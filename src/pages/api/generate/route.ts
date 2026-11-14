import { badRequest, getApiContext, serverError, unauthorized, logTokenUsage } from '@/lib/api-context';
import { GenerateRequestSchema } from '@/lib/validation';
import type { GenerateChunk } from '@/src/features/generation/types';
import type { ProjectFile } from '@/src/features/projects/types';
import { agentManager } from '@/src/server/orchestration/agent-manager';
import { analyzePrompt } from '@/src/server/pipeline/prompt-analyzer';
import { checkApiRateLimit } from '@/lib/auth';
import { countTokensBoth } from '@/lib/token-counter';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(request: Request) {
  const ctx = await getApiContext();
  if (!ctx) return unauthorized();

  const parsed = GenerateRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest('Prompt must be at least 3 characters.');
  const body = parsed.data;
  const prompt = body.prompt;

  // Check rate limit (5 requests per minute per user)
  const rateLimit = await checkApiRateLimit(ctx.user.id, 'generate', { limit: 5, window: 60 });
  if (!rateLimit.allowed) {
    return Response.json(
      { error: `Too many requests. Try again in ${rateLimit.retryAfter} seconds.` },
      { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } }
    );
  }

  // Free tier limits check: basic plan gets 3 promptings
  if (ctx.user && ctx.plan?.plan_id === 'basic') {
    const supabase = createClient();
    const { data: promptings } = await supabase.from('token_usages').select('*', { count: 'exact', head: true }).eq('tenant_id', ctx.user.id);
    if (promptings && promptings.count >= 3) {
      return badRequest(`Anda telah menggunakan ${promptings.count} prompting dari batas 3 untuk basic plan. Silakan berlangganan plan pro atau king untuk melanjutkan.`);
    }
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      const writeChunk = (chunk: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(chunk)}\n`));
      };

      let activeProjectId: string | null = body.projectId ?? null;
      try {
        let workspace = body.projectId ? await ctx.repo.getProjectDetail(body.projectId) : null;
        if (!workspace) {
          try {
            const preliminary = analyzePrompt(prompt, []);
            workspace = await ctx.repo.createProject({
              name: preliminary.brandName,
              initialPrompt: prompt,
            });
          } catch (createErr) {
            return serverError(createErr instanceof Error ? createErr.message : 'Failed to create project');
          }
        }

        const projectId = workspace.id;
        activeProjectId = projectId;

        await ctx.repo.updateWorkspace(projectId, {
          status: 'generating',
          promptState: {
            phase: 'analyzing',
            activePrompt: prompt,
            activeAgent: 'agent-manager',
            lastError: null,
          },
        });

        const streamedFiles = new Map<string, ProjectFile>(
          workspace.files.map((file) => [file.path, file])
        );

        let totalPromptTokens = 0;

        const agent = await agentManager.getAgent();

        // Send initial analysis chunk
        writeChunk({
          type: 'analysis',
          phase: 'analyzing',
          message: 'Analyzing prompt and initializing agents...',
        });

        // Phase 1: Prompt Analysis
        const analysisResult = await agent.analyzePrompt(prompt);
        totalPromptTokens += analysisResult.tokensUsed;
        writeChunk({
          type: 'analysis',
          phase: 'analyzed',
          message: 'Prompt analyzed successfully',
          brandName: analysisResult.brandName,
          projectType: analysisResult.projectType,
        });

        // Phase 2: Architecture Design
        writeChunk({
          type: 'architecture',
          phase: 'designing',
          message: 'Designing website architecture...',
        });

        const architectureResult = await agent.designArchitecture({
          brandName: analysisResult.brandName,
          projectType: analysisResult.projectType,
          prompt,
        });
        totalPromptTokens += architectureResult.tokensUsed;
        writeChunk({
          type: 'architecture',
          phase: 'designed',
          message: 'Architecture designed successfully',
          pages: architectureResult.pages,
          components: architectureResult.components,
        });

        // Phase 3: Component Generation
        writeChunk({
          type: 'generation',
          phase: 'starting',
          message: 'Generating components...',
        });

        // Generate each page/component
        for (const page of architectureResult.pages) {
          const generationResult = await agent.generateComponents({
            page,
            context: {
              brandName: analysisResult.brandName,
              projectType: analysisResult.projectType,
            },
          });
          totalPromptTokens += generationResult.tokensUsed;

          streamedFiles.set(page.path, {
            path: page.path,
            content: generationResult.html,
            type: 'component',
          });

          writeChunk({
            type: 'generation',
            phase: 'progress',
            message: `Generated ${page.path}`,
            progress: Math.round((generationResult.tokensUsed / Math.max(totalPromptTokens, 1)) * 100),
          });
        }

        // Phase 4: Finalization
        await ctx.repo.updateWorkspace(projectId, {
          status: 'ready',
          promptState: {
            phase: 'completed',
            activePrompt: prompt,
            activeAgent: 'agent-manager',
            lastError: null,
          },
        });

        // Save files to workspace
        await ctx.repo.saveWorkspace(projectId, {
          files: Array.from(streamedFiles.values()),
        });

        // Log token usage
        await logTokenUsage(ctx.user.id, 'generate', totalPromptTokens, projectId);

        // Return completion
        writeChunk({
          type: 'complete',
          projectId: projectId,
          message: 'Website generated successfully!',
          totalPromptTokens,
          fileCount: streamedFiles.size,
          redirectUrl: `/projects/${projectId}`,
        });

        controller.close();
      } catch (error) {
        console.error('Generation error:', error);
        try {
          await ctx.repo.updateWorkspace(activeProjectId ?? '', {
            status: 'failed',
            promptState: {
              phase: 'error',
              activePrompt: prompt,
              activeAgent: 'agent-manager',
              lastError: error instanceof Error ? error.message : 'Unknown error',
            },
          });
        } catch (repoError) {
          // Ignore repo update errors during error handling
        }
        writeChunk({
          type: 'error',
          message: error instanceof Error ? error.message : 'Unknown error occurred',
        });
        controller.close();
      }
    },
    async fallback() {
      // Handle client disconnect
      console.log('Client disconnected during generation');
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}