'use client';

import { AnimatePresence, motion } from 'motion/react';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

/**
 * Global public/private shell transition. Keeps the page background stable and
 * fades route content so marketing -> auth -> dashboard never flashes white.
 */
export function RouteTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        className="min-h-screen bg-[#FAFAFA]"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
