import type { Framework, ProjectFile } from './types';

export type ComponentNodeKind = 'entry' | 'component' | 'local-component' | 'config' | 'style';

export interface ComponentTreeNode {
  id: string;
  name: string;
  filePath: string;
  kind: ComponentNodeKind;
  hooks: string[];
  children: ComponentTreeNode[];
}

export interface ComponentTreeResult {
  rootNodes: ComponentTreeNode[];
  supportFiles: ComponentTreeNode[];
  totalComponents: number;
  totalFiles: number;
}

export type ValidationCheckStatus = 'pass' | 'warning' | 'fail';

export interface ExportValidationCheck {
  id: string;
  label: string;
  status: ValidationCheckStatus;
  filePath?: string;
  detail: string;
}

export interface ExportValidationResult {
  valid: boolean;
  framework: Framework;
  checks: ExportValidationCheck[];
  errorCount: number;
  warningCount: number;
}

function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '');
}

function resolveImportPath(
  fileMap: Map<string, ProjectFile>,
  importerPath: string,
  specifier: string
): string | null {
  if (!specifier.startsWith('.') && !specifier.startsWith('@/')) {
    return null;
  }

  const baseDir = importerPath.includes('/')
    ? importerPath.slice(0, importerPath.lastIndexOf('/'))
    : '';

  let rawJoined = '';
  if (specifier.startsWith('@/')) {
    rawJoined = specifier.slice(2);
  } else {
    const parts = baseDir ? baseDir.split('/') : [];
    for (const seg of specifier.split('/')) {
      if (!seg || seg === '.') continue;
      if (seg === '..') {
        parts.pop();
      } else {
        parts.push(seg);
      }
    }
    rawJoined = parts.join('/');
  }

  const clean = normalizePath(rawJoined);
  const candidates = [
    clean,
    `${clean}.tsx`,
    `${clean}.ts`,
    `${clean}.jsx`,
    `${clean}.js`,
    `${clean}/index.tsx`,
    `${clean}/index.ts`,
    `${clean}/index.jsx`,
    `${clean}/index.js`,
  ];

  for (const candidate of candidates) {
    if (fileMap.has(candidate)) {
      return candidate;
    }
  }
  return null;
}

function stripCommentsAndStrings(source: string): string {
  let out = '';
  let i = 0;
  while (i < source.length) {
    const ch = source[i];
    const next = source[i + 1];

    // Single-line comment
    if (ch === '/' && next === '/') {
      while (i < source.length && source[i] !== '\n') i += 1;
      out += '\n';
      continue;
    }
    // Block comment
    if (ch === '/' && next === '*') {
      i += 2;
      while (i < source.length && !(source[i] === '*' && source[i + 1] === '/')) i += 1;
      i += 2;
      continue;
    }
    // Quoted strings (single/double)
    if (ch === '"' || ch === "'") {
      const quote = ch;
      out += '""';
      i += 1;
      while (i < source.length && source[i] !== quote) {
        if (source[i] === '\\') i += 2;
        else i += 1;
      }
      i += 1;
      continue;
    }
    // Backtick template literal (preserve `${...}` brace balance roughly by blanking plain text)
    if (ch === '`') {
      out += '""';
      i += 1;
      while (i < source.length && source[i] !== '`') {
        if (source[i] === '\\') {
          i += 2;
          continue;
        }
        if (source[i] === '$' && source[i + 1] === '{') {
          out += '${';
          i += 2;
          let depth = 1;
          while (i < source.length && depth > 0) {
            if (source[i] === '{') depth += 1;
            else if (source[i] === '}') depth -= 1;
            out += source[i];
            i += 1;
          }
          continue;
        }
        i += 1;
      }
      i += 1;
      continue;
    }

    out += ch;
    i += 1;
  }
  return out;
}

function hasBalancedDelimiters(source: string): { ok: boolean; mismatch?: string } {
  const scrubbed = stripCommentsAndStrings(source);
  const stack: string[] = [];
  const pairs: Record<string, string> = { ')': '(', '}': '{', ']': '[' };

  for (const ch of scrubbed) {
    if (ch === '(' || ch === '{' || ch === '[') {
      stack.push(ch);
    } else if (ch === ')' || ch === '}' || ch === ']') {
      const expected = pairs[ch];
      const top = stack.pop();
      if (top !== expected) {
        return {
          ok: false,
          mismatch: top
            ? `Expected closing pair for "${top}" before "${ch}"`
            : `Unexpected closing "${ch}"`,
        };
      }
    }
  }

  if (stack.length > 0) {
    return { ok: false, mismatch: `Unclosed "${stack[stack.length - 1]}" delimiter` };
  }
  return { ok: true };
}

function isReactComponentIdentifier(name: string): boolean {
  // Must start uppercase, contain at least one lowercase letter (excludes UPPER_SNAKE_CASE constants like DESIGN_TOKENS)
  return /^[A-Z][A-Za-z0-9]*$/.test(name) && /[a-z]/.test(name);
}

function extractRelativeImports(source: string): Array<{
  specifier: string;
  importedNames: string[];
  isTypeOnly: boolean;
}> {
  const results: Array<{ specifier: string; importedNames: string[]; isTypeOnly: boolean }> = [];
  const importRegex = /^\s*import\s+([\s\S]*?)\s+from\s+['"]([^'"]+)['"]\s*;?/gm;
  let match: RegExpExecArray | null;
  while ((match = importRegex.exec(source)) !== null) {
    const clause = match[1].trim();
    const specifier = match[2].trim();
    if (!specifier.startsWith('.') && !specifier.startsWith('@/')) {
      continue;
    }

    // Skip top-level `import type ...`
    if (/^type\s+/.test(clause)) {
      results.push({ specifier, importedNames: [], isTypeOnly: true });
      continue;
    }

    const names: string[] = [];
    let hasValueSpecifier = false;
    const braceMatch = clause.match(/\{([^}]+)\}/);
    if (braceMatch) {
      for (const raw of braceMatch[1].split(',')) {
        const trimmedPart = raw.trim();
        if (!trimmedPart || /^type\s+/.test(trimmedPart)) continue;
        hasValueSpecifier = true;
        const aliasSplit = trimmedPart.split(/\s+as\s+/);
        const usedName = (aliasSplit[1] ?? aliasSplit[0]).trim();
        if (usedName && isReactComponentIdentifier(usedName)) {
          names.push(usedName);
        }
      }
    }
    const beforeBrace = clause.replace(/\{[^}]*\}/, '').replace(/,/g, '').trim();
    if (beforeBrace) {
      hasValueSpecifier = true;
      if (!beforeBrace.startsWith('*') && isReactComponentIdentifier(beforeBrace)) {
        names.push(beforeBrace);
      }
    }

    results.push({ specifier, importedNames: names, isTypeOnly: !hasValueSpecifier });
  }
  return results;
}

function extractPrimaryComponentName(filePath: string, content: string): string {
  const defaultFnMatch = content.match(/export\s+default\s+function\s+([A-Z][A-Za-z0-9_]*)/);
  if (defaultFnMatch?.[1]) return defaultFnMatch[1];

  const namedExportFn = content.match(/export\s+(?:function|const)\s+([A-Z][A-Za-z0-9_]*)/);
  if (namedExportFn?.[1]) return namedExportFn[1];

  const baseName = filePath.split('/').pop()?.replace(/\.(tsx|ts|jsx|js)$/, '') ?? filePath;
  return baseName.charAt(0).toUpperCase() + baseName.slice(1);
}

function extractLocalSubcomponents(content: string, primaryName: string): string[] {
  const names = new Set<string>();
  const fnRegex = /(?:^|\n)\s*(?:export\s+)?function\s+([A-Z][A-Za-z0-9_]*)\s*\(/g;
  const arrowRegex = /(?:^|\n)\s*(?:export\s+)?const\s+([A-Z][A-Za-z0-9_]*)\s*=\s*(?:\([^)]*\)|[A-Za-z0-9_]+)\s*=>/g;

  let m: RegExpExecArray | null;
  while ((m = fnRegex.exec(content)) !== null) {
    if (m[1] && m[1] !== primaryName) names.add(m[1]);
  }
  while ((m = arrowRegex.exec(content)) !== null) {
    if (m[1] && m[1] !== primaryName) names.add(m[1]);
  }

  // Only keep local components actually rendered via JSX `<Name`
  const used: string[] = [];
  for (const name of names) {
    if (new RegExp(`<${name}(?:\\s|>|/)`).test(content)) {
      used.push(name);
    }
  }
  return used;
}

function extractUsedHooks(content: string): string[] {
  const hooks = new Set<string>();
  const hookRegex = /\b(use(?:State|Effect|Memo|Callback|Ref|Reducer|Context))\s*(?:<[^>]+>)?\(/g;
  let m: RegExpExecArray | null;
  while ((m = hookRegex.exec(content)) !== null) {
    if (m[1]) hooks.add(m[1]);
  }
  return Array.from(hooks);
}

export function buildComponentTree(files: ProjectFile[]): ComponentTreeResult {
  const normalizedFiles = files.map((f) => ({ ...f, path: normalizePath(f.path) }));
  const fileMap = new Map<string, ProjectFile>(normalizedFiles.map((f) => [f.path, f]));

  const isCodeFile = (p: string) => /\.(tsx|jsx|ts|js)$/i.test(p);
  const entryCandidates = ['src/main.tsx', 'src/main.jsx', 'src/App.tsx', 'src/App.jsx', 'App.tsx', 'App.jsx'];
  const rootPath =
    entryCandidates.find((p) => fileMap.has(p)) ??
    normalizedFiles.find((f) => isCodeFile(f.path))?.path ??
    null;

  const visitedPaths = new Set<string>();
  let totalComponents = 0;

  const buildNodeForPath = (
    filePath: string,
    overrideName?: string,
    lineage = new Set<string>(),
    isEntry = false
  ): ComponentTreeNode | null => {
    const file = fileMap.get(filePath);
    if (!file) return null;

    visitedPaths.add(filePath);
    const primaryName = overrideName ?? extractPrimaryComponentName(file.path, file.content);
    const hooks = extractUsedHooks(file.content);
    totalComponents += 1;

    const children: ComponentTreeNode[] = [];
    const nextLineage = new Set(lineage);
    nextLineage.add(filePath);

    // Imported child components
    const relImports = extractRelativeImports(file.content);
    for (const imp of relImports) {
      if (imp.isTypeOnly || imp.specifier.endsWith('.css')) continue;
      const targetPath = resolveImportPath(fileMap, file.path, imp.specifier);
      if (!targetPath || nextLineage.has(targetPath)) continue;

      const importedComponents = imp.importedNames.filter((n) => /^[A-Z]/.test(n));
      if (importedComponents.length > 0) {
        for (const compName of importedComponents) {
          const childNode = buildNodeForPath(targetPath, compName, nextLineage, false);
          if (childNode) {
            children.push({
              ...childNode,
              id: `${filePath}->${targetPath}#${compName}`,
            });
          }
        }
      } else {
        const childNode = buildNodeForPath(targetPath, undefined, nextLineage, false);
        if (childNode) {
          children.push(childNode);
        }
      }
    }

    // Inline local PascalCase components rendered inside this file
    const locals = extractLocalSubcomponents(file.content, primaryName);
    for (const localName of locals) {
      totalComponents += 1;
      children.push({
        id: `${filePath}#local:${localName}`,
        name: localName,
        filePath: file.path,
        kind: 'local-component',
        hooks: [],
        children: [],
      });
    }

    return {
      id: `node:${filePath}:${primaryName}`,
      name: primaryName,
      filePath: file.path,
      kind: isEntry ? 'entry' : 'component',
      hooks,
      children,
    };
  };

  const rootNodes: ComponentTreeNode[] = [];
  if (rootPath) {
    const rootNode = buildNodeForPath(rootPath, undefined, new Set(), true);
    if (rootNode) {
      rootNodes.push(rootNode);
    }
  }

  // Any remaining code files not reachable from entry point
  for (const file of normalizedFiles) {
    if (isCodeFile(file.path) && !visitedPaths.has(file.path)) {
      const orphan = buildNodeForPath(file.path, undefined, new Set(), false);
      if (orphan) {
        rootNodes.push(orphan);
      }
    }
  }

  const supportFiles: ComponentTreeNode[] = normalizedFiles
    .filter((f) => !isCodeFile(f.path))
    .map((f) => ({
      id: `support:${f.path}`,
      name: f.path,
      filePath: f.path,
      kind: f.path.endsWith('.css') ? 'style' : 'config',
      hooks: [],
      children: [],
    }));

  return {
    rootNodes,
    supportFiles,
    totalComponents,
    totalFiles: normalizedFiles.length,
  };
}

export function validateProjectForExport(
  files: ProjectFile[],
  framework: Framework = 'react-vite'
): ExportValidationResult {
  const normalized = files.map((f) => ({ ...f, path: normalizePath(f.path) }));
  const fileMap = new Map<string, ProjectFile>(normalized.map((f) => [f.path, f]));
  const checks: ExportValidationCheck[] = [];

  if (normalized.length === 0) {
    checks.push({
      id: 'non-empty-workspace',
      label: 'Workspace files present',
      status: 'fail',
      detail: 'No files exist in this workspace to export.',
    });
    return {
      valid: false,
      framework,
      checks,
      errorCount: 1,
      warningCount: 0,
    };
  }

  // 1. Entry component check (react-vite requires App.tsx or App.jsx)
  const appPath = ['src/App.tsx', 'src/App.jsx', 'App.tsx', 'App.jsx'].find((p) =>
    fileMap.has(p)
  );
  if (!appPath) {
    checks.push({
      id: 'entry-component',
      label: 'Root App component (src/App.tsx)',
      status: 'fail',
      filePath: 'src/App.tsx',
      detail: 'Missing src/App.tsx or src/App.jsx entry component required for React + Vite.',
    });
  } else {
    const appFile = fileMap.get(appPath)!;
    const hasDefaultExport =
      /export\s+default\s+/.test(appFile.content) || /export\s*\{[^}]*\bas\s+default\b/.test(appFile.content);
    const hasRenderOutput = /return\s*\(?[\s\S]*</.test(appFile.content) || /React\.createElement/.test(appFile.content);

    if (!appFile.content.trim()) {
      checks.push({
        id: 'entry-component',
        label: `Root App component (${appPath})`,
        status: 'fail',
        filePath: appPath,
        detail: `${appPath} is empty.`,
      });
    } else if (!hasDefaultExport) {
      checks.push({
        id: 'entry-component',
        label: `Root App component (${appPath})`,
        status: 'fail',
        filePath: appPath,
        detail: `${appPath} must include a default export (e.g. "export default function App()").`,
      });
    } else if (!hasRenderOutput) {
      checks.push({
        id: 'entry-component',
        label: `Root App component (${appPath})`,
        status: 'warning',
        filePath: appPath,
        detail: `${appPath} does not appear to return JSX markup.`,
      });
    } else {
      checks.push({
        id: 'entry-component',
        label: `Root App component (${appPath})`,
        status: 'pass',
        filePath: appPath,
        detail: 'Default React entry component exported cleanly.',
      });
    }
  }

  // 2. package.json manifest check
  const pkgFile = fileMap.get('package.json');
  if (!pkgFile) {
    checks.push({
      id: 'package-json',
      label: 'Vite package manifest (package.json)',
      status: 'fail',
      filePath: 'package.json',
      detail: 'Missing package.json required for npm install and Vite build.',
    });
  } else {
    try {
      const parsedPkg = JSON.parse(pkgFile.content) as Record<string, unknown>;
      const scripts =
        parsedPkg.scripts && typeof parsedPkg.scripts === 'object'
          ? (parsedPkg.scripts as Record<string, unknown>)
          : null;
      if (typeof parsedPkg.name !== 'string' || parsedPkg.name.trim().length === 0) {
        checks.push({
          id: 'package-json',
          label: 'Vite package manifest (package.json)',
          status: 'fail',
          filePath: 'package.json',
          detail: 'package.json must contain a non-empty string "name" field.',
        });
      } else if (!scripts || typeof scripts.build !== 'string') {
        checks.push({
          id: 'package-json',
          label: 'Vite package manifest (package.json)',
          status: 'warning',
          filePath: 'package.json',
          detail: 'package.json is valid JSON, but is missing a "scripts.build" command.',
        });
      } else {
        checks.push({
          id: 'package-json',
          label: 'Vite package manifest (package.json)',
          status: 'pass',
          filePath: 'package.json',
          detail: `Valid JSON manifest ("${parsedPkg.name}") with Vite build script.`,
        });
      }
    } catch (err) {
      checks.push({
        id: 'package-json',
        label: 'Vite package manifest (package.json)',
        status: 'fail',
        filePath: 'package.json',
        detail: `Invalid JSON in package.json: ${err instanceof Error ? err.message : 'Parse error'}`,
      });
    }
  }

  // 3. Syntax & formatting checks across source files (.tsx, .ts, .jsx, .js, .json, .css)
  let formattingFailed = false;
  for (const file of normalized) {
    if (file.path === 'package.json') continue;
    if (file.path.endsWith('.json')) {
      try {
        JSON.parse(file.content);
      } catch (err) {
        formattingFailed = true;
        checks.push({
          id: `json-${file.path}`,
          label: `JSON formatting (${file.path})`,
          status: 'fail',
          filePath: file.path,
          detail: `Malformed JSON: ${err instanceof Error ? err.message : 'Parse error'}`,
        });
      }
      continue;
    }

    if (/\.(tsx|ts|jsx|js|css)$/i.test(file.path)) {
      if (file.content.trim().length === 0) {
        formattingFailed = true;
        checks.push({
          id: `empty-${file.path}`,
          label: `Source formatting (${file.path})`,
          status: 'fail',
          filePath: file.path,
          detail: `${file.path} has empty contents.`,
        });
        continue;
      }

      const balanced = hasBalancedDelimiters(file.content);
      if (!balanced.ok) {
        formattingFailed = true;
        checks.push({
          id: `syntax-${file.path}`,
          label: `Delimiter balance (${file.path})`,
          status: 'fail',
          filePath: file.path,
          detail: balanced.mismatch ?? 'Unbalanced braces or parentheses detected.',
        });
      }
    }
  }

  if (!formattingFailed) {
    checks.push({
      id: 'source-formatting',
      label: 'Module syntax & delimiter formatting',
      status: 'pass',
      detail: `Verified balanced syntax across ${normalized.length} workspace file${normalized.length === 1 ? '' : 's'}.`,
    });
  }

  // 4. Relative import resolution check across TS/JSX files
  const missingImports: Array<{ importer: string; specifier: string }> = [];
  for (const file of normalized) {
    if (!/\.(tsx|ts|jsx|js)$/i.test(file.path)) continue;
    for (const imp of extractRelativeImports(file.content)) {
      if (imp.specifier.endsWith('.css')) continue;
      const resolved = resolveImportPath(fileMap, file.path, imp.specifier);
      if (!resolved) {
        missingImports.push({ importer: file.path, specifier: imp.specifier });
      }
    }
  }

  if (missingImports.length > 0) {
    const first = missingImports[0];
    checks.push({
      id: 'relative-imports',
      label: 'Component import graph',
      status: 'fail',
      filePath: first.importer,
      detail: `${first.importer} imports "${first.specifier}", which is not present in this workspace.`,
    });
  } else {
    checks.push({
      id: 'relative-imports',
      label: 'Component import graph',
      status: 'pass',
      detail: 'All relative module imports resolve within the workspace.',
    });
  }

  // 5. Advisory Vite standalone bootstrap check
  const hasHtml = fileMap.has('index.html');
  const hasMain = fileMap.has('src/main.tsx') || fileMap.has('src/main.jsx');
  if (!hasHtml || !hasMain) {
    const missing = [!hasHtml ? 'index.html' : null, !hasMain ? 'src/main.tsx' : null]
      .filter(Boolean)
      .join(' and ');
    checks.push({
      id: 'vite-bootstrap-advisory',
      label: 'Standalone Vite bootstrap files',
      status: 'warning',
      detail: `Optional standalone file(s) (${missing}) are omitted; add them if running locally outside the esbuild sandbox.`,
    });
  } else {
    checks.push({
      id: 'vite-bootstrap-advisory',
      label: 'Standalone Vite bootstrap files',
      status: 'pass',
      detail: 'index.html and src/main.tsx present for local Vite dev/build.',
    });
  }

  const errorCount = checks.filter((c) => c.status === 'fail').length;
  const warningCount = checks.filter((c) => c.status === 'warning').length;

  return {
    valid: errorCount === 0,
    framework,
    checks,
    errorCount,
    warningCount,
  };
}
