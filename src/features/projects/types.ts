import type {
  AgentSource,
  ComplexityProfile,
  GenerationStage,
  OrchestrationStrategy,
} from '../generation/types';

export type ProjectStatus = 'draft' | 'generating' | 'ready' | 'failed';
export type Framework = 'react-vite';

export type PromptPhase =
  | 'idle'
  | 'queued'
  | 'analyzing'
  | 'haiku_ui'
  | 'deepseek_code'
  | 'self_healing'
  | 'esbuild_preview'
  | 'completed'
  | 'failed';

export interface ProjectPromptState {
  phase: PromptPhase;
  activePrompt: string | null;
  activeAgent: AgentSource | null;
  strategy: OrchestrationStrategy | null;
  lastComplexity: ComplexityProfile | null;
  lastError: string | null;
  revisionCount: number;
  updatedAt: string;
}

export type RevisionSource =
  | 'seed'
  | 'manual'
  | 'ai-generation'
  | 'rollback'
  | 'branch';

export interface ProjectFile {
  path: string; // e.g. "src/App.tsx"
  content: string;
  version: number;
}

export interface ProjectRevision {
  id: string;
  version: number;
  label: string;
  summary: string;
  source: RevisionSource;
  agent?: AgentSource | null;
  prompt?: string | null;
  createdAt: string; // ISO
  files: ProjectFile[];
}

export interface Project {
  id: string;
  name: string;
  framework: Framework;
  status: ProjectStatus;
  updatedAt: string; // ISO
  thumbnailColor?: string; // for mock preview cards
  initialPrompt?: string;
  branchedFromId?: string;
  branchedFromName?: string;
  fileCount?: number;
  messageCount?: number;
  revisionCount?: number;
  promptState?: ProjectPromptState;
}

export interface ProjectWithFiles extends Project {
  files: ProjectFile[];
  revisions?: ProjectRevision[];
}

export interface CreateProjectInput {
  name?: string;
  initialPrompt?: string;
  framework?: Framework;
  thumbnailColor?: string;
}

export interface PromptLifecycleEntry {
  phase: PromptPhase;
  stage: GenerationStage | null;
  activeAgent: AgentSource | null;
  activePrompt: string | null;
  pipelineStatus: string | null;
  strategy: OrchestrationStrategy;
  complexity: ComplexityProfile | null;
  streamedFilePaths: string[];
  lastError: string | null;
  startedAt: string | null;
  updatedAt: string;
}
