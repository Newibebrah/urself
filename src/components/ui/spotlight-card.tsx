import { useState, type MouseEvent, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { STAGGER_ITEM_VARIANTS } from '../../lib/motion';
import { cn } from '../../lib/utils';

interface SpotlightCardProps {
  children: ReactNode;
  className?: string;
}

export function SpotlightCard({ children, className }: SpotlightCardProps) {
  const [coords, setCoords] = useState<{ x: number; y: number } | null>(null);

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setCoords({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  return (
    <motion.div
      variants={STAGGER_ITEM_VARIANTS}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setCoords(null)}
      className={cn(
        'group relative overflow-hidden rounded-xl border border-slate-200 bg-white p-6 transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-500/50',
        className
      )}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 transition-opacity duration-300"
        style={{
          opacity: coords ? 1 : 0,
          background: coords
            ? `radial-gradient(360px circle at ${coords.x}px ${coords.y}px, rgba(16, 185, 129, 0.08), transparent 65%)`
            : undefined,
        }}
      />
      <div className="relative z-10 flex h-full flex-col justify-between">{children}</div>
    </motion.div>
  );
}
