import { AlertTriangle, CheckCircle2, Download, Loader2, RotateCcw, X, XCircle } from 'lucide-react';
import type { ZipExportProgressState } from '../../features/projects/zip-export';
import { cn } from '../../lib/utils';

export interface ZipExportOverlayProps {
  projectName: string;
  fileCount: number;
  progress: ZipExportProgressState;
  onCancel: () => void;
  onRetry: () => void;
}

const PROGRESS_WIDTH_STEPS = [
  { min: 100, className: 'w-full' },
  { min: 94, className: 'w-[94%]' },
  { min: 88, className: 'w-[88%]' },
  { min: 82, className: 'w-[82%]' },
  { min: 72, className: 'w-[72%]' },
  { min: 56, className: 'w-[56%]' },
  { min: 34, className: 'w-[34%]' },
  { min: 18, className: 'w-[18%]' },
  { min: 0, className: 'w-[6%]' },
] as const;

function resolveWidthClass(percent: number): string {
  const found = PROGRESS_WIDTH_STEPS.find((step) => percent >= step.min);
  return found?.className ?? 'w-[6%]';
}

export function ZipExportOverlay({
  projectName,
  fileCount,
  progress,
  onCancel,
  onRetry,
}: ZipExportOverlayProps) {
  const widthClass = resolveWidthClass(progress.percent);
  const hasError = Boolean(progress.error);

  return (
    <div
      data-testid="zip-export-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="zip-export-progress-title"
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl shadow-emerald-500/10"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 font-mono text-[11px] text-slate-400">
              <span>Project Archive</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">
                {fileCount} file{fileCount === 1 ? '' : 's'}
              </span>
            </div>
            <h2
              id="zip-export-progress-title"
              className="mt-1 truncate text-lg font-bold tracking-tighter text-slate-900"
            >
              {progress.completed
                ? 'Archive Ready'
                : hasError
                ? 'Export Interrupted'
                : `Exporting ${projectName}`}
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              {progress.detail}
            </p>
          </div>

          <button
            type="button"
            aria-label="Cancel ZIP export"
            onClick={onCancel}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-all hover:bg-slate-50 hover:text-slate-900 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            <X className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>

        {/* Progress Track */}
        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="font-medium text-slate-700">{progress.headline}</span>
            <span
              data-testid="zip-export-percent"
              className={cn(
                'font-mono text-xs font-semibold tabular-nums',
                hasError ? 'text-red-600' : 'text-emerald-700'
              )}
            >
              {progress.percent}%
            </span>
          </div>

          <div
            role="progressbar"
            aria-label="ZIP export progress"
            aria-valuenow={progress.percent}
            aria-valuemin={0}
            aria-valuemax={100}
            className="h-2 w-full overflow-hidden rounded-lg bg-slate-100"
          >
            <div
              className={cn(
                'h-full rounded-lg transition-all duration-200 ease-out',
                hasError
                  ? 'bg-red-500'
                  : 'bg-gradient-to-r from-emerald-500 to-teal-500',
                widthClass
              )}
            />
          </div>
        </div>

        {/* Ordered 3-Stage Breakdown */}
        <ol
          aria-label="Export stages"
          className="mt-5 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-slate-50/50"
        >
          {progress.steps.map((step, index) => (
            <li
              key={step.id}
              data-export-stage={step.id}
              data-stage-status={step.status}
              className={cn(
                'flex items-start gap-3 px-4 py-3 transition-colors',
                step.status === 'active' && 'bg-emerald-50/50',
                step.status === 'error' && 'bg-red-50/60'
              )}
            >
              <div className="mt-0.5 shrink-0">
                {step.status === 'completed' ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" strokeWidth={1.75} />
                ) : step.status === 'active' ? (
                  <Loader2 className="h-4 w-4 animate-spin text-emerald-600" strokeWidth={1.75} />
                ) : step.status === 'error' ? (
                  <XCircle className="h-4 w-4 text-red-600" strokeWidth={1.75} />
                ) : (
                  <span className="flex h-4 w-4 items-center justify-center rounded border border-slate-300 bg-white font-mono text-[10px] font-medium tabular-nums text-slate-400">
                    {index + 1}
                  </span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={cn(
                      'text-xs font-semibold',
                      step.status === 'error'
                        ? 'text-red-900'
                        : step.status === 'pending'
                        ? 'text-slate-500'
                        : 'text-slate-900'
                    )}
                  >
                    {step.label}
                  </span>
                  <span
                    className={cn(
                      'font-mono text-[11px] tabular-nums',
                      step.status === 'completed'
                        ? 'text-emerald-700'
                        : step.status === 'active'
                        ? 'font-medium text-emerald-700'
                        : step.status === 'error'
                        ? 'text-red-600'
                        : 'text-slate-400'
                    )}
                  >
                    {step.status === 'completed'
                      ? 'Complete'
                      : step.status === 'active'
                      ? 'Running'
                      : step.status === 'error'
                      ? 'Failed'
                      : 'Queued'}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
                  {step.detail}
                </p>
              </div>
            </li>
          ))}
        </ol>

        {hasError ? (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50/70 px-3.5 py-2.5 text-xs text-red-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" strokeWidth={1.75} />
            <span className="leading-relaxed">{progress.error}</span>
          </div>
        ) : null}

        <div className="mt-5 flex items-center justify-end gap-2 border-t border-slate-200 pt-4">
          {hasError ? (
            <>
              <button
                type="button"
                onClick={onCancel}
                className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-xs font-medium text-slate-700 transition-all hover:bg-slate-50 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
              >
                Close
              </button>
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-4 text-xs font-medium text-white shadow-sm transition-all hover:from-emerald-700 hover:to-teal-700 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
              >
                <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.5} />
                <span>Retry Export</span>
              </button>
            </>
          ) : progress.completed ? (
            <div className="inline-flex h-9 items-center gap-1.5 font-mono text-xs font-medium text-emerald-700">
              <Download className="h-3.5 w-3.5" strokeWidth={1.75} />
              <span>Downloading {progress.fileName ?? 'archive.zip'}...</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-xs font-medium text-slate-700 transition-all hover:bg-slate-50 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
            >
              Cancel Export
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
