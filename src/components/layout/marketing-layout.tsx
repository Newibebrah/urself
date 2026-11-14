import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import { useLocation } from 'react-router-dom';
import { PAGE_TRANSITION_PROPS } from '../../lib/motion';
import { MarketingFooter } from './marketing-footer';
import { MarketingNavbar } from './marketing-navbar';

export function MarketingLayout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();

  return (
    <div className="flex min-h-screen flex-col bg-[#FAFAFA] text-slate-900">
      <MarketingNavbar />
      <main className="flex-1">
        <motion.div key={pathname} {...PAGE_TRANSITION_PROPS}>
          {children}
        </motion.div>
      </main>
      <MarketingFooter />
    </div>
  );
}
