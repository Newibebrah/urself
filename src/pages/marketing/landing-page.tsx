import { useState, type FormEvent } from 'react';
import { motion } from 'motion/react';
import { Check, Code2, Copy, Cpu, FolderArchive, Layers, Sparkles, Terminal } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { AIChatBox } from '../../components/shared/ai-chat-box';
import { BrowserFrame } from '../../components/shared/browser-frame';
import { Accordion } from '../../components/ui/accordion';
import { SpotlightCard } from '../../components/ui/spotlight-card';
import { Tooltip } from '../../components/ui/tooltip';
import { PricingGrid } from '../../features/billing/components/pricing-grid';
import { LANDING_FAQ_ITEMS } from '../../features/marketing/mock';
import { useWorkspaceStore } from '../../features/projects/workspace-store';
import {
  HERO_CHAT_VARIANTS,
  SECTION_REVEAL_VARIANTS,
  STAGGER_CONTAINER_VARIANTS,
} from '../../lib/motion';
import { validateEmail } from '../../lib/utils';

const HOW_IT_WORKS_STEPS = [
  {
    step: '01',
    title: 'Prompt',
    description: 'Describe your layout, audience, and brand tone in plain English or Indonesian.',
  },
  {
    step: '02',
    title: 'Preview',
    description: 'Inspect the live React + Tailwind build inside an isolated browser frame and refine by chat.',
  },
  {
    step: '03',
    title: 'Export',
    description: 'Download a clean Vite repository ZIP you own completely, ready to deploy anywhere.',
  },
];

const STACK_ITEMS = [
  { label: 'React 19', icon: Code2 },
  { label: 'Vite Bundler', icon: Layers },
  { label: 'Tailwind CSS', icon: Sparkles },
  { label: 'DeepSeek V3', icon: Cpu },
  { label: 'Claude Haiku', icon: Sparkles },
  { label: 'esbuild Sandbox', icon: Terminal },
];

export function LandingPage() {
  const navigate = useNavigate();
  const { createWorkspace } = useWorkspaceStore();
  const [ctaEmail, setCtaEmail] = useState('');
  const [ctaError, setCtaError] = useState<string | null>(null);
  const [ctaSubmitted, setCtaSubmitted] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState(false);

  const handleHeroPrompt = async (prompt: string) => {
    try {
      const created = await createWorkspace({ initialPrompt: prompt });
      toast.success(`Initialized workspace "${created.name}".`);
      navigate(`/projects/${created.id}`);
    } catch {
      toast.info('Opening builder workspace.');
      navigate(`/projects/mock-1?prompt=${encodeURIComponent(prompt)}`);
    }
  };

  const handleCopyCommand = () => {
    navigator.clipboard?.writeText('npm install && npm run dev').catch(() => {});
    setCopiedCmd(true);
    toast.success('Copied CLI command to clipboard.');
    setTimeout(() => setCopiedCmd(false), 1800);
  };

  const handleCtaSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const res = validateEmail(ctaEmail);
    if (!res.ok) {
      setCtaError(res.error);
      return;
    }
    setCtaError(null);
    setCtaSubmitted(true);
    toast.success('Early access request recorded — check your inbox soon.');
  };

  return (
    <div>
      {/* Section 1: Hero */}
      <section className="relative overflow-hidden py-16 md:py-24">
        <div className="mx-auto max-w-6xl px-6 text-center">
          <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-medium uppercase tracking-widest text-slate-500 shadow-sm">
            <span>Beta Release · React + Vite</span>
          </div>

          <h1 className="mx-auto mt-6 max-w-4xl text-4xl font-bold tracking-tighter leading-[1.05] text-slate-900 sm:text-5xl md:text-7xl text-balance">
            Build Your Own <span className="text-emerald-600">Website</span> with AI
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-slate-500 md:text-lg">
            Turn a prompt into a production-ready React app. Preview live, edit by chat, export the code.
          </p>

          <div className="relative mt-10">
            <motion.div
              variants={HERO_CHAT_VARIANTS}
              initial="initial"
              animate="animate"
            >
              <AIChatBox
                variant="hero"
                onSubmit={handleHeroPrompt}
              />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Section 2: Infinite Scrolling Trust Strip */}
      <section aria-label="Technology stack" className="border-y border-slate-200 bg-white/80 py-5">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-6">
          <span className="shrink-0 text-xs font-medium uppercase tracking-widest text-slate-500">
            Built with
          </span>
          <div className="relative flex-1 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
            <div className="animate-urself-marquee items-center gap-10">
              {[...STACK_ITEMS, ...STACK_ITEMS].map((item, idx) => {
                const Icon = item.icon;
                return (
                  <span
                    key={`${item.label}-${idx}`}
                    aria-hidden={idx >= STACK_ITEMS.length}
                    className="inline-flex shrink-0 items-center gap-2 text-xs font-medium uppercase tracking-widest text-slate-600 whitespace-nowrap"
                  >
                    <Icon className="h-3.5 w-3.5 text-emerald-600" strokeWidth={1.5} />
                    <span>{item.label}</span>
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Section 3: Features Bento with Radial Hover Spotlight & Stagger */}
      <motion.section
        variants={SECTION_REVEAL_VARIANTS}
        initial="initial"
        whileInView="whileInView"
        viewport={{ once: true, margin: '-80px' }}
        className="py-20 md:py-24"
      >
        <div className="mx-auto max-w-6xl px-6">
          <div className="max-w-2xl">
            <p className="text-xs font-medium uppercase tracking-widest text-slate-500">
              Built for iteration
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-tighter text-slate-900 md:text-4xl">
              From single prompt to clean repository
            </h2>
          </div>

          <motion.div
            variants={STAGGER_CONTAINER_VARIANTS}
            initial="initial"
            whileInView="whileInView"
            viewport={{ once: true, amount: 0.15 }}
            className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-12"
          >
            {/* Card A */}
            <SpotlightCard className="md:col-span-7 md:row-span-2">
              <div>
                <h3 className="text-lg font-bold tracking-tighter text-slate-900">Chat to edit</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
                  Refine sections, typography, and spacing with scoped component diffs instead of regenerating from scratch.
                </p>
              </div>

              <div className="mt-6 space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="ml-auto max-w-sm rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs leading-relaxed text-slate-700">
                  Add a highlighted Pro card to the pricing section and tighten the headline tracking.
                </div>
                <div className="rounded-xl border border-emerald-500/40 bg-white p-3.5">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                    <Sparkles className="h-3.5 w-3.5" strokeWidth={1.5} />
                    <span>Updated src/components/Pricing.tsx</span>
                  </div>
                  <pre className="mt-2.5 overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-950 p-3 font-mono text-xs leading-relaxed text-zinc-200">
                    <code>
                      <span className="block text-zinc-500">{'  <div className="grid md:grid-cols-3 gap-6">'}</span>
                      <span className="block text-red-400">{'-   <PlanCard plan="pro" />'}</span>
                      <span className="block text-emerald-400">{'+   <PlanCard plan="pro" highlight />'}</span>
                      <span className="block text-zinc-500">{'  </div>'}</span>
                    </code>
                  </pre>
                </div>
              </div>
            </SpotlightCard>

            {/* Card B */}
            <SpotlightCard className="md:col-span-5">
              <div>
                <h3 className="text-lg font-bold tracking-tighter text-slate-900">Instant preview</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
                  Every revision renders immediately inside a sandboxed browser viewport.
                </p>
              </div>

              <BrowserFrame url="kopi-senja.urself.online" className="mt-5">
                <div className="space-y-3 p-4">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                    <div className="h-2.5 w-20 rounded bg-slate-200" />
                    <div className="flex gap-2">
                      <div className="h-2 w-8 rounded bg-slate-100" />
                      <div className="h-2 w-8 rounded bg-slate-100" />
                    </div>
                  </div>
                  <div className="h-4 w-3/4 rounded bg-slate-900/85" />
                  <div className="h-2.5 w-2/3 rounded bg-slate-200" />
                  <div className="flex gap-2 pt-1">
                    <div className="h-6 w-20 rounded-lg bg-emerald-600" />
                    <div className="h-6 w-20 rounded-lg border border-slate-200 bg-white" />
                  </div>
                </div>
              </BrowserFrame>
            </SpotlightCard>

            {/* Card C */}
            <SpotlightCard className="md:col-span-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold tracking-tighter text-slate-900">Export ZIP</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
                    Standard Vite project structure. No proprietary lock-in.
                  </p>
                </div>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-emerald-700">
                  <FolderArchive className="h-4 w-4" strokeWidth={1.5} />
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between gap-2 rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-zinc-100">
                <div className="flex min-w-0 items-center gap-2">
                  <Terminal className="h-3.5 w-3.5 shrink-0 text-emerald-400" strokeWidth={1.5} />
                  <code className="truncate font-mono text-xs sm:text-sm">
                    npm install && npm run dev
                  </code>
                </div>
                <Tooltip label={copiedCmd ? 'Copied!' : 'Copy command'}>
                  <button
                    type="button"
                    onClick={handleCopyCommand}
                    aria-label="Copy install command"
                    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-zinc-400 transition-all hover:bg-zinc-800 hover:text-white active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
                  >
                    {copiedCmd ? (
                      <Check className="h-3.5 w-3.5 text-emerald-400" strokeWidth={1.5} />
                    ) : (
                      <Copy className="h-3.5 w-3.5" strokeWidth={1.5} />
                    )}
                  </button>
                </Tooltip>
              </div>
            </SpotlightCard>
          </motion.div>
        </div>
      </motion.section>

      {/* Section 4: How it works */}
      <motion.section
        variants={SECTION_REVEAL_VARIANTS}
        initial="initial"
        whileInView="whileInView"
        viewport={{ once: true, margin: '-80px' }}
        className="border-t border-slate-200 bg-white py-20 md:py-24"
      >
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center">
            <p className="text-xs font-medium uppercase tracking-widest text-slate-500">
              Workflow
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-tighter text-slate-900 md:text-4xl">
              Three steps to launch
            </h2>
          </div>

          <div className="relative mt-12 grid grid-cols-1 gap-8 md:grid-cols-3">
            {/* Dashed SVG Connector */}
            <svg
              aria-hidden="true"
              className="pointer-events-none absolute left-0 top-6 hidden h-4 w-full md:block"
              preserveAspectRatio="none"
            >
              <line
                x1="16%"
                y1="50%"
                x2="84%"
                y2="50%"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeDasharray="6 6"
                className="text-emerald-500/35"
              />
            </svg>

            {HOW_IT_WORKS_STEPS.map((item) => (
              <div key={item.step} className="relative flex flex-col items-center text-center">
                <div className="z-10 flex h-12 w-12 items-center justify-center rounded-xl border border-emerald-500/50 bg-white font-mono text-sm font-semibold text-emerald-700 tabular-nums shadow-sm">
                  {item.step}
                </div>
                <h3 className="mt-4 text-lg font-bold tracking-tighter text-slate-900">{item.title}</h3>
                <p className="mt-2 max-w-xs text-sm leading-relaxed text-slate-500">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* Section 5: Pricing */}
      <motion.section
        variants={SECTION_REVEAL_VARIANTS}
        initial="initial"
        whileInView="whileInView"
        viewport={{ once: true, margin: '-80px' }}
        className="border-t border-slate-200 py-20 md:py-24"
      >
        <div className="mx-auto max-w-6xl px-6">
          <div className="max-w-2xl">
            <p className="text-xs font-medium uppercase tracking-widest text-slate-500">
              Pricing
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-tighter text-slate-900 md:text-4xl">
              Predictable monthly plans in IDR
            </h2>
            <p className="mt-2 text-base leading-relaxed text-slate-500">
              Start building immediately and upgrade only when you need more active workspaces.
            </p>
          </div>
          <div className="mt-10">
            <PricingGrid />
          </div>
        </div>
      </motion.section>

      {/* Section 6: FAQ */}
      <motion.section
        variants={SECTION_REVEAL_VARIANTS}
        initial="initial"
        whileInView="whileInView"
        viewport={{ once: true, margin: '-80px' }}
        className="border-t border-slate-200 bg-white py-20 md:py-24"
      >
        <div className="mx-auto max-w-2xl px-6">
          <div className="text-center">
            <p className="text-xs font-medium uppercase tracking-widest text-slate-500">
              FAQ
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-tighter text-slate-900 md:text-4xl">
              Common questions
            </h2>
          </div>
          <Accordion items={LANDING_FAQ_ITEMS} className="mt-10" />
        </div>
      </motion.section>

      {/* Section 7: Final CTA */}
      <section className="py-16 md:py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="rounded-xl border border-zinc-800 bg-zinc-950 px-6 py-14 text-center text-zinc-50 shadow-2xl shadow-emerald-500/10 md:p-16">
            <h2 className="text-3xl font-bold tracking-tighter md:text-4xl">Ready to build?</h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-zinc-400">
              Enter your email to reserve a free beta workspace and start prompting React apps in seconds.
            </p>

            {ctaSubmitted ? (
              <div className="mx-auto mt-7 max-w-md rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
                Invite queued for <span className="font-medium text-white">{ctaEmail}</span>.
              </div>
            ) : (
              <form
                onSubmit={handleCtaSubmit}
                noValidate
                className="mx-auto mt-8 flex max-w-md flex-col gap-2.5 sm:flex-row"
              >
                <div className="flex-1 text-left">
                  <label htmlFor="final-cta-email" className="sr-only">
                    Email address
                  </label>
                  <input
                    id="final-cta-email"
                    type="email"
                    value={ctaEmail}
                    onChange={(e) => {
                      setCtaEmail(e.target.value);
                      if (ctaError) setCtaError(null);
                    }}
                    placeholder="you@company.com"
                    className="h-9 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3.5 text-sm text-white placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-zinc-950"
                  />
                  {ctaError ? (
                    <p role="alert" className="mt-1.5 text-xs text-red-400">
                      {ctaError}
                    </p>
                  ) : null}
                </div>
                <button
                  type="submit"
                  className="inline-flex h-9 items-center justify-center rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-5 text-sm font-medium text-white transition-all hover:from-emerald-500 hover:to-teal-500 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 whitespace-nowrap shrink-0"
                >
                  Start free
                </button>
              </form>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
