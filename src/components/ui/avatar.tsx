import { cn } from '../../lib/utils';

interface AvatarProps {
  name: string;
  src?: string | null;
  className?: string;
}

export function Avatar({ name, src, className }: AvatarProps) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'U';

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        referrerPolicy="no-referrer"
        className={cn('h-8 w-8 rounded-lg border border-slate-200 bg-slate-100 object-cover', className)}
      />
    );
  }

  return (
    <div
      aria-label={name}
      className={cn(
        'flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-[11px] font-bold text-emerald-700',
        className
      )}
    >
      {initials}
    </div>
  );
}
