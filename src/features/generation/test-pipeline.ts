import type { ComplexityProfile, GenerateChunk, GenerationStream } from './types';

export const TEST_PIPELINE_PROMPT =
  '[Dev Test] Simulate Haiku layout planning + DeepSeek code synthesis for Atelier Senja';

const TEST_COMPLEXITY_PROFILE: ComplexityProfile = {
  overallScore: 7,
  codeScore: 7,
  uiScore: 8,
  tier: 'high',
  strategy: 'hybrid-dual',
  rationale:
    'Simulated dual-agent run: Claude Haiku plans layout & SVG tokens while DeepSeek synthesizes modular React + Tailwind code.',
  recommendations: [
    'Run claude-3-5-haiku-latest first for palette, typography, and BrandAssets SVG tokens.',
    'Dispatch interactive showcase grid and app assembly to deepseek-chat.',
    'Compile streamed TSX modules via esbuild for isolated preview verification.',
  ],
  recommendedModels: {
    uiModel: 'claude-3-5-haiku-latest',
    codeModel: 'deepseek-chat',
  },
};

function wait(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function* streamMockTestPipeline(
  projectId: string,
  prompt: string = TEST_PIPELINE_PROMPT,
  stepDelayMs = 220
): GenerationStream {
  const mockBlueprint = {
    templateId: 'storefront',
    displayName: 'Storefront',
    selectorProvider: 'deterministic-selector',
    allowedFiles: ['src/App.tsx', 'src/components/BrandAssets.tsx', 'src/components/ShowcaseGrid.tsx', 'package.json'],
    allowedPackages: ['react', 'react-dom', 'lucide-react'],
  };
  const mockRagPatterns = [
    { id: 'sticky-blur-navbar', title: 'Sticky Glassmorphic Navbar', category: 'navigation', score: 0.78 },
    { id: 'filterable-catalog-grid', title: 'Category-Filterable Catalog Grid', category: 'catalog', score: 0.86 },
  ];

  yield {
    type: 'status',
    stage: 'analyzing',
    agent: 'agent-manager',
    complexity: TEST_COMPLEXITY_PROFILE,
    blueprint: mockBlueprint,
    ragPatterns: mockRagPatterns,
    message: `Phase 1 (${mockBlueprint.displayName}) + RAG (${mockRagPatterns.length} patterns) · ${TEST_COMPLEXITY_PROFILE.strategy}: ${TEST_COMPLEXITY_PROFILE.rationale}`,
  };

  await wait(stepDelayMs);

  yield {
    type: 'status',
    stage: 'haiku_ui',
    agent: 'claude-haiku',
    complexity: TEST_COMPLEXITY_PROFILE,
    blueprint: mockBlueprint,
    ragPatterns: mockRagPatterns,
    message: 'Claude Haiku (claude-3-5-haiku-latest) planning layout hierarchy & SVG brand tokens...',
  };

  await wait(stepDelayMs);

  const brandAssetsContent = `import React from 'react';

export const DESIGN_TOKENS = {
  brandName: 'Atelier Senja',
  tagline: 'Architectural ceramics and quiet objects for everyday rituals.',
  palette: {
    background: '#FAFAFA',
    surface: '#FFFFFF',
    textPrimary: '#0F172A',
    textMuted: '#475569',
    accent: '#059669',
    border: '#E2E8F0',
  },
} as const;

export function BrandMark() {
  return (
    <span className="inline-flex items-center gap-2">
      <svg viewBox="0 0 32 32" fill="none" className="h-7 w-7" aria-hidden="true">
        <rect x="2" y="2" width="28" height="28" rx="7" stroke="#059669" strokeWidth="2" />
        <circle cx="16" cy="16" r="5" stroke="#059669" strokeWidth="2" />
      </svg>
      <span className="font-semibold tracking-tight text-slate-900">Atelier Senja</span>
    </span>
  );
}
`;

  yield {
    type: 'file',
    agent: 'claude-haiku',
    file: {
      path: 'src/components/BrandAssets.tsx',
      content: brandAssetsContent,
      version: 1,
    },
  };

  await wait(stepDelayMs);

  yield {
    type: 'status',
    stage: 'deepseek_code',
    agent: 'deepseek',
    complexity: TEST_COMPLEXITY_PROFILE,
    message: 'DeepSeek (deepseek-chat) generating ShowcaseGrid & interactive App.tsx...',
  };

  await wait(stepDelayMs);

  const showcaseGridContent = `import React from 'react';

export interface CraftPiece {
  id: string;
  title: string;
  category: 'Vessels' | 'Tableware' | 'Lighting';
  edition: string;
  price: string;
}

export function ShowcaseGrid({ pieces }: { pieces: CraftPiece[] }) {
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
      {pieces.map((piece) => (
        <article
          key={piece.id}
          className="rounded-xl border border-slate-200 bg-white p-6 transition-colors hover:border-emerald-500/40"
        >
          <div className="flex items-center justify-between text-xs font-mono text-slate-400">
            <span>{piece.category}</span>
            <span>{piece.edition}</span>
          </div>
          <h3 className="mt-3 text-base font-semibold tracking-tight text-slate-900">
            {piece.title}
          </h3>
          <p className="mt-2 font-mono text-sm font-medium text-emerald-700">{piece.price}</p>
        </article>
      ))}
    </div>
  );
}
`;

  yield {
    type: 'file',
    agent: 'deepseek',
    file: {
      path: 'src/components/ShowcaseGrid.tsx',
      content: showcaseGridContent,
      version: 1,
    },
  };

  await wait(stepDelayMs);

  const appContent = `import React, { useState } from 'react';
import { BrandMark, DESIGN_TOKENS } from './components/BrandAssets';
import { ShowcaseGrid, type CraftPiece } from './components/ShowcaseGrid';

const COLLECTION: CraftPiece[] = [
  { id: 'p1', title: 'Soka Stoneware Carafe', category: 'Vessels', edition: 'ED. 01', price: 'Rp 480.000' },
  { id: 'p2', title: 'Batu Pour-Over Set', category: 'Tableware', edition: 'ED. 02', price: 'Rp 620.000' },
  { id: 'p3', title: 'Lentera Paper Shade', category: 'Lighting', edition: 'ED. 03', price: 'Rp 890.000' },
];

export default function App() {
  const [category, setCategory] = useState<'All' | 'Vessels' | 'Tableware' | 'Lighting'>('All');
  const visible =
    category === 'All' ? COLLECTION : COLLECTION.filter((item) => item.category === category);

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-slate-900 antialiased">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <BrandMark />
          <span className="font-mono text-xs text-emerald-700">Haiku + DeepSeek Test Build</span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-16">
        <p className="text-xs font-medium uppercase tracking-widest text-emerald-700">
          {DESIGN_TOKENS.brandName}
        </p>
        <h1 className="mt-3 max-w-2xl text-4xl font-bold tracking-tight md:text-5xl">
          Quiet objects shaped for daily rituals.
        </h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-600">
          {DESIGN_TOKENS.tagline}
        </p>

        <div className="mt-10 mb-6 flex flex-wrap items-center gap-2">
          {(['All', 'Vessels', 'Tableware', 'Lighting'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setCategory(tab)}
              className={
                category === tab
                  ? 'rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-medium text-white'
                  : 'rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-600'
              }
            >
              {tab}
            </button>
          ))}
        </div>

        <ShowcaseGrid pieces={visible} />
      </main>
    </div>
  );
}
`;

  yield {
    type: 'file',
    agent: 'deepseek',
    file: {
      path: 'src/App.tsx',
      content: appContent,
      version: 2,
    },
  };

  await wait(stepDelayMs);

  yield {
    type: 'status',
    stage: 'esbuild_preview',
    agent: 'agent-manager',
    complexity: TEST_COMPLEXITY_PROFILE,
    message: 'Compiling simulated Haiku + DeepSeek output with esbuild...',
  };

  await wait(Math.min(stepDelayMs, 120));

  const doneChunk: GenerateChunk = {
    type: 'done',
    agent: 'agent-manager',
    projectId,
    summary: 'Simulated 3-file build for Atelier Senja (Haiku UI + DeepSeek Code)',
    assistantMessage: `Simulated pipeline completed for "${prompt}": Haiku generated BrandAssets.tsx and DeepSeek synthesized ShowcaseGrid.tsx + App.tsx.`,
    diffLines: [
      { type: 'add', text: "+ import { BrandMark } from './components/BrandAssets';" },
      { type: 'add', text: "+ import { ShowcaseGrid } from './components/ShowcaseGrid';" },
      { type: 'add', text: '+ export default function App() { /* Atelier Senja */ }' },
    ],
    previewHtml: null,
    previewError: null,
    complexity: TEST_COMPLEXITY_PROFILE,
    providers: {
      architect: 'claude-haiku-mock',
      architectModel: 'claude-3-5-haiku-latest',
      engineer: 'deepseek-mock',
      engineerModel: 'deepseek-chat',
      strategy: 'hybrid-dual',
    },
  };

  yield doneChunk;
}
