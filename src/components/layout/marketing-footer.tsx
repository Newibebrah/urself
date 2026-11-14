import { Link } from 'react-router-dom';

export function MarketingFooter() {
  return (
    <footer className="relative overflow-hidden border-t border-slate-200 bg-white">
      {/* Subtle structural blueprint grid texture at opacity-5 */}
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full opacity-5"
      >
        <defs>
          <pattern id="urself-footer-grid" width="32" height="32" patternUnits="userSpaceOnUse">
            <path d="M 32 0 L 0 0 0 32" fill="none" stroke="currentColor" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#urself-footer-grid)" />
      </svg>

      <div className="relative mx-auto flex max-w-6xl flex-col gap-8 px-6 py-12 md:flex-row md:items-center md:justify-between">
        <div>
          <Link
            to="/"
            className="font-display text-base font-bold tracking-tighter text-slate-900 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
          >
            urself.online
          </Link>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
            Build Your Own Website with AI. Clean React + Vite exports.
          </p>
        </div>

        <nav aria-label="Footer navigation" className="flex flex-wrap items-center gap-6 text-sm text-slate-500">
          <Link
            to="/how-it-works"
            className="rounded-lg px-1 py-0.5 transition-colors hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
          >
            How it works
          </Link>
          <Link
            to="/pricing"
            className="rounded-lg px-1 py-0.5 transition-colors hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
          >
            Pricing
          </Link>
          <Link
            to="/faq"
            className="rounded-lg px-1 py-0.5 transition-colors hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
          >
            FAQ
          </Link>
          <Link
            to="/blog"
            className="rounded-lg px-1 py-0.5 transition-colors hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
          >
            Blog
          </Link>
          <Link
            to="/projects"
            className="rounded-lg px-1 py-0.5 transition-colors hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
          >
            Dashboard
          </Link>
        </nav>

        <p className="text-xs text-slate-500">
          © {new Date().getFullYear()} urself.online. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
