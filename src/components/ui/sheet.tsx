import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  side?: 'left' | 'right';
  children: ReactNode;
}

export function Sheet({ open, onOpenChange, title, side = 'right', children }: SheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true" aria-label={title}>
      <button
        type="button"
        aria-label="Close navigation menu"
        onClick={() => onOpenChange(false)}
        className="fixed inset-0 bg-zinc-950/35 backdrop-blur-[2px] transition-opacity"
      />
      <div
        className={cn(
          'relative z-10 flex h-full w-72 max-w-[85vw] flex-col bg-white border-slate-200 p-6 shadow-sm',
          side === 'right' ? 'ml-auto border-l' : 'mr-auto border-r'
        )}
      >
        <div className="flex items-center justify-between pb-4 border-b border-slate-200">
          <span className="text-sm font-semibold tracking-tight text-slate-900">{title}</span>
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => onOpenChange(false)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>
        <div className="mt-5 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
