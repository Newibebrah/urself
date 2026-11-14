import path from 'node:path';
import * as esbuild from 'esbuild';
import type { ProjectFile } from '../../features/projects/types.ts';

export interface CompiledPreviewOutput {
  html: string | null;
  error: string | null;
  bundledBytes: number;
}

function normalizeVirtualPath(p: string): string {
  return p.replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '');
}

function resolveVirtualFile(
  fileMap: Map<string, ProjectFile>,
  importer: string,
  specifier: string
): string | null {
  const baseDir = importer ? path.posix.dirname(importer) : '';
  const joined = specifier.startsWith('@/')
    ? specifier.slice(2)
    : path.posix.normalize(path.posix.join(baseDir, specifier));

  const candidates = [
    joined,
    `${joined}.tsx`,
    `${joined}.ts`,
    `${joined}.jsx`,
    `${joined}.js`,
    `${joined}/index.tsx`,
    `${joined}/index.ts`,
    `${joined}/index.jsx`,
  ];

  for (const c of candidates) {
    if (fileMap.has(c)) return c;
  }
  return null;
}

export async function compilePreviewWithEsbuild(
  files: ProjectFile[],
  title = 'Live Preview'
): Promise<CompiledPreviewOutput> {
  if (files.length === 0) {
    return { html: null, error: 'No source files provided to esbuild.', bundledBytes: 0 };
  }

  const fileMap = new Map<string, ProjectFile>();
  for (const f of files) {
    fileMap.set(normalizeVirtualPath(f.path), f);
  }

  const entryPath =
    ['src/App.tsx', 'src/App.jsx', 'App.tsx', 'App.jsx'].find((p) => fileMap.has(p)) ??
    files.find((f) => /\.(tsx|jsx)$/.test(f.path))?.path;

  if (!entryPath) {
    return { html: null, error: 'Missing src/App.tsx or src/App.jsx entry component.', bundledBytes: 0 };
  }

  const virtualEntry = `__urself_entry__.tsx`;
  const entryBootstrap = `import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './${normalizeVirtualPath(entryPath).replace(/\.(tsx|jsx|ts|js)$/, '')}';

const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(<App />);
}
`;

  const collectedCss: string[] = [];

  const virtualPlugin: esbuild.Plugin = {
    name: 'urself-vfs',
    setup(build) {
      build.onResolve({ filter: /.*/ }, (args) => {
        if (args.path === virtualEntry) {
          return { path: virtualEntry, namespace: 'urself-vfs' };
        }
        if (args.path.startsWith('.') || args.path.startsWith('@/')) {
          const importerPath = args.importer === virtualEntry ? '' : normalizeVirtualPath(args.importer);
          const resolved = resolveVirtualFile(fileMap, importerPath, args.path);
          if (resolved) {
            return { path: resolved, namespace: 'urself-vfs' };
          }
          if (args.path.endsWith('.css')) {
            return { path: args.path, namespace: 'urself-css-noop' };
          }
        }
        return undefined;
      });

      build.onLoad({ filter: /.*/, namespace: 'urself-css-noop' }, () => ({
        contents: '',
        loader: 'js',
      }));

      build.onLoad({ filter: /.*/, namespace: 'urself-vfs' }, (args) => {
        if (args.path === virtualEntry) {
          return {
            contents: entryBootstrap,
            loader: 'tsx',
            resolveDir: process.cwd(),
          };
        }
        const file = fileMap.get(args.path);
        if (!file) {
          return { errors: [{ text: `Virtual file not found: ${args.path}` }] };
        }
        const ext = path.posix.extname(args.path).toLowerCase();
        if (ext === '.css') {
          const cleanedCss = file.content
            .replace(/@import\s+["']tailwindcss["'];?/gi, '')
            .replace(/@tailwind\s+[^;]+;/gi, '')
            .trim();
          if (cleanedCss) collectedCss.push(cleanedCss);
          return { contents: '', loader: 'js' };
        }
        const loader: esbuild.Loader =
          ext === '.ts'
            ? 'ts'
            : ext === '.jsx'
            ? 'jsx'
            : ext === '.js'
            ? 'js'
            : ext === '.json'
            ? 'json'
            : 'tsx';
        return {
          contents: file.content,
          loader,
          resolveDir: process.cwd(),
        };
      });
    },
  };

  try {
    const result = await esbuild.build({
      entryPoints: [virtualEntry],
      bundle: true,
      write: false,
      logLevel: 'silent',
      format: 'iife',
      platform: 'browser',
      target: ['es2020'],
      minify: true,
      jsx: 'automatic',
      define: {
        'process.env.NODE_ENV': '"production"',
      },
      plugins: [virtualPlugin],
      absWorkingDir: process.cwd(),
    });

    const jsOutput = result.outputFiles?.[0]?.text ?? '';
    const safeTitle = title.replace(/[<>&"]/g, '');
    const safeJs = jsOutput.replace(/<\/script>/gi, '<\\/script>');
    const extraStyleTag =
      collectedCss.length > 0
        ? `<style>${collectedCss.join('\n').replace(/<\/style>/gi, '<\\/style>')}</style>`
        : '';

    const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${safeTitle}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    ${extraStyleTag}
  </head>
  <body class="bg-[#FAFAFA] text-slate-900 antialiased">
    <div id="root"></div>
    <script>
      window.addEventListener('error', function (ev) {
        var root = document.getElementById('root');
        if (root && !root.innerHTML) {
          root.innerHTML = '<div style="padding:24px;font-family:monospace;color:#b91c1c;">Runtime error: ' + String(ev.message) + '</div>';
        }
      });
    </script>
    <script>${safeJs}</script>
  </body>
</html>`;

    return {
      html,
      error: null,
      bundledBytes: jsOutput.length,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'esbuild compilation failed';
    return {
      html: null,
      error: message,
      bundledBytes: 0,
    };
  }
}
