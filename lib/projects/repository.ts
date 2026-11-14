import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  CreateProjectInput,
  Project,
  ProjectFile,
  ProjectPromptState,
  ProjectRevision,
  ProjectStatus,
  ProjectWithFiles,
  RevisionSource,
} from '../../src/features/projects/types';
import { analyzePrompt } from '../../src/server/pipeline/prompt-analyzer';
import type { BuilderMessage } from '../../src/types';
import {
  buildSeedFilesForProject,
  createDefaultPromptState,
} from './seed';

export interface ProjectDetail extends ProjectWithFiles {
  messages: BuilderMessage[];
  revisions: ProjectRevision[];
  promptState: ProjectPromptState;
}

export interface RevisionSnapshotMeta {
  label?: string;
  summary: string;
  source: RevisionSource;
  agent?: ProjectPromptState['activeAgent'];
  prompt?: string | null;
}

export interface WorkspaceUpdatePatch {
  status?: ProjectStatus;
  name?: string;
  thumbnailColor?: string;
  files?: ProjectFile[];
  appendMessages?: BuilderMessage[];
  replaceMessages?: BuilderMessage[];
  promptState?: Partial<ProjectPromptState>;
  revisionMeta?: RevisionSnapshotMeta;
}

interface ProjectRow {
  id: string;
  tenant_id: string;
  name: string;
  framework: string;
  status: ProjectStatus;
  thumbnail_color: string | null;
  initial_prompt: string | null;
  branched_from_id: string | null;
  branched_from_name: string | null;
  prompt_state: Partial<ProjectPromptState> | null;
  slug: string | null;
  published_at: string | null;
  custom_domain: string | null;
  domain_status: string | null;
  created_at: string;
  updated_at: string;
  file_count?: number;
  message_count?: number;
  revision_count?: number;
}

interface FileRow {
  id: string;
  project_id: string;
  path: string;
  content: string;
  version: number;
  created_at: string;
}

interface RevisionRow {
  id: string;
  project_id: string;
  version: number;
  label: string;
  summary: string;
  source: RevisionSource;
  agent: string | null;
  prompt: string | null;
  files: ProjectFile[];
  created_at: string;
}

interface MessageRow {
  id: string;
  project_id: string;
  role: 'user' | 'assistant';
  content: string;
  summary: string | null;
  diff_lines: BuilderMessage['diffLines'] | null;
  created_at: string;
}

function normalizeFiles(files: ProjectFile[]): ProjectFile[] {
  const map = new Map<string, ProjectFile>();
  for (const file of files) {
    const cleanPath = file.path.trim().replace(/^\/+/, '');
    if (!cleanPath) continue;
    map.set(cleanPath, {
      path: cleanPath,
      content: file.content,
      version: Math.max(1, Number(file.version) || 1),
    });
  }
  return Array.from(map.values());
}

function toPromptState(row: ProjectRow): ProjectPromptState {
  const fallback = createDefaultPromptState({
    status: row.status,
    updatedAt: row.updated_at,
  });
  const stored = row.prompt_state ?? {};
  return {
    ...fallback,
    ...stored,
    lastComplexity: stored.lastComplexity ?? fallback.lastComplexity,
    revisionCount: stored.revisionCount ?? row.revision_count ?? fallback.revisionCount,
    updatedAt: stored.updatedAt ?? row.updated_at,
  };
}

function toProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    framework: (row.framework as Project['framework']) ?? 'react-vite',
    status: row.status,
    updatedAt: row.updated_at,
    thumbnailColor: row.thumbnail_color ?? undefined,
    initialPrompt: row.initial_prompt ?? undefined,
    branchedFromId: row.branched_from_id ?? undefined,
    branchedFromName: row.branched_from_name ?? undefined,
    fileCount: row.file_count ?? 0,
    messageCount: row.message_count ?? 0,
    revisionCount: row.revision_count ?? 0,
    promptState: toPromptState(row),
  };
}

function toRevision(row: RevisionRow): ProjectRevision {
  return {
    id: row.id,
    version: row.version,
    label: row.label,
    summary: row.summary,
    source: row.source,
    agent: (row.agent as ProjectRevision['agent']) ?? null,
    prompt: row.prompt,
    createdAt: row.created_at,
    files: Array.isArray(row.files) ? row.files : [],
  };
}

function toMessage(row: MessageRow): BuilderMessage {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    timestamp: new Date(row.created_at).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    }),
    summary: row.summary ?? undefined,
    diffLines: row.diff_lines ?? undefined,
  };
}

function assertOk<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) {
    throw new Error(result.error.message);
  }
  if (result.data === null) {
    throw new Error('Supabase returned an empty result.');
  }
  return result.data;
}

export class ProjectRepository {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly tenantId: string
  ) {}

  private async getLatestFileRows(projectId: string): Promise<FileRow[]> {
    const { data, error } = await this.supabase
      .from('latest_project_files')
      .select('id, project_id, path, content, version, created_at')
      .eq('tenant_id', this.tenantId)
      .eq('project_id', projectId)
      .order('path', { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as FileRow[];
  }

  private async getRevisionRows(projectId: string): Promise<RevisionRow[]> {
    const { data, error } = await this.supabase
      .from('project_revisions')
      .select('id, project_id, version, label, summary, source, agent, prompt, files, created_at')
      .eq('tenant_id', this.tenantId)
      .eq('project_id', projectId)
      .order('version', { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as RevisionRow[];
  }

  private async getMessageRows(projectId: string): Promise<MessageRow[]> {
    const { data, error } = await this.supabase
      .from('project_messages')
      .select('id, project_id, role, content, summary, diff_lines, created_at')
      .eq('tenant_id', this.tenantId)
      .eq('project_id', projectId)
      .order('created_at', { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as MessageRow[];
  }

  async listProjects(): Promise<Project[]> {
    const { data, error } = await this.supabase
      .from('project_summaries')
      .select('*')
      .eq('tenant_id', this.tenantId)
      .order('updated_at', { ascending: false });
    if (error) throw new Error(error.message);
    return ((data ?? []) as ProjectRow[]).map(toProject);
  }

  async getProjectDetail(id: string): Promise<ProjectDetail | null> {
    const { data: project, error } = await this.supabase
      .from('project_summaries')
      .select('*')
      .eq('tenant_id', this.tenantId)
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!project) return null;

    const [fileRows, revisionRows, messageRows] = await Promise.all([
      this.getLatestFileRows(id),
      this.getRevisionRows(id),
      this.getMessageRows(id),
    ]);

    const summary = toProject(project as ProjectRow);
    return {
      ...summary,
      files: fileRows.map((f) => ({ path: f.path, content: f.content, version: f.version })),
      revisions: revisionRows.map(toRevision),
      messages: messageRows.map(toMessage),
      promptState: summary.promptState ?? createDefaultPromptState(summary),
      fileCount: fileRows.length,
      messageCount: messageRows.length,
      revisionCount: revisionRows.length,
    };
  }

  async createProject(input: string | CreateProjectInput): Promise<ProjectDetail> {
    const normalized: CreateProjectInput =
      typeof input === 'string' ? { name: input } : input ?? {};
    const initialPrompt = normalized.initialPrompt?.trim();
    const derivedName = initialPrompt
      ? analyzePrompt(initialPrompt, []).brandName
      : 'Untitled Website';
    const finalName = (normalized.name?.trim() || derivedName).slice(0, 64);

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const project: Project = {
      id,
      name: finalName,
      framework: 'react-vite',
      status: 'draft',
      updatedAt: now,
      thumbnailColor: normalized.thumbnailColor ?? '#059669',
      initialPrompt,
    };
    const files = normalizeFiles(buildSeedFilesForProject(project));
    const promptState = createDefaultPromptState(project, initialPrompt);

    const { error: projectError } = await this.supabase.from('projects').insert({
      id,
      tenant_id: this.tenantId,
      name: finalName,
      framework: 'react-vite',
      status: 'draft',
      thumbnail_color: project.thumbnailColor,
      initial_prompt: initialPrompt ?? null,
      prompt_state: promptState,
    });
    if (projectError) throw new Error(projectError.message);

    const { error: filesError } = await this.supabase.from('project_files').insert(
      files.map((file) => ({
        tenant_id: this.tenantId,
        project_id: id,
        path: file.path,
        content: file.content,
        version: 1,
      }))
    );
    if (filesError) throw new Error(filesError.message);

    const { error: revisionError } = await this.supabase.from('project_revisions').insert({
      tenant_id: this.tenantId,
      project_id: id,
      version: 1,
      label: 'Initial workspace',
      summary: `Baseline snapshot (${files.length} files)`,
      source: 'seed',
      prompt: initialPrompt ?? null,
      files,
    });
    if (revisionError) throw new Error(revisionError.message);

    const detail = await this.getProjectDetail(id);
    if (!detail) throw new Error('Project was created but could not be read back.');
    return detail;
  }

  private async nextRevisionVersion(projectId: string): Promise<number> {
    const { data, error } = await this.supabase
      .from('project_revisions')
      .select('version')
      .eq('tenant_id', this.tenantId)
      .eq('project_id', projectId)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (data?.version ?? 0) + 1;
  }

  private async writeFiles(projectId: string, files: ProjectFile[]): Promise<FileRow[]> {
    const normalized = normalizeFiles(files);
    const latest = await this.getLatestFileRows(projectId);
    const maxByPath = new Map(latest.map((f) => [f.path, f.version]));
    const incoming = new Set(normalized.map((f) => f.path));

    const removedPaths = latest.filter((f) => !incoming.has(f.path)).map((f) => f.path);
    if (removedPaths.length > 0) {
      const { error } = await this.supabase
        .from('project_files')
        .delete()
        .eq('tenant_id', this.tenantId)
        .eq('project_id', projectId)
        .in('path', removedPaths);
      if (error) throw new Error(error.message);
    }

    if (normalized.length > 0) {
      const rows = normalized.map((file) => ({
        tenant_id: this.tenantId,
        project_id: projectId,
        path: file.path,
        content: file.content,
        version: (maxByPath.get(file.path) ?? 0) + 1,
      }));
      const { error } = await this.supabase.from('project_files').insert(rows);
      if (error) throw new Error(error.message);
    }

    return this.getLatestFileRows(projectId);
  }

  private async insertRevision(
    projectId: string,
    files: ProjectFile[],
    meta: RevisionSnapshotMeta
  ): Promise<void> {
    const version = await this.nextRevisionVersion(projectId);
    const fallbackLabel =
      meta.source === 'ai-generation'
        ? `AI Build v${version}`
        : meta.source === 'rollback'
        ? `Rollback v${version}`
        : meta.source === 'manual'
        ? `Manual Edit v${version}`
        : `Snapshot v${version}`;

    const { error } = await this.supabase.from('project_revisions').insert({
      tenant_id: this.tenantId,
      project_id: projectId,
      version,
      label: meta.label?.trim() || fallbackLabel,
      summary: meta.summary,
      source: meta.source,
      agent: meta.agent ?? null,
      prompt: meta.prompt ?? null,
      files,
    });
    if (error) throw new Error(error.message);
  }

  async updateWorkspace(id: string, patch: WorkspaceUpdatePatch): Promise<ProjectDetail | null> {
    const current = await this.getProjectDetail(id);
    if (!current) return null;

    const projectUpdate: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (patch.status) projectUpdate.status = patch.status;
    if (patch.name && patch.name.trim().length > 0) {
      projectUpdate.name = patch.name.trim().slice(0, 64);
    }
    if (patch.thumbnailColor) projectUpdate.thumbnail_color = patch.thumbnailColor;

    let files = current.files;
    if (patch.files) {
      const rows = await this.writeFiles(id, patch.files);
      files = rows.map((f) => ({ path: f.path, content: f.content, version: f.version }));
      await this.insertRevision(
        id,
        files,
        patch.revisionMeta ?? {
          summary: `Updated workspace (${files.length} files)`,
          source:
            patch.appendMessages && patch.appendMessages.length > 0 ? 'ai-generation' : 'manual',
          agent: patch.promptState?.activeAgent ?? current.promptState.activeAgent,
          prompt: patch.promptState?.activePrompt ?? null,
        }
      );
    }

    if (patch.replaceMessages) {
      const { error: deleteError } = await this.supabase
        .from('project_messages')
        .delete()
        .eq('tenant_id', this.tenantId)
        .eq('project_id', id);
      if (deleteError) throw new Error(deleteError.message);
    }

    const messagesToInsert = patch.replaceMessages ?? patch.appendMessages ?? [];
    if (messagesToInsert.length > 0) {
      const { error } = await this.supabase.from('project_messages').insert(
        messagesToInsert.map((message) => ({
          tenant_id: this.tenantId,
          project_id: id,
          role: message.role,
          content: message.content,
          summary: message.summary ?? null,
          diff_lines: message.diffLines ?? null,
        }))
      );
      if (error) throw new Error(error.message);
    }

    if (patch.promptState) {
      const nextPromptState = {
        ...current.promptState,
        ...patch.promptState,
        updatedAt: new Date().toISOString(),
      };
      projectUpdate.prompt_state = nextPromptState;
    }

    const { error: updateError } = await this.supabase
      .from('projects')
      .update(projectUpdate)
      .eq('tenant_id', this.tenantId)
      .eq('id', id);
    if (updateError) throw new Error(updateError.message);

    return this.getProjectDetail(id);
  }

  async setPromptState(
    id: string,
    patch: Partial<ProjectPromptState>
  ): Promise<ProjectDetail | null> {
    return this.updateWorkspace(id, { promptState: patch });
  }

  async resetPromptState(id: string): Promise<ProjectDetail | null> {
    const detail = await this.getProjectDetail(id);
    if (!detail) return null;
    const appFile = detail.files.find((f) => f.path === 'src/App.tsx' || f.path === 'src/App.jsx');
    const isDraftTemplate =
      !appFile ||
      appFile.content.includes('Draft workspace ready.') ||
      appFile.content.includes('Initialized from prompt:');
    const recoveredStatus: ProjectStatus = isDraftTemplate ? 'draft' : 'ready';
    return this.updateWorkspace(id, {
      status: recoveredStatus,
      promptState: {
        phase: recoveredStatus === 'ready' ? 'completed' : 'idle',
        activePrompt: null,
        activeAgent: null,
        lastError: null,
      },
    });
  }

  async labelRevision(
    id: string,
    revisionId: string,
    label: string
  ): Promise<ProjectDetail | null> {
    const clean = label.trim().slice(0, 80);
    if (!clean) return null;
    const { error } = await this.supabase
      .from('project_revisions')
      .update({ label: clean })
      .eq('tenant_id', this.tenantId)
      .eq('project_id', id)
      .eq('id', revisionId);
    if (error) throw new Error(error.message);
    await this.supabase
      .from('projects')
      .update({ updated_at: new Date().toISOString() })
      .eq('tenant_id', this.tenantId)
      .eq('id', id);
    return this.getProjectDetail(id);
  }

  async rollbackToRevision(id: string, revisionId: string): Promise<ProjectDetail | null> {
    const detail = await this.getProjectDetail(id);
    if (!detail) return null;
    const target = detail.revisions.find((revision) => revision.id === revisionId);
    if (!target) return null;

    const restoredFiles = target.files.map((file) => {
      const current = detail.files.find((candidate) => candidate.path === file.path);
      return {
        path: file.path,
        content: file.content,
        version: Math.max(file.version, current?.version ?? 0) + 1,
      };
    });
    const recoveredStatus: ProjectStatus =
      target.source === 'seed' &&
      restoredFiles.some(
        (file) =>
          file.path === 'src/App.tsx' &&
          (file.content.includes('Draft workspace ready.') ||
            file.content.includes('Initialized from prompt:'))
      )
        ? 'draft'
        : 'ready';

    return this.updateWorkspace(id, {
      status: recoveredStatus,
      files: restoredFiles,
      revisionMeta: {
        label: `Rollback to v${target.version}`,
        summary: `Rolled back workspace files to v${target.version} (${target.label})`,
        source: 'rollback',
      },
      promptState: {
        phase: recoveredStatus === 'ready' ? 'completed' : 'idle',
        activePrompt: null,
        activeAgent: null,
        lastError: null,
        revisionCount: detail.revisions.length + 1,
      },
    });
  }

  async branchProject(id: string, branchName?: string): Promise<ProjectDetail | null> {
    const source = await this.getProjectDetail(id);
    if (!source) return null;

    const branchId = crypto.randomUUID();
    const now = new Date().toISOString();
    const resolvedName = branchName?.trim()
      ? branchName.trim().slice(0, 64)
      : `${source.name} (Branch)`;
    const branchReady = source.status === 'ready' || source.promptState.revisionCount > 0;

    const { error: projectError } = await this.supabase.from('projects').insert({
      id: branchId,
      tenant_id: this.tenantId,
      name: resolvedName,
      framework: source.framework,
      status: branchReady ? 'ready' : 'draft',
      thumbnail_color: source.thumbnailColor ?? null,
      initial_prompt: source.initialPrompt ?? null,
      branched_from_id: source.id,
      branched_from_name: source.name,
      prompt_state: {
        phase: 'idle',
        activePrompt: null,
        activeAgent: null,
        strategy: source.promptState.strategy,
        lastComplexity: source.promptState.lastComplexity,
        lastError: null,
        revisionCount: source.promptState.revisionCount,
        updatedAt: now,
      },
    });
    if (projectError) throw new Error(projectError.message);

    if (source.files.length > 0) {
      const { error } = await this.supabase.from('project_files').insert(
        source.files.map((file) => ({
          tenant_id: this.tenantId,
          project_id: branchId,
          path: file.path,
          content: file.content,
          version: 1,
        }))
      );
      if (error) throw new Error(error.message);
    }

    if (source.messages.length > 0) {
      const { error } = await this.supabase.from('project_messages').insert(
        source.messages.map((message) => ({
          tenant_id: this.tenantId,
          project_id: branchId,
          role: message.role,
          content: message.content,
          summary: message.summary ?? null,
          diff_lines: message.diffLines ?? null,
        }))
      );
      if (error) throw new Error(error.message);
    }

    const files = source.files.map((file) => ({ ...file, version: 1 }));
    const { error: revisionError } = await this.supabase.from('project_revisions').insert({
      tenant_id: this.tenantId,
      project_id: branchId,
      version: 1,
      label: `Branched from ${source.name}`,
      summary: `Branched workspace (${files.length} files)`,
      source: 'branch',
      files,
    });
    if (revisionError) throw new Error(revisionError.message);

    return this.getProjectDetail(branchId);
  }

  async duplicateProject(id: string): Promise<ProjectDetail | null> {
    const source = await this.getProjectDetail(id);
    if (!source) return null;
    return this.branchProject(id, `${source.name} (Copy)`);
  }

  async deleteProject(id: string): Promise<boolean> {
    const { error, count } = await this.supabase
      .from('projects')
      .delete({ count: 'exact' })
      .eq('tenant_id', this.tenantId)
      .eq('id', id);
    if (error) throw new Error(error.message);
    return (count ?? 0) > 0;
  }
}
