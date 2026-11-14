import * as esbuild from 'esbuild';
import type { ProjectFile } from '../../features/projects/types.ts';
import { compilePreviewWithEsbuild } from './esbuild-preview.ts';
import {
  validateAgainstContract,
  type TemplateContract,
} from './template-contracts.ts';

export interface AstDiagnostic {
  filePath: string;
  message: string;
  line?: number;
  column?: number;
}

export interface AstAndCompileValidation {
  ok: boolean;
  diagnostics: AstDiagnostic[];
  contractErrors: string[];
  bundleError: string | null;
  previewHtml: string | null;
  errorSummary: string;
}

export interface SelfHealingResult {
  healed: boolean;
  attempts: number;
  files: ProjectFile[];
  previewHtml: string | null;
  remainingError: string | null;
  healingLog: string[];
}

function normalizePath(p: string): string {
  return p.replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '');
}

/**
 * Runs per-file AST/syntax transform + contract enforcement + full esbuild bundle check.
 */
export async function validateAstAndCompile(
  files: ProjectFile[],
  contract?: TemplateContract | null,
  title = 'Live Preview'
): Promise<AstAndCompileValidation> {
  const normalized = files.map((f) => ({ ...f, path: normalizePath(f.path) }));
  const diagnostics: AstDiagnostic[] = [];
  const contractErrors: string[] = [];

  if (contract) {
    const contractCheck = validateAgainstContract(normalized, contract);
    if (!contractCheck.valid) {
      contractErrors.push(...contractCheck.errors);
    }
  }

  // Per-file AST / syntax validation via esbuild.transform
  for (const file of normalized) {
    if (!/\.(tsx|ts|jsx|js)$/i.test(file.path)) continue;
    const loader: esbuild.Loader = file.path.endsWith('.ts')
      ? 'ts'
      : file.path.endsWith('.jsx')
      ? 'jsx'
      : file.path.endsWith('.js')
      ? 'js'
      : 'tsx';
    try {
      await esbuild.transform(file.content, {
        loader,
        jsx: 'automatic',
        sourcefile: file.path,
      });
    } catch (err) {
      const failure = err as {
        errors?: Array<{
          text: string;
          location?: { file?: string; line?: number; column?: number } | null;
        }>;
        message?: string;
      };
      if (Array.isArray(failure.errors) && failure.errors.length > 0) {
        for (const e of failure.errors) {
          diagnostics.push({
            filePath: file.path,
            message: e.text,
            line: e.location?.line,
            column: e.location?.column,
          });
        }
      } else {
        diagnostics.push({
          filePath: file.path,
          message: failure.message ?? 'AST syntax check failed',
        });
      }
    }
  }

  // Full cross-file bundle verification
  const compiled = await compilePreviewWithEsbuild(normalized, title);
  const bundleError = compiled.error;

  const summaryParts: string[] = [];
  for (const err of contractErrors) {
    summaryParts.push(`[Schema] ${err}`);
  }
  for (const diag of diagnostics) {
    const loc = diag.line ? `:${diag.line}${diag.column !== undefined ? `:${diag.column}` : ''}` : '';
    summaryParts.push(`[AST] ${diag.filePath}${loc} -> ${diag.message}`);
  }
  if (bundleError && diagnostics.length === 0) {
    summaryParts.push(`[Bundle] ${bundleError}`);
  }

  const ok = contractErrors.length === 0 && diagnostics.length === 0 && !bundleError;

  return {
    ok,
    diagnostics,
    contractErrors,
    bundleError,
    previewHtml: compiled.html,
    errorSummary: summaryParts.join('\n'),
  };
}

/**
 * Deterministic safety-net fixer for common LLM mistakes (stray fences, missing default export,
 * missing React import, unresolved relative imports, or malformed JSON).
 */
export function applyDeterministicAstRepair(
  files: ProjectFile[],
  errorSummary: string
): ProjectFile[] {
  const filePaths = new Set(files.map((f) => normalizePath(f.path)));

  return files.map((file) => {
    const normPath = normalizePath(file.path);
    let content = file.content;
    let changed = false;

    // 1. Strip accidental markdown code fences emitted inside JSON string
    if (/^\s*```[a-zA-Z]*\n/.test(content) || /\n```\s*$/.test(content)) {
      content = content.replace(/^\s*```[a-zA-Z]*\n/, '').replace(/\n```\s*$/, '');
      changed = true;
    }

    // 2. Fix package.json malformed JSON if broken
    if (normPath === 'package.json') {
      try {
        JSON.parse(content);
      } catch {
        content = JSON.stringify(
          {
            name: 'urself-site',
            private: true,
            type: 'module',
            scripts: { dev: 'vite', build: 'vite build' },
            dependencies: { react: '^19.0.0', 'react-dom': '^19.0.0', 'lucide-react': '^0.546.0' },
          },
          null,
          2
        );
        changed = true;
      }
    }

    // 3. Comment out non-existent relative/CSS imports reported by compiler
    if (/\.(tsx|ts|jsx|js)$/i.test(normPath)) {
      const importLines = content.split('\n');
      const repairedLines = importLines.map((line) => {
        const m = line.match(/^\s*import\s+[\s\S]*?from\s+['"](\.[^'"]+|@\/[^'"]+)['"]\s*;?/);
        if (!m) return line;
        const spec = m[1];
        if (spec.endsWith('.css')) return line;
        const cleanSpec = spec.replace(/^\.\//, 'src/').replace(/^@\//, '');
        const exists =
          filePaths.has(cleanSpec) ||
          filePaths.has(`${cleanSpec}.tsx`) ||
          filePaths.has(`${cleanSpec}.ts`) ||
          filePaths.has(`${cleanSpec}.jsx`) ||
          filePaths.has(spec.replace(/^\.\//, ''));
        if (!exists && errorSummary.includes(spec)) {
          changed = true;
          return `// [self-healed missing import] ${line}`;
        }
        return line;
      });
      if (changed) {
        content = repairedLines.join('\n');
      }

      // 4. Ensure src/App.tsx has a default export if function App exists without default
      if (
        (normPath === 'src/App.tsx' || normPath === 'src/App.jsx') &&
        !/export\s+default\s+/.test(content)
      ) {
        if (/function\s+App\b/.test(content)) {
          content = content.replace(/\bfunction\s+App\b/, 'export default function App');
          changed = true;
        } else if (/\bconst\s+App\b/.test(content)) {
          content = `${content}\nexport default App;\n`;
          changed = true;
        }
      }

      // 5. Close simple trailing unclosed component block in JSX if reported at EOF
      if (
        (errorSummary.includes('Unexpected end of file') ||
          errorSummary.includes('Expected "}"')) &&
        !content.trimEnd().endsWith('}')
      ) {
        const openBraces = (content.match(/\{/g) ?? []).length;
        const closeBraces = (content.match(/\}/g) ?? []).length;
        if (openBraces > closeBraces && openBraces - closeBraces <= 3) {
          content = `${content.trimEnd()}\n${'}'.repeat(openBraces - closeBraces)}\n`;
          changed = true;
        }
      }
    }

    return changed
      ? { ...file, path: normPath, content, version: file.version + 1 }
      : { ...file, path: normPath };
  });
}

export type RepairWithLlmFn = (params: {
  prompt: string;
  files: ProjectFile[];
  errorSummary: string;
  attempt: number;
}) => Promise<ProjectFile[] | null>;

/**
 * Self-Healing Validation & Automated Repair Loop (max 3 attempts).
 */
export async function runSelfHealingLoop(options: {
  prompt: string;
  initialFiles: ProjectFile[];
  contract?: TemplateContract | null;
  title?: string;
  maxAttempts?: number;
  repairWithLlm?: RepairWithLlmFn;
  onAttempt?: (info: { attempt: number; maxAttempts: number; errorSummary: string }) => void;
}): Promise<SelfHealingResult> {
  const maxAttempts = Math.max(1, Math.min(3, options.maxAttempts ?? 3));
  let workingFiles = options.initialFiles.map((f) => ({ ...f }));
  const healingLog: string[] = [];

  for (let attempt = 0; attempt <= maxAttempts; attempt += 1) {
    const check = await validateAstAndCompile(
      workingFiles,
      options.contract,
      options.title ?? 'Live Preview'
    );

    if (check.ok) {
      return {
        healed: true,
        attempts: attempt,
        files: workingFiles,
        previewHtml: check.previewHtml,
        remainingError: null,
        healingLog,
      };
    }

    if (attempt === maxAttempts) {
      healingLog.push(`Attempt ${attempt}: Failed with remaining error: ${check.errorSummary}`);
      return {
        healed: false,
        attempts: attempt,
        files: workingFiles,
        previewHtml: null,
        remainingError: check.errorSummary,
        healingLog,
      };
    }

    const nextAttempt = attempt + 1;
    healingLog.push(`Attempt ${nextAttempt}: Detected compiler/schema error -> ${check.errorSummary}`);
    options.onAttempt?.({
      attempt: nextAttempt,
      maxAttempts,
      errorSummary: check.errorSummary,
    });

    let repaired: ProjectFile[] | null = null;
    if (options.repairWithLlm) {
      try {
        repaired = await options.repairWithLlm({
          prompt: options.prompt,
          files: workingFiles,
          errorSummary: check.errorSummary,
          attempt: nextAttempt,
        });
      } catch {
        repaired = null;
      }
    }

    if (repaired && repaired.length > 0) {
      workingFiles = repaired;
    } else {
      workingFiles = applyDeterministicAstRepair(workingFiles, check.errorSummary);
    }
  }

  return {
    healed: false,
    attempts: maxAttempts,
    files: workingFiles,
    previewHtml: null,
    remainingError: 'Self-healing exhausted maximum retry budget.',
    healingLog,
  };
}
