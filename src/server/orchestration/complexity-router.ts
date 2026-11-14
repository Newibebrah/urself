import type {
  ComplexityProfile,
  GenerateRequest,
  OrchestrationStrategy,
  RecommendedModels,
} from '../../features/generation/types.ts';
import type { ProjectFile } from '../../features/projects/types.ts';
import { analyzePrompt, type PromptAnalysis } from '../pipeline/prompt-analyzer.ts';

export interface RoutingEvaluation {
  analysis: PromptAnalysis;
  complexity: ComplexityProfile;
}

const CODE_ENGINEERING_PATTERNS: Array<{ pattern: RegExp; weight: number }> = [
  { pattern: /\b(state|hook|filter|search|sort|paginate|validation|form|submit|calculate|logic|algorithm)\b/i, weight: 2 },
  { pattern: /\b(dashboard|table|crud|api|fetch|auth|chart|invoice|ledger|billing|interactive)\b/i, weight: 2 },
  { pattern: /\b(typescript|interface|component|refactor|fix|bug|error|route|modal|tabs)\b/i, weight: 2 },
  { pattern: /\b(pricing|tier|toggle|comparison|calculator|checkout)\b/i, weight: 1 },
];

const UI_UX_ASSET_PATTERNS: Array<{ pattern: RegExp; weight: number }> = [
  { pattern: /\b(ui|ux|design|aesthetic|layout|typography|font|palette|color|theme|dark\s*mode)\b/i, weight: 2 },
  { pattern: /\b(hero|bento|landing|portfolio|brand|minimal|editorial|modern|sleek|glass)\b/i, weight: 2 },
  { pattern: /\b(svg|icon|illustration|asset|logo|badge|card|grid|animation|spacing|footer|navbar)\b/i, weight: 2 },
  { pattern: /\b(copy|headline|tagline|tighten|contrast|border|shadow)\b/i, weight: 1 },
];

function clampScore(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeDeepSeekModel(rawModel?: string, fallback = 'deepseek-chat'): string {
  const candidate = rawModel?.trim();
  if (!candidate) return fallback;
  const baseUrl = (process.env.DEEPSEEK_BASE_URL?.trim() || 'https://api.deepseek.com').toLowerCase();
  if (baseUrl.includes('api.deepseek.com') && candidate === 'deepseek-flash') {
    return 'deepseek-chat';
  }
  return candidate;
}

function isKeyConfigured(val?: string): boolean {
  return Boolean(val && val.trim().length > 0 && !val.trim().startsWith('MY_'));
}

export function resolveRecommendedModels(
  strategy: OrchestrationStrategy,
  tier: ComplexityProfile['tier'],
  codeScore: number
): RecommendedModels {
  const uiModel = process.env.ANTHROPIC_MODEL?.trim() || 'claude-3-5-haiku-latest';
  const standardCodeModel = normalizeDeepSeekModel(process.env.DEEPSEEK_MODEL, 'deepseek-chat');
  const complexCodeModel = normalizeDeepSeekModel(
    process.env.DEEPSEEK_REASONER_MODEL,
    'deepseek-reasoner'
  );

  const chosenCodeModel =
    tier === 'high' && codeScore >= 6 ? complexCodeModel : standardCodeModel;

  if (strategy === 'haiku-only') {
    return { uiModel };
  }
  if (strategy === 'deepseek-only') {
    return { codeModel: chosenCodeModel };
  }
  return {
    uiModel,
    codeModel: chosenCodeModel,
  };
}

export function buildStrategyRecommendations(
  strategy: OrchestrationStrategy,
  tier: ComplexityProfile['tier'],
  codeScore: number,
  uiScore: number,
  models: RecommendedModels,
  analysis: PromptAnalysis
): string[] {
  const recommendations: string[] = [];

  if (strategy === 'haiku-only') {
    recommendations.push(
      `Assign ${models.uiModel ?? 'claude-3-5-haiku-latest'} exclusively for visual tokens, typography, and SVG brand assets.`
    );
    recommendations.push(
      `Skip heavy code re-synthesis because code complexity is low (${codeScore}/10).`
    );
  } else if (strategy === 'deepseek-only') {
    recommendations.push(
      `Route targeted ${analysis.intent} engineering to ${models.codeModel ?? 'deepseek-chat'} (code score ${codeScore}/10).`
    );
    recommendations.push(
      `Preserve existing visual architecture while mutating state, handlers, and TypeScript components.`
    );
  } else {
    recommendations.push(
      `Run ${models.uiModel ?? 'claude-3-5-haiku-latest'} first to lock palette, ${analysis.requestedSections.length} sections, and BrandAssets SVG tokens (UI ${uiScore}/10).`
    );
    recommendations.push(
      `Feed the Haiku blueprint into ${models.codeModel ?? 'deepseek-chat'} (${tier} tier, code ${codeScore}/10) for modular React + Tailwind synthesis.`
    );
  }

  recommendations.push('Verify compiled output with in-memory esbuild before emitting preview HTML.');
  return recommendations;
}

export function resolveComplexityProfile(
  request: GenerateRequest,
  existingFiles: ProjectFile[] = []
): RoutingEvaluation {
  const evaluated = evaluatePromptComplexity(request, existingFiles);
  if (!request.complexityProfile) {
    return evaluated;
  }

  const override = request.complexityProfile;
  const strategy = override.strategy;
  const tier = override.tier;
  const codeScore = clampScore(override.codeScore, 0, 10);
  const uiScore = clampScore(override.uiScore, 0, 10);
  const overallScore = clampScore(override.overallScore, 1, 10);
  const fallbackModels = resolveRecommendedModels(strategy, tier, codeScore);

  const recommendedModels: RecommendedModels = {
    uiModel:
      strategy === 'deepseek-only'
        ? override.recommendedModels?.uiModel
        : override.recommendedModels?.uiModel ?? fallbackModels.uiModel,
    codeModel:
      strategy === 'haiku-only'
        ? override.recommendedModels?.codeModel
        : override.recommendedModels?.codeModel ?? fallbackModels.codeModel,
  };

  const recommendations =
    override.recommendations && override.recommendations.length > 0
      ? override.recommendations
      : buildStrategyRecommendations(
          strategy,
          tier,
          codeScore,
          uiScore,
          recommendedModels,
          evaluated.analysis
        );

  return {
    analysis: evaluated.analysis,
    complexity: {
      overallScore,
      codeScore,
      uiScore,
      tier,
      strategy,
      rationale: override.rationale || evaluated.complexity.rationale,
      recommendations,
      recommendedModels,
    },
  };
}

export function evaluatePromptComplexity(
  request: GenerateRequest,
  existingFiles: ProjectFile[] = []
): RoutingEvaluation {
  const prompt = request.prompt.trim();
  const analysis = analyzePrompt(prompt, existingFiles);

  let codeScore = analysis.intent === 'create' ? 3 : 1;
  let uiScore = analysis.intent === 'create' ? 3 : 1;

  for (const rule of CODE_ENGINEERING_PATTERNS) {
    if (rule.pattern.test(prompt)) codeScore += rule.weight;
  }
  for (const rule of UI_UX_ASSET_PATTERNS) {
    if (rule.pattern.test(prompt)) uiScore += rule.weight;
  }

  // Length & multi-section complexity adjustments
  const wordCount = prompt.split(/\s+/).filter(Boolean).length;
  if (wordCount >= 18) {
    codeScore += 1;
    uiScore += 1;
  }
  if (analysis.requestedSections.length >= 4) {
    codeScore += 1;
    uiScore += 1;
  }
  if (analysis.darkMode) {
    uiScore += 1;
  }

  codeScore = clampScore(codeScore, 0, 10);
  uiScore = clampScore(uiScore, 0, 10);

  const overallScore = clampScore(
    Math.round((codeScore + uiScore) / 2 + (analysis.intent === 'create' ? 1 : 0)),
    1,
    10
  );
  const tier: ComplexityProfile['tier'] =
    overallScore >= 7 ? 'high' : overallScore >= 4 ? 'medium' : 'low';

  let strategy: OrchestrationStrategy;
  let rationale: string;

  const haikuReady = isKeyConfigured(process.env.ANTHROPIC_API_KEY);
  const deepseekReady = isKeyConfigured(process.env.DEEPSEEK_API_KEY);

  if (analysis.intent === 'create') {
    if (uiScore > codeScore + 2 && overallScore <= 5 && (haikuReady || !deepseekReady)) {
      strategy = 'haiku-only';
      rationale = `UI-focused prompt (UI ${uiScore}/10 vs Code ${codeScore}/10) routed directly to Claude Haiku.`;
    } else if (codeScore > uiScore + 2 && overallScore <= 5) {
      strategy = 'deepseek-only';
      rationale = `Logic-focused prompt (Code ${codeScore}/10 vs UI ${uiScore}/10) routed directly to DeepSeek Engineer.`;
    } else {
      strategy = 'hybrid-dual';
      rationale = haikuReady
        ? `Full-stack generation (${tier}, ${overallScore}/10) toggles Haiku for UI/UX assets + DeepSeek for React code.`
        : `Full-stack generation (${tier}, ${overallScore}/10) uses deterministic UI blueprint + DeepSeek for React code.`;
    }
  } else {
    if (uiScore >= codeScore + 2 && codeScore <= 3) {
      strategy = 'haiku-only';
      rationale = `UI/UX styling & asset revision (UI ${uiScore}/10, Code ${codeScore}/10) handled by Claude Haiku.`;
    } else if (codeScore >= uiScore + 2 && uiScore <= 3) {
      strategy = 'deepseek-only';
      rationale = `Code & logic revision (Code ${codeScore}/10, UI ${uiScore}/10) handled by DeepSeek Engineer.`;
    } else if (overallScore <= 4 && uiScore >= codeScore) {
      strategy = 'haiku-only';
      rationale = `Lightweight visual revision (${overallScore}/10) routed to Claude Haiku.`;
    } else if (overallScore <= 4) {
      strategy = 'deepseek-only';
      rationale = `Targeted code revision (${overallScore}/10) routed to DeepSeek Engineer.`;
    } else {
      strategy = 'hybrid-dual';
      rationale = `Complex multi-layer revision (${overallScore}/10) orchestrates Haiku UI/UX + DeepSeek code synthesis.`;
    }
  }

  const recommendedModels = resolveRecommendedModels(strategy, tier, codeScore);
  const recommendations = buildStrategyRecommendations(
    strategy,
    tier,
    codeScore,
    uiScore,
    recommendedModels,
    analysis
  );

  return {
    analysis,
    complexity: {
      overallScore,
      codeScore,
      uiScore,
      tier,
      strategy,
      rationale,
      recommendations,
      recommendedModels,
    },
  };
}
