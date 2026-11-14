import type { ReactNode } from 'react';
import { Lock } from 'lucide-react';
import { cn } from '../../lib/utils';

interface BrowserFrameProps {
  url?: string;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}

export function BrowserFrame({
  url = 'preview.urself.online',
  children,
  className,
  contentClassName,
}: BrowserFrameProps) {
  return (
    <div
      className={cn(
        'flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white',
        className
      )}
    >
      <div className="flex h-10 shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/80 px-4">
        <div className="flex items-center gap-1.5" aria-hidden="true">
          <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
        </div>
        <div className="flex min-w-0 max-w-sm flex-1 items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1 text-xs font-mono text-slate-500">
          <Lock className="h-3 w-3 shrink-0 text-slate-400" strokeWidth={1.5} />
          <span className="truncate">{url}</span>
        </div>
        <div className="w-10 shrink-0" aria-hidden="true" />
      </div>
      <div className={cn('flex-1 bg-white', contentClassName)}>{children}</div>
    </div>
  );
}
