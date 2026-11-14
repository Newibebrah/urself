import type { BuilderMessage } from '../../types';
import type {
  AgentSource,
  ComplexityProfile,
  GenerationStage,
  OrchestrationStrategy,
} from '../generation/types';
import type {
  Project,
  ProjectFile,
  ProjectPromptState,
  ProjectRevision,
  PromptLifecycleEntry,
  RevisionSource,
} from './types';

export interface ProjectWorkspaceDetail extends Project {
  files: ProjectFile[];
  messages: BuilderMessage[];
  revisions: ProjectRevision[];
  promptState: ProjectPromptState;
  dirtyFiles?: boolean;
}

export interface WorkspaceStoreState {
  projectsById: Record<string, Project>;
  projectOrder: string[];
  detailsById: Record<string, ProjectWorkspaceDetail>;
  lifecyclesById: Record<string, PromptLifecycleEntry>;
  isLoadingList: boolean;
  listError: string | null;
}

export type WorkspaceAction =
  | { type: 'FETCH_LIST_START' }
  | { type: 'FETCH_LIST_SUCCESS'; projects: Project[] }
  | { type: 'FETCH_LIST_ERROR'; error: string }
  | { type: 'HYDRATE_DETAIL'; detail: ProjectWorkspaceDetail }
  | { type: 'UPSERT_PROJECT'; project: Project }
  | { type: 'RENAME_PROJECT'; projectId: string; name: string; updatedAt?: string }
  | { type: 'REMOVE_PROJECT'; projectId: string }
  | {
      type: 'PROMPT_QUEUED';
      projectId: string;
      prompt: string;
      complexity?: ComplexityProfile | null;
    }
  | {
      type: 'PROMPT_STARTED';
      projectId: string;
      prompt: string;
      initialStatus: string;
      complexity?: ComplexityProfile | null;
      strategy?: OrchestrationStrategy;
    }
  | {
      type: 'PROMPT_PROGRESS';
      projectId: string;
      statusMessage?: string | null;
      stage?: GenerationStage | null;
      agent?: AgentSource | null;
      complexity?: ComplexityProfile | null;
      strategy?: OrchestrationStrategy;
    }
  | {
      type: 'PROMPT_FILE_STREAMED';
      projectId: string;
      file: ProjectFile;
      agent?: AgentSource | null;
    }
  | {
      type: 'PROMPT_COMPLETED';
      projectId: string;
      files: ProjectFile[];
      assistantMessage: BuilderMessage;
      summary: string;
      prompt: string;
      strategy: OrchestrationStrategy;
      complexity: ComplexityProfile | null;
      agent?: AgentSource | null;
      revisions?: ProjectRevision[];
      previewError?: string | null;
    }
  | {
      type: 'PROMPT_FAILED';
      projectId: string;
      error: string;
    }
  | {
      type: 'PROMPT_RESET';
      projectId: string;
      detail?: ProjectWorkspaceDetail;
    }
  | {
      type: 'EDIT_FILE_CONTENT';
      projectId: string;
      path: string;
      content: string;
    }
  | {
      type: 'FILES_SAVED';
      projectId: string;
      files: ProjectFile[];
      revisions?: ProjectRevision[];
      label?: string;
    }
  | {
      type: 'LABEL_REVISION';
      projectId: string;
      revisionId: string;
      label: string;
    }
  | {
      type: 'ROLLBACK_REVISION';
      projectId: string;
      revisionId: string;
      revisions?: ProjectRevision[];
      files?: ProjectFile[];
    };

export const INITIAL_WORKSPACE_STATE: WorkspaceStoreState = {
  projectsById: {},
  projectOrder: [],
  detailsById: {},
  lifecyclesById: {},
  isLoadingList: false,
  listError: null,
};

export function createInitialLifecycle(
  promptState?: ProjectPromptState | null
): PromptLifecycleEntry {
  const now = promptState?.updatedAt ?? new Date().toISOString();
  const phase = promptState?.phase ?? 'idle';
  const stage: GenerationStage | null =
    phase === 'analyzing' ||
    phase === 'haiku_ui' ||
    phase === 'deepseek_code' ||
    phase === 'self_healing' ||
    phase === 'esbuild_preview'
      ? phase
      : null;

  return {
    phase,
    stage,
    activeAgent: promptState?.activeAgent ?? null,
    activePrompt: promptState?.activePrompt ?? null,
    pipelineStatus: null,
    strategy: promptState?.strategy ?? promptState?.lastComplexity?.strategy ?? 'hybrid-dual',
    complexity: promptState?.lastComplexity ?? null,
    streamedFilePaths: [],
    lastError: promptState?.lastError ?? null,
    startedAt: stage ? now : null,
    updatedAt: now,
  };
}

export function createSeedRevision(
  files: ProjectFile[],
  label = 'Initial workspace',
  source: RevisionSource = 'seed'
): ProjectRevision {
  return {
    id: `rev_seed_${Date.now().toString(36)}`,
    version: 1,
    label,
    summary: `Baseline snapshot (${files.length} files)`,
    source,
    agent: null,
    prompt: null,
    createdAt: new Date().toISOString(),
    files: files.map((f) => ({ ...f })),
  };
}

export function buildNextRevision(
  existingRevisions: ProjectRevision[],
  files: ProjectFile[],
  opts: {
    label?: string;
    summary: string;
    source: RevisionSource;
    agent?: AgentSource | null;
    prompt?: string | null;
  }
): ProjectRevision {
  const maxVersion = existingRevisions.reduce((m, r) => Math.max(m, r.version), 0);
  const nextVersion = maxVersion + 1;
  const defaultLabel =
    opts.source === 'ai-generation'
      ? `AI Build v${nextVersion}`
      : opts.source === 'rollback'
      ? `Rollback v${nextVersion}`
      : opts.source === 'manual'
      ? `Manual Edit v${nextVersion}`
      : `Snapshot v${nextVersion}`;

  return {
    id: `rev_${nextVersion}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
    version: nextVersion,
    label: opts.label?.trim() || defaultLabel,
    summary: opts.summary,
    source: opts.source,
    agent: opts.agent ?? null,
    prompt: opts.prompt ?? null,
    createdAt: new Date().toISOString(),
    files: files.map((f) => ({ ...f })),
  };
}

export function areFileListsEqual(a: ProjectFile[], b: ProjectFile[]): boolean {
  if (a.length !== b.length) return false;
  const mapB = new Map(b.map((f) => [f.path, f.content]));
  return a.every((file) => mapB.get(file.path) === file.content);
}

export function computeRevisionDiffStats(
  revisionFiles: ProjectFile[],
  currentFiles: ProjectFile[]
): { changedFiles: number; addedLines: number; removedLines: number } {
  const currentMap = new Map(currentFiles.map((f) => [f.path, f.content]));
  const revisionMap = new Map(revisionFiles.map((f) => [f.path, f.content]));
  const allPaths = new Set([...currentMap.keys(), ...revisionMap.keys()]);

  let changedFiles = 0;
  let addedLines = 0;
  let removedLines = 0;

  for (const filePath of allPaths) {
    const prev = revisionMap.get(filePath);
    const curr = currentMap.get(filePath);
    if (prev === curr) continue;
    changedFiles += 1;
    const prevLines = prev ? prev.split('\n') : [];
    const currLines = curr ? curr.split('\n') : [];
    if (currLines.length >= prevLines.length) {
      addedLines += currLines.length - prevLines.length;
    } else {
      removedLines += prevLines.length - currLines.length;
    }
  }

  return { changedFiles, addedLines, removedLines };
}

function syncSummaryFromDetail(detail: ProjectWorkspaceDetail): Project {
  return {
    id: detail.id,
    name: detail.name,
    framework: detail.framework,
    status: detail.status,
    updatedAt: detail.updatedAt,
    thumbnailColor: detail.thumbnailColor,
    initialPrompt: detail.initialPrompt,
    branchedFromId: detail.branchedFromId,
    branchedFromName: detail.branchedFromName,
    fileCount: detail.files.length,
    messageCount: detail.messages.length,
    revisionCount: detail.revisions.length,
    promptState: detail.promptState,
  };
}

export function selectOrderedProjects(state: WorkspaceStoreState): Project[] {
  return state.projectOrder
    .map((id) => state.projectsById[id])
    .filter((p): p is Project => Boolean(p));
}

export function workspaceReducer(
  state: WorkspaceStoreState,
  action: WorkspaceAction
): WorkspaceStoreState {
  switch (action.type) {
    case 'FETCH_LIST_START':
      return { ...state, isLoadingList: true, listError: null };

    case 'FETCH_LIST_SUCCESS': {
      const nextById: Record<string, Project> = {};
      const nextOrder: string[] = [];
      const nextLifecycles = { ...state.lifecyclesById };

      for (const proj of action.projects) {
        nextById[proj.id] = proj;
        nextOrder.push(proj.id);
        if (!nextLifecycles[proj.id]) {
          nextLifecycles[proj.id] = createInitialLifecycle(proj.promptState);
        }
      }

      return {
        ...state,
        projectsById: nextById,
        projectOrder: nextOrder,
        lifecyclesById: nextLifecycles,
        isLoadingList: false,
        listError: null,
      };
    }

    case 'FETCH_LIST_ERROR':
      return { ...state, isLoadingList: false, listError: action.error };

    case 'HYDRATE_DETAIL': {
      const revisions =
        action.detail.revisions && action.detail.revisions.length > 0
          ? action.detail.revisions
          : [createSeedRevision(action.detail.files)];

      const normalizedDetail: ProjectWorkspaceDetail = {
        ...action.detail,
        revisions,
        dirtyFiles: false,
      };
      const existingLifecycle = state.lifecyclesById[action.detail.id];
      const nextLifecycle =
        existingLifecycle &&
        (existingLifecycle.phase === 'analyzing' ||
          existingLifecycle.phase === 'haiku_ui' ||
          existingLifecycle.phase === 'deepseek_code' ||
          existingLifecycle.phase === 'self_healing' ||
          existingLifecycle.phase === 'esbuild_preview')
          ? existingLifecycle
          : createInitialLifecycle(normalizedDetail.promptState);

      const summary = syncSummaryFromDetail(normalizedDetail);
      const nextOrder = state.projectOrder.includes(summary.id)
        ? state.projectOrder
        : [summary.id, ...state.projectOrder];

      return {
        ...state,
        projectsById: { ...state.projectsById, [summary.id]: summary },
        projectOrder: nextOrder,
        detailsById: { ...state.detailsById, [summary.id]: normalizedDetail },
        lifecyclesById: { ...state.lifecyclesById, [summary.id]: nextLifecycle },
      };
    }

    case 'UPSERT_PROJECT': {
      const nextOrder = state.projectOrder.includes(action.project.id)
        ? state.projectOrder
        : [action.project.id, ...state.projectOrder];

      return {
        ...state,
        projectsById: { ...state.projectsById, [action.project.id]: action.project },
        projectOrder: nextOrder,
        lifecyclesById: {
          ...state.lifecyclesById,
          [action.project.id]:
            state.lifecyclesById[action.project.id] ??
            createInitialLifecycle(action.project.promptState),
        },
      };
    }

    case 'RENAME_PROJECT': {
      const now = action.updatedAt ?? new Date().toISOString();
      const existingProj = state.projectsById[action.projectId];
      const existingDetail = state.detailsById[action.projectId];

      return {
        ...state,
        projectsById: existingProj
          ? {
              ...state.projectsById,
              [action.projectId]: { ...existingProj, name: action.name, updatedAt: now },
            }
          : state.projectsById,
        detailsById: existingDetail
          ? {
              ...state.detailsById,
              [action.projectId]: { ...existingDetail, name: action.name, updatedAt: now },
            }
          : state.detailsById,
      };
    }

    case 'REMOVE_PROJECT': {
      const nextById = { ...state.projectsById };
      delete nextById[action.projectId];
      const nextDetails = { ...state.detailsById };
      delete nextDetails[action.projectId];
      const nextLifecycles = { ...state.lifecyclesById };
      delete nextLifecycles[action.projectId];
      return {
        ...state,
        projectsById: nextById,
        projectOrder: state.projectOrder.filter((id) => id !== action.projectId),
        detailsById: nextDetails,
        lifecyclesById: nextLifecycles,
      };
    }

    case 'PROMPT_QUEUED': {
      const now = new Date().toISOString();
      const prevLifecycle = state.lifecyclesById[action.projectId] ?? createInitialLifecycle();
      const detail = state.detailsById[action.projectId];
      const proj = state.projectsById[action.projectId];
      const nextPromptState: ProjectPromptState = {
        phase: 'queued',
        activePrompt: action.prompt,
        activeAgent: 'agent-manager',
        strategy: action.complexity?.strategy ?? prevLifecycle.strategy,
        lastComplexity: action.complexity ?? prevLifecycle.complexity,
        lastError: null,
        revisionCount: detail?.promptState.revisionCount ?? proj?.promptState?.revisionCount ?? 0,
        updatedAt: now,
      };

      return {
        ...state,
        lifecyclesById: {
          ...state.lifecyclesById,
          [action.projectId]: {
            ...prevLifecycle,
            phase: 'queued',
            stage: null,
            activeAgent: 'agent-manager',
            activePrompt: action.prompt,
            complexity: action.complexity ?? prevLifecycle.complexity,
            lastError: null,
            updatedAt: now,
          },
        },
        projectsById: proj
          ? { ...state.projectsById, [action.projectId]: { ...proj, promptState: nextPromptState } }
          : state.projectsById,
        detailsById: detail
          ? { ...state.detailsById, [action.projectId]: { ...detail, promptState: nextPromptState } }
          : state.detailsById,
      };
    }

    case 'PROMPT_STARTED': {
      const now = new Date().toISOString();
      const prevLifecycle = state.lifecyclesById[action.projectId] ?? createInitialLifecycle();
      const detail = state.detailsById[action.projectId];
      const proj = state.projectsById[action.projectId];
      const userMsg: BuilderMessage = {
        id: `usr-opt-${Date.now()}`,
        role: 'user',
        content: action.prompt,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        summary: action.prompt.slice(0, 40),
      };

      const nextPromptState: ProjectPromptState = {
        phase: 'analyzing',
        activePrompt: action.prompt,
        activeAgent: 'agent-manager',
        strategy: action.strategy ?? action.complexity?.strategy ?? prevLifecycle.strategy,
        lastComplexity: action.complexity ?? prevLifecycle.complexity,
        lastError: null,
        revisionCount: detail?.promptState.revisionCount ?? proj?.promptState?.revisionCount ?? 0,
        updatedAt: now,
      };

      const nextDetail: ProjectWorkspaceDetail | undefined = detail
        ? {
            ...detail,
            status: 'generating',
            messages: [...detail.messages, userMsg],
            promptState: nextPromptState,
            updatedAt: now,
          }
        : undefined;

      return {
        ...state,
        lifecyclesById: {
          ...state.lifecyclesById,
          [action.projectId]: {
            phase: 'analyzing',
            stage: 'analyzing',
            activeAgent: 'agent-manager',
            activePrompt: action.prompt,
            pipelineStatus: action.initialStatus,
            strategy: action.strategy ?? action.complexity?.strategy ?? prevLifecycle.strategy,
            complexity: action.complexity ?? prevLifecycle.complexity,
            streamedFilePaths: [],
            lastError: null,
            startedAt: now,
            updatedAt: now,
          },
        },
        projectsById: proj
          ? {
              ...state.projectsById,
              [action.projectId]: {
                ...proj,
                status: 'generating',
                promptState: nextPromptState,
                updatedAt: now,
              },
            }
          : state.projectsById,
        detailsById: nextDetail
          ? { ...state.detailsById, [action.projectId]: nextDetail }
          : state.detailsById,
      };
    }

    case 'PROMPT_PROGRESS': {
      const now = new Date().toISOString();
      const prev = state.lifecyclesById[action.projectId] ?? createInitialLifecycle();
      const nextStage = action.stage ?? prev.stage;
      const nextPhase = nextStage ?? prev.phase;
      const nextStrategy =
        action.strategy ?? action.complexity?.strategy ?? prev.strategy;

      return {
        ...state,
        lifecyclesById: {
          ...state.lifecyclesById,
          [action.projectId]: {
            ...prev,
            phase: nextPhase,
            stage: nextStage,
            activeAgent: action.agent ?? prev.activeAgent,
            pipelineStatus: action.statusMessage ?? prev.pipelineStatus,
            complexity: action.complexity ?? prev.complexity,
            strategy: nextStrategy,
            updatedAt: now,
          },
        },
      };
    }

    case 'PROMPT_FILE_STREAMED': {
      const now = new Date().toISOString();
      const prev = state.lifecyclesById[action.projectId] ?? createInitialLifecycle();
      const detail = state.detailsById[action.projectId];
      const nextPaths = prev.streamedFilePaths.includes(action.file.path)
        ? prev.streamedFilePaths
        : [...prev.streamedFilePaths, action.file.path];

      let nextDetail = detail;
      if (detail) {
        const existing = detail.files.find((f) => f.path === action.file.path);
        const nextVersion = Math.max(action.file.version, (existing?.version ?? 0) + 1);
        const mergedFile: ProjectFile = { ...action.file, version: nextVersion };
        nextDetail = {
          ...detail,
          files: [...detail.files.filter((f) => f.path !== mergedFile.path), mergedFile],
          updatedAt: now,
        };
      }

      return {
        ...state,
        lifecyclesById: {
          ...state.lifecyclesById,
          [action.projectId]: {
            ...prev,
            activeAgent: action.agent ?? prev.activeAgent,
            streamedFilePaths: nextPaths,
            updatedAt: now,
          },
        },
        detailsById: nextDetail
          ? { ...state.detailsById, [action.projectId]: nextDetail }
          : state.detailsById,
      };
    }

    case 'PROMPT_COMPLETED': {
      const now = new Date().toISOString();
      const detail = state.detailsById[action.projectId];
      const proj = state.projectsById[action.projectId];
      const status = action.previewError ? 'failed' : 'ready';
      const phase = action.previewError ? 'failed' : 'completed';

      const prevRevisions = detail?.revisions ?? [];
      const nextRevisions =
        action.revisions && action.revisions.length > 0
          ? action.revisions
          : [
              buildNextRevision(prevRevisions, action.files, {
                summary: action.summary,
                source: 'ai-generation',
                agent: action.agent ?? 'deepseek',
                prompt: action.prompt,
              }),
              ...prevRevisions,
            ];

      const nextPromptState: ProjectPromptState = {
        phase,
        activePrompt: null,
        activeAgent: null,
        strategy: action.strategy,
        lastComplexity: action.complexity,
        lastError: action.previewError ?? null,
        revisionCount: nextRevisions.length,
        updatedAt: now,
      };

      const nextDetail: ProjectWorkspaceDetail | undefined = detail
        ? {
            ...detail,
            status,
            files: action.files.map((f) => ({ ...f })),
            messages: [...detail.messages, action.assistantMessage],
            revisions: nextRevisions,
            promptState: nextPromptState,
            dirtyFiles: false,
            updatedAt: now,
          }
        : undefined;

      const updatedProj: Project | undefined = nextDetail
        ? syncSummaryFromDetail(nextDetail)
        : proj
        ? {
            ...proj,
            status,
            fileCount: action.files.length,
            revisionCount: nextRevisions.length,
            promptState: nextPromptState,
            updatedAt: now,
          }
        : undefined;

      return {
        ...state,
        lifecyclesById: {
          ...state.lifecyclesById,
          [action.projectId]: {
            phase,
            stage: null,
            activeAgent: null,
            activePrompt: null,
            pipelineStatus: null,
            strategy: action.strategy,
            complexity: action.complexity,
            streamedFilePaths: action.files.map((f) => f.path),
            lastError: action.previewError ?? null,
            startedAt: state.lifecyclesById[action.projectId]?.startedAt ?? now,
            updatedAt: now,
          },
        },
        projectsById: updatedProj
          ? { ...state.projectsById, [action.projectId]: updatedProj }
          : state.projectsById,
        detailsById: nextDetail
          ? { ...state.detailsById, [action.projectId]: nextDetail }
          : state.detailsById,
      };
    }

    case 'PROMPT_FAILED': {
      const now = new Date().toISOString();
      const prev = state.lifecyclesById[action.projectId] ?? createInitialLifecycle();
      const detail = state.detailsById[action.projectId];
      const proj = state.projectsById[action.projectId];

      const nextPromptState: ProjectPromptState = {
        phase: 'failed',
        activePrompt: null,
        activeAgent: null,
        strategy: prev.strategy,
        lastComplexity: prev.complexity,
        lastError: action.error,
        revisionCount: detail?.promptState.revisionCount ?? proj?.promptState?.revisionCount ?? 0,
        updatedAt: now,
      };

      return {
        ...state,
        lifecyclesById: {
          ...state.lifecyclesById,
          [action.projectId]: {
            ...prev,
            phase: 'failed',
            stage: null,
            activeAgent: null,
            activePrompt: null,
            pipelineStatus: null,
            lastError: action.error,
            updatedAt: now,
          },
        },
        projectsById: proj
          ? {
              ...state.projectsById,
              [action.projectId]: {
                ...proj,
                status: 'failed',
                promptState: nextPromptState,
                updatedAt: now,
              },
            }
          : state.projectsById,
        detailsById: detail
          ? {
              ...state.detailsById,
              [action.projectId]: {
                ...detail,
                status: 'failed',
                promptState: nextPromptState,
                updatedAt: now,
              },
            }
          : state.detailsById,
      };
    }

    case 'PROMPT_RESET': {
      if (action.detail) {
        return workspaceReducer(state, { type: 'HYDRATE_DETAIL', detail: action.detail });
      }
      const now = new Date().toISOString();
      const prev = state.lifecyclesById[action.projectId] ?? createInitialLifecycle();
      const detail = state.detailsById[action.projectId];
      const proj = state.projectsById[action.projectId];
      const nextStatus = detail?.revisions.some((r) => r.source === 'ai-generation') ? 'ready' : 'draft';
      const nextPhase = nextStatus === 'ready' ? 'completed' : 'idle';
      const nextPromptState: ProjectPromptState = {
        phase: nextPhase,
        activePrompt: null,
        activeAgent: null,
        strategy: prev.strategy,
        lastComplexity: prev.complexity,
        lastError: null,
        revisionCount: detail?.revisions.length ?? proj?.promptState?.revisionCount ?? 0,
        updatedAt: now,
      };

      return {
        ...state,
        lifecyclesById: {
          ...state.lifecyclesById,
          [action.projectId]: {
            ...prev,
            phase: nextPhase,
            stage: null,
            activeAgent: null,
            activePrompt: null,
            pipelineStatus: null,
            lastError: null,
            updatedAt: now,
          },
        },
        projectsById: proj
          ? { ...state.projectsById, [action.projectId]: { ...proj, status: nextStatus, promptState: nextPromptState, updatedAt: now } }
          : state.projectsById,
        detailsById: detail
          ? { ...state.detailsById, [action.projectId]: { ...detail, status: nextStatus, promptState: nextPromptState, updatedAt: now } }
          : state.detailsById,
      };
    }

    case 'EDIT_FILE_CONTENT': {
      const detail = state.detailsById[action.projectId];
      if (!detail) return state;
      const alreadyDirty = Boolean(detail.dirtyFiles);
      const nextFiles = detail.files.map((f) =>
        f.path === action.path
          ? { ...f, content: action.content, version: f.version + (alreadyDirty ? 0 : 1) }
          : f
      );
      return {
        ...state,
        detailsById: {
          ...state.detailsById,
          [action.projectId]: {
            ...detail,
            files: nextFiles,
            dirtyFiles: true,
          },
        },
      };
    }

    case 'FILES_SAVED': {
      const now = new Date().toISOString();
      const detail = state.detailsById[action.projectId];
      if (!detail) return state;

      const nextRevisions =
        action.revisions && action.revisions.length > 0
          ? action.revisions
          : [
              buildNextRevision(detail.revisions, action.files, {
                label: action.label,
                summary: `Manual edit (${action.files.length} files)`,
                source: 'manual',
              }),
              ...detail.revisions,
            ];

      const nextDetail: ProjectWorkspaceDetail = {
        ...detail,
        files: action.files.map((f) => ({ ...f })),
        revisions: nextRevisions,
        dirtyFiles: false,
        promptState: {
          ...detail.promptState,
          revisionCount: nextRevisions.length,
          updatedAt: now,
        },
        updatedAt: now,
      };

      return {
        ...state,
        detailsById: { ...state.detailsById, [action.projectId]: nextDetail },
        projectsById: {
          ...state.projectsById,
          [action.projectId]: syncSummaryFromDetail(nextDetail),
        },
      };
    }

    case 'LABEL_REVISION': {
      const detail = state.detailsById[action.projectId];
      if (!detail) return state;
      const cleanLabel = action.label.trim();
      if (!cleanLabel) return state;

      const nextRevisions = detail.revisions.map((rev) =>
        rev.id === action.revisionId ? { ...rev, label: cleanLabel } : rev
      );
      return {
        ...state,
        detailsById: {
          ...state.detailsById,
          [action.projectId]: {
            ...detail,
            revisions: nextRevisions,
          },
        },
      };
    }

    case 'ROLLBACK_REVISION': {
      const now = new Date().toISOString();
      const detail = state.detailsById[action.projectId];
      if (!detail) return state;

      const target = detail.revisions.find((r) => r.id === action.revisionId);
      if (!target && !action.files) return state;

      const restoredFiles =
        action.files ??
        (target
          ? target.files.map((f) => {
              const current = detail.files.find((cf) => cf.path === f.path);
              return {
                path: f.path,
                content: f.content,
                version: Math.max(f.version, current?.version ?? 0) + 1,
              };
            })
          : detail.files);

      const nextRevisions =
        action.revisions && action.revisions.length > 0
          ? action.revisions
          : [
              buildNextRevision(detail.revisions, restoredFiles, {
                label: target ? `Rollback to v${target.version}` : 'Rollback',
                summary: target
                  ? `Rolled back to v${target.version} (${target.label})`
                  : 'Rolled back workspace files',
                source: 'rollback',
              }),
              ...detail.revisions,
            ];

      const nextDetail: ProjectWorkspaceDetail = {
        ...detail,
        status: 'ready',
        files: restoredFiles,
        revisions: nextRevisions,
        dirtyFiles: false,
        promptState: {
          ...detail.promptState,
          phase: 'completed',
          lastError: null,
          revisionCount: nextRevisions.length,
          updatedAt: now,
        },
        updatedAt: now,
      };

      return {
        ...state,
        detailsById: { ...state.detailsById, [action.projectId]: nextDetail },
        projectsById: {
          ...state.projectsById,
          [action.projectId]: syncSummaryFromDetail(nextDetail),
        },
      };
    }

    default:
      return state;
  }
}
