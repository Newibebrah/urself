import test from 'node:test';
import assert from 'node:assert/strict';
import { AgentManager, evaluatePromptProfile } from './agent-manager';

test('evaluatePromptProfile produces valid ComplexityProfile with low/medium/high tiers and recommendations', () => {
  const simpleEdit = evaluatePromptProfile('Rename footer label', 2);
  assert.equal(simpleEdit.tier, 'low');
  assert.ok(simpleEdit.overallScore >= 1 && simpleEdit.overallScore <= 3);
  assert.ok(simpleEdit.recommendations.length >= 2);

  const uiRevision = evaluatePromptProfile(
    'Switch theme to dark mode, add hero SVG logo, and tighten typography contrast',
    2
  );
  assert.equal(uiRevision.tier, 'medium');
  assert.equal(uiRevision.strategy, 'haiku-only');

  const complexSite = evaluatePromptProfile(
    'Build a multi-section SaaS pricing dashboard with interactive filter state, auth modal, bento grid, dark mode, and custom SVG brand assets',
    0
  );
  assert.equal(complexSite.tier, 'high');
  assert.equal(complexSite.strategy, 'hybrid-dual');
  assert.ok(complexSite.overallScore >= 7);
});

test('AgentManager.evaluate routes prompts to Haiku UI architect, DeepSeek engineer, or hybrid dual', () => {
  const haikuRoute = AgentManager.evaluate(
    { prompt: 'Update palette color, dark mode theme, and hero SVG logo asset', projectId: 'p1' },
    3
  );
  assert.equal(haikuRoute.target, 'haiku');
  assert.equal(haikuRoute.useHaiku, true);
  assert.equal(haikuRoute.useDeepSeek, false);
  assert.equal(haikuRoute.activeAgentLabel, 'Haiku UI Architect');

  const deepseekRoute = AgentManager.evaluate(
    { prompt: 'Add interactive search filter, pagination state, and form validation logic', projectId: 'p1' },
    3
  );
  assert.equal(deepseekRoute.target, 'deepseek');
  assert.equal(deepseekRoute.useHaiku, false);
  assert.equal(deepseekRoute.useDeepSeek, true);
  assert.equal(deepseekRoute.activeAgentLabel, 'DeepSeek Coding Engineer');

  const hybridRoute = AgentManager.evaluate(
    { prompt: 'Create a minimalist specialty coffee landing page with dark mode, interactive filter tabs, and SVG brand assets' },
    0
  );
  assert.equal(hybridRoute.target, 'hybrid');
  assert.equal(hybridRoute.useHaiku, true);
  assert.equal(hybridRoute.useDeepSeek, true);
});

test('AgentManager.mapStatusToProgress maps pipelineStatus streams accurately across Haiku and DeepSeek phases', () => {
  const haikuPhase = AgentManager.mapStatusToProgress(
    'Claude Haiku (claude-3-5-haiku-latest) planning layout hierarchy & SVG brand tokens...',
    'haiku_ui',
    'claude-haiku',
    'hybrid-dual'
  );
  assert.equal(haikuPhase.activeStage, 'haiku_ui');
  assert.equal(haikuPhase.activeAgent, 'claude-haiku');
  assert.equal(haikuPhase.headline, 'Haiku is planning the layout');
  assert.equal(haikuPhase.percent, 44);
  assert.equal(haikuPhase.steps.find((s) => s.id === 'analyzing')?.state, 'completed');
  assert.equal(haikuPhase.steps.find((s) => s.id === 'haiku_ui')?.state, 'active');
  assert.equal(haikuPhase.steps.find((s) => s.id === 'deepseek_code')?.state, 'pending');

  const deepseekPhase = AgentManager.mapStatusToProgress(
    'DeepSeek (deepseek-chat) generating ShowcaseGrid & interactive App.tsx...',
    null,
    null,
    'hybrid-dual'
  );
  assert.equal(deepseekPhase.activeStage, 'deepseek_code');
  assert.equal(deepseekPhase.activeAgent, 'deepseek');
  assert.equal(deepseekPhase.headline, 'DeepSeek is generating code');
  assert.equal(deepseekPhase.percent, 76);
  assert.equal(deepseekPhase.steps.find((s) => s.id === 'haiku_ui')?.state, 'completed');
  assert.equal(deepseekPhase.steps.find((s) => s.id === 'deepseek_code')?.state, 'active');

  const deepseekOnlyPhase = AgentManager.mapStatusToProgress(
    'Compiling React + Tailwind preview bundle with esbuild...',
    'esbuild_preview',
    'agent-manager',
    'deepseek-only'
  );
  assert.equal(deepseekOnlyPhase.percent, 94);
  assert.equal(deepseekOnlyPhase.steps.find((s) => s.id === 'haiku_ui')?.state, 'skipped');
  assert.equal(deepseekOnlyPhase.steps.find((s) => s.id === 'deepseek_code')?.state, 'completed');
  assert.equal(deepseekOnlyPhase.steps.find((s) => s.id === 'esbuild_preview')?.state, 'active');
});
