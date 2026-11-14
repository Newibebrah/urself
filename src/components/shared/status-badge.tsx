import type { ProjectStatus } from '../../features/projects/types';
import { cn } from '../../lib/utils';

interface StatusBadgeProps {
  status: ProjectStatus;
  className?: string;
}

const STATUS_META: Record<
  ProjectStatus,
  { label: string; dotClass: string; textClass: string }
> = {
  ready: {
    label: 'Live',
    dotClass: 'bg-emerald-500 animate-pulse',
    textClass: 'text-emerald-700',
  },
  draft: {
    label: 'Draft',
    dotClass: 'bg-slate-400',
    textClass: 'text-slate-500',
  },
  generating: {
    label: 'Generating',
    dotClass: 'bg-amber-500 animate-pulse',
    textClass: 'text-amber-700',
  },
  failed: {
    label: 'Failed',
    dotClass: 'bg-red-500',
    textClass: 'text-red-700',
  },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const meta = STATUS_META[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 text-xs font-medium whitespace-nowrap shrink-0 tabular-nums',
        meta.textClass,
        className
      )}
    >
      <span aria-hidden="true" className={cn('h-2 w-2 rounded-full', meta.dotClass)} />
      <span>{meta.label}</span>
    </span>
  );
}
