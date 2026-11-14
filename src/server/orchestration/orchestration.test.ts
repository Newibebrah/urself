import test from 'node:test';
import assert from 'node:assert/strict';
import type { ProjectWithFiles } from '../../features/projects/types.ts';
import { streamMockTestPipeline } from '../../features/generation/test-pipeline.ts';
import { compilePreviewWithEsbuild } from '../pipeline/esbuild-preview.ts';
import { evaluatePromptComplexity } from './complexity-router.ts';
import { AgentManager } from './agent-manager.ts';

const EXISTING_APP_WORKSPACE: ProjectWithFiles = {
  id: 'prj_test_01',
  name: 'Kopi Senja',
  framework: 'react-vite',
  status: 'ready',
  updatedAt: new Date().toISOString(),
  files: [
    {
      path: 'src/App.tsx',
      version: 1,
      content: `import React from 'react';
export default function App() {
  return <div className="min-h-screen bg-[#FAFAFA] text-slate-900"><h1>Kopi Senja</h1></div>;
}`,
    },
  ],
};

test('complexity-router toggles between haiku-only, deepseek-only, and hybrid-dual with model recommendations', () => {
  const uiOnly = evaluatePromptComplexity(
    { prompt: 'Switch theme to dark mode and tighten typography contrast', projectId: 'prj_test_01' },
    EXISTING_APP_WORKSPACE.files
  );
  assert.equal(uiOnly.complexity.strategy, 'haiku-only');
  assert.ok(uiOnly.complexity.recommendations.length >= 2);
  assert.ok(uiOnly.complexity.recommendedModels.uiModel);
  assert.equal(uiOnly.complexity.recommendedModels.codeModel, undefined);

  const codeOnly = evaluatePromptComplexity(
    { prompt: 'Add interactive search filter and form submit validation logic to the invoice table', projectId: 'prj_test_01' },
    EXISTING_APP_WORKSPACE.files
  );
  assert.equal(codeOnly.complexity.strategy, 'deepseek-only');
  assert.ok(codeOnly.complexity.recommendations.length >= 2);
  assert.equal(codeOnly.complexity.recommendedModels.uiModel, undefined);
  assert.equal(codeOnly.complexity.recommendedModels.codeModel, 'deepseek-chat');

  assert.equal(codeOnly.complexity.tier, 'low');
  assert.equal(uiOnly.complexity.tier, 'medium');

  const hybridFull = evaluatePromptComplexity(
    { prompt: 'Build a multi-section SaaS pricing dashboard with interactive tier calculator, stateful auth, bento grid, dark mode, and custom SVG brand assets' },
    []
  );
  assert.equal(hybridFull.complexity.strategy, 'hybrid-dual');
  assert.equal(hybridFull.complexity.tier, 'high');
  assert.ok(hybridFull.complexity.codeScore >= 7);
  assert.equal(hybridFull.complexity.recommendedModels.codeModel, 'deepseek-reasoner');
  assert.ok(hybridFull.complexity.recommendedModels.uiModel);
});

test('AgentManager streams status, files, and esbuild preview for haiku-only strategy', async () => {
  const manager = new AgentManager();
  const chunks = [];
  for await (const chunk of manager.orchestrate(
    { prompt: 'Switch theme to dark mode and refine typography spacing', projectId: 'prj_test_01' },
    EXISTING_APP_WORKSPACE
  )) {
    chunks.push(chunk);
  }

  const statuses = chunks.filter((c) => c.type === 'status');
  const files = chunks.filter((c) => c.type === 'file');
  const done = chunks.find((c) => c.type === 'done');

  assert.ok(statuses.some((s) => s.agent === 'claude-haiku'));
  assert.ok(!statuses.some((s) => s.agent === 'deepseek'));
  assert.ok(files.some((f) => f.file?.path === 'src/components/BrandAssets.tsx'));
  assert.ok(done && done.providers?.strategy === 'haiku-only');
  assert.ok(done?.providers?.architectModel);
  assert.equal(done?.providers?.engineerModel, undefined);
  assert.equal(done?.previewError, null);
  assert.ok(done?.previewHtml && done.previewHtml.includes('<!doctype html>'));
});

test('AgentManager streams both Haiku and DeepSeek outputs for hybrid-dual strategy', async () => {
  const manager = new AgentManager();
  const emptyWorkspace: ProjectWithFiles = {
    id: 'prj_test_02',
    name: 'MetricFlow',
    framework: 'react-vite',
    status: 'draft',
    updatedAt: new Date().toISOString(),
    files: [],
  };

  const chunks = [];
  for await (const chunk of manager.orchestrate(
    { prompt: 'Build a SaaS analytics dashboard and pricing page with dark mode, interactive filters, and SVG assets' },
    emptyWorkspace
  )) {
    chunks.push(chunk);
  }

  const haikuFiles = chunks.filter((c) => c.type === 'file' && c.agent === 'claude-haiku');
  const deepseekFiles = chunks.filter((c) => c.type === 'file' && c.agent === 'deepseek');
  const done = chunks.find((c) => c.type === 'done');

  assert.ok(haikuFiles.length >= 1);
  assert.ok(deepseekFiles.length >= 2);
  assert.equal(done?.providers?.strategy, 'hybrid-dual');
  assert.ok(done?.providers?.architectModel);
  assert.ok(done?.providers?.engineerModel);
  assert.equal(done?.previewError, null);
});

test('AgentManager honors explicit ComplexityProfile passed in GenerateRequest to select models dynamically', async () => {
  const manager = new AgentManager();
  const chunks = [];
  for await (const chunk of manager.orchestrate(
    {
      prompt: 'Update footer contrast',
      projectId: 'prj_test_01',
      complexityProfile: {
        overallScore: 8,
        codeScore: 8,
        uiScore: 3,
        tier: 'high',
        strategy: 'deepseek-only',
        rationale: 'Forced deepseek-reasoner profile for strict structural diff.',
        recommendations: ['Use deepseek-reasoner for deterministic component refactoring.'],
        recommendedModels: {
          codeModel: 'deepseek-reasoner',
        },
      },
    },
    EXISTING_APP_WORKSPACE
  )) {
    chunks.push(chunk);
  }

  const done = chunks.find((c) => c.type === 'done');
  assert.equal(done?.providers?.strategy, 'deepseek-only');
  assert.equal(done?.providers?.engineerModel, 'deepseek-reasoner');
  assert.equal(done?.providers?.architectModel, undefined);
  assert.equal(done?.complexity?.tier, 'high');
  assert.equal(done?.complexity?.recommendations[0], 'Use deepseek-reasoner for deterministic component refactoring.');
});

test('AgentManager generates a complete simple website even when ANTHROPIC_API_KEY is unset and handles CSS imports', async () => {
  const prevAnthropic = process.env.ANTHROPIC_API_KEY;
  const prevDeepseek = process.env.DEEPSEEK_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.DEEPSEEK_API_KEY;

  try {
    const manager = new AgentManager();
    const emptyWorkspace: ProjectWithFiles = {
      id: 'prj_test_no_haiku',
      name: 'Toko Bunga',
      framework: 'react-vite',
      status: 'draft',
      updatedAt: new Date().toISOString(),
      files: [],
    };
    const chunks = [];
    for await (const chunk of manager.orchestrate(
      { prompt: 'Create a simple minimalist flower shop website with hero and catalog' },
      emptyWorkspace
    )) {
      chunks.push(chunk);
    }

    const done = chunks.find((c) => c.type === 'done');
    assert.ok(done);
    assert.equal(done.previewError, null);
    assert.ok(done.previewHtml && done.previewHtml.includes('<!doctype html>'));
    assert.equal(done.providers?.architect, 'deterministic-architect');
  } finally {
    if (prevAnthropic !== undefined) process.env.ANTHROPIC_API_KEY = prevAnthropic;
    if (prevDeepseek !== undefined) process.env.DEEPSEEK_API_KEY = prevDeepseek;
  }
});

test('streamMockTestPipeline simulates Haiku layout planning and DeepSeek code files that compile cleanly', async () => {
  const chunks = [];
  for await (const chunk of streamMockTestPipeline('prj_mock_test', undefined, 0)) {
    chunks.push(chunk);
  }

  const statuses = chunks.filter((c) => c.type === 'status');
  const haikuFiles = chunks.filter((c) => c.type === 'file' && c.agent === 'claude-haiku');
  const deepseekFiles = chunks.filter((c) => c.type === 'file' && c.agent === 'deepseek');
  const done = chunks.find((c) => c.type === 'done');

  assert.ok(statuses.some((s) => s.stage === 'haiku_ui' && s.agent === 'claude-haiku'));
  assert.ok(statuses.some((s) => s.stage === 'deepseek_code' && s.agent === 'deepseek'));
  assert.equal(haikuFiles.length, 1);
  assert.equal(haikuFiles[0].file?.path, 'src/components/BrandAssets.tsx');
  assert.equal(deepseekFiles.length, 2);
  assert.ok(done && done.providers?.strategy === 'hybrid-dual');

  const allFiles = chunks.filter((c) => c.type === 'file' && c.file).map((c) => c.file!);
  const compiled = await compilePreviewWithEsbuild(allFiles, 'Atelier Senja');
  assert.equal(compiled.error, null);
  assert.ok(compiled.html && compiled.html.includes('<!doctype html>'));
});

test('AgentManager emits Phase 1 blueprint selection and RAG pattern metadata during orchestration', async () => {
  const manager = new AgentManager();
  const chunks = [];
  for await (const chunk of manager.orchestrate(
    { prompt: 'Create a minimalist SaaS pricing page with navbar blur, bento grid, and FAQ' },
    {
      id: 'prj_rag_meta',
      name: 'CloudPulse',
      framework: 'react-vite',
      status: 'draft',
      updatedAt: new Date().toISOString(),
      files: [],
    }
  )) {
    chunks.push(chunk);
  }

  const blueprintStatus = chunks.find((c) => c.type === 'status' && c.blueprint);
  const ragStatus = chunks.find((c) => c.type === 'status' && c.ragPatterns && c.ragPatterns.length > 0);
  const done = chunks.find((c) => c.type === 'done');

  assert.ok(blueprintStatus?.blueprint?.templateId);
  assert.ok((blueprintStatus?.blueprint?.allowedFiles.length ?? 0) >= 2);
  assert.ok(ragStatus?.ragPatterns?.some((p) => p.title.length > 0));
  assert.equal(done?.previewError, null);
});
