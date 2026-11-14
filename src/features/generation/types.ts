import type { DiffLine } from '../../server/pipeline/deepseek-engineer';
import type { ProjectFile } from '../projects/types';

export interface RecommendedModels {
  uiModel?: string;
  codeModel?: string;
}

export interface ComplexityProfile {
  overallScore: number; // 1-10
  codeScore: number; // 0-10
  uiScore: number; // 0-10
  tier: 'low' | 'medium' | 'high';
  strategy: OrchestrationStrategy;
  rationale: string;
  recommendations: string[];
  recommendedModels: RecommendedModels;
}

export interface GenerateRequest {
  prompt: string;
  projectId?: string; // omit to create new
  complexityProfile?: ComplexityProfile;
}

export type GenerationStage =
  | 'analyzing'
  | 'haiku_ui'
  | 'deepseek_code'
  | 'self_healing'
  | 'esbuild_preview';

export type OrchestrationStrategy = 'haiku-only' | 'deepseek-only' | 'hybrid-dual';

export type AgentSource = 'claude-haiku' | 'deepseek' | 'agent-manager';

export interface BlueprintChunkMeta {
  templateId: string;
  displayName: string;
  selectorProvider: string;
  allowedFiles: string[];
  allowedPackages: string[];
}

export interface RagPatternChunkMeta {
  id: string;
  title: string;
  category: string;
  score: number;
}

export interface HealingAttemptMeta {
  attempt: number;
  maxAttempts: number;
  errorSummary?: string;
}

export interface GenerateChunk {
  type: 'status' | 'file' | 'done' | 'error';
  stage?: GenerationStage;
  agent?: AgentSource;
  message?: string;
  file?: ProjectFile;
  error?: string;
  projectId?: string;
  summary?: string;
  assistantMessage?: string;
  diffLines?: DiffLine[];
  previewHtml?: string | null;
  previewError?: string | null;
  complexity?: ComplexityProfile;
  blueprint?: BlueprintChunkMeta;
  ragPatterns?: RagPatternChunkMeta[];
  healing?: HealingAttemptMeta;
  providers?: {
    architect?: string;
    architectModel?: string;
    engineer?: string;
    engineerModel?: string;
    strategy: OrchestrationStrategy;
  };
}

export type GenerationStream = AsyncGenerator<GenerateChunk>;

export type AgentTarget = 'haiku' | 'deepseek' | 'hybrid';

export interface AgentRoutingDecision {
  target: AgentTarget;
  strategy: OrchestrationStrategy;
  useHaiku: boolean;
  useDeepSeek: boolean;
  activeAgentLabel: string;
  complexity: ComplexityProfile;
}

export type PipelineStepState = 'completed' | 'active' | 'pending' | 'skipped';

export interface PipelineProgressStep {
  id: GenerationStage;
  label: string;
  agentLabel: string;
  state: PipelineStepState;
}

export interface PipelineProgressInfo {
  percent: number;
  activeStage: GenerationStage;
  activeAgent: AgentSource;
  headline: string;
  detail: string;
  steps: PipelineProgressStep[];
}

