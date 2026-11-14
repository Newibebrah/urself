'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Check,
  Copy,
  Edit3,
  Eye,
  FolderOpen,
  GitBranch,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { DashboardLayout } from '../../components/layout/dashboard-layout';
import { StatusBadge } from '../../components/shared/status-badge';
import { DropdownMenu } from '../../components/ui/dropdown-menu';
import { Skeleton } from '../../components/ui/skeleton';
import { Tooltip } from '../../components/ui/tooltip';
import type { Project, ProjectStatus } from '../../features/projects/types';
import { useWorkspaceStore } from '../../features/projects/workspace-store';
import { cn, formatRelativeTime } from '../../lib/utils';

const STATUS_FILTERS: { id: ProjectStatus | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'ready', label: 'Live' },
  { id: 'generating', label: 'Generating' },
  { id: 'draft', label: 'Draft' },
  { id: 'failed', label: 'Failed' },
];

export function ProjectsPage() {
  const router = useRouter();
  const {
    state,
    projects,
    loadProjects,
    renameWorkspace,
    branchWorkspace,
    duplicateWorkspace,
    deleteWorkspace,
    resetPrompt,
  } = useWorkspaceStore();

  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'all'>('all');

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [isSavingRename, setIsSavingRename] = useState(false);

  const refreshList = useCallback(async () => {
    try {
      await loadProjects();
    } catch {
      // listError captured in WorkspaceStore
    }
  }, [loadProjects]);

  useEffect(() => {
    void refreshList();
  }, [refreshList]);

  const isLoading = state.isLoadingList && projects.length === 0;
  const loadError = state.listError;

  const visibleProjects = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return projects.filter((project) => {
      const matchesStatus = statusFilter === 'all' || project.status === statusFilter;
      const matchesQuery = !needle || project.name.toLowerCase().includes(needle);
      return matchesStatus && matchesQuery;
    });
  }, [projects, query, statusFilter]);
  const readyCount = projects.filter((p) => p.status === 'ready').length;
  const totalRevisions = projects.reduce(
    (sum, p) => sum + (p.revisionCount ?? p.promptState?.revisionCount ?? 0),
    0
  );
  const queuedOrActiveCount = projects.filter((p) => {
    const lifecycle = state.lifecyclesById[p.id];
    const phase = lifecycle?.phase ?? p.promptState?.phase;
    return (
      p.status === 'generating' ||
      phase === 'queued' ||
      phase === 'analyzing' ||
      phase === 'haiku_ui' ||
      phase === 'deepseek_code' ||
      phase === 'esbuild_preview'
    );
  }).length;

  const handleDuplicate = async (project: Project) => {
    try {
      await duplicateWorkspace(project.id);
      toast.success(`Duplicated "${project.name}".`);
    } catch {
      toast.error('Failed to duplicate workspace.');
    }
  };

  const handleBranch = async (project: Project) => {
    try {
      const branched = await branchWorkspace(project.id);
      toast.success(`Created branch "${branched.name}".`);
      router.push(`/projects/${branched.id}`);
    } catch {
      toast.error('Failed to branch workspace.');
    }
  };

  const handleDelete = async (project: Project) => {
    try {
      await deleteWorkspace(project.id);
      toast.success(`Deleted "${project.name}".`);
    } catch {
      toast.error('Failed to delete workspace.');
    }
  };

  const handleResetPrompt = async (project: Project) => {
    try {
      await resetPrompt(project.id);
      toast.success(`Reset prompt state for "${project.name}".`);
    } catch {
      toast.error('Failed to reset prompt state.');
    }
  };

  const startRename = (project: Project) => {
    setRenamingId(project.id);
    setRenameDraft(project.name);
  };

  const commitRename = async (projectId: string) => {
    const clean = renameDraft.trim();
    if (!clean) {
      toast.error('Project name cannot be empty.');
      return;
    }
    setIsSavingRename(true);
    try {
      const updated = await renameWorkspace(projectId, clean);
      setRenamingId(null);
      toast.success(`Renamed workspace to "${updated.name}".`);
    } catch {
      toast.error('Failed to rename workspace.');
    } finally {
      setIsSavingRename(false);
    }
  };

  return (
    <DashboardLayout breadcrumb="Projects">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tighter text-slate-900">Projects</h1>
          <p className="mt-1 text-sm leading-relaxed text-slate-500">
            Manage persisted React + Vite workspaces, branches, revisions, and prompt lifecycles.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void refreshList()}
            disabled={state.isLoadingList}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 shadow-sm transition-all hover:bg-slate-50 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:opacity-50"
          >
            <RefreshCw
              className={cn('h-3.5 w-3.5', state.isLoadingList && 'animate-spin')}
              strokeWidth={1.5}
            />
            <span>Refresh</span>
          </button>

          <Link
            href="/projects/new"
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-4 text-sm font-medium text-white shadow-sm transition-all hover:from-emerald-700 hover:to-teal-700 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 whitespace-nowrap shrink-0"
          >
            <Plus className="h-4 w-4" strokeWidth={1.5} />
            <span>New Project</span>
          </Link>
        </div>
      </div>

      {/* Workspace summary metrics */}
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-emerald-500/50">
          <div className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
            Workspaces
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl font-bold tracking-tighter tabular-nums text-slate-900">
              {projects.length}
            </span>
            <span className="text-xs text-slate-500">{readyCount} ready</span>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-emerald-500/50">
          <div className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
            Prompt Revisions
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl font-bold tracking-tighter tabular-nums text-slate-900">
              {totalRevisions}
            </span>
            <span className="text-xs text-slate-500">persisted snapshots</span>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-emerald-500/50">
          <div className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
            Prompt Queue
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl font-bold tracking-tighter tabular-nums text-slate-900">
              {queuedOrActiveCount}
            </span>
            <span className="text-xs text-slate-500">active or queued</span>
          </div>
        </div>
      </div>

      {/* Filters toolbar */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            strokeWidth={1.5}
          />
          <label htmlFor="projects-search" className="sr-only">
            Search projects
          </label>
          <input
            id="projects-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search projects..."
            className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
          />
        </div>

        <div
          role="group"
          aria-label="Filter by status"
          className="flex items-center gap-1 overflow-x-auto rounded-lg border border-slate-200 bg-white p-1 shadow-sm"
        >
          {STATUS_FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setStatusFilter(item.id)}
              className={cn(
                'rounded-lg px-2.5 py-1 text-xs font-medium transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 whitespace-nowrap shrink-0',
                statusFilter === item.id
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'text-slate-600 hover:text-slate-900'
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {loadError ? (
        <div className="mt-6 flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <span>{loadError}</span>
          <button
            type="button"
            onClick={() => void refreshList()}
            className="rounded-lg border border-red-200 bg-white px-3 py-1 text-xs font-medium text-red-700 transition-all hover:bg-red-50 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
          >
            Retry
          </button>
        </div>
      ) : null}

      {/* Data Table, Skeleton Loader, or Empty State */}
      {isLoading ? (
        <div
          aria-label="Loading workspaces"
          className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
        >
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/70 px-5 py-3">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-32 hidden sm:block" />
            <Skeleton className="h-3 w-20" />
          </div>
          <div className="divide-y divide-slate-200 p-4 space-y-3">
            {[1, 2, 3, 4].map((row) => (
              <div key={row} className="flex items-center justify-between gap-4 pt-3 first:pt-0">
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-64" />
                </div>
                <Skeleton className="h-5 w-20 hidden sm:block" />
                <Skeleton className="h-6 w-20" />
                <Skeleton className="h-8 w-8" />
              </div>
            ))}
          </div>
        </div>
      ) : visibleProjects.length === 0 ? (
        <div className="mt-8 flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
          <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-slate-200 bg-slate-50/80 text-slate-300">
            <FolderOpen className="h-9 w-9" strokeWidth={1.25} />
          </div>
          <h2 className="mt-4 text-lg font-bold tracking-tighter text-slate-900">
            {projects.length === 0 ? 'No projects yet' : 'No matching workspaces'}
          </h2>
          <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-slate-500">
            {projects.length === 0
              ? 'Create your first AI-generated React app to start building.'
              : 'No projects match your current search or status filter.'}
          </p>
          <div className="mt-6 flex items-center gap-3">
            <Link
              href="/projects/new"
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-4 text-sm font-medium text-white shadow-sm transition-all hover:from-emerald-700 hover:to-teal-700 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
            >
              <Plus className="h-4 w-4" strokeWidth={1.5} />
              <span>New Project</span>
            </Link>
            {projects.length > 0 ? (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setStatusFilter('all');
                }}
                className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition-all hover:bg-slate-50 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
              >
                Clear filters
              </button>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[700px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium uppercase tracking-wider text-slate-500">
                <th className="px-5 py-3">Workspace</th>
                <th className="px-5 py-3">Files &amp; Revisions</th>
                <th className="px-5 py-3">Status &amp; Prompt Lifecycle</th>
                <th className="px-5 py-3">Last edited</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {visibleProjects.map((project) => {
                const isRenaming = renamingId === project.id;
                const lifecycle = state.lifecyclesById[project.id];
                const phase = lifecycle?.phase ?? project.promptState?.phase ?? 'idle';
                const activeAgent = lifecycle?.activeAgent ?? project.promptState?.activeAgent;
                const activePromptText =
                  lifecycle?.activePrompt ?? project.promptState?.activePrompt ?? project.initialPrompt;
                const revCount =
                  state.detailsById[project.id]?.revisions.length ??
                  project.revisionCount ??
                  project.promptState?.revisionCount ??
                  1;

                return (
                  <tr key={project.id} className="group transition-colors hover:bg-slate-50">
                    <td className="px-5 py-3.5">
                      {isRenaming ? (
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            void commitRename(project.id);
                          }}
                          className="flex items-center gap-1.5"
                        >
                          <label htmlFor={`rename-${project.id}`} className="sr-only">
                            Workspace name
                          </label>
                          <input
                            id={`rename-${project.id}`}
                            type="text"
                            value={renameDraft}
                            onChange={(e) => setRenameDraft(e.target.value)}
                            autoFocus
                            className="h-8 w-52 rounded-lg border border-emerald-500 bg-white px-2.5 text-sm text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                          />
                          <Tooltip label="Save name">
                            <button
                              type="submit"
                              disabled={isSavingRename}
                              aria-label="Save project name"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white transition-all hover:bg-emerald-700 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-50"
                            >
                              <Check className="h-3.5 w-3.5" strokeWidth={1.75} />
                            </button>
                          </Tooltip>
                          <Tooltip label="Cancel">
                            <button
                              type="button"
                              onClick={() => setRenamingId(null)}
                              aria-label="Cancel rename"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-all hover:bg-slate-50 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                            >
                              <X className="h-3.5 w-3.5" strokeWidth={1.75} />
                            </button>
                          </Tooltip>
                        </form>
                      ) : (
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Link
                              href={`/projects/${project.id}`}
                              className="rounded-md font-medium text-slate-900 transition-colors hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
                            >
                              {project.name}
                            </Link>
                            {project.branchedFromName ? (
                              <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">
                                <GitBranch className="h-2.5 w-2.5" strokeWidth={1.5} />
                                <span>from {project.branchedFromName}</span>
                              </span>
                            ) : null}
                          </div>
                          {activePromptText ? (
                            <p className="mt-0.5 max-w-sm truncate text-xs leading-relaxed text-slate-500">
                              {activePromptText}
                            </p>
                          ) : null}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs text-slate-500 tabular-nums">
                      <div>{project.fileCount ?? 2} files</div>
                      <div className="text-[11px] text-slate-400">
                        v{revCount} · {project.framework}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex flex-col items-start gap-1">
                        <StatusBadge status={project.status} />
                        <span className="font-mono text-[11px] text-slate-400">
                          {phase}
                          {activeAgent ? ` · ${activeAgent}` : ''}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-500 tabular-nums">
                      {formatRelativeTime(project.updatedAt)}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="inline-flex items-center justify-end gap-1">
                        <Tooltip label="Open in Builder" side="top">
                          <Link
                            href={`/projects/${project.id}`}
                            aria-label={`View ${project.name}`}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 opacity-0 transition-all hover:border-emerald-500/50 hover:text-emerald-700 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
                          >
                            <Eye className="h-4 w-4" strokeWidth={1.5} />
                          </Link>
                        </Tooltip>

                        <DropdownMenu
                          triggerLabel={`Actions for ${project.name}`}
                          trigger={<MoreHorizontal className="h-4 w-4" strokeWidth={1.5} />}
                          items={[
                            {
                              label: 'Edit in Builder',
                              icon: <Pencil className="h-3.5 w-3.5" strokeWidth={1.5} />,
                              onSelect: () => router.push(`/projects/${project.id}`),
                            },
                            {
                              label: 'Rename',
                              icon: <Edit3 className="h-3.5 w-3.5" strokeWidth={1.5} />,
                              onSelect: () => startRename(project),
                            },
                            {
                              label: 'Branch Workspace',
                              icon: <GitBranch className="h-3.5 w-3.5" strokeWidth={1.5} />,
                              onSelect: () => void handleBranch(project),
                            },
                            {
                              label: 'Duplicate',
                              icon: <Copy className="h-3.5 w-3.5" strokeWidth={1.5} />,
                              onSelect: () => void handleDuplicate(project),
                            },
                            ...(project.status === 'failed' || phase === 'failed'
                              ? [
                                  {
                                    label: 'Reset Prompt State',
                                    icon: <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.5} />,
                                    onSelect: () => void handleResetPrompt(project),
                                  },
                                ]
                              : []),
                            {
                              label: 'Delete',
                              icon: <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />,
                              destructive: true,
                              onSelect: () => void handleDelete(project),
                            },
                          ]}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </DashboardLayout>
  );
}
