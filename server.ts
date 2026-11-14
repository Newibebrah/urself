import 'dotenv/config';
import path from 'node:path';
import express, { type Request, type Response } from 'express';
import { createServer as createViteServer } from 'vite';
import { z } from 'zod';
import type { ComplexityProfile, GenerateRequest } from './src/features/generation/types.ts';
import type { ProjectFile } from './src/features/projects/types.ts';
import { agentManager } from './src/server/orchestration/agent-manager.ts';
import { requestDeepSeekRepair } from './src/server/pipeline/deepseek-engineer.ts';
import { compilePreviewWithEsbuild } from './src/server/pipeline/esbuild-preview.ts';
import { retrieveRelevantPatterns, UI_PATTERN_CORPUS } from './src/server/pipeline/pattern-rag.ts';
import { analyzePrompt } from './src/server/pipeline/prompt-analyzer.ts';
import { runSelfHealingLoop } from './src/server/pipeline/self-healing.ts';
import { TEMPLATE_CONTRACTS, type TemplateId } from './src/server/pipeline/template-contracts.ts';
import { createZipArchive } from './src/server/pipeline/zip-exporter.ts';
import { projectStore } from './src/server/store/project-store.ts';

function isConfigured(val?: string): boolean {
  return Boolean(val && val.trim().length > 0 && !val.trim().startsWith('MY_'));
}

const ComplexityProfileSchema = z.object({
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

const ProjectFileSchema = z.object({
  path: z.string().min(1).max(200),
  content: z.string(),
  version: z.number().int().min(1).default(1),
});

const BuilderMessageSchema = z.object({
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

const PromptStatePatchSchema = z.object({
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

const CreateProjectSchema = z.object({
  name: z.string().max(80).optional(),
  initialPrompt: z.string().max(4000).optional(),
  framework: z.literal('react-vite').optional(),
  thumbnailColor: z.string().max(24).optional(),
});

const UpdateProjectSchema = z.object({
  name: z.string().trim().min(1).max(64).optional(),
  status: z.enum(['draft', 'generating', 'ready', 'failed']).optional(),
  thumbnailColor: z.string().max(24).optional(),
  files: z.array(ProjectFileSchema).optional(),
  appendMessages: z.array(BuilderMessageSchema).optional(),
  replaceMessages: z.array(BuilderMessageSchema).optional(),
  promptState: PromptStatePatchSchema.optional(),
});

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  // Capability health endpoint (never returns secret values)
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      ok: true,
      providers: {
        haikuConfigured: isConfigured(process.env.ANTHROPIC_API_KEY),
        deepseekConfigured: isConfigured(process.env.DEEPSEEK_API_KEY),
      },
      bundler: 'esbuild',
    });
  });

  // Projects CRUD & Workspace Initialization
  app.get('/api/projects', (_req: Request, res: Response) => {
    res.json({ projects: projectStore.listProjects() });
  });

  app.post('/api/projects', (req: Request, res: Response) => {
    const parsed = CreateProjectSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid project payload' });
      return;
    }

    const ws = projectStore.createProject(parsed.data);
    const full = projectStore.getProjectWithFiles(ws.project.id);
    res.status(201).json(full);
  });

  app.get('/api/projects/:id', (req: Request, res: Response) => {
    const id = String(req.params.id);
    const data = projectStore.getProjectWithFiles(id);
    if (!data) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }
    res.json(data);
  });

  app.patch('/api/projects/:id', (req: Request, res: Response) => {
    const id = String(req.params.id);
    const parsed = UpdateProjectSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid workspace update payload' });
      return;
    }

    const { promptState, ...rest } = parsed.data;
    const updated = projectStore.updateWorkspace(id, {
      ...rest,
      ...(promptState
        ? {
            promptState: {
              phase: promptState.phase,
              activePrompt: promptState.activePrompt,
              activeAgent: promptState.activeAgent,
              strategy: promptState.strategy,
              lastComplexity: promptState.lastComplexity as ComplexityProfile | null | undefined,
              lastError: promptState.lastError,
              revisionCount: promptState.revisionCount,
            },
          }
        : {}),
    });

    if (!updated) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }
    res.json(projectStore.getProjectWithFiles(id));
  });

  app.put('/api/projects/:id/files', (req: Request, res: Response) => {
    const id = String(req.params.id);
    const parsed = z
      .object({
        files: z.array(ProjectFileSchema).min(1),
        label: z.string().max(80).optional(),
      })
      .safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid files payload' });
      return;
    }

    const updated = projectStore.updateWorkspace(id, {
      files: parsed.data.files,
      revisionMeta: {
        label: parsed.data.label,
        summary: `Manual edit (${parsed.data.files.length} files)`,
        source: 'manual',
      },
    });
    if (!updated) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }
    res.json(projectStore.getProjectWithFiles(id));
  });

  app.patch('/api/projects/:id/revisions/:revId', (req: Request, res: Response) => {
    const id = String(req.params.id);
    const revId = String(req.params.revId);
    const parsed = z.object({ label: z.string().trim().min(1).max(80) }).safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: 'Revision label must be 1-80 characters' });
      return;
    }

    const updated = projectStore.labelRevision(id, revId, parsed.data.label);
    if (!updated) {
      res.status(404).json({ error: 'Project or revision not found' });
      return;
    }
    res.json(projectStore.getProjectWithFiles(id));
  });

  app.post('/api/projects/:id/revisions/:revId/rollback', (req: Request, res: Response) => {
    const id = String(req.params.id);
    const revId = String(req.params.revId);
    const updated = projectStore.rollbackToRevision(id, revId);
    if (!updated) {
      res.status(404).json({ error: 'Project or revision not found' });
      return;
    }
    res.json(projectStore.getProjectWithFiles(id));
  });

  app.patch('/api/projects/:id/prompt-state', (req: Request, res: Response) => {
    const id = String(req.params.id);
    const parsed = PromptStatePatchSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid prompt state payload' });
      return;
    }

    const updated = parsed.data.reset
      ? projectStore.resetPromptState(id)
      : projectStore.setPromptState(id, {
          ...(parsed.data.phase !== undefined ? { phase: parsed.data.phase } : {}),
          ...(parsed.data.activePrompt !== undefined
            ? { activePrompt: parsed.data.activePrompt }
            : {}),
          ...(parsed.data.activeAgent !== undefined ? { activeAgent: parsed.data.activeAgent } : {}),
          ...(parsed.data.strategy !== undefined ? { strategy: parsed.data.strategy } : {}),
          ...(parsed.data.lastComplexity !== undefined
            ? { lastComplexity: parsed.data.lastComplexity as ComplexityProfile | null }
            : {}),
          ...(parsed.data.lastError !== undefined ? { lastError: parsed.data.lastError } : {}),
          ...(parsed.data.revisionCount !== undefined
            ? { revisionCount: parsed.data.revisionCount }
            : {}),
        });

    if (!updated) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }
    res.json(projectStore.getProjectWithFiles(id));
  });

  app.post('/api/projects/:id/branch', (req: Request, res: Response) => {
    const id = String(req.params.id);
    const parsed = z.object({ name: z.string().max(64).optional() }).safeParse(req.body ?? {});
    const branch = projectStore.branchProject(id, parsed.success ? parsed.data.name : undefined);
    if (!branch) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }
    res.status(201).json(projectStore.getProjectWithFiles(branch.project.id));
  });

  app.post('/api/projects/:id/duplicate', (req: Request, res: Response) => {
    const id = String(req.params.id);
    const copy = projectStore.duplicateProject(id);
    if (!copy) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }
    const summary = projectStore.listProjects().find((p) => p.id === copy.project.id) ?? copy.project;
    res.status(201).json(summary);
  });

  app.delete('/api/projects/:id', (req: Request, res: Response) => {
    const id = String(req.params.id);
    const deleted = projectStore.deleteProject(id);
    if (!deleted) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }
    res.json({ ok: true });
  });

  // Real ZIP archive export
  app.get('/api/projects/:id/export', (req: Request, res: Response) => {
    const id = String(req.params.id);
    const data = projectStore.getProjectWithFiles(id);
    if (!data) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }
    const zipBytes = createZipArchive(data.files);
    const slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || id;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Length', String(zipBytes.length));
    res.setHeader('Content-Disposition', `attachment; filename="${slug}.zip"`);
    res.send(Buffer.from(zipBytes));
  });

  // Real esbuild compilation endpoint
  app.post('/api/preview', async (req: Request, res: Response) => {
    const body = req.body as { files?: ProjectFile[]; title?: string };
    const files = Array.isArray(body?.files) ? body.files : [];
    const compiled = await compilePreviewWithEsbuild(files, body?.title ?? 'Live Preview');
    if (compiled.error) {
      res.json({ html: null, error: compiled.error });
      return;
    }
    res.json({
      html: compiled.html,
      error: null,
      bundledBytes: compiled.bundledBytes,
    });
  });

  // RAG UI Component Pattern Retrieval Endpoint
  app.get('/api/rag/patterns', (req: Request, res: Response) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const rawTpl = typeof req.query.template === 'string' ? req.query.template.trim() : '';
    const templateId =
      rawTpl && rawTpl in TEMPLATE_CONTRACTS ? (rawTpl as TemplateId) : undefined;

    const patterns = q
      ? retrieveRelevantPatterns(q, templateId, 3)
      : UI_PATTERN_CORPUS.map((p) => ({ ...p, score: 1 }));
    res.json({ patterns, total: patterns.length });
  });

  // Self-Healing Loop Endpoint (AST validation + error-feedback repair loop)
  app.post('/api/projects/:id/self-heal', async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const parsed = z
      .object({
        files: z.array(ProjectFileSchema).min(1),
        error: z.string().optional(),
        prompt: z.string().optional(),
      })
      .safeParse(req.body ?? {});

    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid self-heal payload' });
      return;
    }

    const ws = projectStore.getWorkspace(id);
    const healPrompt =
      parsed.data.prompt?.trim() ||
      ws?.project.initialPrompt ||
      'Repair compilation error and preserve application structure';

    const outcome = await runSelfHealingLoop({
      prompt: healPrompt,
      initialFiles: parsed.data.files,
      title: ws?.project.name ?? 'Live Preview',
      maxAttempts: 3,
      repairWithLlm: async ({ prompt, files, errorSummary, attempt }) =>
        requestDeepSeekRepair({
          prompt,
          files,
          errorSummary: parsed.data.error
            ? `${parsed.data.error}\n${errorSummary}`
            : errorSummary,
          attempt,
        }),
    });

    if (ws && outcome.healed) {
      projectStore.updateWorkspace(id, {
        status: 'ready',
        files: outcome.files,
        revisionMeta: {
          label: `Self-Healed (Attempt ${outcome.attempts || 1})`,
          summary: `Auto-repaired AST/compile error after ${outcome.attempts} iteration(s)`,
          source: 'ai-generation',
          agent: 'deepseek',
          prompt: healPrompt,
        },
        promptState: {
          phase: 'completed',
          activePrompt: null,
          activeAgent: null,
          lastError: null,
        },
      });
    }

    const updatedDetail = projectStore.getProjectWithFiles(id);
    res.json({
      ok: outcome.healed,
      healed: outcome.healed,
      attempts: outcome.attempts,
      files: outcome.files,
      previewHtml: outcome.previewHtml,
      remainingError: outcome.remainingError,
      healingLog: outcome.healingLog,
      detail: updatedDetail,
    });
  });

  // Dual-Model Orchestration Streaming Endpoint (Haiku UI/UX + DeepSeek Code + esbuild Preview)
  app.post('/api/generate', async (req: Request, res: Response) => {
    const body = req.body as GenerateRequest;
    const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';

    if (prompt.length < 3) {
      res.status(400).json({ error: 'Prompt must be at least 3 characters.' });
      return;
    }

    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const writeChunk = (chunk: Record<string, unknown>) => {
      res.write(`${JSON.stringify(chunk)}\n`);
    };

    let activeProjectId: string | null = null;

    try {
      let workspace = body.projectId ? projectStore.getWorkspace(body.projectId) : null;
      if (!workspace) {
        const preliminary = analyzePrompt(prompt, []);
        workspace = projectStore.createProject({
          name: preliminary.brandName,
          initialPrompt: prompt,
        });
      }

      const projectId = workspace.project.id;
      activeProjectId = projectId;
      projectStore.updateWorkspace(projectId, {
        status: 'generating',
        promptState: {
          phase: 'analyzing',
          activePrompt: prompt,
          activeAgent: 'agent-manager',
          lastError: null,
        },
      });

      const streamedFiles = new Map<string, ProjectFile>(
        workspace.files.map((f) => [f.path, f])
      );

      const parsedProfile = body.complexityProfile
        ? ComplexityProfileSchema.safeParse(body.complexityProfile)
        : null;
      const complexityProfile: ComplexityProfile | undefined = parsedProfile?.success
        ? parsedProfile.data
        : undefined;

      for await (const chunk of agentManager.orchestrate(
        { prompt, projectId, complexityProfile },
        { ...workspace.project, files: workspace.files }
      )) {
        if (chunk.type === 'status') {
          projectStore.setPromptState(projectId, {
            ...(chunk.stage ? { phase: chunk.stage } : {}),
            ...(chunk.agent ? { activeAgent: chunk.agent } : {}),
            ...(chunk.complexity
              ? {
                  strategy: chunk.complexity.strategy,
                  lastComplexity: chunk.complexity,
                }
              : {}),
          });
        }

        if (chunk.type === 'file' && chunk.file) {
          streamedFiles.set(chunk.file.path, chunk.file);
        }

        if (chunk.type === 'error') {
          projectStore.updateWorkspace(projectId, {
            status: 'failed',
            promptState: {
              phase: 'failed',
              activePrompt: null,
              activeAgent: null,
              lastError: chunk.error ?? 'Generation failed',
            },
          });
        }

        if (chunk.type === 'done') {
          const finalFiles = Array.from(streamedFiles.values());
          const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const strategyLabel = chunk.providers?.strategy ?? 'hybrid-dual';
          const currentRevision = projectStore.getWorkspace(projectId)?.promptState.revisionCount ?? 0;

          const newMessages = [
            {
              id: `usr_${Date.now()}`,
              role: 'user' as const,
              content: prompt,
              timestamp: nowTime,
              summary: `${strategyLabel} · ${workspace.project.name}`,
            },
            {
              id: `ai_${Date.now() + 1}`,
              role: 'assistant' as const,
              content: chunk.assistantMessage ?? chunk.summary ?? 'Generation complete.',
              timestamp: nowTime,
              summary: chunk.summary,
              diffLines: chunk.diffLines,
            },
          ];

          projectStore.updateWorkspace(projectId, {
            status: chunk.previewError ? 'failed' : 'ready',
            files: finalFiles,
            appendMessages: newMessages,
            revisionMeta: {
              summary: chunk.summary ?? `AI generation (${strategyLabel})`,
              source: 'ai-generation',
              agent: chunk.providers?.engineer ? 'deepseek' : 'claude-haiku',
              prompt,
            },
            promptState: {
              phase: chunk.previewError ? 'failed' : 'completed',
              activePrompt: null,
              activeAgent: null,
              strategy: strategyLabel,
              lastComplexity: chunk.complexity ?? null,
              lastError: chunk.previewError ?? null,
              revisionCount: currentRevision + 1,
            },
          });
        }

        writeChunk(chunk as unknown as Record<string, unknown>);
      }
      res.end();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Generation failed unexpectedly';
      if (activeProjectId) {
        projectStore.updateWorkspace(activeProjectId, {
          status: 'failed',
          promptState: {
            phase: 'failed',
            activePrompt: null,
            activeAgent: null,
            lastError: msg,
          },
        });
      }
      writeChunk({ type: 'error', error: msg });
      res.end();
    }
  });

  // Vite dev middleware vs static production dist
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const port = Number(process.env.PORT ?? 3000);
  app.listen(port, '0.0.0.0', () => {
    console.log(`urself.online server listening on http://localhost:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
