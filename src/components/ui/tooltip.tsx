import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

interface TooltipProps {
  label: string;
  children: ReactNode;
  side?: 'top' | 'bottom' | 'right' | 'left';
  className?: string;
}

const POSITION_CLASSES: Record<NonNullable<TooltipProps['side']>, string> = {
  top: 'bottom-full left-1/2 mb-1.5 -translate-x-1/2',
  bottom: 'top-full left-1/2 mt-1.5 -translate-x-1/2',
  right: 'left-full top-1/2 ml-2 -translate-y-1/2',
  left: 'right-full top-1/2 mr-2 -translate-y-1/2',
};

export function Tooltip({
  label,
  children,
  side = 'top',
  className,
}: TooltipProps) {
  return (
    <span className={cn('group/tooltip relative inline-flex shrink-0', className)}>
      {children}
      <span
        role="tooltip"
        className={cn(
          'pointer-events-none invisible absolute z-50 whitespace-nowrap rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1 text-[11px] font-medium text-zinc-100 opacity-0 shadow-sm transition-opacity duration-150 hidden group-hover/tooltip:block group-hover/tooltip:visible group-hover/tooltip:opacity-100 group-focus-within/tooltip:block group-focus-within/tooltip:visible group-focus-within/tooltip:opacity-100',
          POSITION_CLASSES[side]
        )}
      >
        {label}
      </span>
    </span>
  );
}
