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
        let totalCompletionTokens = 0;

        for await (const chunk of agentManager.orchestrate(
          { prompt, projectId, complexityProfile: body.complexityProfile },
          { ...workspace.project, files: workspace.files }
        )) {
          if (chunk.type === 'status') {
            await ctx.repo.setPromptState(projectId, {
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
            await ctx.repo.updateWorkspace(projectId, {
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
            const now = new Date();
            const nowTime = now.toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            });
            const strategyLabel = chunk.providers?.strategy ?? 'deepseek-only';
            const currentRevision =
              (await ctx.repo.getProjectDetail(projectId))?.promptState.revisionCount ?? 0;

            // Increment promptings usage counter (free tier tracking)
            if (ctx.user && ctx.plan?.plan_id === 'basic') {
              try {
                await supabase.from('token_usages').insert({
                  tenant_id: ctx.user.id,
                  prompt_tokens: 0,
                  completion_tokens: 1, // Count each generation as 1 prompting
                  created_at: now.toISOString(),
                });
              } catch (countErr) {
                console.error('Failed to increment promptings counter:', countErr);
              }
            }

            // Generate slug for publish domain
            const slug = workspace.project.name
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/^-+|-+$/g, '');

            // Update workspace with publish info
            await ctx.repo.updateWorkspace(projectId, {
              status: chunk.previewError ? 'failed' : 'ready',
              files: finalFiles,
              publishedAt: now,
              slug: slug,
              domainStatus: 'pending',
              appendMessages: [
                {
                  id: `usr_${Date.now()}`,
                  role: 'user',
                  content: prompt,
                  timestamp: nowTime,
                  summary: `${strategyLabel} · ${workspace.project.name}`,
                },
                {
                  id: `ai_${Date.now() + 1}`,
                  role: 'assistant',
                  content:
                    chunk.assistantMessage ?? chunk.summary ?? 'Generation complete.',
                  timestamp: nowTime,
                  summary: chunk.summary,
                  diffLines: chunk.diffLines,
                },
              ],
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

            // Log token usage after generation completes
            // We estimate tokens from the prompt; actual completion tokens will be
            // approximated from the generated files' content size
            const generatedContent = finalFiles
              .map((f) => f.content)
              .join('\n');
            const { promptTokens, completionTokens } = countTokensBoth(
              prompt,
              generatedContent
            );

            await logTokenUsage(
              ctx.supabase,
              ctx.user.id,
              chunk.providers?.engineer ?? 'deepseek',
              prompt,
              generatedContent
            );

            // Publish the project (async, non-blocking)
            // This will be handled by the background publish worker
            // For now, set the slug and status for preview
            if (!chunk.previewError) {
              try {
                // Generate preview URL
                const previewUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/preview/${slug}`;
                await ctx.repo.updateWorkspace(projectId, {
                  customDomain: slug,
                  domainStatus: 'pending',
                });
              } catch (publishError) {
                console.error('Publish preview generation failed:', publishError);
                // Continue even if publish fails - project is still ready
              }
            }

            controller.close();
          }

          writeChunk(chunk as unknown as Record<string, unknown>);
        }

        controller.close();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Generation failed unexpectedly';
        if (activeProjectId) {
          try {
            await ctx.repo.updateWorkspace(activeProjectId, {
              status: 'failed',
              promptState: {
                phase: 'failed',
                activePrompt: null,
                activeAgent: null,
                lastError: message,
              },
            });
          } catch {
            // The database error is reported to the stream below.
          }
        }
        writeChunk({ type: 'error', error: message } satisfies Partial<GenerateChunk>);
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}