'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Code2,
  Download,
  Edit3,
  Eye,
  FolderTree,
  GitBranch,
  Globe,
  History,
  Play,
  RefreshCw,
  RotateCcw,
  Save,
  Sparkles,
  Wrench,
  X,
  XCircle,
} from 'lucide-react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { DashboardLayout } from '../../components/layout/dashboard-layout';
import { AIChatBox } from '../../components/shared/ai-chat-box';
import { BrowserFrame } from '../../components/shared/browser-frame';
import { ComponentTreeView } from '../../components/shared/component-tree-view';
import { PipelineProgressTracker } from '../../components/shared/pipeline-progress-tracker';
import { RevisionHistory } from '../../components/shared/revision-history';
import { StatusBadge } from '../../components/shared/status-badge';
import { ZipExportOverlay } from '../../components/shared/zip-export-overlay';
import { Skeleton } from '../../components/ui/skeleton';
import { Tooltip } from '../../components/ui/tooltip';
import { AgentManager } from '../../features/generation/agent-manager';
import { streamGeneration } from '../../features/generation/api';
import type {
  AgentSource,
  BlueprintChunkMeta,
  ComplexityProfile,
  GenerationStream,
  OrchestrationStrategy,
  RagPatternChunkMeta,
} from '../../features/generation/types';
import { buildPreview } from '../../features/preview/api';
import { getExportZipUrl, selfHealProjectFiles, updateProject } from '../../features/projects/api';
import {
  validateProjectForExport,
  type ExportValidationResult,
} from '../../features/projects/project-inspector';
import type { ProjectFile } from '../../features/projects/types';
import { createInitialLifecycle, createSeedRevision } from '../../features/projects/workspace-reducer';
import { useWorkspaceStore } from '../../features/projects/workspace-store';
import {
  buildZipExportProgressSnapshot,
  runZipExportPipeline,
  type ZipExportProgressState,
} from '../../features/projects/zip-export';
import { cn } from '../../lib/utils';
import type { BuilderMessage } from '../../types';

const ACTIVE_PHASES = new Set([
  'analyzing',
  'haiku_ui',
  'deepseek_code',
  'self_healing',
  'esbuild_preview',
]);

export function ProjectBuilderPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    state,
    loadProjectDetail,
    renameWorkspace,
    branchWorkspace,
    editFileContent,
    saveFiles,
    labelRevision,
    rollbackRevision,
    resetPrompt,
    dismissQueuedPrompt,
    dispatchPromptStarted,
    dispatchPromptProgress,
    dispatchPromptFile,
    dispatchPromptCompleted,
    dispatchPromptFailed,
  } = useWorkspaceStore();

  const storedDetail = state.detailsById[id];
  const project = storedDetail ?? state.projectsById[id] ?? {
    id,
    name: 'Loading workspace',
    framework: 'react-vite' as const,
    status: 'draft' as const,
    updatedAt: new Date(0).toISOString(),
  };
  const files = useMemo(() => storedDetail?.files ?? [], [storedDetail?.files]);
  const messages = useMemo(() => storedDetail?.messages ?? [], [storedDetail?.messages]);
  const revisions = useMemo(() => storedDetail?.revisions ?? [], [storedDetail?.revisions]);
  const promptState = storedDetail?.promptState ?? project.promptState ?? null;
  const dirtyFiles = Boolean(storedDetail?.dirtyFiles);

  const lifecycle = useMemo(
    () => state.lifecyclesById[id] ?? createInitialLifecycle(promptState),
    [id, promptState, state.lifecyclesById]
  );

  const [selectedFilePath, setSelectedFilePath] = useState<string>('src/App.tsx');
  const [rightMode, setRightMode] = useState<'preview' | 'code' | 'revisions'>('preview');
  const [isSavingFiles, setIsSavingFiles] = useState(false);

  const [isRenamingProject, setIsRenamingProject] = useState(false);
  const [renameDraft, setRenameDraft] = useState('');
  const [isBranching, setIsBranching] = useState(false);

  const [historyFilter, setHistoryFilter] = useState('');
  const [draftPrompt, setDraftPrompt] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewSrcDoc, setPreviewSrcDoc] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [localStreaming, setLocalStreaming] = useState(false);
  const [mobileTab, setMobileTab] = useState<'chat' | 'preview'>('chat');
  const [isHydratingWorkspace, setIsHydratingWorkspace] = useState(!storedDetail);
  const [showComponentTree, setShowComponentTree] = useState(true);
  const [exportValidation, setExportValidation] = useState<ExportValidationResult | null>(null);
  const [zipExportProgress, setZipExportProgress] = useState<ZipExportProgressState | null>(null);
  const [streamBlueprint, setStreamBlueprint] = useState<BlueprintChunkMeta | null>(null);
  const [streamRagPatterns, setStreamRagPatterns] = useState<RagPatternChunkMeta[]>([]);
  const [isAutoHealing, setIsAutoHealing] = useState(false);

  const chatBottomRef = useRef<HTMLDivElement>(null);
  const autoPromptRanRef = useRef<string | null>(null);
  const activeBlobRef = useRef<string | null>(null);
  const exportAbortRef = useRef<AbortController | null>(null);
  const filesRef = useRef<ProjectFile[]>(files);
  filesRef.current = files;

  const isGenerating = localStreaming || ACTIVE_PHASES.has(lifecycle.phase);
  const pipelineStatus = lifecycle.pipelineStatus;
  const pipelineStage = lifecycle.stage;
  const pipelineAgent = lifecycle.activeAgent;
  const activeStrategy = lifecycle.strategy;
  const complexityInfo = lifecycle.complexity;

  const setSafeBlobPreview = useCallback((url: string | null) => {
    if (activeBlobRef.current) {
      URL.revokeObjectURL(activeBlobRef.current);
      activeBlobRef.current = null;
    }
    if (url) {
      activeBlobRef.current = url;
    }
    setPreviewUrl(url);
  }, []);

  useEffect(() => {
    return () => {
      if (activeBlobRef.current) {
        URL.revokeObjectURL(activeBlobRef.current);
      }
      exportAbortRef.current?.abort();
    };
  }, []);

  const compileFilesToPreview = useCallback(
    async (targetFiles: ProjectFile[]): Promise<boolean> => {
      const result = await buildPreview({ files: targetFiles });
      if (result.error) {
        setPreviewError(result.error);
        return false;
      }
      setPreviewError(null);
      setPreviewSrcDoc(null);
      setSafeBlobPreview(result.htmlUrl);
      return true;
    },
    [setSafeBlobPreview]
  );

  const consumeGenerationStream = useCallback(
    async (
      stream: GenerationStream,
      prompt: string,
      initialStatus: string,
      targetProjectId: string,
      options?: {
        initialComplexity?: ComplexityProfile | null;
        initialStrategy?: OrchestrationStrategy;
        persistSimulated?: boolean;
      }
    ) => {
      setLocalStreaming(true);
      setStreamBlueprint(null);
      setStreamRagPatterns([]);
      dispatchPromptStarted({
        projectId: targetProjectId,
        prompt,
        initialStatus,
        complexity: options?.initialComplexity ?? null,
        strategy: options?.initialStrategy,
      });

      let latestFiles: ProjectFile[] = [...filesRef.current];
      let latestComplexity: ComplexityProfile | null = options?.initialComplexity ?? null;
      let latestStrategy: OrchestrationStrategy =
        options?.initialStrategy ?? latestComplexity?.strategy ?? 'hybrid-dual';
      let lastAgent: AgentSource | null = null;
      let donePayload: {
        summary?: string;
        assistantMessage?: string;
        diffLines?: BuilderMessage['diffLines'];
        previewHtml?: string | null;
        previewError?: string | null;
        complexity?: ComplexityProfile;
        providers?: { strategy: OrchestrationStrategy; engineer?: string; architect?: string | null };
      } | null = null;

      try {
        for await (const chunk of stream) {
          if (chunk.complexity) {
            latestComplexity = chunk.complexity;
            latestStrategy = chunk.complexity.strategy;
          }
          if (chunk.agent) {
            lastAgent = chunk.agent;
          }
          if (chunk.blueprint) {
            setStreamBlueprint(chunk.blueprint);
          }
          if (chunk.ragPatterns && chunk.ragPatterns.length > 0) {
            setStreamRagPatterns(chunk.ragPatterns);
          }
          if (chunk.type === 'status') {
            dispatchPromptProgress({
              projectId: targetProjectId,
              statusMessage: chunk.message ?? null,
              stage: chunk.stage ?? null,
              agent: chunk.agent ?? null,
              complexity: chunk.complexity ?? null,
              strategy: chunk.complexity?.strategy,
            });
          } else if (chunk.type === 'file' && chunk.file) {
            latestFiles = [...latestFiles.filter((f) => f.path !== chunk.file!.path), chunk.file];
            dispatchPromptFile({
              projectId: targetProjectId,
              file: chunk.file,
              agent: chunk.agent ?? lastAgent,
            });
          } else if (chunk.type === 'error') {
            const errText = chunk.error ?? 'Generation failed';
            toast.error(errText);
            dispatchPromptFailed(targetProjectId, errText);
          } else if (chunk.type === 'done') {
            if (chunk.providers?.strategy) {
              latestStrategy = chunk.providers.strategy;
            }
            donePayload = chunk;
          }
        }

        if (donePayload) {
          const aiMsg: BuilderMessage = {
            id: `ai-${Date.now()}`,
            role: 'assistant',
            content:
              donePayload.assistantMessage ??
              donePayload.summary ??
              'Updated React + Tailwind components.',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            summary: donePayload.summary,
            diffLines: donePayload.diffLines,
          };

          if (donePayload.previewHtml) {
            setPreviewError(null);
            setSafeBlobPreview(null);
            setPreviewSrcDoc(donePayload.previewHtml);
          } else if (donePayload.previewError) {
            setPreviewError(donePayload.previewError);
          } else if (latestFiles.length > 0) {
            await compileFilesToPreview(latestFiles);
          }

          const resolvedComplexity = donePayload.complexity ?? latestComplexity;
          const resolvedStrategy =
            donePayload.providers?.strategy ?? resolvedComplexity?.strategy ?? latestStrategy;
          const resolvedAgent: AgentSource =
            donePayload.providers?.engineer ? 'deepseek' : lastAgent ?? 'deepseek';
          const summaryText = donePayload.summary ?? `AI generation (${resolvedStrategy})`;

          dispatchPromptCompleted({
            projectId: targetProjectId,
            files: latestFiles,
            assistantMessage: aiMsg,
            summary: summaryText,
            prompt,
            strategy: resolvedStrategy,
            complexity: resolvedComplexity,
            agent: resolvedAgent,
            previewError: donePayload.previewError ?? null,
          });

          if (options?.persistSimulated) {
            const userMsg: BuilderMessage = {
              id: `usr-sim-${Date.now()}`,
              role: 'user',
              content: prompt,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              summary: prompt.slice(0, 40),
            };
            const nextStatus = donePayload.previewError ? 'failed' : 'ready';
            try {
              await updateProject(targetProjectId, {
                status: nextStatus,
                files: latestFiles,
                appendMessages: [userMsg, aiMsg],
                promptState: {
                  phase: nextStatus === 'failed' ? 'failed' : 'completed',
                  activePrompt: null,
                  activeAgent: null,
                  strategy: resolvedStrategy,
                  lastComplexity: resolvedComplexity,
                  lastError: donePayload.previewError ?? null,
                  revisionCount: revisions.length + 1,
                },
              });
              await loadProjectDetail(targetProjectId);
            } catch {
              // Simulated build remains cached in WorkspaceStore if offline
            }
          } else {
            // Re-sync authoritative server revisions created by /api/generate
            await loadProjectDetail(targetProjectId).catch(() => {});
          }

          toast.success('Build compiled and preview updated.');
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Streaming connection failed.';
        toast.error(errMsg);
        dispatchPromptFailed(targetProjectId, errMsg);
      } finally {
        setLocalStreaming(false);
        setStreamBlueprint(null);
        setStreamRagPatterns([]);
      }
    },
    [
      compileFilesToPreview,
      dispatchPromptCompleted,
      dispatchPromptFailed,
      dispatchPromptFile,
      dispatchPromptProgress,
      dispatchPromptStarted,
      loadProjectDetail,
      revisions.length,
      setSafeBlobPreview,
    ]
  );

  const runPromptGeneration = useCallback(
    async (prompt: string, targetProjectId: string) => {
      const routing = AgentManager.evaluate(
        { prompt, projectId: targetProjectId },
        filesRef.current.length
      );
      await consumeGenerationStream(
        streamGeneration({ prompt, projectId: targetProjectId }),
        prompt,
        `AgentManager (${routing.complexity.tier} · ${routing.complexity.overallScore}/10): Routing to ${routing.activeAgentLabel}...`,
        targetProjectId,
        {
          initialComplexity: routing.complexity,
          initialStrategy: routing.strategy,
        }
      );
    },
    [consumeGenerationStream]
  );

  useEffect(() => {
    let cancelled = false;
    const promptParam = searchParams.get('prompt');

    async function load() {
      try {
        const detail = await loadProjectDetail(id);
        if (cancelled) return;

        if (detail.files.length > 0 && !detail.files.some((f) => f.path === selectedFilePath)) {
          setSelectedFilePath(detail.files[0].path);
        }

        if (promptParam && autoPromptRanRef.current !== `${id}:${promptParam}`) {
          autoPromptRanRef.current = `${id}:${promptParam}`;
          router.replace(`/projects/${id}`);
          await runPromptGeneration(promptParam, detail.id);
        } else {
          await compileFilesToPreview(detail.files);
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : 'Failed to load workspace.');
        }
      } finally {
        if (!cancelled) {
          setIsHydratingWorkspace(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, pipelineStatus]);

  const handleRenameCommit = async () => {
    const clean = renameDraft.trim();
    if (!clean) {
      toast.error('Workspace name cannot be empty.');
      return;
    }
    try {
      const updated = await renameWorkspace(project.id, clean);
      setIsRenamingProject(false);
      toast.success(`Renamed workspace to "${updated.name}".`);
    } catch {
      toast.error('Failed to rename workspace.');
    }
  };

  const handleBranchWorkspace = async () => {
    if (isBranching) return;
    setIsBranching(true);
    try {
      const branched = await branchWorkspace(project.id);
      toast.success(`Created branch "${branched.name}".`);
      router.push(`/projects/${branched.id}`);
    } catch {
      toast.error('Failed to branch workspace.');
    } finally {
      setIsBranching(false);
    }
  };

  const handleResetPromptState = async () => {
    try {
      await resetPrompt(project.id);
      toast.success('Prompt state reset cleanly.');
    } catch {
      toast.error('Failed to reset prompt state.');
    }
  };

  const handleDismissQueuedPrompt = async () => {
    await dismissQueuedPrompt(project.id);
    toast.info('Cleared queued prompt.');
  };

  const handleSaveFiles = async () => {
    setIsSavingFiles(true);
    try {
      const updated = await saveFiles(project.id, files);
      const nextFiles = updated?.files ?? files;
      const compiledOk = await compileFilesToPreview(nextFiles);
      if (compiledOk) {
        toast.success('Saved files and updated live preview.');
      } else {
        toast.error('Saved files, but esbuild reported a compilation error.');
      }
    } catch {
      toast.error('Failed to save workspace files.');
    } finally {
      setIsSavingFiles(false);
    }
  };

  const handleAutoHealPreview = async () => {
    if (isAutoHealing) return;
    setIsAutoHealing(true);
    try {
      const lastUserPrompt = [...messages].reverse().find((m) => m.role === 'user')?.content;
      const result = await selfHealProjectFiles(project.id, {
        files,
        error: previewError ?? undefined,
        prompt: lastUserPrompt,
      });

      if (result.detail) {
        await loadProjectDetail(project.id);
      } else {
        for (const nextFile of result.files) {
          editFileContent(project.id, nextFile.path, nextFile.content);
        }
        await saveFiles(
          project.id,
          result.files,
          `Self-healed (${result.attempts} attempt${result.attempts === 1 ? '' : 's'})`
        );
      }

      if (result.previewHtml) {
        setPreviewError(null);
        setSafeBlobPreview(null);
        setPreviewSrcDoc(result.previewHtml);
        toast.success(
          `Self-healing repaired build in ${result.attempts} attempt${result.attempts === 1 ? '' : 's'}.`
        );
      } else if (result.remainingError) {
        setPreviewError(result.remainingError);
        toast.error('Self-healing loop could not automatically fix every compiler error.');
      } else {
        await compileFilesToPreview(result.files);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Self-healing loop failed.');
    } finally {
      setIsAutoHealing(false);
    }
  };

  const handleLabelRevision = async (revisionId: string, label: string) => {
    await labelRevision(project.id, revisionId, label);
    toast.success(`Saved revision label "${label}".`);
  };

  const handleRollbackRevision = async (revisionId: string) => {
    const targetRev = revisions.find((r) => r.id === revisionId);
    const updated = await rollbackRevision(project.id, revisionId);
    const restoredFiles =
      updated?.files ?? targetRev?.files ?? filesRef.current;
    await compileFilesToPreview(restoredFiles);
    toast.success(
      targetRev
        ? `Rolled back workspace to v${targetRev.version} and recompiled preview.`
        : 'Rolled back workspace and recompiled preview.'
    );
  };

  const handleRequestZipExport = () => {
    const report = validateProjectForExport(files, project.framework);
    setExportValidation(report);
    if (!report.valid) {
      toast.error(
        `Export blocked: found ${report.errorCount} validation error${report.errorCount === 1 ? '' : 's'}.`
      );
    }
  };

  const handleCancelZipExport = useCallback(() => {
    if (exportAbortRef.current) {
      exportAbortRef.current.abort();
      exportAbortRef.current = null;
    }
    setZipExportProgress(null);
  }, []);

  const handleConfirmZipDownload = async () => {
    if (exportAbortRef.current) {
      exportAbortRef.current.abort();
    }

    const controller = new AbortController();
    exportAbortRef.current = controller;

    setExportValidation(null);
    setZipExportProgress(
      buildZipExportProgressSnapshot({
        activeStage: 'validating',
        percent: 18,
        detail: `Inspecting ${files.length} workspace file${files.length === 1 ? '' : 's'} and import graph...`,
      })
    );

    const result = await runZipExportPipeline({
      projectName: project.name,
      framework: project.framework,
      files,
      dirtyFiles,
      exportUrl: getExportZipUrl(project.id),
      signal: controller.signal,
      onProgress: (nextState) => {
        if (!controller.signal.aborted) {
          setZipExportProgress(nextState);
        }
      },
      saveWorkspaceFiles: async (latestFiles) => {
        await saveFiles(project.id, latestFiles);
      },
      verifyBundle: async (latestFiles) => {
        const previewRes = await buildPreview({ files: latestFiles });
        if (!previewRes.error && previewRes.htmlUrl) {
          if (previewError || !previewUrl) {
            setPreviewError(null);
            setPreviewSrcDoc(null);
            setSafeBlobPreview(previewRes.htmlUrl);
          } else {
            URL.revokeObjectURL(previewRes.htmlUrl);
          }
        }
        return { error: previewRes.error };
      },
    });

    if (exportAbortRef.current === controller) {
      exportAbortRef.current = null;
    }

    if (result.cancelled) {
      setZipExportProgress(null);
      toast.info('ZIP export cancelled.');
      return;
    }

    if (result.ok) {
      setZipExportProgress(null);
      toast.success(`Project validated. Downloaded ${result.fileName ?? 'ZIP archive'}.`);
    } else if (result.error) {
      toast.error(result.error);
    }
  };

  useEffect(() => {
    if (!exportValidation && !zipExportProgress) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (zipExportProgress) {
          handleCancelZipExport();
        } else {
          setExportValidation(null);
        }
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [exportValidation, handleCancelZipExport, zipExportProgress]);

  const filteredHistory = messages.filter((m) =>
    historyFilter.trim().length === 0
      ? true
      : m.content.toLowerCase().includes(historyFilter.trim().toLowerCase())
  );

  const activeFile = files.find((f) => f.path === selectedFilePath) ?? files[0];
  const queuedPrompt =
    lifecycle.phase === 'queued' && (lifecycle.activePrompt ?? promptState?.activePrompt)
      ? lifecycle.activePrompt ?? promptState?.activePrompt ?? null
      : null;

  return (
    <DashboardLayout breadcrumb={project.name} fullBleed>
      <div className="flex h-[calc(100vh-3.5rem)] flex-col overflow-hidden">
        {/* Mobile Chat / Preview switcher */}
        <div
          role="tablist"
          aria-label="Builder view"
          className="grid grid-cols-2 border-b border-slate-200 bg-white lg:hidden"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mobileTab === 'chat'}
            onClick={() => setMobileTab('chat')}
            className={cn(
              'py-2.5 text-xs font-medium transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500',
              mobileTab === 'chat'
                ? 'border-b-2 border-emerald-600 text-emerald-700'
                : 'text-slate-500'
            )}
          >
            Chat
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mobileTab === 'preview'}
            onClick={() => setMobileTab('preview')}
            className={cn(
              'py-2.5 text-xs font-medium transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500',
              mobileTab === 'preview'
                ? 'border-b-2 border-emerald-600 text-emerald-700'
                : 'text-slate-500'
            )}
          >
            Preview
          </button>
        </div>

        {/* 3-Panel IDE */}
        <div className="flex min-h-0 flex-1">
          {/* Panel 1: Left Chat History & Workspace Metadata */}
          <aside className="hidden w-72 shrink-0 flex-col border-r border-slate-200 bg-white xl:flex">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                History
              </span>
              <StatusBadge status={project.status} />
            </div>

            {project.branchedFromName || promptState ? (
              <div className="border-b border-slate-200 bg-slate-50/70 px-4 py-2.5 text-[11px] text-slate-500">
                {project.branchedFromName ? (
                  <div className="flex items-center gap-1.5 font-medium text-slate-700">
                    <GitBranch className="h-3 w-3 shrink-0 text-emerald-600" strokeWidth={1.75} />
                    <span className="truncate">Branch of {project.branchedFromName}</span>
                  </div>
                ) : null}
                <div className="mt-1 flex items-center justify-between font-mono text-[10px] text-slate-400">
                  <span>phase: {lifecycle.phase}</span>
                  <span>v{revisions.length} rev</span>
                </div>
              </div>
            ) : null}

            <div className="flex-1 space-y-2 overflow-y-auto p-3">
              {filteredHistory.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-xs text-slate-400">
                  No prompt history yet.
                </div>
              ) : (
                filteredHistory.map((item) => (
                  <div
                    key={item.id}
                    className={cn(
                      'rounded-lg border px-3 py-2 text-xs',
                      item.role === 'user'
                        ? 'border-slate-200 bg-slate-50 text-slate-800'
                        : 'border-emerald-200/70 bg-emerald-50/40 text-slate-700'
                    )}
                  >
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span className="font-medium capitalize text-slate-600">{item.role}</span>
                      <span className="tabular-nums">{item.timestamp}</span>
                    </div>
                    <p className="mt-1 line-clamp-2 leading-relaxed">{item.content}</p>
                  </div>
                ))
              )}
            </div>

            <div className="border-t border-slate-200 p-3">
              <label htmlFor="history-filter" className="sr-only">
                Filter message history
              </label>
              <input
                id="history-filter"
                type="search"
                value={historyFilter}
                onChange={(e) => setHistoryFilter(e.target.value)}
                placeholder="Filter history..."
                className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none"
              />
            </div>
          </aside>

          {/* Panel 2: Middle Active Chat (Dark IDE Terminal Aesthetic) */}
          <section
            aria-label="Builder chat"
            className={cn(
              'min-w-0 flex-1 flex-col bg-zinc-950 text-zinc-100',
              mobileTab === 'chat' ? 'flex' : 'hidden lg:flex'
            )}
          >
            {/* Terminal-style header with 3 Mac dots */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 bg-zinc-950 px-4 py-2.5">
              {isRenamingProject ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void handleRenameCommit();
                  }}
                  className="flex items-center gap-1.5"
                >
                  <label htmlFor="builder-rename-input" className="sr-only">
                    Rename workspace
                  </label>
                  <input
                    id="builder-rename-input"
                    type="text"
                    value={renameDraft}
                    onChange={(e) => setRenameDraft(e.target.value)}
                    autoFocus
                    className="h-7 w-44 rounded-lg border border-emerald-500 bg-zinc-900 px-2 text-xs text-zinc-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                  />
                  <Tooltip label="Confirm rename">
                    <button
                      type="submit"
                      aria-label="Confirm workspace rename"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600 text-white transition-all hover:bg-emerald-700 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                    >
                      <Check className="h-3.5 w-3.5" strokeWidth={1.75} />
                    </button>
                  </Tooltip>
                  <Tooltip label="Cancel rename">
                    <button
                      type="button"
                      aria-label="Cancel workspace rename"
                      onClick={() => setIsRenamingProject(false)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-400 transition-all hover:bg-zinc-800 hover:text-zinc-100 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                    >
                      <X className="h-3.5 w-3.5" strokeWidth={1.75} />
                    </button>
                  </Tooltip>
                </form>
              ) : (
                <div className="flex items-center gap-2.5">
                  <div aria-hidden="true" className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-red-500/80" />
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
                  </div>
                  <span className="font-mono text-xs font-medium tracking-tight text-zinc-400">
                    urself-terminal
                  </span>
                  <Tooltip label="Rename workspace" side="bottom">
                    <button
                      type="button"
                      onClick={() => {
                        setRenameDraft(project.name);
                        setIsRenamingProject(true);
                      }}
                      aria-label="Rename workspace"
                      className="inline-flex h-7 items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900 px-2 text-xs text-zinc-300 transition-all hover:border-emerald-500/50 hover:bg-zinc-800 hover:text-zinc-100 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
                    >
                      <Edit3 className="h-3 w-3" strokeWidth={1.5} />
                      <span>Rename</span>
                    </button>
                  </Tooltip>
                </div>
              )}

              <div className="flex items-center gap-1.5">
                <Tooltip label="Create a branch from current workspace" side="bottom">
                  <button
                    type="button"
                    disabled={isBranching || isGenerating}
                    onClick={() => void handleBranchWorkspace()}
                    className="inline-flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 text-xs font-medium text-zinc-200 transition-all hover:border-emerald-500/50 hover:bg-zinc-800 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 disabled:opacity-50"
                  >
                    <GitBranch className="h-3.5 w-3.5 shrink-0 text-emerald-400" strokeWidth={1.5} />
                    <span>{isBranching ? 'Branching...' : 'Branch'}</span>
                  </button>
                </Tooltip>

              </div>
            </div>

            <div className="min-w-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
              {isHydratingWorkspace && !storedDetail ? (
                <div className="space-y-3" aria-label="Hydrating workspace chat">
                  <Skeleton className="h-16 w-3/4 ml-auto border-zinc-800 bg-zinc-900" />
                  <Skeleton className="h-24 w-full border-zinc-800 bg-zinc-900" />
                </div>
              ) : null}

              {/* Failed / Interrupted Prompt State Recovery Banner */}
              {(project.status === 'failed' || lifecycle.phase === 'failed') && !isGenerating ? (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/40 bg-amber-950/40 px-4 py-3 text-xs text-amber-200">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" strokeWidth={1.5} />
                    <div>
                      <div className="font-semibold text-amber-100">
                        Workspace prompt state needs recovery
                      </div>
                      <p className="mt-0.5 leading-relaxed text-amber-300/90">
                        {lifecycle.lastError ??
                          promptState?.lastError ??
                          'Previous generation ended with an error.'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleResetPromptState()}
                    className="inline-flex h-7 items-center gap-1 rounded-lg border border-amber-500/50 bg-zinc-900 px-2.5 text-xs font-medium text-amber-200 transition-all hover:bg-zinc-800 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                  >
                    <RotateCcw className="h-3 w-3" strokeWidth={1.5} />
                    <span>Reset State</span>
                  </button>
                </div>
              ) : null}

              {/* Queued Initial Prompt Banner */}
              {queuedPrompt && !isGenerating ? (
                <div className="rounded-xl border border-emerald-500/40 bg-zinc-900 p-4 shadow-2xl shadow-emerald-500/10">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-xs font-semibold uppercase tracking-wider text-emerald-400">
                      Queued Prompt Ready
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setDraftPrompt(queuedPrompt);
                          void handleDismissQueuedPrompt();
                        }}
                        className="inline-flex h-7 items-center rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 text-xs font-medium text-zinc-300 transition-all hover:bg-zinc-800 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                      >
                        Load to Input
                      </button>
                      <button
                        type="button"
                        onClick={() => void runPromptGeneration(queuedPrompt, project.id)}
                        className="inline-flex h-7 items-center gap-1 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-2.5 text-xs font-medium text-white shadow-sm transition-all hover:from-emerald-500 hover:to-teal-500 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                      >
                        <Play className="h-3 w-3" strokeWidth={1.5} />
                        <span>Run Prompt</span>
                      </button>
                    </div>
                  </div>
                  <p className="mt-2 font-mono text-xs leading-relaxed text-zinc-300">
                    {queuedPrompt}
                  </p>
                </div>
              ) : null}

              {messages.map((msg, idx) => {
                const isAssistant = msg.role === 'assistant';
                return (
                  <div
                    key={msg.id}
                    className={cn(
                      'group min-w-0 max-w-full overflow-hidden rounded-xl border p-4 text-sm transition-colors',
                      isAssistant
                        ? 'border-zinc-800 bg-zinc-900/90 text-zinc-200'
                        : 'ml-auto max-w-xl border-emerald-500/30 bg-emerald-950/35 text-zinc-100'
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 font-mono text-xs font-medium text-zinc-400">
                        {isAssistant ? (
                          <Sparkles className="h-3.5 w-3.5 text-emerald-400" strokeWidth={1.5} />
                        ) : null}
                        <span className={isAssistant ? 'text-emerald-400' : 'text-zinc-300'}>
                          {isAssistant ? 'urself AI' : 'You'}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">{msg.timestamp}</span>
                      </div>

                      {isAssistant ? (
                        <div className="flex items-center gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                          <Tooltip label="Regenerate response">
                            <button
                              type="button"
                              aria-label="Regenerate response"
                              disabled={isGenerating}
                              onClick={() => {
                                const prevUser = messages[idx - 1];
                                if (prevUser) {
                                  void runPromptGeneration(prevUser.content, project.id);
                                }
                              }}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 transition-all hover:bg-zinc-800 hover:text-zinc-100 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-40"
                            >
                              <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.5} />
                            </button>
                          </Tooltip>
                          <Tooltip label="Edit prompt">
                            <button
                              type="button"
                              aria-label="Edit previous prompt"
                              onClick={() => {
                                const prevUser = messages[idx - 1];
                                if (prevUser) {
                                  setDraftPrompt(prevUser.content);
                                  toast.info('Loaded prompt into input.');
                                }
                              }}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 transition-all hover:bg-zinc-800 hover:text-zinc-100 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                            >
                              <Edit3 className="h-3.5 w-3.5" strokeWidth={1.5} />
                            </button>
                          </Tooltip>
                        </div>
                      ) : null}
                    </div>

                    <p
                      className={cn(
                        'mt-2 leading-relaxed',
                        isAssistant
                          ? 'font-mono text-xs text-zinc-200'
                          : 'text-sm text-zinc-100'
                      )}
                    >
                      {msg.content}
                    </p>

                    {msg.diffLines && msg.diffLines.length > 0 ? (
                      <pre className="mt-3 max-w-full overflow-x-auto rounded-lg border border-zinc-800 bg-black/70 p-3 font-mono text-[11px] leading-relaxed text-zinc-200">
                        <code>
                          {msg.diffLines.map((line, i) => (
                            <span
                              key={i}
                              className={cn(
                                'block',
                                line.type === 'add' && 'text-emerald-400',
                                line.type === 'remove' && 'text-red-400',
                                line.type === 'context' && 'text-zinc-500'
                              )}
                            >
                              {line.type === 'add' ? '+ ' : line.type === 'remove' ? '- ' : '  '}
                              {line.text}
                            </span>
                          ))}
                        </code>
                      </pre>
                    ) : null}
                  </div>
                );
              })}

              {pipelineStatus ? (
                <PipelineProgressTracker
                  theme="dark"
                  pipelineStatus={pipelineStatus}
                  pipelineStage={pipelineStage}
                  agent={pipelineAgent}
                  strategy={activeStrategy}
                  complexity={complexityInfo}
                  blueprint={streamBlueprint}
                  ragPatterns={streamRagPatterns}
                />
              ) : null}

              <div ref={chatBottomRef} />
            </div>

            <div className="border-t border-zinc-800 bg-zinc-950 p-3 sm:p-4">
              <AIChatBox
                key={draftPrompt}
                variant="compact"
                theme="dark"
                showSuggestions={false}
                initialValue={draftPrompt}
                placeholder="Ask AI to change layout, copy, or styling..."
                submitLabel={isGenerating ? 'Building...' : 'Send'}
                onSubmit={(prompt) => {
                  if (!isGenerating) {
                    setDraftPrompt('');
                    void runPromptGeneration(prompt, project.id);
                  }
                }}
              />
            </div>
          </section>

          {/* Panel 3: Right Live Preview + Source Code + Revision History */}
          <section
            aria-label="Live preview"
            className={cn(
              'relative min-w-0 flex-1 flex-col border-l border-slate-200 bg-slate-50 p-4 pb-20',
              mobileTab === 'preview' ? 'flex' : 'hidden lg:flex'
            )}
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <div
                role="tablist"
                aria-label="Workspace output mode"
                className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-sm"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={rightMode === 'preview'}
                  onClick={() => setRightMode('preview')}
                  className={cn(
                    'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1 text-xs font-medium transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500',
                    rightMode === 'preview'
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'text-slate-600 hover:text-slate-900'
                  )}
                >
                  <Eye className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
                  <span>Preview</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={rightMode === 'code'}
                  onClick={() => setRightMode('code')}
                  className={cn(
                    'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1 text-xs font-medium transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500',
                    rightMode === 'code'
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'text-slate-600 hover:text-slate-900'
                  )}
                >
                  <Code2 className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
                  <span>Code ({files.length})</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={rightMode === 'revisions'}
                  onClick={() => setRightMode('revisions')}
                  className={cn(
                    'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1 text-xs font-medium transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500',
                    rightMode === 'revisions'
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'text-slate-600 hover:text-slate-900'
                  )}
                >
                  <History className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
                  <span>Revisions ({revisions.length})</span>
                </button>
              </div>

              <span
                title={
                  complexityInfo
                    ? `${complexityInfo.tier.toUpperCase()} (${complexityInfo.overallScore}/10)\n${complexityInfo.recommendations.join('\n')}`
                    : undefined
                }
                className="hidden min-w-0 truncate text-xs font-mono text-slate-500 tabular-nums sm:inline"
              >
                {activeStrategy === 'haiku-only'
                  ? `Haiku (${complexityInfo?.recommendedModels?.uiModel ?? 'claude-3-5-haiku'})`
                  : activeStrategy === 'deepseek-only'
                  ? `DeepSeek (${complexityInfo?.recommendedModels?.codeModel ?? 'deepseek-chat'})`
                  : `Haiku + DeepSeek${
                      complexityInfo?.recommendedModels?.codeModel
                        ? ` (${complexityInfo.recommendedModels.codeModel})`
                        : ''
                    }`}
                {complexityInfo ? ` · ${complexityInfo.overallScore}/10` : ''}
              </span>
            </div>

            {rightMode === 'preview' ? (
              <BrowserFrame
                url={`${project.id}.urself.online`}
                className="min-h-0 flex-1"
                contentClassName="h-full"
              >
                {previewError ? (
                  <div className="p-6">
                    <div className="rounded-xl border border-red-200 bg-red-50/70 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex items-start gap-2.5 min-w-0">
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" strokeWidth={1.75} />
                          <div className="min-w-0">
                            <h3 className="text-xs font-bold tracking-tight text-red-900">
                              esbuild compilation error
                            </h3>
                            <p className="mt-1 break-words font-mono text-xs leading-relaxed text-red-700">
                              {previewError}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={isAutoHealing || isGenerating}
                          onClick={() => void handleAutoHealPreview()}
                          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-3 text-xs font-medium text-white shadow-sm transition-all hover:from-emerald-700 hover:to-teal-700 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:opacity-50"
                        >
                          <Wrench className="h-3.5 w-3.5" strokeWidth={1.75} />
                          <span>{isAutoHealing ? 'Self-Healing...' : 'Auto-Heal Code'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <iframe
                    title={`${project.name} live preview`}
                    sandbox="allow-scripts"
                    src={previewUrl ?? undefined}
                    srcDoc={previewUrl ? undefined : previewSrcDoc ?? undefined}
                    className="h-full w-full border-0 bg-white"
                  />
                )}
              </BrowserFrame>
            ) : rightMode === 'code' ? (
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-100 shadow-sm">
                <div className="flex items-center justify-between gap-2 border-b border-zinc-800 px-3 py-2">
                  <div className="flex min-w-0 items-center gap-1.5 overflow-x-auto">
                    <Tooltip
                      label={showComponentTree ? 'Hide Component Tree' : 'Show Component Tree'}
                      side="bottom"
                    >
                      <button
                        type="button"
                        aria-label="Toggle component tree"
                        aria-pressed={showComponentTree}
                        onClick={() => setShowComponentTree((prev) => !prev)}
                        className={cn(
                          'inline-flex h-7 shrink-0 items-center gap-1.5 rounded-lg border px-2 text-xs font-medium transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 whitespace-nowrap',
                          showComponentTree
                            ? 'border-emerald-500/40 bg-emerald-950/60 text-emerald-300'
                            : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-200'
                        )}
                      >
                        <FolderTree className="h-3.5 w-3.5" strokeWidth={1.5} />
                        <span className="hidden sm:inline">Tree</span>
                      </button>
                    </Tooltip>

                    <div className="h-4 w-px shrink-0 bg-zinc-800" aria-hidden="true" />

                    <div className="flex items-center gap-1 overflow-x-auto">
                      {files.map((f) => {
                        const shortLabel = f.path.split('/').pop() ?? f.path;
                        return (
                          <button
                            key={f.path}
                            type="button"
                            title={f.path}
                            aria-label={f.path}
                            onClick={() => setSelectedFilePath(f.path)}
                            className={cn(
                              'rounded-lg px-2.5 py-1 font-mono text-xs transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 whitespace-nowrap shrink-0',
                              activeFile?.path === f.path
                                ? 'bg-zinc-800 text-emerald-400'
                                : 'text-zinc-400 hover:text-zinc-200'
                            )}
                          >
                            {shortLabel}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={!dirtyFiles || isSavingFiles}
                    onClick={() => void handleSaveFiles()}
                    className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-2.5 text-xs font-medium text-white transition-all hover:from-emerald-500 hover:to-teal-500 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-40"
                  >
                    <Save className="h-3 w-3" strokeWidth={1.5} />
                    <span>{isSavingFiles ? 'Saving...' : 'Save & Compile'}</span>
                  </button>
                </div>

                <div className="flex min-h-0 flex-1 flex-col md:flex-row overflow-hidden">
                  {showComponentTree ? (
                    <ComponentTreeView
                      files={files}
                      selectedFilePath={activeFile?.path ?? ''}
                      onSelectFile={(path) => setSelectedFilePath(path)}
                      className="max-h-48 shrink-0 border-b border-zinc-800 md:max-h-none md:w-56 md:border-b-0 md:border-r"
                    />
                  ) : null}

                  <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                    <label htmlFor="workspace-code-editor" className="sr-only">
                      Edit {activeFile?.path ?? 'source file'}
                    </label>
                    <textarea
                      id="workspace-code-editor"
                      spellCheck={false}
                      value={activeFile?.content ?? ''}
                      onChange={(e) => {
                        if (activeFile) {
                          editFileContent(project.id, activeFile.path, e.target.value);
                        }
                      }}
                      className="min-h-0 flex-1 resize-none bg-zinc-950 p-4 font-mono text-xs leading-relaxed text-zinc-200 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <RevisionHistory
                revisions={revisions}
                currentFiles={files}
                isGenerating={isGenerating}
                dirtyFiles={dirtyFiles}
                onLabelRevision={handleLabelRevision}
                onRollbackRevision={handleRollbackRevision}
              />
            )}

            {/* Floating Glassmorphic Preview Toolbar */}
            <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-slate-200 bg-white/75 p-1.5 shadow-sm backdrop-blur-md">
              <Tooltip label="Recompile preview with esbuild">
                <button
                  type="button"
                  onClick={async () => {
                    const compiledOk = await compileFilesToPreview(files);
                    if (compiledOk) {
                      toast.success('Recompiled preview with esbuild.');
                    } else {
                      toast.error('Compilation failed — see Preview diagnostics.');
                    }
                  }}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-medium text-slate-700 transition-all hover:bg-slate-100/90 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 whitespace-nowrap"
                >
                  <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.5} />
                  <span>Refresh</span>
                </button>
              </Tooltip>
              <Tooltip label="Validate workspace & download React + Vite ZIP">
                <button
                  type="button"
                  onClick={handleRequestZipExport}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-medium text-slate-700 transition-all hover:bg-slate-100/90 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 whitespace-nowrap"
                >
                  <Download className="h-3.5 w-3.5" strokeWidth={1.5} />
                  <span>Download ZIP</span>
                </button>
              </Tooltip>
              <Tooltip label="Publish workspace to custom domain">
                <button
                  type="button"
                  onClick={() => toast.info('Custom domain publishing pending DNS provisioning.')}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-3.5 text-xs font-medium text-white shadow-sm transition-all hover:from-emerald-700 hover:to-teal-700 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 whitespace-nowrap"
                >
                  <Globe className="h-3.5 w-3.5" strokeWidth={1.5} />
                  <span>Publish</span>
                </button>
              </Tooltip>
            </div>
          </section>
        </div>
      </div>

      {/* Pre-Export ZIP Validation Modal */}
      {exportValidation ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm"
          onClick={() => setExportValidation(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="export-validation-title"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl shadow-emerald-500/10"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] font-medium uppercase tracking-wider text-slate-400">
                    Pre-Export Validation · {exportValidation.framework}
                  </span>
                </div>
                <h2
                  id="export-validation-title"
                  className="mt-1 text-lg font-bold tracking-tighter [word-spacing:0.06em] text-slate-900"
                >
                  {exportValidation.valid
                    ? 'Ready to download ZIP archive'
                    : 'Fix project validation errors before export'}
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  {exportValidation.valid
                    ? `All required React + Vite entry files and syntax checks passed for "${project.name}".`
                    : `${exportValidation.errorCount} blocking issue${exportValidation.errorCount === 1 ? '' : 's'} detected in "${project.name}".`}
                </p>
              </div>
              <button
                type="button"
                aria-label="Close validation modal"
                onClick={() => setExportValidation(null)}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-all hover:bg-slate-50 hover:text-slate-900 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                <X className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </div>

            <ul className="mt-4 max-h-[22rem] space-y-2 overflow-y-auto pr-1">
              {exportValidation.checks.map((check) => (
                <li
                  key={check.id}
                  data-validation-status={check.status}
                  className={cn(
                    'flex items-start justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-xs',
                    check.status === 'pass' && 'border-slate-200 bg-slate-50/70',
                    check.status === 'warning' && 'border-amber-200 bg-amber-50/60',
                    check.status === 'fail' && 'border-red-200 bg-red-50/70'
                  )}
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    {check.status === 'pass' ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" strokeWidth={1.75} />
                    ) : check.status === 'warning' ? (
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" strokeWidth={1.75} />
                    ) : (
                      <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" strokeWidth={1.75} />
                    )}
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900">{check.label}</div>
                      <p className="mt-0.5 leading-relaxed text-slate-500">{check.detail}</p>
                    </div>
                  </div>

                  {check.status === 'fail' && check.filePath && files.some((f) => f.path === check.filePath) ? (
                    <button
                      type="button"
                      onClick={() => {
                        setRightMode('code');
                        setSelectedFilePath(check.filePath!);
                        setExportValidation(null);
                      }}
                      className="shrink-0 rounded-lg border border-red-200 bg-white px-2.5 py-1 text-[11px] font-medium text-red-700 transition-all hover:bg-red-50 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 whitespace-nowrap"
                    >
                      Fix file
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>

            {dirtyFiles && exportValidation.valid ? (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/70 px-3.5 py-2.5 text-xs text-amber-900">
                You have unsaved editor changes — confirming will save and compile your latest files into the ZIP archive.
              </div>
            ) : null}

            <div className="mt-5 flex items-center justify-end gap-2 border-t border-slate-200 pt-4">
              <button
                type="button"
                onClick={() => setExportValidation(null)}
                className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-xs font-medium text-slate-700 transition-all hover:bg-slate-50 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!exportValidation.valid || isSavingFiles}
                onClick={() => void handleConfirmZipDownload()}
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-4 text-xs font-medium text-white shadow-sm transition-all hover:from-emerald-700 hover:to-teal-700 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Download className="h-3.5 w-3.5" strokeWidth={1.5} />
                <span>{isSavingFiles ? 'Saving & Exporting...' : 'Confirm & Download ZIP'}</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {/* ZIP Export Progress Overlay */}
      {zipExportProgress ? (
        <ZipExportOverlay
          projectName={project.name}
          fileCount={files.length}
          progress={zipExportProgress}
          onCancel={handleCancelZipExport}
          onRetry={() => void handleConfirmZipDownload()}
        />
      ) : null}
    </DashboardLayout>
  );
}
