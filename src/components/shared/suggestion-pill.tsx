import { Sparkles } from 'lucide-react';
import { cn } from '../../lib/utils';

interface SuggestionPillProps {
  label: string;
  onSelect: (prompt: string) => void;
  active?: boolean;
  className?: string;
}

export function SuggestionPill({ label, onSelect, active = false, className }: SuggestionPillProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(label)}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-all active:scale-95 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2',
        active
          ? 'border-emerald-500/60 bg-emerald-50 text-emerald-700'
          : 'border-slate-200 bg-white text-slate-500 hover:border-emerald-500/40 hover:bg-emerald-50 hover:text-emerald-700',
        className
      )}
    >
      <Sparkles className="h-3 w-3 shrink-0 text-emerald-600" strokeWidth={1.75} />
      <span>{label}</span>
    </button>
  );
}
