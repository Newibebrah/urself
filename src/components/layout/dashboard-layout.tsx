import { useState, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { useLocation } from 'react-router-dom';
import { PAGE_TRANSITION_PROPS } from '../../lib/motion';
import { cn } from '../../lib/utils';
import { Sheet } from '../ui/sheet';
import { DashboardSidebar } from './dashboard-sidebar';
import { DashboardTopbar } from './dashboard-topbar';

interface DashboardLayoutProps {
  breadcrumb: string;
  children: ReactNode;
  fullBleed?: boolean;
}

export function DashboardLayout({ breadcrumb, children, fullBleed = false }: DashboardLayoutProps) {
  const { pathname } = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="flex min-h-screen bg-[#FAFAFA] text-slate-900">
      <div
        className={cn(
          'hidden lg:block lg:shrink-0 transition-all duration-200',
          sidebarCollapsed ? 'lg:w-16' : 'lg:w-60'
        )}
      >
        <div
          className={cn(
            'fixed inset-y-0 left-0 z-20 transition-all duration-200',
            sidebarCollapsed ? 'w-16' : 'w-60'
          )}
        >
          <DashboardSidebar
            collapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
          />
        </div>
      </div>

      <Sheet
        open={mobileMenuOpen}
        onOpenChange={setMobileMenuOpen}
        side="left"
        title="urself.online"
      >
        <div className="-m-6 h-[calc(100%+3rem)]">
          <DashboardSidebar onNavigate={() => setMobileMenuOpen(false)} className="w-full border-r-0" />
        </div>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <DashboardTopbar
          breadcrumb={breadcrumb}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
        />
        <main
          className={
            fullBleed
              ? 'flex flex-1 min-w-0 flex-col'
              : 'mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6'
          }
        >
          <motion.div
            key={pathname}
            {...PAGE_TRANSITION_PROPS}
            className={fullBleed ? 'flex flex-1 min-h-0 flex-col' : undefined}
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
}
