import {
  CreditCard,
  FolderKanban,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Sparkles,
} from 'lucide-react';
import { Link, NavLink } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { MOCK_USER } from '../../types';
import { Tooltip } from '../ui/tooltip';

interface DashboardSidebarProps {
  onNavigate?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  className?: string;
}

const SIDEBAR_ITEMS = [
  { to: '/projects', label: 'Projects', icon: FolderKanban },
  { to: '/billing', label: 'Billing', icon: CreditCard },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export function DashboardSidebar({
  onNavigate,
  collapsed = false,
  onToggleCollapse,
  className,
}: DashboardSidebarProps) {
  return (
    <aside
      className={cn(
        'flex h-full flex-col justify-between border-r border-slate-200 bg-white transition-all duration-200',
        collapsed ? 'w-16' : 'w-60',
        className
      )}
    >
      <div>
        <div
          className={cn(
            'flex h-14 items-center border-b border-slate-200',
            collapsed ? 'justify-center px-2' : 'justify-between px-4'
          )}
        >
          {!collapsed ? (
            <Link
              to="/"
              onClick={onNavigate}
              className="font-display text-base font-bold tracking-tighter text-slate-900 whitespace-nowrap rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
            >
              urself.online
            </Link>
          ) : null}

          {onToggleCollapse ? (
            <Tooltip label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} side="right">
              <button
                type="button"
                onClick={onToggleCollapse}
                aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-all hover:bg-slate-50 hover:text-slate-900 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
              >
                {collapsed ? (
                  <PanelLeftOpen className="h-4 w-4" strokeWidth={1.5} />
                ) : (
                  <PanelLeftClose className="h-4 w-4" strokeWidth={1.5} />
                )}
              </button>
            </Tooltip>
          ) : null}
        </div>

        <div className={cn('p-3', collapsed && 'px-2')}>
          {collapsed ? (
            <Tooltip label="New Project" side="right" className="mb-4 flex justify-center">
              <Link
                to="/projects/new"
                onClick={onNavigate}
                aria-label="New Project"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-sm transition-all hover:from-emerald-700 hover:to-teal-700 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
              >
                <Sparkles className="h-4 w-4" strokeWidth={1.5} />
              </Link>
            </Tooltip>
          ) : (
            <Link
              to="/projects/new"
              onClick={onNavigate}
              className="mb-4 inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-3 text-sm font-medium text-white shadow-sm transition-all hover:from-emerald-700 hover:to-teal-700 active:scale-95 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
            >
              <Sparkles className="h-4 w-4" strokeWidth={1.5} />
              <span>New Project</span>
            </Link>
          )}

          <nav aria-label="Workspace" className="space-y-1">
            {SIDEBAR_ITEMS.map((item) => {
              const Icon = item.icon;
              const link = (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={onNavigate}
                  aria-label={collapsed ? item.label : undefined}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center rounded-lg py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2',
                      collapsed ? 'justify-center px-2' : 'gap-2.5 px-3',
                      isActive
                        ? 'border-l-2 border-emerald-500 bg-emerald-50/50 text-emerald-700 rounded-l-none'
                        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                    )
                  }
                >
                  <Icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                  {!collapsed ? <span className="whitespace-nowrap">{item.label}</span> : null}
                </NavLink>
              );

              return collapsed ? (
                <Tooltip key={item.to} label={item.label} side="right" className="flex justify-center">
                  {link}
                </Tooltip>
              ) : (
                link
              );
            })}
          </nav>
        </div>
      </div>

      <div className={cn('border-t border-slate-200', collapsed ? 'p-2' : 'p-4')}>
        <Tooltip label={collapsed ? `${MOCK_USER.name} · Settings` : 'Account settings'} side="right" className="w-full">
          <Link
            to="/settings"
            onClick={onNavigate}
            className={cn(
              'flex w-full items-center rounded-lg p-1.5 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2',
              collapsed ? 'justify-center' : 'gap-3'
            )}
          >
            <img
              src={MOCK_USER.avatarUrl}
              alt={MOCK_USER.name}
              referrerPolicy="no-referrer"
              className="h-8 w-8 rounded-lg object-cover border border-slate-200 bg-slate-100 shrink-0"
            />
            {!collapsed ? (
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-semibold text-slate-900">{MOCK_USER.name}</div>
                <div className="truncate text-[11px] text-slate-500 capitalize">
                  {MOCK_USER.plan} Plan
                </div>
              </div>
            ) : null}
          </Link>
        </Tooltip>
      </div>
    </aside>
  );
}
