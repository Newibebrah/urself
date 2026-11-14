import type { ProjectFile } from '../../features/projects/types.ts';
import type { UIDesignBlueprint } from './haiku-architect.ts';
import { formatPatternsForSystemPrompt, type RetrievedPattern } from './pattern-rag.ts';
import type { PromptAnalysis } from './prompt-analyzer.ts';
import { parsePartialGeneratedPayload } from './streaming-json-parser.ts';
import {
  GENERATED_PAYLOAD_SCHEMA,
  type TemplateContract,
  validateAgainstContract,
} from './template-contracts.ts';

export interface DiffLine {
  type: 'add' | 'remove' | 'context';
  text: string;
}

export interface DeepSeekSynthesisResult {
  files: ProjectFile[];
  summary: string;
  assistantMessage: string;
  diffLines: DiffLine[];
  provider: 'deepseek-api' | 'deterministic-synthesizer';
}

export function parseGeneratedFiles(raw: string): Array<{ path: string; content: string }> {
  return parsePartialGeneratedPayload(raw).files;
}

export function buildSchemaEnforcedSystemPrompt(
  contract?: TemplateContract | null,
  ragPatterns: RetrievedPattern[] = []
): string {
  const allowedFilesList = contract
    ? contract.allowedFiles.join(', ')
    : 'src/App.tsx, src/components/Navbar.tsx, src/components/Sections.tsx, src/components/BrandAssets.tsx, src/index.css, package.json';
  const allowedPkgsList = contract
    ? contract.allowedPackages.join(', ')
    : 'react, react-dom, lucide-react';
  const ragBlock = formatPatternsForSystemPrompt(ragPatterns);

  return `You are the Lead Program Technician (DeepSeek) for urself.online.
Generate clean, modular, production-grade React + TypeScript + Tailwind CSS code strictly conforming to the Template Contract and JSON Schema below.

STRICT CONTRACT RULES:
1. Entry component MUST be \`src/App.tsx\` exporting \`default function App()\`.
2. ONLY write files in this whitelist: ${allowedFilesList} (plus modular components under \`src/components/*.tsx\`).
3. ONLY import external packages in this whitelist: ${allowedPkgsList}, or relative \`./components/...\` files that you output.
4. Implement real interactive states (tabs, filters, form validation, toggles) — no dead buttons or placeholder TODOs.
5. Output ONLY a single valid JSON object matching this exact schema (no markdown explanation outside JSON):
{
  "files": [
    { "path": "src/components/Navbar.tsx", "content": "..." },
    { "path": "src/App.tsx", "content": "..." }
  ],
  "summary": "1-sentence summary of what was built"
}
${ragBlock ? `\nRELEVANT UI COMPONENT PATTERNS (adapt cleanly to the user brief):\n${ragBlock}` : ''}`;
}

export function computeFileDiffLines(prevContent: string, nextContent: string): DiffLine[] {
  const prevLines = prevContent.split('\n');
  const nextLines = nextContent.split('\n');
  const prevSet = new Set(prevLines.map((l) => l.trim()));
  const nextSet = new Set(nextLines.map((l) => l.trim()));

  const diffs: DiffLine[] = [];
  for (const line of prevLines) {
    const trimmed = line.trim();
    if (trimmed && !nextSet.has(trimmed)) {
      diffs.push({ type: 'remove', text: line.trimEnd() });
      if (diffs.length >= 4) break;
    }
  }
  for (const line of nextLines) {
    const trimmed = line.trim();
    if (trimmed && !prevSet.has(trimmed)) {
      diffs.push({ type: 'add', text: line.trimEnd() });
      if (diffs.length >= 8) break;
    }
  }

  if (diffs.length === 0 && nextLines.length > 0) {
    return nextLines.slice(0, 3).map((text) => ({ type: 'context' as const, text }));
  }
  return diffs;
}

function escapeJsxText(value: string): string {
  return value.replace(/[{}<>&]/g, (ch) => {
    if (ch === '{') return '&#123;';
    if (ch === '}') return '&#125;';
    if (ch === '<') return '&lt;';
    if (ch === '>') return '&gt;';
    return '&amp;';
  });
}

export function synthesizeFromBlueprint(
  prompt: string,
  analysis: PromptAnalysis,
  blueprint: UIDesignBlueprint,
  existingFiles: ProjectFile[]
): DeepSeekSynthesisResult {
  const isDark = analysis.darkMode || blueprint.palette.background.startsWith('#0') || blueprint.palette.background.startsWith('#1');
  const bgClass = isDark ? 'bg-zinc-950 text-zinc-50' : 'bg-[#FAFAFA] text-slate-900';
  const surfaceClass = isDark ? 'bg-zinc-900 border-zinc-800 text-zinc-100' : 'bg-white border-slate-200 text-slate-900';
  const mutedClass = isDark ? 'text-zinc-400' : 'text-slate-600';
  const borderClass = isDark ? 'border-zinc-800' : 'border-slate-200';

  const heroSection = blueprint.sections[0] ?? {
    id: 'sec-1',
    componentName: 'HeroSection',
    purpose: 'Hero banner',
    layoutPattern: 'Centered editorial',
    copyHeadline: blueprint.brandName,
    copyBody: blueprint.tagline,
  };

  const secondarySections = blueprint.sections.slice(1);
  const existingApp = existingFiles.find((f) => f.path === 'src/App.tsx' || f.path === 'src/App.jsx');
  const nextVersion = (existingApp?.version ?? 0) + 1;

  // Apply surgical prompt-aware adjustments when revising
  const lower = prompt.toLowerCase();
  const darkFooterRequested = analysis.intent === 'revise' && /footer/.test(lower) && /dark|zinc|black/.test(lower);
  const ctaLabel = /order|bean|buy|shop/.test(lower)
    ? 'Order Beans'
    : /book|appointment|clinic/.test(lower)
    ? 'Book Visit'
    : /pricing|plan|start/.test(lower)
    ? 'Start Free'
    : 'Get Started';

  const navbarCode = `import React from 'react';

interface NavbarProps {
  brandName: string;
  accentColor: string;
}

export function Navbar({ brandName, accentColor }: NavbarProps) {
  return (
    <header className="border-b ${borderClass} ${isDark ? 'bg-zinc-950/90' : 'bg-white/90'} backdrop-blur-md sticky top-0 z-20">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
        <span className="text-base font-bold tracking-tight">{brandName}</span>
        <nav className="hidden sm:flex items-center gap-6 text-sm ${mutedClass}">
          ${secondarySections
            .slice(0, 3)
            .map((s) => `<a href="#${s.id}" className="hover:opacity-80 transition-opacity">${escapeJsxText(s.copyHeadline)}</a>`)
            .join('\n          ')}
        </nav>
        <a
          href="#action"
          style={{ backgroundColor: accentColor }}
          className="inline-flex h-9 items-center rounded-lg px-4 text-xs font-medium text-white transition-opacity hover:opacity-90"
        >
          ${ctaLabel}
        </a>
      </div>
    </header>
  );
}
`;

  const sectionsCode = `import React from 'react';

export interface SectionSpec {
  id: string;
  title: string;
  description: string;
  pattern: string;
}

export function ContentSections({ items }: { items: SectionSpec[] }) {
  return (
    <section className="mx-auto max-w-5xl px-6 pb-20">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {items.map((item, idx) => (
          <div
            key={item.id}
            id={item.id}
            className="rounded-xl border p-6 ${surfaceClass}"
          >
            <div className="font-mono text-xs ${mutedClass}">0{idx + 1}</div>
            <h2 className="mt-2 text-lg font-semibold tracking-tight">{item.title}</h2>
            <p className="mt-2 text-sm leading-relaxed ${mutedClass}">{item.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
`;

  const appCode = `import React, { useState } from 'react';
import { Navbar } from './components/Navbar';
import { ContentSections } from './components/Sections';

const SECTIONS = ${JSON.stringify(
    (secondarySections.length > 0
      ? secondarySections
      : [
          {
            id: 'sec-2',
            copyHeadline: 'Designed for Speed',
            copyBody: 'Modular React + Tailwind components generated from your prompt.',
            layoutPattern: 'Grid',
          },
          {
            id: 'sec-3',
            copyHeadline: 'Clean Code Ownership',
            copyBody: 'Standard Vite structure ready for local edits and deployment.',
            layoutPattern: 'Grid',
          },
          {
            id: 'sec-4',
            copyHeadline: 'Instant Iteration',
            copyBody: 'Refine copy, layout, and colors with follow-up chat revisions.',
            layoutPattern: 'Grid',
          },
        ]
    ).map((s) => ({
      id: s.id,
      title: s.copyHeadline,
      description: s.copyBody,
      pattern: s.layoutPattern,
    })),
    null,
    2
  )};

export default function App() {
  const [submitted, setSubmitted] = useState(false);

  return (
    <div className="min-h-screen ${bgClass} font-sans antialiased">
      <Navbar
        brandName=${JSON.stringify(blueprint.brandName)}
        accentColor=${JSON.stringify(blueprint.palette.accent)}
      />

      <main>
        <section className="mx-auto max-w-5xl px-6 py-20 md:py-24">
          <p
            style={{ color: ${JSON.stringify(blueprint.palette.accent)} }}
            className="text-xs font-medium uppercase tracking-widest"
          >
            ${escapeJsxText(blueprint.brandName)}
          </p>
          <h1 className="mt-3 max-w-3xl text-4xl font-bold tracking-tight md:text-6xl">
            ${escapeJsxText(heroSection.copyHeadline)}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed ${mutedClass}">
            ${escapeJsxText(heroSection.copyBody)}
          </p>

          <div id="action" className="mt-8 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setSubmitted(true)}
              style={{ backgroundColor: ${JSON.stringify(blueprint.palette.accent)} }}
              className="inline-flex h-10 items-center rounded-lg px-5 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              ${ctaLabel}
            </button>
            <a
              href="#sec-2"
              className="inline-flex h-10 items-center rounded-lg border px-5 text-sm font-medium ${surfaceClass}"
            >
              Explore details
            </a>
          </div>

          {submitted ? (
            <div className="mt-5 inline-flex items-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs font-medium text-emerald-700">
              Action confirmed for ${escapeJsxText(blueprint.brandName)}.
            </div>
          ) : null}
        </section>

        <ContentSections items={SECTIONS} />
      </main>

      <footer className="${darkFooterRequested ? 'bg-zinc-950 text-zinc-300 border-t border-zinc-800' : `border-t ${borderClass}`}">
        <div className="mx-auto flex max-w-5xl flex-col gap-2 px-6 py-8 text-xs sm:flex-row sm:items-center sm:justify-between">
          <span className="font-semibold">${escapeJsxText(blueprint.brandName)}</span>
          <span className="opacity-70">${escapeJsxText(blueprint.tagline)}</span>
        </div>
      </footer>
    </div>
  );
}
`;

  const pkgJson: ProjectFile = {
    path: 'package.json',
    version: 1,
    content: JSON.stringify(
      {
        name: blueprint.brandName.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'urself-site',
        private: true,
        type: 'module',
        scripts: { dev: 'vite', build: 'vite build' },
        dependencies: { react: '^19.0.0', 'react-dom': '^19.0.0', 'lucide-react': '^0.546.0' },
        devDependencies: { vite: '^6.0.0', '@vitejs/plugin-react': '^4.3.0', tailwindcss: '^4.0.0' },
      },
      null,
      2
    ),
  };

  const files: ProjectFile[] = [
    { path: 'src/App.tsx', content: appCode, version: nextVersion },
    { path: 'src/components/Navbar.tsx', content: navbarCode, version: nextVersion },
    { path: 'src/components/Sections.tsx', content: sectionsCode, version: nextVersion },
    pkgJson,
  ];

  const diffLines =
    analysis.intent === 'revise'
      ? computeFileDiffLines(existingApp?.content ?? '', appCode)
      : computeFileDiffLines('', appCode);

  return {
    files,
    summary: `${analysis.intent === 'revise' ? 'Revised' : 'Created'} ${files.length} files for ${blueprint.brandName}`,
    assistantMessage: `${
      analysis.intent === 'revise' ? 'Applied surgical revision' : 'Synthesized modular React + Tailwind app'
    } for ${blueprint.brandName} using Haiku UI architecture (${blueprint.sections.length} sections) and DeepSeek synthesis pipeline.`,
    diffLines,
    provider: 'deterministic-synthesizer',
  };
}

export async function requestDeepSeekRepair(params: {
  prompt: string;
  files: ProjectFile[];
  errorSummary: string;
  contract?: TemplateContract | null;
  attempt: number;
  modelOverride?: string;
}): Promise<ProjectFile[] | null> {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  const isPlaceholder = !apiKey || apiKey.startsWith('MY_');
  if (isPlaceholder) {
    return null;
  }

  const baseUrl = (process.env.DEEPSEEK_BASE_URL?.trim() || 'https://api.deepseek.com').replace(/\/+$/, '');
  const rawModel = params.modelOverride?.trim() || process.env.DEEPSEEK_MODEL?.trim() || 'deepseek-chat';
  const model =
    baseUrl.toLowerCase().includes('api.deepseek.com') && rawModel === 'deepseek-flash'
      ? 'deepseek-chat'
      : rawModel;

  const fileBlock = params.files
    .map((f) => `--- ${f.path} ---\n${f.content.slice(0, 6000)}`)
    .join('\n\n');

  const systemPrompt = buildSchemaEnforcedSystemPrompt(params.contract, []);
  const userMessage = `SELF-HEALING REPAIR ATTEMPT #${params.attempt}
Original User Request: ${params.prompt}

Your code produced these compiler / AST / schema errors:
${params.errorSummary}

Fix ONLY the broken files while preserving everything else, and return valid JSON {"files": [{"path": "...", "content": "..."}], "summary": "..."} conforming to the template contract.

Current Workspace Files:
${fileBlock}`;

  try {
    const requestPayload: Record<string, unknown> = {
      model,
      max_tokens: 4096,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
    };
    if (!model.includes('reasoner')) {
      requestPayload.temperature = 0.1;
    }

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      signal: AbortSignal.timeout(30000),
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestPayload),
    });
    if (!response.ok) return null;

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = data.choices?.[0]?.message?.content ?? '';
    const parsedFiles = parseGeneratedFiles(raw);
    if (parsedFiles.length === 0) return null;

    const schemaCheck = GENERATED_PAYLOAD_SCHEMA.safeParse({ files: parsedFiles });
    if (!schemaCheck.success) return null;

    const prevMap = new Map(params.files.map((f) => [f.path, f]));
    const mergedMap = new Map(params.files.map((f) => [f.path, f]));
    for (const pf of parsedFiles) {
      const prev = prevMap.get(pf.path);
      mergedMap.set(pf.path, {
        path: pf.path,
        content: pf.content,
        version: (prev?.version ?? 0) + 1,
      });
    }

    const merged = Array.from(mergedMap.values());
    if (params.contract) {
      const contractCheck = validateAgainstContract(merged, params.contract);
      if (!contractCheck.valid) return null;
    }
    return merged;
  } catch {
    return null;
  }
}

export async function runDeepSeekEngineer(
  prompt: string,
  analysis: PromptAnalysis,
  blueprint: UIDesignBlueprint,
  existingFiles: ProjectFile[],
  modelOverride?: string,
  contract?: TemplateContract | null,
  ragPatterns: RetrievedPattern[] = []
): Promise<DeepSeekSynthesisResult> {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  const isPlaceholder = !apiKey || apiKey.startsWith('MY_');

  if (isPlaceholder) {
    return synthesizeFromBlueprint(prompt, analysis, blueprint, existingFiles);
  }

  const baseUrl = (process.env.DEEPSEEK_BASE_URL?.trim() || 'https://api.deepseek.com').replace(/\/+$/, '');
  const rawModel = modelOverride?.trim() || process.env.DEEPSEEK_MODEL?.trim() || 'deepseek-chat';
  const model =
    baseUrl.toLowerCase().includes('api.deepseek.com') && rawModel === 'deepseek-flash'
      ? 'deepseek-chat'
      : rawModel;

  const contextBlock = analysis.relevantFiles
    .map((f) => `<existing_file path="${f.path}">\n${f.content.slice(0, 3500)}\n</existing_file>`)
    .join('\n\n');

  const systemPrompt = buildSchemaEnforcedSystemPrompt(contract, ragPatterns);

  const userPrompt = `User Request: ${prompt}
Intent: ${analysis.intent}
Selected Blueprint Template: ${contract?.displayName ?? 'Landing Page'}
Haiku UI/UX Blueprint:
${JSON.stringify(blueprint, null, 2)}

${contextBlock ? `Existing Project Context:\n${contextBlock}` : ''}`;

  try {
    const requestPayload: Record<string, unknown> = {
      model,
      max_tokens: 4096,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    };
    if (!model.includes('reasoner')) {
      requestPayload.temperature = 0.2;
    }

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      signal: AbortSignal.timeout(35000),
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestPayload),
    });

    if (!response.ok) {
      throw new Error(`DeepSeek HTTP ${response.status}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = data.choices?.[0]?.message?.content ?? '';
    const snap = parsePartialGeneratedPayload(raw);
    const parsedFiles = snap.files;

    if (parsedFiles.length === 0) {
      throw new Error('DeepSeek returned no parseable files');
    }

    const prevMap = new Map(existingFiles.map((f) => [f.path, f]));
    const mergedMap = new Map(existingFiles.map((f) => [f.path, f]));

    for (const pf of parsedFiles) {
      const prev = prevMap.get(pf.path);
      mergedMap.set(pf.path, {
        path: pf.path,
        content: pf.content,
        version: (prev?.version ?? 0) + 1,
      });
    }

    const finalFiles = Array.from(mergedMap.values());
    const prevApp = prevMap.get('src/App.tsx')?.content ?? '';
    const nextApp = mergedMap.get('src/App.tsx')?.content ?? parsedFiles[0].content;
    const summaryText = snap.summary || `Updated ${parsedFiles.length} file(s) via DeepSeek`;

    return {
      files: finalFiles,
      summary: summaryText,
      assistantMessage: `${summaryText} (UI engineered by Haiku · Code synthesized by DeepSeek)`,
      diffLines: computeFileDiffLines(prevApp, nextApp),
      provider: 'deepseek-api',
    };
  } catch {
    return synthesizeFromBlueprint(prompt, analysis, blueprint, existingFiles);
  }
}
