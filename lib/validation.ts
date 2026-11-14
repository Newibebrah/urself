import { z } from 'zod';

export const ComplexityProfileSchema = z.object({
  overallScore: z.number().min(1).max(10),
  codeScore: z.number().min(0).max(10),
  uiScore: z.number().min(0).max(10),
  tier: z.enum(['low', 'medium', 'high']),
  strategy: z.enum(['haiku-only', 'deepseek-only', 'hybrid-dual']),
  rationale: z.string(),
  recommendations: z.array(z.string()).default([]),
  recommendedModels: z
    .object({
      uiModel: z.string().optional(),
      codeModel: z.string().optional(),
    })
    .default({}),
});

export const ProjectFileSchema = z.object({
  path: z.string().min(1).max(200),
  content: z.string(),
  version: z.number().int().min(1).default(1),
});

export const BuilderMessageSchema = z.object({
  id: z.string().min(1),
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  timestamp: z.string(),
  summary: z.string().optional(),
  diffLines: z
    .array(
      z.object({
        type: z.enum(['add', 'remove', 'context']),
        text: z.string(),
      })
    )
    .optional(),
});

export const PromptStatePatchSchema = z.object({
  reset: z.boolean().optional(),
  phase: z
    .enum([
      'idle',
      'queued',
      'analyzing',
      'haiku_ui',
      'deepseek_code',
      'self_healing',
      'esbuild_preview',
      'completed',
      'failed',
    ])
    .optional(),
  activePrompt: z.string().nullable().optional(),
  activeAgent: z.enum(['claude-haiku', 'deepseek', 'agent-manager']).nullable().optional(),
  strategy: z.enum(['haiku-only', 'deepseek-only', 'hybrid-dual']).nullable().optional(),
  lastComplexity: ComplexityProfileSchema.nullable().optional(),
  lastError: z.string().nullable().optional(),
  revisionCount: z.number().int().min(0).optional(),
});

export const CreateProjectSchema = z.object({
  name: z.string().max(80).optional(),
  initialPrompt: z.string().max(4000).optional(),
  framework: z.literal('react-vite').optional(),
  thumbnailColor: z.string().max(24).optional(),
});

export const UpdateProjectSchema = z.object({
  name: z.string().trim().min(1).max(64).optional(),
  status: z.enum(['draft', 'generating', 'ready', 'failed']).optional(),
  thumbnailColor: z.string().max(24).optional(),
  files: z.array(ProjectFileSchema).optional(),
  appendMessages: z.array(BuilderMessageSchema).optional(),
  replaceMessages: z.array(BuilderMessageSchema).optional(),
  promptState: PromptStatePatchSchema.optional(),
});

export const GenerateRequestSchema = z.object({
  prompt: z.string().trim().min(3).max(8000),
  projectId: z.string().uuid().optional(),
  complexityProfile: ComplexityProfileSchema.optional(),
});
