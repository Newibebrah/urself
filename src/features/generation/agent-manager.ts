import type {
  AgentRoutingDecision,
  AgentSource,
  AgentTarget,
  ComplexityProfile,
  GenerateRequest,
  GenerationStage,
  OrchestrationStrategy,
  PipelineProgressInfo,
  PipelineProgressStep,
  PipelineStepState,
} from './types';

const CODE_SIGNALS: Array<{ pattern: RegExp; weight: number }> = [
  { pattern: /\b(state|hook|filter|search|sort|paginate|validation|form|submit|calculate|logic|algorithm)\b/i, weight: 2 },
  { pattern: /\b(dashboard|table|crud|api|fetch|auth|chart|invoice|ledger|billing|interactive)\b/i, weight: 2 },
  { pattern: /\b(typescript|interface|component|refactor|fix|bug|error|route|modal|tabs)\b/i, weight: 2 },
  { pattern: /\b(pricing|tier|toggle|comparison|calculator|checkout)\b/i, weight: 1 },
];

const UI_SIGNALS: Array<{ pattern: RegExp; weight: number }> = [
  { pattern: /\b(ui|ux|design|aesthetic|layout|typography|font|palette|color|theme|dark\s*mode)\b/i, weight: 2 },
  { pattern: /\b(hero|bento|landing|portfolio|brand|minimal|editorial|modern|sleek|glass)\b/i, weight: 2 },
  { pattern: /\b(svg|icon|illustration|asset|logo|badge|card|grid|animation|spacing|footer|navbar)\b/i, weight: 2 },
  { pattern: /\b(copy|headline|tagline|tighten|contrast|border|shadow)\b/i, weight: 1 },
];

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function isCreateIntent(prompt: string, existingFileCount: number): boolean {
  if (existingFileCount === 0) return true;
  if (/\b(refactor|modify|edit|fix|tweak|change|tighten|rename|update)\b/i.test(prompt)) {
    return false;
  }
  return /\b(create|build|generate|make|new website|landing page|from scratch)\b/i.test(prompt);
}

/**
 * Evaluates a natural-language prompt into a structured ComplexityProfile
 * matching the backend complexity-router thresholds.
 */
export function evaluatePromptProfile(
  prompt: string,
  existingFileCount = 0
): ComplexityProfile {
  const trimmed = prompt.trim();
  const creating = isCreateIntent(trimmed, existingFileCount);

  let codeScore = creating ? 3 : 1;
  let uiScore = creating ? 3 : 1;

  for (const rule of CODE_SIGNALS) {
    if (rule.pattern.test(trimmed)) codeScore += rule.weight;
  }
  for (const rule of UI_SIGNALS) {
    if (rule.pattern.test(trimmed)) uiScore += rule.weight;
  }

  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
  if (wordCount >= 18) {
    codeScore += 1;
    uiScore += 1;
  }
  if (/\b(dark\s*mode|dark\s*theme|zinc-950|obsidian)\b/i.test(trimmed)) {
    uiScore += 1;
  }

  codeScore = clamp(codeScore, 0, 10);
  uiScore = clamp(uiScore, 0, 10);

  const overallScore = clamp(
    Math.round((codeScore + uiScore) / 2 + (creating ? 1 : 0)),
    1,
    10
  );
  const tier: ComplexityProfile['tier'] =
    overallScore >= 7 ? 'high' : overallScore >= 4 ? 'medium' : 'low';

  let strategy: OrchestrationStrategy;
  let rationale: string;

  if (creating) {
    if (uiScore > codeScore + 2 && overallScore <= 5) {
      strategy = 'haiku-only';
      rationale = `UI-focused prompt (UI ${uiScore}/10 vs Code ${codeScore}/10) routed to Haiku UI architect.`;
    } else if (codeScore > uiScore + 2 && overallScore <= 5) {
      strategy = 'deepseek-only';
      rationale = `Logic-focused prompt (Code ${codeScore}/10 vs UI ${uiScore}/10) routed to DeepSeek coding engineer.`;
    } else {
      strategy = 'hybrid-dual';
      rationale = `Full-stack build (${tier}, ${overallScore}/10) routes UI planning to Haiku and React synthesis to DeepSeek.`;
    }
  } else if (uiScore >= codeScore + 2 && codeScore <= 3) {
    strategy = 'haiku-only';
    rationale = `UI/UX styling revision (UI ${uiScore}/10, Code ${codeScore}/10) routed to Haiku UI architect.`;
  } else if (codeScore >= uiScore + 2 && uiScore <= 3) {
    strategy = 'deepseek-only';
    rationale = `Code & logic revision (Code ${codeScore}/10, UI ${uiScore}/10) routed to DeepSeek coding engineer.`;
  } else if (overallScore <= 4 && uiScore >= codeScore) {
    strategy = 'haiku-only';
    rationale = `Lightweight visual revision (${overallScore}/10) routed to Haiku UI architect.`;
  } else if (overallScore <= 4) {
    strategy = 'deepseek-only';
    rationale = `Targeted code revision (${overallScore}/10) routed to DeepSeek coding engineer.`;
  } else {
    strategy = 'hybrid-dual';
    rationale = `Multi-layer revision (${overallScore}/10) orchestrates Haiku UI layout + DeepSeek code generation.`;
  }

  const uiModel = 'claude-3-5-haiku-latest';
  const codeModel = tier === 'high' && codeScore >= 6 ? 'deepseek-reasoner' : 'deepseek-chat';

  const recommendations: string[] = [];
  if (strategy === 'haiku-only') {
    recommendations.push(`Route to ${uiModel} for layout tokens, typography, and SVG assets.`);
    recommendations.push(`Bypass full React synthesis (code complexity ${codeScore}/10).`);
  } else if (strategy === 'deepseek-only') {
    recommendations.push(`Route to ${codeModel} for stateful TypeScript & React engineering (${codeScore}/10).`);
    recommendations.push('Preserve existing layout tokens while updating interactive logic.');
  } else {
    recommendations.push(`Have ${uiModel} plan layout hierarchy and BrandAssets tokens (UI ${uiScore}/10).`);
    recommendations.push(`Have ${codeModel} synthesize modular React + Tailwind components (code ${codeScore}/10).`);
  }
  recommendations.push('Verify compiled output with esbuild before updating preview.');

  return {
    overallScore,
    codeScore,
    uiScore,
    tier,
    strategy,
    rationale,
    recommendations,
    recommendedModels:
      strategy === 'haiku-only'
        ? { uiModel }
        : strategy === 'deepseek-only'
        ? { codeModel }
        : { uiModel, codeModel },
  };
}

function resolveTargetFromProfile(profile: ComplexityProfile): AgentTarget {
  if (profile.strategy === 'haiku-only') return 'haiku';
  if (profile.strategy === 'deepseek-only') return 'deepseek';
  if (profile.recommendedModels.uiModel && !profile.recommendedModels.codeModel) return 'haiku';
  if (profile.recommendedModels.codeModel && !profile.recommendedModels.uiModel) return 'deepseek';
  return 'hybrid';
}

function inferStageFromStatusText(
  statusText: string,
  explicitStage?: GenerationStage | null,
  explicitAgent?: AgentSource | null
): { stage: GenerationStage; agent: AgentSource } {
  if (explicitStage) {
    const inferredAgent: AgentSource =
      explicitAgent ??
      (explicitStage === 'haiku_ui'
        ? 'claude-haiku'
        : explicitStage === 'deepseek_code'
        ? 'deepseek'
        : 'agent-manager');
    return { stage: explicitStage, agent: inferredAgent };
  }

  const lower = statusText.toLowerCase();
  if (lower.includes('self-heal') || lower.includes('self_heal') || lower.includes('repair')) {
    return { stage: 'self_healing', agent: explicitAgent ?? 'deepseek' };
  }
  if (lower.includes('esbuild') || lower.includes('compil') || lower.includes('preview')) {
    return { stage: 'esbuild_preview', agent: 'agent-manager' };
  }
  if (
    explicitAgent === 'deepseek' ||
    lower.includes('deepseek') ||
    lower.includes('synthesiz') ||
    lower.includes('generating code') ||
    lower.includes('streaming')
  ) {
    return { stage: 'deepseek_code', agent: 'deepseek' };
  }
  if (
    explicitAgent === 'claude-haiku' ||
    lower.includes('haiku') ||
    lower.includes('layout') ||
    lower.includes('blueprint') ||
    lower.includes('svg')
  ) {
    return { stage: 'haiku_ui', agent: 'claude-haiku' };
  }

  return { stage: 'analyzing', agent: explicitAgent ?? 'agent-manager' };
}

/**
 * Pure utility for evaluating prompts against ComplexityProfile routing rules
 * and mapping live generation stream updates into visual progress states.
 */
export const AgentManager = {
  evaluate(request: GenerateRequest, existingFileCount = 0): AgentRoutingDecision {
    const complexity = request.complexityProfile ?? evaluatePromptProfile(request.prompt, existingFileCount);
    const target = resolveTargetFromProfile(complexity);
    const useHaiku = target === 'haiku' || target === 'hybrid';
    const useDeepSeek = target === 'deepseek' || target === 'hybrid';

    const activeAgentLabel =
      target === 'haiku'
        ? 'Haiku UI Architect'
        : target === 'deepseek'
        ? 'DeepSeek Coding Engineer'
        : 'Haiku UI Architect + DeepSeek Coding Engineer';

    return {
      target,
      strategy: complexity.strategy,
      useHaiku,
      useDeepSeek,
      activeAgentLabel,
      complexity,
    };
  },

  mapStatusToProgress(
    pipelineStatus: string | null,
    explicitStage?: GenerationStage | null,
    explicitAgent?: AgentSource | null,
    strategy: OrchestrationStrategy = 'hybrid-dual'
  ): PipelineProgressInfo {
    const detail = pipelineStatus?.trim() || 'Preparing AI orchestration pipeline...';
    const { stage, agent } = inferStageFromStatusText(detail, explicitStage, explicitAgent);

    const useHaiku = strategy === 'haiku-only' || strategy === 'hybrid-dual';
    const useDeepSeek = strategy === 'deepseek-only' || strategy === 'hybrid-dual';

    const stageOrder: GenerationStage[] = ['analyzing', 'haiku_ui', 'deepseek_code', 'esbuild_preview'];
    const normalizedStage: GenerationStage = stage === 'self_healing' ? 'esbuild_preview' : stage;
    const activeIndex = stageOrder.indexOf(normalizedStage);

    const stateFor = (stepId: GenerationStage, enabled: boolean): PipelineStepState => {
      if (!enabled) return 'skipped';
      const idx = stageOrder.indexOf(stepId);
      if (stage === 'self_healing' && stepId === 'deepseek_code') return 'active';
      if (idx < activeIndex) return 'completed';
      if (idx === activeIndex) return 'active';
      return 'pending';
    };

    const steps: PipelineProgressStep[] = [
      {
        id: 'analyzing',
        label: 'Evaluate',
        agentLabel: 'AgentManager',
        state: stateFor('analyzing', true),
      },
      {
        id: 'haiku_ui',
        label: 'Plan Layout',
        agentLabel: 'Haiku',
        state: stateFor('haiku_ui', useHaiku),
      },
      {
        id: 'deepseek_code',
        label: stage === 'self_healing' ? 'Self-Heal' : 'Code Gen',
        agentLabel: 'DeepSeek',
        state: stateFor('deepseek_code', useDeepSeek || stage === 'self_healing'),
      },
      {
        id: 'esbuild_preview',
        label: 'Preview',
        agentLabel: 'esbuild',
        state: stateFor('esbuild_preview', true),
      },
    ];

    const percentByStage: Record<GenerationStage, number> = {
      analyzing: 18,
      haiku_ui: strategy === 'haiku-only' ? 58 : 44,
      deepseek_code: strategy === 'deepseek-only' ? 62 : 76,
      self_healing: 86,
      esbuild_preview: 94,
    };

    const headlineByStage: Record<GenerationStage, string> = {
      analyzing: 'AgentManager is evaluating prompt & RAG patterns',
      haiku_ui: 'Haiku is planning the layout',
      deepseek_code: 'DeepSeek is generating code',
      self_healing: 'Self-Healing Loop is repairing AST/compile errors',
      esbuild_preview: 'esbuild is compiling the live preview',
    };

    return {
      percent: percentByStage[stage],
      activeStage: stage,
      activeAgent: agent,
      headline: headlineByStage[stage],
      detail,
      steps,
    };
  },
};
