import type {
  ComplexityProfile,
  GenerateChunk,
  GenerateRequest,
  GenerationStream,
} from '../../features/generation/types.ts';
import type { ProjectFile, ProjectWithFiles } from '../../features/projects/types.ts';
import {
  buildSchemaEnforcedSystemPrompt,
  computeFileDiffLines,
  requestDeepSeekRepair,
  runDeepSeekEngineer,
  synthesizeFromBlueprint,
  type DeepSeekSynthesisResult,
} from '../pipeline/deepseek-engineer.ts';
import { runHaikuUiArchitect, type UIDesignBlueprint } from '../pipeline/haiku-architect.ts';
import { retrieveRelevantPatterns, type RetrievedPattern } from '../pipeline/pattern-rag.ts';
import type { PromptAnalysis } from '../pipeline/prompt-analyzer.ts';
import { runSelfHealingLoop } from '../pipeline/self-healing.ts';
import { StreamingJsonFileParser } from '../pipeline/streaming-json-parser.ts';
import { selectBlueprintPhase1, type TemplateContract } from '../pipeline/template-contracts.ts';
import { evaluatePromptComplexity, resolveComplexityProfile } from './complexity-router.ts';
import { executeTool, availableTools, getProjectSummary, listProjectFiles, readProjectFile, searchProjectFiles } from '../pipeline/agentic-engine.ts';

function isApiKeyReady(value?: string): boolean {
  return Boolean(value && value.trim().length > 0 && !value.trim().startsWith('MY_'));
}

function buildHaikuAssetFile(
  blueprint: UIDesignBlueprint,
  existingFiles: ProjectFile[]
): ProjectFile {
  const prev = existingFiles.find((f) => f.path === 'src/components/BrandAssets.tsx');
  const primarySvg =
    blueprint.svgAssets[0]?.svgMarkup ??
    `<svg viewBox="0 0 32 32" fill="none" class="h-7 w-7" aria-hidden="true"><rect x="2" y="2" width="28" height="28" rx="7" stroke="${blueprint.palette.accent}" stroke-width="2"/></svg>`;

  const safeSvg = primarySvg
    .replace(/class=/g, 'className=')
    .replace(/stroke-width=/g, 'strokeWidth=')
    .replace(/stroke-linecap=/g, 'strokeLinecap=')
    .replace(/stroke-linejoin=/g, 'strokeLinejoin=');

  const content = `import React from 'react';

export const DESIGN_TOKENS = ${JSON.stringify(
    {
      brandName: blueprint.brandName,
      tagline: blueprint.tagline,
      palette: blueprint.palette,
      typography: blueprint.typography,
    },
    null,
    2
  )} as const;

export function BrandMark() {
  return (
    <span className="inline-flex items-center gap-2">
      ${safeSvg}
      <span className="font-semibold tracking-tight">${blueprint.brandName}</span>
    </span>
  );
}
`;

  return {
    path: 'src/components/BrandAssets.tsx',
    content,
    version: (prev?.version ?? 0) + 1,
  };
}

function applyHaikuUiRevision(
  prompt: string,
  blueprint: UIDesignBlueprint,
  existingFiles: ProjectFile[]
): { files: ProjectFile[]; summary: string; assistantMessage: string; diffLines: ReturnType<typeof computeFileDiffLines> } {
  const assetFile = buildHaikuAssetFile(blueprint, existingFiles);
  const existingApp = existingFiles.find((f) => f.path === 'src/App.tsx' || f.path === 'src/App.jsx');

  if (!existingApp || existingApp.content.includes('Draft workspace ready.')) {
    const fallbackApp: ProjectFile = {
      path: 'src/App.tsx',
      version: (existingApp?.version ?? 0) + 1,
      content: `import React from 'react';
import { BrandMark, DESIGN_TOKENS } from './components/BrandAssets';

export default function App() {
  return (
    <div
      style={{ backgroundColor: DESIGN_TOKENS.palette.background, color: DESIGN_TOKENS.palette.textPrimary }}
      className="min-h-screen antialiased"
    >
      <header style={{ borderColor: DESIGN_TOKENS.palette.border }} className="border-b px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <BrandMark />
          <span style={{ color: DESIGN_TOKENS.palette.accent }} className="text-xs font-medium">
            UI Engineered by Haiku
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-20">
        <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
          ${blueprint.sections[0]?.copyHeadline ?? blueprint.brandName}
        </h1>
        <p style={{ color: DESIGN_TOKENS.palette.textMuted }} className="mt-4 max-w-xl text-base leading-relaxed">
          ${blueprint.sections[0]?.copyBody ?? blueprint.tagline}
        </p>
        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
          ${blueprint.sections
            .slice(0, 3)
            .map(
              (s, i) => `<div style={{ backgroundColor: DESIGN_TOKENS.palette.surface, borderColor: DESIGN_TOKENS.palette.border }} className="rounded-xl border p-5">
            <div className="font-mono text-xs opacity-60">0${i + 1}</div>
            <h2 className="mt-2 text-base font-semibold">${s.copyHeadline}</h2>
            <p style={{ color: DESIGN_TOKENS.palette.textMuted }} className="mt-1.5 text-sm">${s.copyBody}</p>
          </div>`
            )
            .join('\n          ')}
        </div>
      </main>
    </div>
  );
}
`,
    };
    const merged = mergeFiles(existingFiles, [assetFile, fallbackApp]);
    return {
      files: merged,
      summary: `Claude Haiku crafted UI tokens, BrandAssets, and ${blueprint.sections.length} layout blocks`,
      assistantMessage: `Claude Haiku engineered the UI/UX design system and SVG assets for ${blueprint.brandName} ("${prompt}").`,
      diffLines: computeFileDiffLines('', fallbackApp.content),
    };
  }

  // Surgical UI/theme polish on existing App.tsx
  const lower = prompt.toLowerCase();
  let updatedContent = existingApp.content;
  if (/dark|zinc|obsidian/.test(lower)) {
    updatedContent = updatedContent
      .replace(/bg-\[#FAFAFA\]/g, 'bg-zinc-950')
      .replace(/bg-white/g, 'bg-zinc-900')
      .replace(/text-slate-900/g, 'text-zinc-50')
      .replace(/text-slate-600/g, 'text-zinc-400')
      .replace(/border-slate-200/g, 'border-zinc-800');
  } else if (/light|clean|white/.test(lower)) {
    updatedContent = updatedContent
      .replace(/bg-zinc-950/g, 'bg-[#FAFAFA]')
      .replace(/bg-zinc-900/g, 'bg-white')
      .replace(/text-zinc-50/g, 'text-slate-900')
      .replace(/border-zinc-800/g, 'border-slate-200');
  }

  if (!updatedContent.includes('BrandAssets')) {
    updatedContent = `// UI tokens synced via BrandAssets (${blueprint.palette.accent})\n${updatedContent}`;
  }

  const updatedApp: ProjectFile = {
    path: existingApp.path,
    content: updatedContent,
    version: existingApp.version + 1,
  };
  const merged = mergeFiles(existingFiles, [assetFile, updatedApp]);
  return {
    files: merged,
    summary: `Claude Haiku updated UI/UX tokens and BrandAssets.tsx`,
    assistantMessage: `Claude Haiku applied UI/UX asset and visual updates for "${prompt}".`,
    diffLines: computeFileDiffLines(existingApp.content, updatedApp.content),
  };
}

function mergeFiles(base: ProjectFile[], updates: ProjectFile[]): ProjectFile[] {
  const map = new Map<string, ProjectFile>();
  for (const f of base) map.set(f.path, f);
  for (const u of updates) map.set(u.path, u);
  return Array.from(map.values());
}

async function* streamDeepSeekTokens(
  prompt: string,
  analysis: PromptAnalysis,
  blueprint: UIDesignBlueprint | null,
  existingFiles: ProjectFile[],
  modelOverride?: string,
  uiModelOverride?: string,
  contract?: TemplateContract | null,
  ragPatterns: RetrievedPattern[] = []
): AsyncGenerator<{ type: 'status'; message: string } | { type: 'file'; file: ProjectFile } | { type: 'result'; result: DeepSeekSynthesisResult }> {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  const baseUrl = (process.env.DEEPSEEK_BASE_URL?.trim() || 'https://api.deepseek.com').replace(/\/+$/, '');
  const rawModel = modelOverride?.trim() || process.env.DEEPSEEK_MODEL?.trim() || 'deepseek-chat';
  const model =
    baseUrl.toLowerCase().includes('api.deepseek.com') && rawModel === 'deepseek-flash'
      ? 'deepseek-chat'
      : rawModel;
  if (!isApiKeyReady(apiKey)) {
    const fallbackBlueprint =
      blueprint ?? (await runHaikuUiArchitect(prompt, analysis, uiModelOverride));
    const synthesis = await runDeepSeekEngineer(
      prompt,
      analysis,
      fallbackBlueprint,
      existingFiles,
      model,
      contract,
      ragPatterns
    );
    for (const file of synthesis.files) {
      yield { type: 'file', file };
    }
    yield { type: 'result', result: synthesis };
    return;
  }

  const contextBlock = analysis.relevantFiles
    .map((f) => `<existing_file path="${f.path}">\n${f.content.slice(0, 3500)}\n</existing_file>`)
    .join('\n\n');

  const systemPrompt = buildSchemaEnforcedSystemPrompt(contract, ragPatterns);

  const userPrompt = `User Request: ${prompt}
Intent: ${analysis.intent}
Phase 1 Selected Blueprint: ${contract?.displayName ?? 'Landing Page'}
${blueprint ? `Claude Haiku UI/UX Blueprint:\n${JSON.stringify(blueprint, null, 2)}` : `Domain: ${analysis.domain}, Brand: ${analysis.brandName}`}
${contextBlock ? `Existing Files:\n${contextBlock}` : ''}`;

  try {
    const requestPayload: Record<string, unknown> = {
      model,
      max_tokens: 4096,
      stream: true,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    };
    if (!model.includes('reasoner')) {
      requestPayload.temperature = 0.2;
    }

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      signal: AbortSignal.timeout(45000),
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestPayload),
    });

    if (!response.ok || !response.body) {
      throw new Error(`DeepSeek stream HTTP ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let sseBuffer = '';
    const streamingParser = new StreamingJsonFileParser();
    const prevMap = new Map(existingFiles.map((f) => [f.path, f]));

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      sseBuffer += decoder.decode(value, { stream: true });

      const lines = sseBuffer.split('\n');
      sseBuffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === '[DONE]') continue;
        try {
          const json = JSON.parse(payload) as {
            choices?: Array<{ delta?: { content?: string } }>;
          };
          const token = json.choices?.[0]?.delta?.content ?? '';
          if (token) {
            const newlyCompleted = streamingParser.feed(token);
            for (const pf of newlyCompleted) {
              const prev = prevMap.get(pf.path);
              yield {
                type: 'file',
                file: {
                  path: pf.path,
                  content: pf.content,
                  version: (prev?.version ?? 0) + 1,
                },
              };
            }
          }
        } catch {
          // ignore partial SSE JSON frame
        }
      }
    }

    const finalSnapshot = streamingParser.getSnapshot();
    const finalParsed = finalSnapshot.files;
    if (finalParsed.length === 0) {
      throw new Error('DeepSeek stream produced no parseable files');
    }

    const updatedFiles: ProjectFile[] = finalParsed.map((pf) => ({
      path: pf.path,
      content: pf.content,
      version: (prevMap.get(pf.path)?.version ?? 0) + 1,
    }));
    const merged = mergeFiles(existingFiles, updatedFiles);
    const prevApp = prevMap.get('src/App.tsx')?.content ?? '';
    const nextApp = merged.find((f) => f.path === 'src/App.tsx')?.content ?? updatedFiles[0].content;
    const summaryText = finalSnapshot.summary || `DeepSeek synthesized ${updatedFiles.length} file(s)`;

    yield {
      type: 'result',
      result: {
        files: merged,
        summary: summaryText,
        assistantMessage: `${summaryText} (DeepSeek Code Engineering)`,
        diffLines: computeFileDiffLines(prevApp, nextApp),
        provider: 'deepseek-api',
      },
    };
  } catch {
    const fallbackBlueprint =
      blueprint ?? (await runHaikuUiArchitect(prompt, analysis, uiModelOverride));
    const synthesis = synthesizeFromBlueprint(
      prompt,
      analysis,
      fallbackBlueprint,
      existingFiles
    );
    for (const file of synthesis.files) {
      yield { type: 'file', file };
    }
    yield { type: 'result', result: synthesis };
  }
}

export class AgentManager {
  evaluatePromptRouting(
    request: GenerateRequest,
    existingFiles: ProjectFile[] = []
  ) {
    const evaluated = request.complexityProfile
      ? resolveComplexityProfile(request, existingFiles)
      : evaluatePromptComplexity(request, existingFiles);

    const target =
      evaluated.complexity.strategy === 'haiku-only'
        ? ('haiku' as const)
        : evaluated.complexity.strategy === 'deepseek-only'
        ? ('deepseek' as const)
        : ('hybrid' as const);

    return {
      ...evaluated,
      target,
      useHaiku: target === 'haiku' || target === 'hybrid',
      useDeepSeek: target === 'deepseek' || target === 'hybrid',
    };
  }

  async *orchestrate(
    request: GenerateRequest,
    workspace: ProjectWithFiles
  ): GenerationStream {
    const { analysis, complexity } = this.evaluatePromptRouting(request, workspace.files);

    // Phase 1: Schema-enforced Blueprint Contract Selection + Vector RAG Component Pattern Retrieval
    const phase1 = await selectBlueprintPhase1(request.prompt, analysis, workspace.files);
    const ragPatterns = retrieveRelevantPatterns(request.prompt, phase1.templateId, 3);

    // Project Context Engine: Retrieve relevant files and summarize
    const projectSummary = getProjectSummary(workspace.files);
    const relevantFiles = await listProjectFiles(workspace.id);
    const searchResults = await searchProjectFiles(workspace.id, request.prompt, (path) => 
      path.includes('src/components') || path.includes('src/pages')
    );

    const blueprintMeta = {
      templateId: phase1.templateId,
      displayName: phase1.displayName,
      selectorProvider: phase1.selectorProvider,
      allowedFiles: phase1.contract.allowedFiles,
      allowedPackages: phase1.contract.allowedPackages,
    };
    const ragMeta = ragPatterns.map((p) => ({
      id: p.id,
      title: p.title,
      category: p.category,
      score: p.score,
    }));

    // Append project context to system prompt (limited to avoid token overflow)
    const contextBlock = relevantFiles.slice(0, 5).map(f => 
      `${f.replace(/^\/projects\/[^/]+\//, '')}: ${workspace.files.find(w => w.path === f)?.content?.substring(0, 200).replace(/\n/g, ' ') || ''}`
    ).filter(Boolean).join('\n\n');

    const selectedUiModel = complexity.recommendedModels.uiModel;
    const selectedCodeModel = complexity.recommendedModels.codeModel;

    yield {
      type: 'status',
      stage: 'analyzing',
      agent: 'agent-manager',
      complexity,
      blueprint: blueprintMeta,
      ragPatterns: ragMeta,
      message: `Phase 1 (${phase1.displayName}) + RAG (${ragPatterns.length} patterns) · ${complexity.strategy}: ${complexity.rationale}`,
    };

    let currentFiles = [...workspace.files];
    let blueprint: UIDesignBlueprint | null = null;
    let architectProvider: string | undefined;
    let architectModel: string | undefined;
    let engineerProvider: string | undefined;
    let engineerModel: string | undefined;
    let finalSummary = '';
    let finalAssistantMessage = '';
    let finalDiffLines = computeFileDiffLines('', '');

    if (complexity.strategy === 'haiku-only') {
      architectModel = selectedUiModel ?? 'claude-3-5-haiku-latest';
      yield {
        type: 'status',
        stage: 'haiku_ui',
        agent: 'claude-haiku',
        complexity,
        blueprint: blueprintMeta,
        ragPatterns: ragMeta,
        message: `Claude Haiku (${architectModel}) crafting UI/UX layout & visual assets for ${analysis.brandName}...`,
      };

      blueprint = await runHaikuUiArchitect(request.prompt, analysis, architectModel);
      architectProvider = blueprint.provider;

      const haikuOutcome = applyHaikuUiRevision(request.prompt, blueprint, currentFiles);
      currentFiles = haikuOutcome.files;
      finalSummary = haikuOutcome.summary;
      finalAssistantMessage = haikuOutcome.assistantMessage;
      finalDiffLines = haikuOutcome.diffLines;

      for (const file of currentFiles) {
        yield {
          type: 'file',
          agent: 'claude-haiku',
          file,
        };
      }
    } else if (complexity.strategy === 'deepseek-only') {
      engineerModel = selectedCodeModel ?? 'deepseek-chat';
      yield {
        type: 'status',
        stage: 'deepseek_code',
        agent: 'deepseek',
        complexity,
        blueprint: blueprintMeta,
        ragPatterns: ragMeta,
        message: `DeepSeek (${engineerModel}) streaming schema-enforced JSON (${phase1.displayName})...`,
      };

      for await (const event of streamDeepSeekTokens(
        request.prompt,
        analysis,
        null,
        currentFiles,
        engineerModel,
        selectedUiModel,
        phase1.contract,
        ragPatterns
      )) {
        if (event.type === 'status') {
          yield { type: 'status', stage: 'deepseek_code', agent: 'deepseek', message: event.message };
        } else if (event.type === 'file') {
          currentFiles = mergeFiles(currentFiles, [event.file]);
          yield { type: 'file', agent: 'deepseek', file: event.file };
        } else if (event.type === 'result') {
          currentFiles = event.result.files;
          engineerProvider = event.result.provider;
          finalSummary = event.result.summary;
          finalAssistantMessage = event.result.assistantMessage;
          finalDiffLines = event.result.diffLines;
        }
      }
    } else {
      // hybrid-dual: Haiku engineers UI/UX blueprint + BrandAssets -> DeepSeek engineers modular React JSON code
      architectModel = selectedUiModel ?? 'claude-3-5-haiku-latest';
      engineerModel = selectedCodeModel ?? 'deepseek-chat';

      yield {
        type: 'status',
        stage: 'haiku_ui',
        agent: 'claude-haiku',
        complexity,
        blueprint: blueprintMeta,
        ragPatterns: ragMeta,
        message: `Claude Haiku (${architectModel}) designing ${analysis.requestedSections.length} UI sections & SVG assets for ${analysis.brandName}...`,
      };

      blueprint = await runHaikuUiArchitect(request.prompt, analysis, architectModel);
      architectProvider = blueprint.provider;

      const haikuAssetFile = buildHaikuAssetFile(blueprint, currentFiles);
      currentFiles = mergeFiles(currentFiles, [haikuAssetFile]);
      yield {
        type: 'file',
        agent: 'claude-haiku',
        file: haikuAssetFile,
      };

      yield {
        type: 'status',
        stage: 'deepseek_code',
        agent: 'deepseek',
        complexity,
        blueprint: blueprintMeta,
        ragPatterns: ragMeta,
        message: `DeepSeek (${engineerModel}) streaming JSON files using ${ragPatterns.length} RAG UI patterns (${phase1.displayName})...`,
      };

      for await (const event of streamDeepSeekTokens(
        request.prompt,
        analysis,
        blueprint,
        currentFiles,
        engineerModel,
        architectModel,
        phase1.contract,
        ragPatterns
      )) {
        if (event.type === 'status') {
          yield { type: 'status', stage: 'deepseek_code', agent: 'deepseek', message: event.message };
        } else if (event.type === 'file') {
          currentFiles = mergeFiles(currentFiles, [event.file]);
          yield { type: 'file', agent: 'deepseek', file: event.file };
        } else if (event.type === 'result') {
          currentFiles = mergeFiles(event.result.files, [haikuAssetFile]);
          engineerProvider = event.result.provider;
          finalSummary = event.result.summary;
          finalAssistantMessage = event.result.assistantMessage;
          finalDiffLines = event.result.diffLines;
        }
      }
    }

    yield {
      type: 'status',
      stage: 'esbuild_preview',
      agent: 'agent-manager',
      complexity,
      blueprint: blueprintMeta,
      ragPatterns: ragMeta,
      message: 'Validating AST syntax, template schema, and esbuild preview bundle...',
    };

    const healingAttemptLogs: Array<{ attempt: number; maxAttempts: number; errorSummary: string }> = [];
    const healingOutcome = await runSelfHealingLoop({
      prompt: request.prompt,
      initialFiles: currentFiles,
      contract: phase1.contract,
      title: blueprint?.brandName ?? analysis.brandName,
      maxAttempts: 3,
      repairWithLlm: async ({ prompt, files, errorSummary, attempt }) =>
        requestDeepSeekRepair({
          prompt,
          files,
          errorSummary,
          contract: phase1.contract,
          attempt,
          modelOverride: engineerModel,
        }),
      onAttempt: (info) => {
        healingAttemptLogs.push(info);
      },
    });

    if (healingAttemptLogs.length > 0) {
      const lastAttempt = healingAttemptLogs[healingAttemptLogs.length - 1];
      yield {
        type: 'status',
        stage: 'self_healing',
        agent: 'deepseek',
        complexity,
        blueprint: blueprintMeta,
        ragPatterns: ragMeta,
        healing: {
          attempt: lastAttempt.attempt,
          maxAttempts: lastAttempt.maxAttempts,
          errorSummary: lastAttempt.errorSummary,
        },
        message: `Self-Healing Loop repaired AST/compile issue (attempt ${lastAttempt.attempt}/${lastAttempt.maxAttempts})`,
      };
      currentFiles = healingOutcome.files;
      for (const file of currentFiles) {
        yield {
          type: 'file',
          agent: 'deepseek',
          file,
        };
      }
    }

    if (!healingOutcome.healed && healingOutcome.remainingError) {
      yield {
        type: 'error',
        agent: 'agent-manager',
        error: healingOutcome.remainingError,
      };
    }

    yield {
      type: 'done',
      agent: 'agent-manager',
      projectId: workspace.id,
      summary: finalSummary,
      assistantMessage: healingOutcome.attempts > 0 && healingOutcome.healed
        ? `${finalAssistantMessage} (Self-Healed after ${healingOutcome.attempts} compiler check${healingOutcome.attempts === 1 ? '' : 's'})`
        : finalAssistantMessage,
      diffLines: finalDiffLines,
      previewHtml: healingOutcome.previewHtml,
      previewError: healingOutcome.remainingError,
      complexity: complexity as ComplexityProfile,
      blueprint: blueprintMeta,
      ragPatterns: ragMeta,
      providers: {
        architect: architectProvider,
        architectModel,
        engineer: engineerProvider,
        engineerModel,
        strategy: complexity.strategy,
      },
    };
  }
}

export const agentManager = new AgentManager();
