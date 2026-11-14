/**
 * Temporary E2E validation script for single-page website generation
 * via the DeepSeek orchestration pipeline.
 *
 * Usage:
 *   npx tsx scripts/validate-deepseek-e2e.ts          # Self-contained SSE mock E2E validation
 *   npx tsx scripts/validate-deepseek-e2e.ts --live   # Live HTTP E2E validation against localhost:3000
 */

import assert from 'node:assert/strict';
import type { GenerateChunk, GenerateRequest } from '../src/features/generation/types.ts';
import type { ProjectFile, ProjectWithFiles } from '../src/features/projects/types.ts';
import { AgentManager } from '../src/server/orchestration/agent-manager.ts';
import {
  evaluatePromptComplexity,
  resolveComplexityProfile,
} from '../src/server/orchestration/complexity-router.ts';
import { createZipArchive } from '../src/server/pipeline/zip-exporter.ts';

export const SINGLE_PAGE_DEEPSEEK_SCENARIO: {
  request: GenerateRequest;
  workspace: ProjectWithFiles;
  mockedDeepSeekXmlResponse: string;
} = {
  request: {
    prompt:
      'Build a single-page minimalist specialty coffee website for Kopi Nusantara with interactive roast filter tabs, tasting notes grid, and newsletter form',
    complexityProfile: {
      overallScore: 6,
      codeScore: 7,
      uiScore: 5,
      tier: 'medium',
      strategy: 'deepseek-only',
      rationale: 'Single-page interactive React build routed directly to DeepSeek Engineer.',
      recommendations: [
        'Use deepseek-chat for single-page React + Tailwind state and component synthesis.',
        'Compile generated files with esbuild before emitting live preview HTML.',
      ],
      recommendedModels: {
        codeModel: 'deepseek-chat',
      },
    },
  },
  workspace: {
    id: 'prj_e2e_single_page',
    name: 'Kopi Nusantara',
    framework: 'react-vite',
    status: 'draft',
    updatedAt: new Date().toISOString(),
    files: [
      {
        path: 'package.json',
        version: 1,
        content: JSON.stringify(
          {
            name: 'kopi-nusantara',
            private: true,
            type: 'module',
            scripts: { dev: 'vite', build: 'vite build' },
            dependencies: { react: '^19.0.0', 'react-dom': '^19.0.0', 'lucide-react': '^0.546.0' },
          },
          null,
          2
        ),
      },
    ],
  },
  mockedDeepSeekXmlResponse: `<file path="src/components/RoastCards.tsx">
import React from 'react';

export interface RoastItem {
  id: string;
  name: string;
  origin: string;
  process: 'Washed' | 'Natural' | 'Honey';
  notes: string;
}

export function RoastCards({ items }: { items: RoastItem[] }) {
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
      {items.map((item) => (
        <article
          key={item.id}
          className="rounded-xl border border-slate-200 bg-white p-6 transition-colors hover:border-emerald-500/40"
        >
          <span className="font-mono text-xs uppercase tracking-wider text-emerald-700">
            {item.process}
          </span>
          <h3 className="mt-2 text-lg font-semibold text-slate-900">{item.name}</h3>
          <p className="mt-1 text-xs text-slate-500">{item.origin}</p>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">{item.notes}</p>
        </article>
      ))}
    </div>
  );
}
</file>
<file path="src/App.tsx">
import React, { useState, type FormEvent } from 'react';
import { RoastCards, type RoastItem } from './components/RoastCards';

const ROASTS: RoastItem[] = [
  { id: '1', name: 'Aceh Gayo Highland', origin: 'Takengon, 1500m', process: 'Washed', notes: 'Dark cacao, cedar, clean citrus finish.' },
  { id: '2', name: 'Flores Bajawa', origin: 'Ngada, 1400m', process: 'Honey', notes: 'Roasted hazelnut, palm sugar, velvety body.' },
  { id: '3', name: 'Toraja Sapan', origin: 'North Toraja, 1650m', process: 'Natural', notes: 'Blackberry jam, clove spice, cocoa nib.' },
];

export default function App() {
  const [filter, setFilter] = useState<'All' | 'Washed' | 'Natural' | 'Honey'>('All');
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const visible = filter === 'All' ? ROASTS : ROASTS.filter((r) => r.process === filter);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (email.includes('@')) setSubscribed(true);
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-slate-900 antialiased">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <span className="text-base font-bold tracking-tight">Kopi Nusantara</span>
          <a
            href="#roasts"
            className="inline-flex h-8 items-center rounded-lg bg-emerald-600 px-3.5 text-xs font-medium text-white"
          >
            Explore Roasts
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-16">
        <section className="max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-widest text-emerald-700">
            Single-Origin Indonesian Roastery
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight md:text-5xl">
            Small-batch archipelago coffee, roasted daily.
          </h1>
          <p className="mt-4 text-base leading-relaxed text-slate-600">
            Direct-trade harvests from Aceh, Flores, and Toraja crafted for filter and espresso.
          </p>
        </section>

        <section id="roasts" className="mt-14">
          <div className="mb-6 flex flex-wrap items-center gap-2">
            {(['All', 'Washed', 'Natural', 'Honey'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setFilter(tab)}
                className={
                  filter === tab
                    ? 'rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white'
                    : 'rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600'
                }
              >
                {tab}
              </button>
            ))}
          </div>
          <RoastCards items={visible} />
        </section>

        <section className="mt-16 rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold">Roast Drop Dispatch</h2>
          {subscribed ? (
            <p className="mt-2 text-sm text-emerald-700">Subscribed {email} for weekly roast releases.</p>
          ) : (
            <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-2 sm:flex-row">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@domain.com"
                className="h-9 flex-1 rounded-lg border border-slate-200 px-3 text-sm"
              />
              <button
                type="submit"
                className="h-9 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white"
              >
                Notify Me
              </button>
            </form>
          )}
        </section>
      </main>
    </div>
  );
}
</file>
<summary>Generated single-page Kopi Nusantara coffee landing page with interactive roast filters and newsletter form.</summary>`,
};

function buildMockDeepSeekSseResponse(xmlContent: string): Response {
  const encoder = new TextEncoder();
  const chunkSize = 180;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (let i = 0; i < xmlContent.length; i += chunkSize) {
        const piece = xmlContent.slice(i, i + chunkSize);
        const line = `data: ${JSON.stringify({
          choices: [{ delta: { content: piece } }],
        })}\n\n`;
        controller.enqueue(encoder.encode(line));
      }
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  });
}

async function runOfflinePipelineE2E(): Promise<void> {
  console.log('[1/4] Evaluating ComplexityProfile for single-page website prompt...');
  const autoEvaluated = evaluatePromptComplexity(
    { prompt: SINGLE_PAGE_DEEPSEEK_SCENARIO.request.prompt },
    []
  );
  assert.ok(autoEvaluated.complexity.overallScore >= 1 && autoEvaluated.complexity.overallScore <= 10);
  assert.ok(autoEvaluated.complexity.recommendations.length >= 2);
  assert.ok(autoEvaluated.complexity.recommendedModels.codeModel);

  const resolved = resolveComplexityProfile(
    SINGLE_PAGE_DEEPSEEK_SCENARIO.request,
    SINGLE_PAGE_DEEPSEEK_SCENARIO.workspace.files
  );
  assert.equal(resolved.complexity.strategy, 'deepseek-only');
  assert.equal(resolved.complexity.recommendedModels.codeModel, 'deepseek-chat');

  console.log('[2/4] Streaming single-page site through AgentManager (DeepSeek SSE pipeline)...');
  const prevFetch = globalThis.fetch;
  const prevDeepseekKey = process.env.DEEPSEEK_API_KEY;
  const prevAnthropicKey = process.env.ANTHROPIC_API_KEY;
  let deepseekEndpointCalled = false;
  let capturedModel = '';

  process.env.DEEPSEEK_API_KEY = 'sk-mock-e2e-validation-key';
  delete process.env.ANTHROPIC_API_KEY;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    if (url.includes('/chat/completions')) {
      deepseekEndpointCalled = true;
      const bodyJson = typeof init?.body === 'string' ? (JSON.parse(init.body) as { model?: string }) : {};
      capturedModel = bodyJson.model ?? '';
      return buildMockDeepSeekSseResponse(SINGLE_PAGE_DEEPSEEK_SCENARIO.mockedDeepSeekXmlResponse);
    }
    return prevFetch(input, init);
  }) as typeof fetch;

  const chunks: GenerateChunk[] = [];
  const emittedFiles = new Map<string, ProjectFile>(
    SINGLE_PAGE_DEEPSEEK_SCENARIO.workspace.files.map((f) => [f.path, f])
  );

  try {
    const manager = new AgentManager();
    for await (const chunk of manager.orchestrate(
      SINGLE_PAGE_DEEPSEEK_SCENARIO.request,
      SINGLE_PAGE_DEEPSEEK_SCENARIO.workspace
    )) {
      chunks.push(chunk);
      if (chunk.type === 'file' && chunk.file) {
        emittedFiles.set(chunk.file.path, chunk.file);
      }
    }
  } finally {
    globalThis.fetch = prevFetch;
    if (prevDeepseekKey === undefined) delete process.env.DEEPSEEK_API_KEY;
    else process.env.DEEPSEEK_API_KEY = prevDeepseekKey;
    if (prevAnthropicKey !== undefined) process.env.ANTHROPIC_API_KEY = prevAnthropicKey;
  }

  assert.equal(deepseekEndpointCalled, true, 'Expected DeepSeek chat/completions endpoint to be invoked');
  assert.equal(capturedModel, 'deepseek-chat', 'Expected AgentManager to pass complexity-selected model');

  console.log('[3/4] Validating esbuild compilation & streamed file artifacts...');
  const done = chunks.find((c) => c.type === 'done');
  assert.ok(done, 'Expected final done chunk');
  assert.equal(done.previewError, null, `Unexpected esbuild error: ${done.previewError}`);
  assert.ok(done.previewHtml && done.previewHtml.includes('<!doctype html>'));
  assert.ok(done.previewHtml.includes('Kopi Nusantara'));
  assert.equal(done.providers?.engineer, 'deepseek-api');
  assert.equal(done.providers?.engineerModel, 'deepseek-chat');
  assert.equal(done.providers?.strategy, 'deepseek-only');

  assert.ok(emittedFiles.has('src/App.tsx'));
  assert.ok(emittedFiles.has('src/components/RoastCards.tsx'));
  assert.ok(emittedFiles.has('package.json'));

  console.log('[4/4] Validating PKZIP export archive...');
  const zipBytes = createZipArchive(Array.from(emittedFiles.values()));
  assert.equal(zipBytes[0], 0x50);
  assert.equal(zipBytes[1], 0x4b);
  assert.equal(zipBytes[2], 0x03);
  assert.equal(zipBytes[3], 0x04);

  console.log(
    `PASS (Offline E2E): ${emittedFiles.size} files generated via ${done.providers?.engineerModel}, esbuild preview (${done.previewHtml.length} bytes), ZIP (${zipBytes.length} bytes).`
  );
}

async function runLiveHttpE2E(baseUrl = 'http://localhost:3000'): Promise<void> {
  console.log(`[1/4] Checking server health at ${baseUrl}/api/health...`);
  const healthRes = await fetch(`${baseUrl}/api/health`);
  assert.equal(healthRes.status, 200);
  const health = (await healthRes.json()) as {
    ok: boolean;
    providers: { haikuConfigured: boolean; deepseekConfigured: boolean };
  };
  assert.equal(health.ok, true);
  console.log('Health:', health);

  console.log('[2/4] Creating new workspace via POST /api/projects...');
  const createRes = await fetch(`${baseUrl}/api/projects`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Kopi Nusantara E2E' }),
  });
  assert.equal(createRes.status, 201);
  const created = (await createRes.json()) as { id: string };

  console.log('[3/4] Streaming single-page generation via POST /api/generate...');
  const genRes = await fetch(`${baseUrl}/api/generate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      ...SINGLE_PAGE_DEEPSEEK_SCENARIO.request,
      projectId: created.id,
    }),
  });
  assert.equal(genRes.status, 200);
  const ndjson = await genRes.text();
  const chunks = ndjson
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as GenerateChunk);

  const done = chunks.find((c) => c.type === 'done');
  assert.ok(done, 'Expected done chunk from /api/generate');
  assert.equal(done.previewError, null, `Preview build failed: ${done.previewError}`);
  assert.ok(done.previewHtml && done.previewHtml.includes('<!doctype html>'));

  console.log('[4/4] Verifying persisted workspace & ZIP download...');
  const detailRes = await fetch(`${baseUrl}/api/projects/${created.id}`);
  assert.equal(detailRes.status, 200);
  const zipRes = await fetch(`${baseUrl}/api/projects/${created.id}/export`);
  assert.equal(zipRes.status, 200);
  const zipBuf = new Uint8Array(await zipRes.arrayBuffer());
  assert.equal(zipBuf[0], 0x50);
  assert.equal(zipBuf[1], 0x4b);

  console.log(
    `PASS (Live HTTP E2E): project=${created.id}, engineer=${done.providers?.engineer}, model=${done.providers?.engineerModel}, zip=${zipBuf.length} bytes.`
  );
}

async function main(): Promise<void> {
  const isLive = process.argv.includes('--live');
  if (isLive) {
    await runLiveHttpE2E();
  } else {
    await runOfflinePipelineE2E();
  }
}

main().catch((err) => {
  console.error('E2E validation failed:', err);
  process.exit(1);
});
