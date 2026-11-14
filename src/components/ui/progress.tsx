import { cn } from '../../lib/utils';

interface ProgressProps {
  value: number;
  className?: string;
  barClassName?: string;
  label?: string;
}

export function Progress({ value, className, barClassName, label }: ProgressProps) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn('h-2 w-full overflow-hidden rounded-full bg-zinc-800', className)}
    >
      <div
        className={cn('h-full rounded-full bg-emerald-500 transition-all duration-200', barClassName)}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
