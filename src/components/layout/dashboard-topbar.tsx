import { useEffect, useMemo, useState } from 'react';
import { Bell, Command, FolderKanban, Menu, Plus, Search, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useWorkspaceStore } from '../../features/projects/workspace-store';
import { formatRelativeTime } from '../../lib/utils';
import { MOCK_QUOTA, MOCK_USER } from '../../types';
import { Tooltip } from '../ui/tooltip';

interface DashboardTopbarProps {
  breadcrumb: string;
  onOpenMobileMenu: () => void;
}

export function DashboardTopbar({ breadcrumb, onOpenMobileMenu }: DashboardTopbarProps) {
  const navigate = useNavigate();
  const { projects, state } = useWorkspaceStore();

  const [cmdOpen, setCmdOpen] = useState(false);
  const [cmdQuery, setCmdQuery] = useState('');
  const [notifOpen, setNotifOpen] = useState(false);
  const [seenAt, setSeenAt] = useState<number>(0);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCmdOpen((prev) => !prev);
      } else if (e.key === 'Escape') {
        setCmdOpen(false);
        setNotifOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const recentEvents = useMemo(() => {
    return projects.slice(0, 4).map((p) => {
      const lifecycle = state.lifecyclesById[p.id];
      return {
        id: p.id,
        name: p.name,
        phase: lifecycle?.phase ?? p.promptState?.phase ?? 'idle',
        updatedAt: p.updatedAt,
      };
    });
  }, [projects, state.lifecyclesById]);

  const hasUnread = recentEvents.some(
    (ev) => new Date(ev.updatedAt).getTime() > seenAt || ev.phase === 'failed'
  );

  const filteredCommands = useMemo(() => {
    const q = cmdQuery.trim().toLowerCase();
    const projectItems = projects.map((p) => ({
      id: p.id,
      title: p.name,
      subtitle: `${p.framework} · v${p.revisionCount ?? p.promptState?.revisionCount ?? 1} rev`,
      to: `/projects/${p.id}`,
    }));
    const quickLinks = [
      { id: 'new', title: 'Create New Project', subtitle: 'Initialize AI workspace', to: '/projects/new' },
      { id: 'all', title: 'All Workspaces', subtitle: 'Open project data table', to: '/projects' },
      { id: 'billing', title: 'Billing & Quota', subtitle: 'Manage plan & IDR invoice', to: '/billing' },
      { id: 'settings', title: 'Settings & API Keys', subtitle: 'Profile and CLI keys', to: '/settings' },
    ];
    const all = [...projectItems, ...quickLinks];
    return q ? all.filter((item) => item.title.toLowerCase().includes(q)) : all.slice(0, 7);
  }, [cmdQuery, projects]);

  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-white/85 px-4 backdrop-blur-md lg:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Tooltip label="Open menu" side="bottom" className="lg:hidden">
            <button
              type="button"
              aria-label="Open workspace sidebar"
              onClick={onOpenMobileMenu}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-all hover:bg-slate-100 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
            >
              <Menu className="h-5 w-5" strokeWidth={1.5} />
            </button>
          </Tooltip>

          <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 text-sm">
            <Link
              to="/projects"
              className="rounded text-slate-500 hover:text-slate-900 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
            >
              Workspace
            </Link>
            <span aria-hidden="true" className="text-slate-300">/</span>
            <span className="truncate font-semibold tracking-tight text-slate-900">{breadcrumb}</span>
          </nav>
        </div>

        {/* Center Command+K Quick Search Bar */}
        <div className="hidden flex-1 justify-center md:flex">
          <button
            type="button"
            onClick={() => {
              setCmdQuery('');
              setCmdOpen(true);
            }}
            className="flex h-8 w-full max-w-xs items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50/80 px-3 text-xs text-slate-500 transition-all hover:border-emerald-500/40 hover:bg-white hover:text-slate-900 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
          >
            <span className="flex items-center gap-2 truncate">
              <Search className="h-3.5 w-3.5 shrink-0 text-slate-400" strokeWidth={1.5} />
              <span className="truncate">Jump to workspace...</span>
            </span>
            <kbd className="inline-flex shrink-0 items-center gap-0.5 rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[10px] text-slate-500">
              <Command className="h-2.5 w-2.5" strokeWidth={1.75} />
              <span>K</span>
            </kbd>
          </button>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <Link
            to="/billing"
            className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-emerald-500/40 hover:text-slate-900 tabular-nums whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
          >
            <span>
              {MOCK_QUOTA.projectsUsed} / {MOCK_QUOTA.projectsMax} projects
            </span>
          </Link>

          {/* Notification Bell with wired popover */}
          <div className="relative">
            <Tooltip label="Workspace activity" side="bottom">
              <button
                type="button"
                aria-label="Workspace notifications"
                aria-expanded={notifOpen}
                onClick={() => {
                  setNotifOpen((prev) => !prev);
                  setSeenAt(Date.now());
                }}
                className="relative inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-all hover:bg-slate-50 hover:text-slate-900 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
              >
                <Bell className="h-4 w-4" strokeWidth={1.5} />
                {hasUnread ? (
                  <span
                    aria-hidden="true"
                    className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500 animate-pulse"
                  />
                ) : null}
              </button>
            </Tooltip>

            {notifOpen ? (
              <div
                role="dialog"
                aria-label="Workspace activity feed"
                className="absolute right-0 mt-2 w-72 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl shadow-emerald-500/10"
              >
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <span className="text-xs font-bold tracking-tighter text-slate-900">
                    Workspace Activity
                  </span>
                  <button
                    type="button"
                    aria-label="Close notifications"
                    onClick={() => setNotifOpen(false)}
                    className="inline-flex h-6 w-6 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  >
                    <X className="h-3.5 w-3.5" strokeWidth={1.5} />
                  </button>
                </div>

                {recentEvents.length === 0 ? (
                  <p className="py-4 text-center text-xs text-slate-500">
                    No recent workspace updates.
                  </p>
                ) : (
                  <ul className="mt-2 divide-y divide-slate-100">
                    {recentEvents.map((ev) => (
                      <li key={ev.id}>
                        <Link
                          to={`/projects/${ev.id}`}
                          onClick={() => setNotifOpen(false)}
                          className="flex items-center justify-between gap-2 rounded-lg px-2 py-2 text-xs transition-colors hover:bg-slate-50"
                        >
                          <div className="min-w-0">
                            <div className="truncate font-medium text-slate-900">{ev.name}</div>
                            <div className="font-mono text-[10px] text-slate-500">{ev.phase}</div>
                          </div>
                          <span className="shrink-0 text-[10px] text-slate-400 tabular-nums">
                            {formatRelativeTime(ev.updatedAt)}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
          </div>

          <Tooltip label={`Account: ${MOCK_USER.name}`} side="bottom">
            <Link
              to="/settings"
              aria-label={`Account settings for ${MOCK_USER.name}`}
              className="inline-flex items-center gap-2 rounded-lg p-0.5 transition-all hover:bg-slate-100 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
            >
              <img
                src={MOCK_USER.avatarUrl}
                alt={MOCK_USER.name}
                referrerPolicy="no-referrer"
                className="h-7 w-7 rounded-lg object-cover border border-slate-200 bg-slate-100"
              />
            </Link>
          </Tooltip>
        </div>
      </header>

      {/* Command+K Palette Modal */}
      {cmdOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Command palette"
          onClick={() => setCmdOpen(false)}
          className="fixed inset-0 z-50 flex items-start justify-center bg-zinc-950/40 px-4 pt-24 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-emerald-500/10"
          >
            <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
              <Search className="h-4 w-4 text-slate-400" strokeWidth={1.5} />
              <label htmlFor="cmdk-input" className="sr-only">
                Search workspaces or commands
              </label>
              <input
                id="cmdk-input"
                type="text"
                autoFocus
                value={cmdQuery}
                onChange={(e) => setCmdQuery(e.target.value)}
                placeholder="Search workspaces, billing, or settings..."
                className="flex-1 border-0 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
              />
              <button
                type="button"
                aria-label="Close search"
                onClick={() => setCmdOpen(false)}
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-900"
              >
                <X className="h-3.5 w-3.5" strokeWidth={1.5} />
              </button>
            </div>

            <div className="max-h-72 overflow-y-auto p-2">
              {filteredCommands.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  No matching workspaces or routes.
                </div>
              ) : (
                filteredCommands.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setCmdOpen(false);
                      navigate(item.to);
                    }}
                    className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-emerald-50 hover:text-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      {item.id === 'new' ? (
                        <Plus className="h-4 w-4 shrink-0 text-emerald-600" strokeWidth={1.5} />
                      ) : (
                        <FolderKanban className="h-4 w-4 shrink-0 text-slate-400" strokeWidth={1.5} />
                      )}
                      <span className="truncate font-medium text-slate-900">{item.title}</span>
                    </span>
                    <span className="shrink-0 font-mono text-[11px] text-slate-400">
                      {item.subtitle}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
