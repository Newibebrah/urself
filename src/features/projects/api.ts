import type { BuilderMessage } from '../../types';
import type {
  CreateProjectInput,
  Project,
  ProjectFile,
  ProjectPromptState,
  ProjectRevision,
  ProjectStatus,
  ProjectWithFiles,
} from './types';

export interface ProjectDetailResponse extends ProjectWithFiles {
  messages: BuilderMessage[];
  revisions: ProjectRevision[];
  promptState: ProjectPromptState;
}

export interface UpdateProjectPayload {
  name?: string;
  status?: ProjectStatus;
  thumbnailColor?: string;
  files?: ProjectFile[];
  appendMessages?: BuilderMessage[];
  replaceMessages?: BuilderMessage[];
  promptState?: Partial<ProjectPromptState>;
}

export async function fetchProjects(): Promise<Project[]> {
  const res = await fetch('/api/projects');
  if (!res.ok) throw new Error('Failed to load projects');
  const data = (await res.json()) as { projects: Project[] };
  return data.projects;
}

export async function createProject(
  input: string | CreateProjectInput
): Promise<ProjectDetailResponse> {
  const payload: CreateProjectInput =
    typeof input === 'string' ? { name: input } : input;

  const res = await fetch('/api/projects', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to create project');
  return (await res.json()) as ProjectDetailResponse;
}

export async function fetchProjectDetail(id: string): Promise<ProjectDetailResponse> {
  const res = await fetch(`/api/projects/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error('Project not found');
  return (await res.json()) as ProjectDetailResponse;
}

export async function updateProject(
  id: string,
  patch: UpdateProjectPayload
): Promise<ProjectDetailResponse> {
  const res = await fetch(`/api/projects/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error('Failed to update project');
  return (await res.json()) as ProjectDetailResponse;
}

export async function saveProjectFiles(
  id: string,
  files: ProjectFile[],
  label?: string
): Promise<ProjectDetailResponse> {
  const res = await fetch(`/api/projects/${encodeURIComponent(id)}/files`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(label ? { files, label } : { files }),
  });
  if (!res.ok) throw new Error('Failed to save workspace files');
  return (await res.json()) as ProjectDetailResponse;
}

export async function labelProjectRevision(
  id: string,
  revisionId: string,
  label: string
): Promise<ProjectDetailResponse> {
  const res = await fetch(
    `/api/projects/${encodeURIComponent(id)}/revisions/${encodeURIComponent(revisionId)}`,
    {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ label }),
    }
  );
  if (!res.ok) throw new Error('Failed to label revision');
  return (await res.json()) as ProjectDetailResponse;
}

export async function rollbackProjectRevision(
  id: string,
  revisionId: string
): Promise<ProjectDetailResponse> {
  const res = await fetch(
    `/api/projects/${encodeURIComponent(id)}/revisions/${encodeURIComponent(revisionId)}/rollback`,
    {
      method: 'POST',
    }
  );
  if (!res.ok) throw new Error('Failed to rollback revision');
  return (await res.json()) as ProjectDetailResponse;
}

export async function updatePromptState(
  id: string,
  patch: Partial<ProjectPromptState> & { reset?: boolean }
): Promise<ProjectDetailResponse> {
  const res = await fetch(`/api/projects/${encodeURIComponent(id)}/prompt-state`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error('Failed to update prompt state');
  return (await res.json()) as ProjectDetailResponse;
}

export async function branchProject(
  id: string,
  name?: string
): Promise<ProjectDetailResponse> {
  const res = await fetch(`/api/projects/${encodeURIComponent(id)}/branch`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(name ? { name } : {}),
  });
  if (!res.ok) throw new Error('Failed to branch project');
  return (await res.json()) as ProjectDetailResponse;
}

export async function duplicateProject(id: string): Promise<Project> {
  const res = await fetch(`/api/projects/${encodeURIComponent(id)}/duplicate`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to duplicate project');
  return (await res.json()) as Project;
}

export async function deleteProject(id: string): Promise<void> {
  const res = await fetch(`/api/projects/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete project');
}

export function getExportZipUrl(id: string): string {
  return `/api/projects/${encodeURIComponent(id)}/export`;
}

export interface SelfHealApiResponse {
  ok: boolean;
  healed: boolean;
  attempts: number;
  files: ProjectFile[];
  previewHtml: string | null;
  remainingError: string | null;
  healingLog: string[];
  detail: ProjectDetailResponse | null;
}

export async function selfHealProjectFiles(
  id: string,
  payload: { files: ProjectFile[]; error?: string; prompt?: string }
): Promise<SelfHealApiResponse> {
  const res = await fetch(`/api/projects/${encodeURIComponent(id)}/self-heal`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Self-healing request failed');
  return (await res.json()) as SelfHealApiResponse;
}
