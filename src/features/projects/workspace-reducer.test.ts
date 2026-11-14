import test from 'node:test';
import assert from 'node:assert/strict';
import {
  INITIAL_WORKSPACE_STATE,
  areFileListsEqual,
  computeRevisionDiffStats,
  createInitialLifecycle,
  createSeedRevision,
  workspaceReducer,
  type ProjectWorkspaceDetail,
} from './workspace-reducer.ts';
import type { ProjectFile } from './types.ts';

function makeDetail(id = 'prj-1'): ProjectWorkspaceDetail {
  const seedFiles: ProjectFile[] = [
    { path: 'src/App.tsx', content: 'export default function App() { return <h1>v1</h1>; }', version: 1 },
    { path: 'package.json', content: '{"name":"prj-1"}', version: 1 },
  ];
  return {
    id,
    name: 'Test Workspace',
    framework: 'react-vite',
    status: 'draft',
    updatedAt: '2026-11-13T10:00:00.000Z',
    fileCount: seedFiles.length,
    messageCount: 0,
    revisionCount: 1,
    files: seedFiles,
    messages: [],
    revisions: [createSeedRevision(seedFiles)],
    promptState: {
      phase: 'idle',
      activePrompt: null,
      activeAgent: null,
      strategy: null,
      lastComplexity: null,
      lastError: null,
      revisionCount: 1,
      updatedAt: '2026-11-13T10:00:00.000Z',
    },
    dirtyFiles: false,
  };
}

test('workspaceReducer tracks full AI prompt lifecycle from queued to completed and creates a revision snapshot', () => {
  const detail = makeDetail('prj-lifecycle');
  let state = workspaceReducer(INITIAL_WORKSPACE_STATE, {
    type: 'HYDRATE_DETAIL',
    detail,
  });

  state = workspaceReducer(state, {
    type: 'PROMPT_QUEUED',
    projectId: 'prj-lifecycle',
    prompt: 'Build a coffee shop hero section',
  });
  assert.equal(state.lifecyclesById['prj-lifecycle'].phase, 'queued');

  state = workspaceReducer(state, {
    type: 'PROMPT_STARTED',
    projectId: 'prj-lifecycle',
    prompt: 'Build a coffee shop hero section',
    initialStatus: 'Analyzing prompt...',
    strategy: 'hybrid-dual',
  });
  assert.equal(state.lifecyclesById['prj-lifecycle'].phase, 'analyzing');
  assert.equal(state.projectsById['prj-lifecycle'].status, 'generating');
  assert.equal(state.detailsById['prj-lifecycle'].messages.length, 1);

  state = workspaceReducer(state, {
    type: 'PROMPT_PROGRESS',
    projectId: 'prj-lifecycle',
    stage: 'deepseek_code',
    agent: 'deepseek',
    statusMessage: 'DeepSeek writing React components...',
  });
  assert.equal(state.lifecyclesById['prj-lifecycle'].phase, 'deepseek_code');
  assert.equal(state.lifecyclesById['prj-lifecycle'].activeAgent, 'deepseek');

  const updatedAppFile: ProjectFile = {
    path: 'src/App.tsx',
    content: 'export default function App() { return <h1>Kopi Nusantara v2</h1>; }',
    version: 2,
  };
  state = workspaceReducer(state, {
    type: 'PROMPT_FILE_STREAMED',
    projectId: 'prj-lifecycle',
    file: updatedAppFile,
    agent: 'deepseek',
  });
  assert.deepEqual(state.lifecyclesById['prj-lifecycle'].streamedFilePaths, ['src/App.tsx']);

  const finalFiles: ProjectFile[] = [
    updatedAppFile,
    { path: 'package.json', content: '{"name":"prj-lifecycle"}', version: 1 },
  ];
  state = workspaceReducer(state, {
    type: 'PROMPT_COMPLETED',
    projectId: 'prj-lifecycle',
    files: finalFiles,
    assistantMessage: {
      id: 'ai-1',
      role: 'assistant',
      content: 'Generated coffee shop hero section.',
      timestamp: '10:02',
    },
    summary: 'Built Kopi Nusantara landing page',
    prompt: 'Build a coffee shop hero section',
    strategy: 'hybrid-dual',
    complexity: null,
    agent: 'deepseek',
  });

  assert.equal(state.lifecyclesById['prj-lifecycle'].phase, 'completed');
  assert.equal(state.projectsById['prj-lifecycle'].status, 'ready');
  assert.equal(state.projectsById['prj-lifecycle'].revisionCount, 2);
  assert.equal(state.detailsById['prj-lifecycle'].revisions.length, 2);
  assert.equal(state.detailsById['prj-lifecycle'].revisions[0].version, 2);
  assert.equal(state.detailsById['prj-lifecycle'].revisions[0].source, 'ai-generation');
});

test('workspaceReducer handles manual edits, revision labeling, and rollback with file version bumps', () => {
  const detail = makeDetail('prj-rev');
  let state = workspaceReducer(INITIAL_WORKSPACE_STATE, {
    type: 'HYDRATE_DETAIL',
    detail,
  });

  const baselineRevId = state.detailsById['prj-rev'].revisions[0].id;
  state = workspaceReducer(state, {
    type: 'LABEL_REVISION',
    projectId: 'prj-rev',
    revisionId: baselineRevId,
    label: 'Stable Baseline',
  });
  assert.equal(state.detailsById['prj-rev'].revisions[0].label, 'Stable Baseline');

  state = workspaceReducer(state, {
    type: 'EDIT_FILE_CONTENT',
    projectId: 'prj-rev',
    path: 'src/App.tsx',
    content: 'export default function App() { return <h1>Broken Experimental Edit</h1>; }',
  });
  assert.equal(state.detailsById['prj-rev'].dirtyFiles, true);

  state = workspaceReducer(state, {
    type: 'FILES_SAVED',
    projectId: 'prj-rev',
    files: state.detailsById['prj-rev'].files,
    label: 'Experimental tweak',
  });
  assert.equal(state.detailsById['prj-rev'].dirtyFiles, false);
  assert.equal(state.detailsById['prj-rev'].revisions.length, 2);

  // Diff stats between baseline revision and current v2 files
  const diff = computeRevisionDiffStats(
    state.detailsById['prj-rev'].revisions[1].files,
    state.detailsById['prj-rev'].files
  );
  assert.equal(diff.changedFiles, 1);

  // Rollback to v1 baseline
  state = workspaceReducer(state, {
    type: 'ROLLBACK_REVISION',
    projectId: 'prj-rev',
    revisionId: baselineRevId,
  });

  const latest = state.detailsById['prj-rev'];
  assert.equal(latest.revisions.length, 3);
  assert.equal(latest.revisions[0].source, 'rollback');
  assert.equal(latest.revisions[0].label, 'Rollback to v1');
  assert.ok(areFileListsEqual(latest.files, latest.revisions[2].files));
  const restoredApp = latest.files.find((f) => f.path === 'src/App.tsx');
  assert.ok(restoredApp && restoredApp.version > 1);
});

test('createInitialLifecycle maps active stream phases cleanly', () => {
  const active = createInitialLifecycle({
    phase: 'haiku_ui',
    activePrompt: 'Redesign pricing grid',
    activeAgent: 'claude-haiku',
    strategy: 'hybrid-dual',
    lastComplexity: null,
    lastError: null,
    revisionCount: 1,
    updatedAt: '2026-11-13T10:00:00.000Z',
  });
  assert.equal(active.phase, 'haiku_ui');
  assert.equal(active.stage, 'haiku_ui');
  assert.equal(active.activeAgent, 'claude-haiku');
});
