import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from 'react';
import type { BuilderMessage } from '../../types';
import { getConversationForProject } from '../generation/mock';
import type {
  AgentSource,
  ComplexityProfile,
  GenerationStage,
  OrchestrationStrategy,
} from '../generation/types';
import {
  branchProject,
  createProject,
  deleteProject,
  duplicateProject,
  fetchProjectDetail,
  fetchProjects,
  labelProjectRevision,
  rollbackProjectRevision,
  saveProjectFiles,
  updateProject,
  updatePromptState,
  type ProjectDetailResponse,
} from './api';
import { getMockProjectWithFiles } from './mock';
import type {
  CreateProjectInput,
  Project,
  ProjectFile,
  ProjectRevision,
} from './types';
import {
  INITIAL_WORKSPACE_STATE,
  createSeedRevision,
  selectOrderedProjects,
  workspaceReducer,
  type ProjectWorkspaceDetail,
  type WorkspaceStoreState,
} from './workspace-reducer';

const STORAGE_KEY = 'urself_workspace_cache_v1';

function toWorkspaceDetail(resp: ProjectDetailResponse): ProjectWorkspaceDetail {
  return {
    id: resp.id,
    name: resp.name,
    framework: resp.framework,
    status: resp.status,
    updatedAt: resp.updatedAt,
    thumbnailColor: resp.thumbnailColor,
    initialPrompt: resp.initialPrompt,
    branchedFromId: resp.branchedFromId,
    branchedFromName: resp.branchedFromName,
    fileCount: resp.files.length,
    messageCount: resp.messages.length,
    revisionCount: resp.revisions?.length ?? resp.promptState?.revisionCount ?? 1,
    promptState: resp.promptState,
    files: resp.files,
    messages: resp.messages,
    revisions:
      resp.revisions && resp.revisions.length > 0
        ? resp.revisions
        : [createSeedRevision(resp.files)],
    dirtyFiles: false,
  };
}

function loadCachedState(): WorkspaceStoreState {
  if (typeof window === 'undefined') return INITIAL_WORKSPACE_STATE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return INITIAL_WORKSPACE_STATE;
    const parsed = JSON.parse(raw) as Partial<WorkspaceStoreState>;
    if (!parsed || typeof parsed !== 'object') return INITIAL_WORKSPACE_STATE;

    return {
      projectsById: parsed.projectsById ?? {},
      projectOrder: Array.isArray(parsed.projectOrder) ? parsed.projectOrder : [],
      detailsById: parsed.detailsById ?? {},
      lifecyclesById: parsed.lifecyclesById ?? {},
      isLoadingList: false,
      listError: null,
    };
  } catch {
    return INITIAL_WORKSPACE_STATE;
  }
}

interface WorkspaceContextValue {
  state: WorkspaceStoreState;
  projects: Project[];
  loadProjects: () => Promise<Project[]>;
  loadProjectDetail: (id: string) => Promise<ProjectWorkspaceDetail>;
  createWorkspace: (input: CreateProjectInput) => Promise<ProjectWorkspaceDetail>;
  renameWorkspace: (id: string, name: string) => Promise<Project>;
  branchWorkspace: (id: string, name?: string) => Promise<ProjectWorkspaceDetail>;
  duplicateWorkspace: (id: string) => Promise<Project>;
  deleteWorkspace: (id: string) => Promise<void>;
  editFileContent: (id: string, path: string, content: string) => void;
  saveFiles: (
    id: string,
    files: ProjectFile[],
    label?: string
  ) => Promise<ProjectWorkspaceDetail | null>;
  labelRevision: (id: string, revisionId: string, label: string) => Promise<void>;
  rollbackRevision: (id: string, revisionId: string) => Promise<ProjectWorkspaceDetail | null>;
  resetPrompt: (id: string) => Promise<void>;
  dismissQueuedPrompt: (id: string) => Promise<void>;
  queuePrompt: (id: string, prompt: string, complexity?: ComplexityProfile | null) => void;
  dispatchPromptStarted: (payload: {
    projectId: string;
    prompt: string;
    initialStatus: string;
    complexity?: ComplexityProfile | null;
    strategy?: OrchestrationStrategy;
  }) => void;
  dispatchPromptProgress: (payload: {
    projectId: string;
    statusMessage?: string | null;
    stage?: GenerationStage | null;
    agent?: AgentSource | null;
    complexity?: ComplexityProfile | null;
    strategy?: OrchestrationStrategy;
  }) => void;
  dispatchPromptFile: (payload: {
    projectId: string;
    file: ProjectFile;
    agent?: AgentSource | null;
  }) => void;
  dispatchPromptCompleted: (payload: {
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
  }) => void;
  dispatchPromptFailed: (projectId: string, error: string) => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(workspaceReducer, undefined, loadCachedState);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          projectsById: state.projectsById,
          projectOrder: state.projectOrder,
          detailsById: state.detailsById,
          lifecyclesById: state.lifecyclesById,
        })
      );
    } catch {
      // Ignore storage quota / private mode errors
    }
  }, [state.detailsById, state.lifecyclesById, state.projectOrder, state.projectsById]);

  const projects = useMemo(() => selectOrderedProjects(state), [state]);

  const loadProjects = useCallback(async (): Promise<Project[]> => {
    dispatch({ type: 'FETCH_LIST_START' });
    try {
      const list = await fetchProjects();
      dispatch({ type: 'FETCH_LIST_SUCCESS', projects: list });
      return list;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to load workspace list';
      dispatch({ type: 'FETCH_LIST_ERROR', error: msg });
      throw err;
    }
  }, []);

  const loadProjectDetail = useCallback(async (id: string): Promise<ProjectWorkspaceDetail> => {
    try {
      const resp = await fetchProjectDetail(id);
      const detail = toWorkspaceDetail(resp);
      dispatch({ type: 'HYDRATE_DETAIL', detail });
      return detail;
    } catch {
      const local = getMockProjectWithFiles(id);
      const fallbackDetail: ProjectWorkspaceDetail = {
        ...local,
        messages: getConversationForProject(local.id, local.name),
        revisions: [createSeedRevision(local.files)],
        promptState: local.promptState ?? {
          phase: local.status === 'ready' ? 'completed' : 'idle',
          activePrompt: null,
          activeAgent: null,
          strategy: 'hybrid-dual',
          lastComplexity: null,
          lastError: null,
          revisionCount: 1,
          updatedAt: local.updatedAt,
        },
        dirtyFiles: false,
      };
      dispatch({ type: 'HYDRATE_DETAIL', detail: fallbackDetail });
      return fallbackDetail;
    }
  }, []);

  const createWorkspace = useCallback(
    async (input: CreateProjectInput): Promise<ProjectWorkspaceDetail> => {
      const resp = await createProject(input);
      const detail = toWorkspaceDetail(resp);
      dispatch({ type: 'HYDRATE_DETAIL', detail });
      if (input.initialPrompt?.trim()) {
        dispatch({
          type: 'PROMPT_QUEUED',
          projectId: detail.id,
          prompt: input.initialPrompt.trim(),
        });
      }
      return detail;
    },
    []
  );

  const renameWorkspace = useCallback(async (id: string, name: string): Promise<Project> => {
    const clean = name.trim();
    const updated = await updateProject(id, { name: clean });
    const detail = toWorkspaceDetail(updated);
    dispatch({ type: 'HYDRATE_DETAIL', detail });
    return detail;
  }, []);

  const branchWorkspace = useCallback(
    async (id: string, name?: string): Promise<ProjectWorkspaceDetail> => {
      const resp = await branchProject(id, name);
      const detail = toWorkspaceDetail(resp);
      dispatch({ type: 'HYDRATE_DETAIL', detail });
      return detail;
    },
    []
  );

  const duplicateWorkspace = useCallback(async (id: string): Promise<Project> => {
    const copy = await duplicateProject(id);
    dispatch({ type: 'UPSERT_PROJECT', project: copy });
    return copy;
  }, []);

  const deleteWorkspace = useCallback(async (id: string): Promise<void> => {
    await deleteProject(id);
    dispatch({ type: 'REMOVE_PROJECT', projectId: id });
  }, []);

  const editFileContent = useCallback((projectId: string, filePath: string, content: string) => {
    dispatch({ type: 'EDIT_FILE_CONTENT', projectId, path: filePath, content });
  }, []);

  const saveFiles = useCallback(
    async (
      projectId: string,
      files: ProjectFile[],
      label?: string
    ): Promise<ProjectWorkspaceDetail | null> => {
      try {
        const resp = await saveProjectFiles(projectId, files, label);
        const detail = toWorkspaceDetail(resp);
        dispatch({ type: 'HYDRATE_DETAIL', detail });
        return detail;
      } catch {
        dispatch({ type: 'FILES_SAVED', projectId, files, label });
        return null;
      }
    },
    []
  );

  const labelRevision = useCallback(
    async (projectId: string, revisionId: string, label: string): Promise<void> => {
      try {
        const resp = await labelProjectRevision(projectId, revisionId, label);
        dispatch({ type: 'HYDRATE_DETAIL', detail: toWorkspaceDetail(resp) });
      } catch {
        dispatch({ type: 'LABEL_REVISION', projectId, revisionId, label });
      }
    },
    []
  );

  const rollbackRevision = useCallback(
    async (projectId: string, revisionId: string): Promise<ProjectWorkspaceDetail | null> => {
      try {
        const resp = await rollbackProjectRevision(projectId, revisionId);
        const detail = toWorkspaceDetail(resp);
        dispatch({ type: 'HYDRATE_DETAIL', detail });
        return detail;
      } catch {
        dispatch({ type: 'ROLLBACK_REVISION', projectId, revisionId });
        return null;
      }
    },
    []
  );

  const resetPrompt = useCallback(async (projectId: string): Promise<void> => {
    try {
      const resp = await updatePromptState(projectId, { reset: true });
      dispatch({ type: 'PROMPT_RESET', projectId, detail: toWorkspaceDetail(resp) });
    } catch {
      dispatch({ type: 'PROMPT_RESET', projectId });
    }
  }, []);

  const dismissQueuedPrompt = useCallback(async (projectId: string): Promise<void> => {
    try {
      const resp = await updatePromptState(projectId, {
        phase: 'idle',
        activePrompt: null,
        activeAgent: null,
      });
      dispatch({ type: 'HYDRATE_DETAIL', detail: toWorkspaceDetail(resp) });
    } catch {
      dispatch({ type: 'PROMPT_RESET', projectId });
    }
  }, []);

  const queuePrompt = useCallback(
    (projectId: string, prompt: string, complexity?: ComplexityProfile | null) => {
      dispatch({ type: 'PROMPT_QUEUED', projectId, prompt, complexity });
    },
    []
  );

  const dispatchPromptStarted = useCallback(
    (payload: {
      projectId: string;
      prompt: string;
      initialStatus: string;
      complexity?: ComplexityProfile | null;
      strategy?: OrchestrationStrategy;
    }) => {
      dispatch({ type: 'PROMPT_STARTED', ...payload });
    },
    []
  );

  const dispatchPromptProgress = useCallback(
    (payload: {
      projectId: string;
      statusMessage?: string | null;
      stage?: GenerationStage | null;
      agent?: AgentSource | null;
      complexity?: ComplexityProfile | null;
      strategy?: OrchestrationStrategy;
    }) => {
      dispatch({ type: 'PROMPT_PROGRESS', ...payload });
    },
    []
  );

  const dispatchPromptFile = useCallback(
    (payload: { projectId: string; file: ProjectFile; agent?: AgentSource | null }) => {
      dispatch({ type: 'PROMPT_FILE_STREAMED', ...payload });
    },
    []
  );

  const dispatchPromptCompleted = useCallback(
    (payload: {
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
    }) => {
      dispatch({ type: 'PROMPT_COMPLETED', ...payload });
    },
    []
  );

  const dispatchPromptFailed = useCallback((projectId: string, error: string) => {
    dispatch({ type: 'PROMPT_FAILED', projectId, error });
  }, []);

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      state,
      projects,
      loadProjects,
      loadProjectDetail,
      createWorkspace,
      renameWorkspace,
      branchWorkspace,
      duplicateWorkspace,
      deleteWorkspace,
      editFileContent,
      saveFiles,
      labelRevision,
      rollbackRevision,
      resetPrompt,
      dismissQueuedPrompt,
      queuePrompt,
      dispatchPromptStarted,
      dispatchPromptProgress,
      dispatchPromptFile,
      dispatchPromptCompleted,
      dispatchPromptFailed,
    }),
    [
      branchWorkspace,
      createWorkspace,
      deleteWorkspace,
      dismissQueuedPrompt,
      dispatchPromptCompleted,
      dispatchPromptFailed,
      dispatchPromptFile,
      dispatchPromptProgress,
      dispatchPromptStarted,
      duplicateWorkspace,
      editFileContent,
      labelRevision,
      loadProjectDetail,
      loadProjects,
      projects,
      queuePrompt,
      renameWorkspace,
      resetPrompt,
      rollbackRevision,
      saveFiles,
      state,
    ]
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspaceStore(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error('useWorkspaceStore must be used inside a WorkspaceProvider');
  }
  return ctx;
}
