import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ProjectStore } from './project-store.ts';

function makeTempStorePath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'urself-store-'));
  return path.join(dir, 'workspaces.json');
}

test('ProjectStore initializes from initialPrompt with derived brand name, queued promptState, and persists to disk', () => {
  const storePath = makeTempStorePath();
  const store1 = new ProjectStore(storePath);

  const created = store1.createProject({
    initialPrompt: 'Build a minimalist portfolio website for Studio Lentera',
  });

  assert.equal(created.project.name, 'Studio Lentera');
  assert.equal(created.project.status, 'draft');
  assert.equal(created.project.initialPrompt, 'Build a minimalist portfolio website for Studio Lentera');
  assert.equal(created.promptState.phase, 'queued');
  assert.equal(
    created.promptState.activePrompt,
    'Build a minimalist portfolio website for Studio Lentera'
  );
  assert.ok(created.files.some((f) => f.path === 'src/App.tsx'));

  // Reload from disk with a brand new ProjectStore instance
  const store2 = new ProjectStore(storePath);
  const loaded = store2.getProjectWithFiles(created.project.id);
  assert.ok(loaded);
  assert.equal(loaded.name, 'Studio Lentera');
  assert.equal(loaded.promptState.phase, 'queued');
  assert.equal(loaded.fileCount, 2);

  const draftBranch = store2.branchProject(created.project.id, 'Studio Lentera — Alt');
  assert.equal(draftBranch?.project.status, 'draft');
  assert.equal(draftBranch?.promptState.phase, 'idle');

  fs.rmSync(path.dirname(storePath), { recursive: true, force: true });
});

test('ProjectStore manages rename, promptState transitions, recovery, and workspace branching', () => {
  const storePath = makeTempStorePath();
  const store = new ProjectStore(storePath);

  const renamed = store.updateWorkspace('mock-1', { name: 'Kopi Senja v2' });
  assert.equal(renamed?.project.name, 'Kopi Senja v2');

  const branch = store.branchProject('mock-1', 'Kopi Senja — Dark Variant');
  assert.ok(branch);
  assert.equal(branch.project.name, 'Kopi Senja — Dark Variant');
  assert.equal(branch.project.branchedFromId, 'mock-1');
  assert.equal(branch.project.branchedFromName, 'Kopi Senja v2');
  assert.equal(branch.promptState.phase, 'idle');
  assert.ok(branch.files.length >= 2);

  // Simulate an interrupted active stream saved on disk
  store.setPromptState(branch.project.id, {
    phase: 'deepseek_code',
    activePrompt: 'Add roast subscription pricing',
    activeAgent: 'deepseek',
  });
  store.updateWorkspace(branch.project.id, { status: 'generating' });

  const reloaded = new ProjectStore(storePath);
  const recovered = reloaded.getProjectWithFiles(branch.project.id);
  assert.equal(recovered?.status, 'failed');
  assert.equal(recovered?.promptState.phase, 'failed');
  assert.ok(recovered?.promptState.lastError?.includes('interrupted'));

  const reset = reloaded.resetPromptState(branch.project.id);
  assert.equal(reset?.promptState.phase, 'completed');
  assert.equal(reset?.promptState.lastError, null);
  assert.equal(reset?.project.status, 'ready');

  fs.rmSync(path.dirname(storePath), { recursive: true, force: true });
});

test('ProjectStore labels revisions, rolls back workspace files, and persists revision history to disk', () => {
  const storePath = makeTempStorePath();
  const store1 = new ProjectStore(storePath);

  const initialDetail = store1.getProjectWithFiles('mock-1');
  assert.ok(initialDetail);
  assert.equal(initialDetail.revisions.length, 1);
  const v1Id = initialDetail.revisions[0].id;

  store1.labelRevision('mock-1', v1Id, 'Pre-refactor baseline');
  store1.updateWorkspace('mock-1', {
    files: [
      { path: 'src/App.tsx', content: 'export default function App() { return <div>Broken AI code</div>; }', version: 4 },
      { path: 'package.json', content: '{"name":"mock-1"}', version: 1 },
    ],
    revisionMeta: {
      summary: 'Experimental AI pass',
      source: 'ai-generation',
      agent: 'deepseek',
      prompt: 'Make it experimental',
    },
  });

  const afterEdit = store1.getProjectWithFiles('mock-1');
  assert.equal(afterEdit?.revisions.length, 2);
  assert.equal(afterEdit?.revisions[1].label, 'Pre-refactor baseline');

  const rolled = store1.rollbackToRevision('mock-1', v1Id);
  assert.ok(rolled);
  assert.equal(rolled.revisions.length, 3);
  assert.equal(rolled.revisions[0].source, 'rollback');
  assert.equal(rolled.revisions[0].label, 'Rollback to v1');

  // Verify persistence across fresh ProjectStore reload
  const store2 = new ProjectStore(storePath);
  const reloaded = store2.getProjectWithFiles('mock-1');
  assert.equal(reloaded?.revisions.length, 3);
  assert.ok(reloaded?.files.some((f) => f.path === 'src/App.tsx' && f.content.includes('Single-Origin Roasts')));

  fs.rmSync(path.dirname(storePath), { recursive: true, force: true });
});

