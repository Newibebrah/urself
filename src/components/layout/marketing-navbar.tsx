import { useEffect, useState } from 'react';
import { Menu } from 'lucide-react';
import { Link, NavLink } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { Sheet } from '../ui/sheet';
import { Tooltip } from '../ui/tooltip';

const NAV_LINKS = [
  { to: '/how-it-works', label: 'How it works' },
  { to: '/pricing', label: 'Pricing' },
  { to: '/faq', label: 'FAQ' },
  { to: '/blog', label: 'Blog' },
];

export function MarketingNavbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 10);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={cn(
        'sticky top-0 z-40 h-16 transition-all duration-200',
        isScrolled
          ? 'border-b border-slate-200 bg-[#FAFAFA]/80 backdrop-blur-lg'
          : 'border-b border-transparent bg-transparent'
      )}
    >
      <div className="mx-auto flex h-full max-w-6xl items-center justify-between gap-8 px-6">
        <Link
          to="/"
          className="font-display text-lg font-bold tracking-tighter text-slate-900 whitespace-nowrap shrink-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
        >
          urself.online
        </Link>

        <nav aria-label="Primary" className="hidden md:flex items-center gap-7">
          {NAV_LINKS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'rounded-lg px-1.5 py-1 text-sm font-medium transition-colors whitespace-nowrap shrink-0 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2',
                  isActive
                    ? 'text-emerald-700 underline underline-offset-8 decoration-emerald-500'
                    : 'text-slate-500'
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-3 shrink-0">
          <Link
            to="/login"
            className="inline-flex h-9 items-center justify-center rounded-lg px-4 text-sm font-medium text-slate-600 transition-all hover:bg-slate-100 hover:text-slate-900 active:scale-95 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
          >
            Login
          </Link>
          <Link
            to="/projects/new"
            className="inline-flex h-9 items-center justify-center rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-4 text-sm font-medium text-white shadow-sm transition-all hover:from-emerald-700 hover:to-teal-700 active:scale-95 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
          >
            Start Building
          </Link>
        </div>

        <Tooltip label="Open menu" side="left" className="md:hidden">
          <button
            type="button"
            aria-label="Open navigation menu"
            onClick={() => setMobileOpen(true)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition-all hover:bg-slate-100 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
          >
            <Menu className="h-5 w-5" strokeWidth={1.5} />
          </button>
        </Tooltip>
      </div>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen} title="urself.online">
        <nav aria-label="Mobile navigation" className="flex flex-col gap-1">
          {NAV_LINKS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                cn(
                  'rounded-lg px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2',
                  isActive ? 'bg-emerald-50 text-emerald-700' : 'text-slate-700 hover:bg-slate-50'
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-6 flex flex-col gap-2 border-t border-slate-200 pt-5">
          <Link
            to="/login"
            onClick={() => setMobileOpen(false)}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-800 transition-all hover:bg-slate-50 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
          >
            Login
          </Link>
          <Link
            to="/projects/new"
            onClick={() => setMobileOpen(false)}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-4 text-sm font-medium text-white transition-all hover:from-emerald-700 hover:to-teal-700 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
          >
            Start Building
          </Link>
        </div>
      </Sheet>
    </header>
  );
}
