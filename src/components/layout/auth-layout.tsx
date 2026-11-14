import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import { Check, Code2, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PAGE_TRANSITION_PROPS } from '../../lib/motion';

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen bg-[#FAFAFA] lg:grid-cols-2">
      {/* Left column: centered form */}
      <div className="flex flex-col items-center justify-center px-6 py-12">
        <motion.div {...PAGE_TRANSITION_PROPS} className="w-full max-w-sm">
          <Link
            to="/"
            className="mb-8 inline-block font-display text-xl font-bold tracking-tighter text-slate-900 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
          >
            urself.online
          </Link>
          <div className="w-full rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            {children}
          </div>
        </motion.div>
      </div>

      {/* Right column: dark architectural IDE preview */}
      <div className="relative hidden flex-col justify-between overflow-hidden border-l border-zinc-800 bg-zinc-950 p-12 text-zinc-100 lg:flex">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl"
        />

        <div className="relative z-10 flex items-center gap-2 text-xs font-medium text-emerald-400">
          <Sparkles className="h-4 w-4" strokeWidth={1.5} />
          <span>Multi-agent React + Vite synthesis</span>
        </div>

        <div className="relative z-10 my-auto">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/90 p-5 shadow-2xl shadow-emerald-500/10">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-red-500/80" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
              </div>
              <div className="flex items-center gap-1.5 font-mono text-[11px] text-zinc-400">
                <Code2 className="h-3.5 w-3.5 text-emerald-400" strokeWidth={1.5} />
                <span>src/App.tsx</span>
              </div>
            </div>

            <pre className="mt-4 overflow-x-auto font-mono text-xs leading-relaxed text-zinc-300">
              <code>
                <span className="block text-zinc-500">{"import { HeroSection } from './components/Hero';"}</span>
                <span className="block text-zinc-500">{"import { PricingGrid } from './components/Pricing';"}</span>
                <span className="block mt-2 text-zinc-200">{'export default function App() {'}</span>
                <span className="block text-zinc-200">{'  return ('}</span>
                <span className="block text-emerald-400">{'    <main className="min-h-screen bg-[#FAFAFA]">'}</span>
                <span className="block text-emerald-400">{'      <HeroSection brand="Atelier Senja" />'}</span>
                <span className="block text-emerald-400">{'      <PricingGrid currency="IDR" />'}</span>
                <span className="block text-emerald-400">{'    </main>'}</span>
                <span className="block text-zinc-200">{'  );'}</span>
                <span className="block text-zinc-200">{'}'}</span>
              </code>
            </pre>

            <div className="mt-5 flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-xs">
              <span className="inline-flex items-center gap-1.5 text-emerald-400">
                <Check className="h-3.5 w-3.5" strokeWidth={1.75} />
                <span>Preview compiled</span>
              </span>
              <span className="font-mono text-zinc-400 tabular-nums">vite build · clean ZIP</span>
            </div>
          </div>
        </div>

        <p className="relative z-10 max-w-md text-xs leading-relaxed text-zinc-400">
          Every prompt produces versioned React + Tailwind source files you can inspect, label, roll back, and export at any time.
        </p>
      </div>
    </div>
  );
}
