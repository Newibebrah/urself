import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { BrowserFrame } from '../../components/shared/browser-frame';
import { STAGGER_CONTAINER_VARIANTS, STAGGER_ITEM_VARIANTS } from '../../lib/motion';

const DEEP_DIVE_SECTIONS = [
  {
    step: '01. Prompt',
    title: 'Describe intent, layout, and domain copy',
    body: 'Start with a concise description of your product, audience, and sections. No wireframing tool or component library configuration required before you begin.',
    url: 'urself.online/prompt',
    preview: (
      <div className="space-y-3 p-5">
        <div className="text-xs font-medium uppercase tracking-widest text-slate-400">Input Prompt</div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm leading-relaxed text-slate-600">
          “Landing page for Kopi Senja, a Jakarta specialty roastery with 3 single-origin beans and store hours.”
        </div>
        <div className="flex items-center justify-between pt-1 text-xs text-slate-500">
          <span>Target: React + Vite</span>
          <span className="font-mono text-emerald-700">Model: DeepSeek-V3</span>
        </div>
      </div>
    ),
  },
  {
    step: '02. Generate',
    title: 'Modular React + Tailwind file synthesis',
    body: 'Instead of dumping monolithic markup, the builder emits structured files under src/components, typed contracts, and consistent spacing tokens.',
    url: 'urself.online/generate',
    preview: (
      <div className="space-y-2 p-5 font-mono text-xs">
        <div className="text-slate-500">Generated repository tree</div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3.5 leading-relaxed text-zinc-200">
          <div>├── src/App.tsx</div>
          <div className="text-emerald-400">├── src/components/RoastGrid.tsx</div>
          <div className="text-emerald-400">├── src/components/StoreHours.tsx</div>
          <div>└── package.json</div>
        </div>
      </div>
    ),
  },
  {
    step: '03. Preview',
    title: 'Sandboxed live rendering on every edit',
    body: 'Inspect typography, responsive breakpoints, and component interactions directly inside an isolated browser frame before shipping.',
    url: 'kopi-senja.urself.online',
    preview: (
      <div className="p-5">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <span className="text-sm font-bold tracking-tighter text-slate-900">Kopi Senja</span>
          <span className="text-xs font-medium text-emerald-700">Live Preview</span>
        </div>
        <div className="mt-4 space-y-2">
          <div className="text-lg font-bold tracking-tighter text-slate-900">Roasted every dawn.</div>
          <p className="text-xs leading-relaxed text-slate-500">
            Small-batch Arabica from Gayo, Flores, and Toraja.
          </p>
          <div className="pt-2">
            <span className="inline-block rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white">
              Order Beans
            </span>
          </div>
        </div>
      </div>
    ),
  },
  {
    step: '04. Export',
    title: 'Clean Vite ZIP you own forever',
    body: 'Download the full repository archive with standard package scripts. Deploy to Vercel, Netlify, Cloudflare Pages, or your own server.',
    url: 'urself.online/export',
    preview: (
      <div className="space-y-3 p-5">
        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs">
          <span className="font-mono text-slate-800">kopi-senja-react-vite.zip</span>
          <span className="font-mono text-slate-500 tabular-nums">142 KB</span>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 font-mono text-xs text-emerald-400">
          $ npm install && npm run build
        </div>
      </div>
    ),
  },
];

export function HowItWorksPage() {
  return (
    <div className="py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12">
          {/* Desktop sticky left overview */}
          <div className="lg:col-span-4">
            <div className="lg:sticky lg:top-24">
              <p className="text-xs font-medium uppercase tracking-widest text-slate-500">
                How it works
              </p>
              <h1 className="mt-2 text-4xl font-bold tracking-tighter text-slate-900 md:text-5xl text-balance">
                Prompt to React repository in four stages
              </h1>
              <p className="mt-4 text-sm leading-relaxed text-slate-500">
                Every step keeps generated websites modular, versioned in revisions, editable by chat, and cleanly exportable.
              </p>

              <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
                <h2 className="text-sm font-bold tracking-tighter text-slate-900">
                  Try the builder workspace
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  Launch a new prompt inside the 3-panel IDE with live esbuild bundling.
                </p>
                <Link
                  to="/projects/new"
                  className="mt-4 inline-flex h-9 w-full items-center justify-center rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-4 text-sm font-medium text-white transition-all hover:from-emerald-700 hover:to-teal-700 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 whitespace-nowrap"
                >
                  Start Building
                </Link>
              </div>
            </div>
          </div>

          {/* Right scrollable deep-dive cards */}
          <motion.div
            variants={STAGGER_CONTAINER_VARIANTS}
            initial="initial"
            whileInView="whileInView"
            viewport={{ once: true, amount: 0.1 }}
            className="space-y-10 lg:col-span-8"
          >
            {DEEP_DIVE_SECTIONS.map((section) => (
              <motion.section
                key={section.step}
                variants={STAGGER_ITEM_VARIANTS}
                className="rounded-xl border border-slate-200 bg-white p-6 transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-500/50"
              >
                <div className="mb-5">
                  <p className="font-mono text-xs font-medium text-emerald-700">{section.step}</p>
                  <h2 className="mt-1.5 text-xl font-bold tracking-tighter text-slate-900">
                    {section.title}
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-slate-500">{section.body}</p>
                </div>
                <BrowserFrame url={section.url}>{section.preview}</BrowserFrame>
              </motion.section>
            ))}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
