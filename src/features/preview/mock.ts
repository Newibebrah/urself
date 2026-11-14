import type { Project, ProjectStatus } from '../projects/types';
import type { BuildPreview } from './types';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildMockPreviewSrcDoc(project: Project, revisionNote?: string): string {
  const safeTitle = escapeHtml(project.name);
  const safeNote = revisionNote ? escapeHtml(revisionNote) : '';

  if (project.status === 'draft') {
    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <script src="https://cdn.tailwindcss.com"></script>
  </head>
  <body class="bg-slate-50 text-slate-900 min-h-screen flex items-center justify-center p-8 font-sans antialiased">
    <div class="max-w-md w-full bg-white border border-slate-200 rounded-xl p-8 text-center">
      <div class="mx-auto h-10 w-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 font-mono text-xs">UI</div>
      <h1 class="mt-4 text-lg font-semibold text-slate-900">${safeTitle}</h1>
      <p class="mt-2 text-sm text-slate-500">Preview will appear here once you send your first build prompt in the chat panel.</p>
    </div>
  </body>
</html>`;
  }

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <script src="https://cdn.tailwindcss.com"></script>
  </head>
  <body class="bg-[#FAFAFA] text-slate-900 font-sans antialiased">
    <header class="border-b border-slate-200 bg-white/90 px-6 py-4 flex items-center justify-between">
      <span class="font-semibold tracking-tight text-sm">${safeTitle}</span>
      <nav class="flex items-center gap-5 text-xs text-slate-500">
        <span>Overview</span>
        <span>Menu</span>
        <span>Contact</span>
      </nav>
    </header>
    <main class="mx-auto max-w-3xl px-6 py-16">
      <p class="text-xs font-medium uppercase tracking-widest text-emerald-600">Preview Environment</p>
      <h1 class="mt-3 text-3xl font-bold tracking-tight text-slate-900">${safeTitle}</h1>
      <p class="mt-3 text-sm text-slate-600 leading-relaxed max-w-xl">
        This interactive sandbox renders your generated React + Vite build output. Edit layout copy, sections, or styles using the chat input on the left.
      </p>
      ${
        safeNote
          ? `<div class="mt-5 rounded-lg border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-xs text-emerald-900">
              Latest prompt applied: <span class="font-medium">${safeNote}</span>
            </div>`
          : ''
      }
      <div class="mt-8 flex items-center gap-3">
        <button class="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-medium text-white">Primary Action</button>
        <button class="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700">Learn More</button>
      </div>
      <div class="mt-12 grid grid-cols-3 gap-4">
        <div class="rounded-xl border border-slate-200 bg-white p-4">
          <div class="text-xs font-medium text-slate-500">Component 01</div>
          <div class="mt-1 text-sm font-semibold text-slate-900">Hero Showcase</div>
        </div>
        <div class="rounded-xl border border-slate-200 bg-white p-4">
          <div class="text-xs font-medium text-slate-500">Component 02</div>
          <div class="mt-1 text-sm font-semibold text-slate-900">Feature Grid</div>
        </div>
        <div class="rounded-xl border border-slate-200 bg-white p-4">
          <div class="text-xs font-medium text-slate-500">Component 03</div>
          <div class="mt-1 text-sm font-semibold text-slate-900">Contact Footer</div>
        </div>
      </div>
    </main>
  </body>
</html>`;
}

export const buildMockPreview: BuildPreview = async ({ files }) => {
  if (files.length === 0) {
    return { htmlUrl: null, error: 'No source files to bundle.' };
  }
  const placeholderProject: Project = {
    id: 'preview',
    name: 'Live Preview',
    framework: 'react-vite',
    status: 'ready' as ProjectStatus,
    updatedAt: new Date().toISOString(),
  };
  const blob = new Blob([buildMockPreviewSrcDoc(placeholderProject)], { type: 'text/html' });
  return { htmlUrl: URL.createObjectURL(blob), error: null };
};
