'use client';

import { useState, type FormEvent } from 'react';
import { motion } from 'motion/react';
import { Check, Code2, Copy } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { AIChatBox } from '../../components/shared/ai-chat-box';
import { BrowserFrame } from '../../components/shared/browser-frame';
import { Accordion } from '../../components/ui/accordion';
import { SpotlightCard } from '../../components/ui/spotlight-card';
import { Tooltip } from '../../components/ui/tooltip';
import { PricingGrid } from '../../features/billing/components/pricing-grid';
import { LANDING_FAQ_ITEMS } from '../../features/marketing/mock';
import {
  HERO_CHAT_VARIANTS,
  SECTION_REVEAL_VARIANTS,
  STAGGER_CONTAINER_VARIANTS,
} from '../../lib/motion';
import { validateEmail } from '../../lib/utils';

export function LandingPage() {
  return (
    <div className="bg-[#FAFAFA] text-slate-900 antialiased">
      <svg
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-50 h-full w-full opacity-[0.02]"
      >
        <filter id="urself-noise">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.8"
            numOctaves="3"
            stitchTiles="stitch"
          />
        </filter>
        <rect width="100%" height="100%" filter="url(#urself-noise)" />
      </svg>

      <div className="flex min-h-screen flex-col bg-[#FAFAFA] text-slate-900">
        <MarketingLayout>
          <LandingPageInner />
        </MarketingLayout>
        <MarketingFooter />
      </div>
    </div>
  );
}

function LandingPageInner() {
  const steps = [
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

  const stack = [
    { label: 'React 19', icon: Code2 },
    { label: 'Vite Bundler', icon: Layers },
    { label: 'Tailwind CSS', icon: Sparkles },
    { label: 'DeepSeek V3', icon: Cpu },
    { label: 'Claude Haiku', icon: Sparkles },
    { label: 'esbuild Sandbox', icon: Terminal },
  ];

  return (
    <div className="flex-1">
      <motion.div
        className="animate-urself-marquee"
        aria-hidden="true"
      >
        {stack.map((item, index) => (
          <span key={index} className="mx-8 text-xs font-medium text-slate-500">
            {item.label}
          </span>
        ))}
      </motion.div>

      <div className="mx-auto max-w-6xl px-6 py-16 md:py-24">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          <div className="lg:col-span-3">
            <div className="lg:sticky lg:top-24">
              <p className="text-xs font-medium uppercase tracking-widest text-slate-500">Pricing</p>
              <h1 className="mt-2 text-3xl font-bold tracking-tighter text-slate-900 md:text-4xl text-balance">
                Simple plans built for shipping
              </h1>
              <p className="mt-4 text-sm leading-relaxed text-slate-500">
                Transparent monthly pricing in Indonesian Rupiah with full ZIP source ownership on every tier.
              </p>
            </div>
          </div>

          <div className="lg:col-span-9">
            <PricingGrid />
          </div>
        </div>
      </div>

      <section className="mt-20">
        <h2 className="text-2xl font-bold tracking-tighter text-slate-900">Compare plan limits</h2>
        <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[600px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium uppercase tracking-wider text-slate-500">
                <th className="px-5 py-3.5">Capability</th>
                <th className="px-5 py-3.5">Basic</th>
                <th className="px-5 py-3.5 text-emerald-700">Pro</th>
                <th className="px-5 py-3.5">King</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {LANDING_FAQ_ITEMS.map((row) => (
                <tr key={row.id} className="transition-colors hover:bg-slate-50">
                  <td className="px-5 py-3.5 font-medium text-slate-900">{row.feature}</td>
                  <td className="px-5 py-3.5 text-slate-500 tabular-nums">{row.basic}</td>
                  <td className="px-5 py-3.5 font-semibold text-slate-900 tabular-nums">{row.pro}</td>
                  <td className="px-5 py-3.5 text-slate-500 tabular-nums">{row.king}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}