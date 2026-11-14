import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PROJECT_FILES } from './mock';
import { buildComponentTree, validateProjectForExport } from './project-inspector';
import { buildZipExportProgressSnapshot, runZipExportPipeline } from './zip-export';
import type { ProjectFile } from './types';

test('buildComponentTree parses imported child components, local components, hooks, and support files', () => {
  const files: ProjectFile[] = [
    {
      path: 'src/App.tsx',
      version: 2,
      content: `import React, { useState } from 'react';
import { BrandMark, DESIGN_TOKENS } from './components/BrandAssets';
import ShowcaseGrid, { type CraftPiece } from './components/ShowcaseGrid';

const TAG = DESIGN_TOKENS.brandName;
export type { CraftPiece };

function FooterNote() {
  return <footer>Built clean · {TAG}</footer>;
}

export default function App() {
  const [tab, setTab] = useState('all');
  return (
    <main>
      <BrandMark />
      <ShowcaseGrid tab={tab} />
      <FooterNote />
    </main>
  );
}`,
    },
    {
      path: 'src/components/BrandAssets.tsx',
      version: 1,
      content: `export function BrandMark() {
  return <span>Atelier</span>;
}`,
    },
    {
      path: 'src/components/ShowcaseGrid.tsx',
      version: 1,
      content: `import { useMemo } from 'react';
export default function ShowcaseGrid() {
  const items = useMemo(() => [1, 2], []);
  return <div>{items.length}</div>;
}`,
    },
    {
      path: 'package.json',
      version: 1,
      content: '{"name":"atelier-senja","private":true,"scripts":{"build":"vite build"}}',
    },
  ];

  const tree = buildComponentTree(files);
  assert.equal(tree.totalFiles, 4);
  assert.equal(tree.rootNodes.length, 1);

  const root = tree.rootNodes[0];
  assert.equal(root.name, 'App');
  assert.equal(root.kind, 'entry');
  assert.deepEqual(root.hooks, ['useState']);
  assert.equal(root.children.length, 3);
  assert.equal(root.children[0].name, 'BrandMark');
  assert.equal(root.children[0].filePath, 'src/components/BrandAssets.tsx');
  assert.equal(root.children[1].name, 'ShowcaseGrid');
  assert.deepEqual(root.children[1].hooks, ['useMemo']);
  assert.equal(root.children[2].name, 'FooterNote');
  assert.equal(root.children[2].kind, 'local-component');
  assert.equal(tree.supportFiles.length, 1);
  assert.equal(tree.supportFiles[0].filePath, 'package.json');
});

test('buildComponentTree handles cyclic imports safely without infinite recursion', () => {
  const cyclicFiles: ProjectFile[] = [
    {
      path: 'src/App.tsx',
      version: 1,
      content: `import { NodeB } from './NodeB';
export default function App() { return <NodeB />; }`,
    },
    {
      path: 'src/NodeB.tsx',
      version: 1,
      content: `import App from './App';
export function NodeB() { return <App />; }`,
    },
  ];

  const tree = buildComponentTree(cyclicFiles);
  assert.equal(tree.rootNodes.length, 1);
  assert.equal(tree.rootNodes[0].children[0].name, 'NodeB');
  assert.equal(tree.rootNodes[0].children[0].children.length, 0);
});

test('validateProjectForExport passes on DEFAULT_PROJECT_FILES with advisory Vite bootstrap warning', () => {
  const result = validateProjectForExport(DEFAULT_PROJECT_FILES, 'react-vite');
  assert.equal(result.valid, true);
  assert.equal(result.errorCount, 0);
  assert.ok(result.warningCount >= 1);
  assert.equal(result.checks.find((c) => c.id === 'entry-component')?.status, 'pass');
  assert.equal(result.checks.find((c) => c.id === 'package-json')?.status, 'pass');
});

test('validateProjectForExport detects malformed package.json, missing default export, unbalanced braces, and broken imports', () => {
  const brokenFiles: ProjectFile[] = [
    {
      path: 'src/App.tsx',
      version: 1,
      content: `import { MissingCard } from './components/MissingCard';
function App() {
  return <MissingCard />;`,
    },
    {
      path: 'package.json',
      version: 1,
      content: '{ "name": "broken-app", ',
    },
  ];

  const result = validateProjectForExport(brokenFiles, 'react-vite');
  assert.equal(result.valid, false);
  assert.ok(result.errorCount >= 4);
  assert.equal(result.checks.find((c) => c.id === 'entry-component')?.status, 'fail');
  assert.equal(result.checks.find((c) => c.id === 'package-json')?.status, 'fail');
  assert.equal(result.checks.find((c) => c.id === 'syntax-src/App.tsx')?.status, 'fail');
  assert.equal(result.checks.find((c) => c.id === 'relative-imports')?.status, 'fail');
});

test('runZipExportPipeline tracks Validating Project, Bundling Assets, and Generating Archive stages monotonically', async () => {
  const seenStates: ReturnType<typeof buildZipExportProgressSnapshot>[] = [];
  let savedDirty = false;
  let downloadedFile = '';
  let downloadedSize = 0;

  const res = await runZipExportPipeline({
    projectName: 'Kopi Senja',
    framework: 'react-vite',
    files: DEFAULT_PROJECT_FILES,
    dirtyFiles: true,
    exportUrl: '/api/projects/mock-1/export',
    stepDelayMs: 0,
    onProgress: (state) => {
      seenStates.push(state);
    },
    saveWorkspaceFiles: async () => {
      savedDirty = true;
    },
    verifyBundle: async () => ({ error: null }),
    fetchImpl: async () =>
      new Response(new Uint8Array([80, 75, 3, 4, 10, 20]), {
        status: 200,
        headers: {
          'content-type': 'application/zip',
          'content-length': '6',
          'content-disposition': 'attachment; filename="kopi-senja.zip"',
        },
      }),
    downloadBlob: (blob, fileName) => {
      downloadedFile = fileName;
      downloadedSize = blob.size;
    },
  });

  assert.equal(res.ok, true);
  assert.equal(savedDirty, true);
  assert.equal(downloadedFile, 'kopi-senja.zip');
  assert.equal(downloadedSize, 6);

  const stageNames = seenStates.map((s) => s.activeStage);
  assert.ok(stageNames.includes('validating'));
  assert.ok(stageNames.includes('bundling'));
  assert.ok(stageNames.includes('archiving'));

  const finalState = seenStates[seenStates.length - 1];
  assert.equal(finalState.percent, 100);
  assert.equal(finalState.completed, true);
  assert.deepEqual(
    finalState.steps.map((s) => s.label),
    ['Validating Project', 'Bundling Assets', 'Generating Archive']
  );
  assert.ok(finalState.steps.every((s) => s.status === 'completed'));
});

test('runZipExportPipeline surfaces Bundling Assets compiler error cleanly', async () => {
  const seenStates: ReturnType<typeof buildZipExportProgressSnapshot>[] = [];
  const res = await runZipExportPipeline({
    projectName: 'Kopi Senja',
    framework: 'react-vite',
    files: DEFAULT_PROJECT_FILES,
    dirtyFiles: false,
    exportUrl: '/api/projects/mock-1/export',
    stepDelayMs: 0,
    onProgress: (state) => {
      seenStates.push(state);
    },
    verifyBundle: async () => ({ error: 'SyntaxError in src/App.tsx' }),
  });

  assert.equal(res.ok, false);
  const last = seenStates[seenStates.length - 1];
  assert.equal(last.activeStage, 'bundling');
  assert.ok(last.error && last.error.includes('SyntaxError'));
  assert.equal(last.steps[0].status, 'completed');
  assert.equal(last.steps[1].status, 'error');
  assert.equal(last.steps[2].status, 'pending');
});
