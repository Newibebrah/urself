import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  FileCode2,
  GitBranch,
  History,
  Pencil,
  RotateCcw,
  Save,
  Sparkles,
  Tag,
  X,
} from 'lucide-react';
import type { ProjectFile, ProjectRevision, RevisionSource } from '../../features/projects/types';
import {
  areFileListsEqual,
  computeRevisionDiffStats,
} from '../../features/projects/workspace-reducer';
import { Tooltip } from '../ui/tooltip';
import { cn, formatRelativeTime } from '../../lib/utils';

interface RevisionHistoryProps {
  revisions: ProjectRevision[];
  currentFiles: ProjectFile[];
  isGenerating: boolean;
  dirtyFiles?: boolean;
  onLabelRevision: (revisionId: string, label: string) => Promise<void>;
  onRollbackRevision: (revisionId: string) => Promise<void>;
}

const SOURCE_LABELS: Record<RevisionSource, string> = {
  seed: 'Initial',
  'ai-generation': 'AI Build',
  manual: 'Manual Edit',
  rollback: 'Rollback',
  branch: 'Branch',
};

function renderSourceIcon(source: RevisionSource) {
  switch (source) {
    case 'ai-generation':
      return <Sparkles className="h-3 w-3 text-emerald-600" strokeWidth={1.5} />;
    case 'manual':
      return <Save className="h-3 w-3 text-slate-600" strokeWidth={1.5} />;
    case 'rollback':
      return <RotateCcw className="h-3 w-3 text-amber-600" strokeWidth={1.5} />;
    case 'branch':
      return <GitBranch className="h-3 w-3 text-emerald-600" strokeWidth={1.5} />;
    default:
      return <History className="h-3 w-3 text-slate-500" strokeWidth={1.5} />;
  }
}

export function RevisionHistory({
  revisions,
  currentFiles,
  isGenerating,
  dirtyFiles = false,
  onLabelRevision,
  onRollbackRevision,
}: RevisionHistoryProps) {
  const [selectedRevisionId, setSelectedRevisionId] = useState<string>(revisions[0]?.id ?? '');
  const [selectedFilePath, setSelectedFilePath] = useState<string>('src/App.tsx');
  const [editingRevisionId, setEditingRevisionId] = useState<string | null>(null);
  const [labelDraft, setLabelDraft] = useState('');
  const [isSavingLabel, setIsSavingLabel] = useState(false);
  const [isRollingBack, setIsRollingBack] = useState(false);

  useEffect(() => {
    if (revisions.length === 0) return;
    if (!revisions.some((r) => r.id === selectedRevisionId)) {
      setSelectedRevisionId(revisions[0].id);
    }
  }, [revisions, selectedRevisionId]);

  const selectedRevision =
    revisions.find((r) => r.id === selectedRevisionId) ?? revisions[0] ?? null;

  useEffect(() => {
    if (!selectedRevision || selectedRevision.files.length === 0) return;
    if (!selectedRevision.files.some((f) => f.path === selectedFilePath)) {
      setSelectedFilePath(selectedRevision.files[0].path);
    }
  }, [selectedRevision, selectedFilePath]);

  const diffStats = useMemo(() => {
    if (!selectedRevision) return { changedFiles: 0, addedLines: 0, removedLines: 0 };
    return computeRevisionDiffStats(selectedRevision.files, currentFiles);
  }, [currentFiles, selectedRevision]);

  const matchesCurrent = useMemo(() => {
    if (!selectedRevision) return true;
    return areFileListsEqual(selectedRevision.files, currentFiles) && !dirtyFiles;
  }, [currentFiles, dirtyFiles, selectedRevision]);

  const inspectedFile =
    selectedRevision?.files.find((f) => f.path === selectedFilePath) ??
    selectedRevision?.files[0] ??
    null;

  const startEditingLabel = (rev: ProjectRevision) => {
    setEditingRevisionId(rev.id);
    setLabelDraft(rev.label);
  };

  const commitLabel = async (revisionId: string) => {
    const clean = labelDraft.trim();
    if (!clean || isSavingLabel) return;
    setIsSavingLabel(true);
    try {
      await onLabelRevision(revisionId, clean);
      setEditingRevisionId(null);
    } finally {
      setIsSavingLabel(false);
    }
  };

  const handleRollback = async () => {
    if (!selectedRevision || isRollingBack || isGenerating) return;
    setIsRollingBack(true);
    try {
      await onRollbackRevision(selectedRevision.id);
    } finally {
      setIsRollingBack(false);
    }
  };

  if (revisions.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-8 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-500">
          <History className="h-5 w-5" strokeWidth={1.5} />
        </div>
        <h3 className="mt-3 text-sm font-semibold text-slate-900">No revisions recorded yet</h3>
        <p className="mt-1 max-w-xs text-xs text-slate-500">
          Revisions are captured automatically on AI generations, manual code saves, and rollbacks.
        </p>
      </div>
    );
  }

  return (
    <div
      role="region"
      aria-label="Revision History"
      className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white"
    >
      {/* Top section: revision timeline */}
      <div className="flex max-h-56 shrink-0 flex-col border-b border-slate-200">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/70 px-3.5 py-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
            <History className="h-3.5 w-3.5 text-emerald-600" strokeWidth={1.5} />
            <span>Revisions ({revisions.length})</span>
          </div>
          {dirtyFiles ? (
            <span className="rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 font-mono text-[10px] font-medium text-amber-800">
              Unsaved edits
            </span>
          ) : null}
        </div>

        <div className="flex-1 space-y-1.5 overflow-y-auto p-2.5" role="listbox" aria-label="Workspace revisions">
          {revisions.map((rev) => {
            const isSelected = rev.id === selectedRevision?.id;
            const isCurrentState = areFileListsEqual(rev.files, currentFiles) && !dirtyFiles;
            const isEditing = editingRevisionId === rev.id;

            return (
              <div
                key={rev.id}
                role="option"
                aria-selected={isSelected}
                className={cn(
                  'rounded-lg border p-2.5 transition-colors',
                  isSelected
                    ? 'border-emerald-500/60 bg-emerald-50/40'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60'
                )}
              >
                <div className="flex items-center justify-between gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSelectedRevisionId(rev.id)}
                    className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                  >
                    <span
                      className={cn(
                        'inline-flex shrink-0 items-center rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold tabular-nums',
                        isSelected
                          ? 'bg-emerald-600 text-white'
                          : 'border border-slate-200 bg-slate-50 text-slate-700'
                      )}
                    >
                      v{rev.version}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500">
                      {renderSourceIcon(rev.source)}
                      <span>{SOURCE_LABELS[rev.source]}</span>
                    </span>
                    {isCurrentState ? (
                      <span className="ml-auto shrink-0 rounded bg-emerald-100 px-1.5 py-0.5 font-mono text-[10px] font-medium text-emerald-800">
                        Active
                      </span>
                    ) : null}
                  </button>

                  {!isEditing ? (
                    <Tooltip label="Edit revision label" side="left">
                      <button
                        type="button"
                        onClick={() => startEditingLabel(rev)}
                        aria-label={`Edit label for v${rev.version}`}
                        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-700 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
                      >
                        <Pencil className="h-3 w-3" strokeWidth={1.5} />
                      </button>
                    </Tooltip>
                  ) : null}
                </div>

                {isEditing ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void commitLabel(rev.id);
                    }}
                    className="mt-2 flex items-center gap-1"
                  >
                    <label htmlFor={`rev-label-${rev.id}`} className="sr-only">
                      Label for version {rev.version}
                    </label>
                    <input
                      id={`rev-label-${rev.id}`}
                      type="text"
                      value={labelDraft}
                      maxLength={80}
                      onChange={(e) => setLabelDraft(e.target.value)}
                      placeholder="Describe this version..."
                      autoFocus
                      className="h-7 min-w-0 flex-1 rounded-lg border border-emerald-500 bg-white px-2 text-xs text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                    />
                    <Tooltip label="Save label">
                      <button
                        type="submit"
                        disabled={isSavingLabel || labelDraft.trim().length === 0}
                        aria-label={`Save label for v${rev.version}`}
                        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white transition-all hover:bg-emerald-700 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-50"
                      >
                        <Check className="h-3.5 w-3.5" strokeWidth={1.75} />
                      </button>
                    </Tooltip>
                    <Tooltip label="Cancel">
                      <button
                        type="button"
                        onClick={() => setEditingRevisionId(null)}
                        aria-label="Cancel label edit"
                        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-all hover:bg-slate-50 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                      >
                        <X className="h-3.5 w-3.5" strokeWidth={1.75} />
                      </button>
                    </Tooltip>
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => setSelectedRevisionId(rev.id)}
                    className="mt-1.5 flex w-full items-center justify-between gap-2 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-medium text-slate-900">{rev.label}</div>
                      <p className="mt-0.5 truncate text-[11px] leading-relaxed text-slate-500">
                        {rev.prompt || rev.summary}
                      </p>
                    </div>
                    <div className="shrink-0 text-right font-mono text-[10px] text-slate-400 tabular-nums">
                      <div>{rev.files.length} files</div>
                      <div>{formatRelativeTime(rev.createdAt)}</div>
                    </div>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom section: snapshot details & read-only code viewer */}
      {selectedRevision ? (
        <div className="flex min-h-0 flex-1 flex-col bg-zinc-950 text-zinc-100">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-3 text-slate-900">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs font-semibold text-slate-800">
                  v{selectedRevision.version}
                </span>
                <span className="truncate text-xs font-semibold text-slate-900">
                  {selectedRevision.label}
                </span>
                {selectedRevision.agent ? (
                  <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] text-slate-600">
                    {selectedRevision.agent}
                  </span>
                ) : null}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 font-mono text-[11px] text-slate-500 tabular-nums">
                <span>{selectedRevision.summary}</span>
                <span aria-hidden="true">·</span>
                <span>
                  {diffStats.changedFiles === 0
                    ? 'Matches active workspace'
                    : `${diffStats.changedFiles} file${diffStats.changedFiles === 1 ? '' : 's'} differ vs current`}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => startEditingLabel(selectedRevision)}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 transition-all hover:bg-slate-50 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
              >
                <Tag className="h-3.5 w-3.5" strokeWidth={1.5} />
                <span>Label</span>
              </button>

              <button
                type="button"
                disabled={matchesCurrent || isGenerating || isRollingBack}
                onClick={() => void handleRollback()}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-3 text-xs font-medium text-white shadow-sm transition-all hover:from-emerald-700 hover:to-teal-700 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 whitespace-nowrap shrink-0"
              >
                <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.5} />
                <span>
                  {isRollingBack
                    ? 'Rolling back...'
                    : `Roll Back to v${selectedRevision.version}`}
                </span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1 overflow-x-auto border-b border-zinc-800 px-3 py-2">
            {selectedRevision.files.map((file) => (
              <button
                key={file.path}
                type="button"
                onClick={() => setSelectedFilePath(file.path)}
                className={cn(
                  'inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1 font-mono text-xs transition-colors whitespace-nowrap',
                  inspectedFile?.path === file.path
                    ? 'bg-zinc-800 text-emerald-400'
                    : 'text-zinc-400 hover:text-zinc-200'
                )}
              >
                <FileCode2 className="h-3 w-3 shrink-0" strokeWidth={1.5} />
                <span>{file.path}</span>
              </button>
            ))}
          </div>

          <pre className="min-h-0 flex-1 overflow-auto p-4 font-mono text-xs leading-relaxed text-zinc-200">
            <code>{inspectedFile?.content ?? '// No file content'}</code>
          </pre>
        </div>
      ) : null}
    </div>
  );
}
