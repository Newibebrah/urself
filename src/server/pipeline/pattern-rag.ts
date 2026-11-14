import type { TemplateId } from './template-contracts.ts';

export interface UIPatternRecord {
  id: string;
  title: string;
  category: 'navigation' | 'hero' | 'grid' | 'pricing' | 'dashboard' | 'auth' | 'catalog' | 'faq';
  templateHints: TemplateId[];
  tags: string[];
  description: string;
  snippet: string;
}

export interface RetrievedPattern extends UIPatternRecord {
  score: number;
}

export const UI_PATTERN_CORPUS: UIPatternRecord[] = [
  {
    id: 'sticky-blur-navbar',
    title: 'Sticky Glassmorphic Navbar',
    category: 'navigation',
    templateHints: ['landing-page', 'saas-pricing', 'storefront', 'portfolio'],
    tags: ['navbar', 'header', 'sticky', 'blur', 'backdrop', 'navigation', 'menu'],
    description: 'Scroll-aware sticky header with 1px hairline border, backdrop-blur, and crisp emerald CTA button.',
    snippet: `<header className="sticky top-0 z-30 border-b border-slate-200 bg-[#FAFAFA]/80 backdrop-blur-lg">
  <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
    <span className="font-bold tracking-tighter text-slate-900">{brandName}</span>
    <nav className="hidden items-center gap-6 text-sm text-slate-500 md:flex">
      {links.map((l) => <a key={l.href} href={l.href} className="hover:text-slate-900">{l.label}</a>)}
    </nav>
    <a href="#action" className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-medium text-white shadow-sm hover:bg-emerald-700">{cta}</a>
  </div>
</header>`,
  },
  {
    id: 'editorial-hero-cta',
    title: 'Editorial Hero with Dual CTA',
    category: 'hero',
    templateHints: ['landing-page', 'storefront', 'portfolio', 'saas-pricing'],
    tags: ['hero', 'headline', 'landing', 'cta', 'banner', 'above-fold'],
    description: 'Asymmetric tight-tracked hero section with subtle emerald glow accent and primary + secondary button pair.',
    snippet: `<section className="mx-auto max-w-5xl px-6 py-20 md:py-28">
  <h1 className="max-w-3xl text-4xl font-bold tracking-tighter text-slate-900 md:text-6xl">{headline}</h1>
  <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-500">{subheadline}</p>
  <div className="mt-8 flex flex-wrap items-center gap-3">
    <button className="rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm active:scale-95">{primaryCta}</button>
    <a href="#details" className="rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">{secondaryCta}</a>
  </div>
</section>`,
  },
  {
    id: 'bento-feature-grid',
    title: 'Responsive Bento Feature Grid',
    category: 'grid',
    templateHints: ['landing-page', 'portfolio'],
    tags: ['bento', 'grid', 'features', 'cards', 'responsive', 'showcase'],
    description: '12-column responsive bento grid with 1px borders, rounded-xl cards, and subtle hover lift.',
    snippet: `<section className="mx-auto grid max-w-5xl grid-cols-1 gap-4 px-6 py-16 md:grid-cols-12">
  {items.map((item, idx) => (
    <div key={item.id} className={\`rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:border-emerald-500/50 \${idx === 0 ? 'md:col-span-7' : 'md:col-span-5'}\`}>
      <span className="font-mono text-xs text-emerald-700">0{idx + 1}</span>
      <h3 className="mt-2 text-lg font-bold tracking-tighter text-slate-900">{item.title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-500">{item.description}</p>
    </div>
  ))}
</section>`,
  },
  {
    id: 'saas-pricing-tiers',
    title: '3-Tier Pricing Grid with Pro Highlight',
    category: 'pricing',
    templateHints: ['saas-pricing', 'landing-page'],
    tags: ['pricing', 'tier', 'plan', 'pro', 'subscription', 'billing', 'toggle'],
    description: 'Three-column SaaS pricing table with highlighted Pro tier (ring-emerald-500 glow) and monthly/annual toggle.',
    snippet: `<div className="grid grid-cols-1 gap-6 md:grid-cols-3">
  {plans.map((plan) => (
    <div key={plan.id} className={\`rounded-xl border bg-white p-6 shadow-sm transition-all hover:-translate-y-1 \${plan.highlighted ? 'border-emerald-500 ring-1 ring-emerald-500 shadow-2xl shadow-emerald-500/10' : 'border-slate-200'}\`}>
      <h3 className="text-base font-bold tracking-tighter text-slate-900">{plan.name}</h3>
      <div className="mt-3 text-3xl font-bold tracking-tighter tabular-nums text-slate-900">{plan.price}</div>
      <ul className="mt-5 space-y-2 text-sm text-slate-500">{plan.features.map((f) => <li key={f}>• {f}</li>)}</ul>
      <button className="mt-6 w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-medium text-white active:scale-95">{plan.cta}</button>
    </div>
  ))}
</div>`,
  },
  {
    id: 'kpi-analytics-table',
    title: 'Dashboard KPI Strip & Filterable Ledger',
    category: 'dashboard',
    templateHints: ['dashboard'],
    tags: ['dashboard', 'analytics', 'kpi', 'table', 'invoice', 'ledger', 'filter', 'search', 'metrics'],
    description: '4-column metric card strip paired with an interactive search/status-filterable data table.',
    snippet: `<div className="space-y-6">
  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
    {kpis.map((kpi) => (
      <div key={kpi.label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="text-xs font-medium text-slate-500">{kpi.label}</div>
        <div className="mt-2 text-2xl font-bold tracking-tighter tabular-nums text-slate-900">{kpi.value}</div>
      </div>
    ))}
  </div>
  <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
    <table className="w-full text-left text-sm">...</table>
  </div>
</div>`,
  },
  {
    id: 'split-screen-auth',
    title: 'Split-Screen Auth Login Card',
    category: 'auth',
    templateHints: ['auth-login'],
    tags: ['login', 'auth', 'register', 'signin', 'form', 'email', 'password', 'split'],
    description: 'Centered accessible auth form on clean light surface paired with dark architectural preview panel.',
    snippet: `<div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
  <div className="flex items-center justify-center bg-[#FAFAFA] p-8">
    <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
      <h1 className="text-2xl font-bold tracking-tighter text-slate-900">Sign in</h1>
      <input type="email" required placeholder="you@company.com" className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm focus:border-emerald-500 focus:outline-none" />
      <button type="submit" className="h-10 w-full rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 text-sm font-medium text-white active:scale-95">Continue</button>
    </form>
  </div>
  <div className="hidden bg-zinc-950 p-12 text-zinc-100 lg:flex lg:flex-col lg:justify-between border-l border-zinc-800">...</div>
</div>`,
  },
  {
    id: 'filterable-catalog-grid',
    title: 'Category-Filterable Catalog Grid',
    category: 'catalog',
    templateHints: ['storefront', 'portfolio'],
    tags: ['catalog', 'shop', 'store', 'coffee', 'roast', 'menu', 'product', 'filter', 'tabs'],
    description: 'Interactive category tab selector filtering curated 3-column storefront product cards with pricing.',
    snippet: `<div className="space-y-6">
  <div className="flex flex-wrap gap-2">
    {categories.map((cat) => (
      <button key={cat} type="button" onClick={() => setActiveCat(cat)} className={\`rounded-lg px-3.5 py-1.5 text-xs font-medium \${activeCat === cat ? 'bg-emerald-600 text-white' : 'border border-slate-200 bg-white text-slate-600'}\`}>{cat}</button>
    ))}
  </div>
  <div className="grid grid-cols-1 gap-5 md:grid-cols-3">...</div>
</div>`,
  },
  {
    id: 'accordion-faq-footer',
    title: 'Interactive FAQ Accordion & Hairline Footer',
    category: 'faq',
    templateHints: ['landing-page', 'saas-pricing', 'storefront'],
    tags: ['faq', 'accordion', 'question', 'footer', 'copyright'],
    description: 'Accessible disclosure accordion with emerald open accent followed by a quiet hairline footer.',
    snippet: `<section className="mx-auto max-w-3xl px-6 py-16 space-y-3">
  {faqs.map((item, idx) => (
    <div key={item.q} className="rounded-xl border border-slate-200 bg-white">
      <button type="button" onClick={() => setOpenIdx(openIdx === idx ? null : idx)} className="flex w-full items-center justify-between px-5 py-4 text-left text-sm font-semibold text-slate-900">
        <span>{item.q}</span>
        <span className={openIdx === idx ? 'text-emerald-600' : 'text-slate-400'}>{openIdx === idx ? '−' : '+'}</span>
      </button>
      {openIdx === idx ? <div className="border-t border-slate-100 px-5 py-3 text-sm leading-relaxed text-slate-500">{item.a}</div> : null}
    </div>
  ))}
</section>`,
  },
];

function tokenizeForVector(text: string): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2);
  const terms: string[] = [...words];
  for (const w of words) {
    if (w.length >= 4) {
      for (let i = 0; i <= w.length - 3; i += 1) {
        terms.push(`#${w.slice(i, i + 3)}`);
      }
    }
  }
  return terms;
}

function buildTermFreqVector(text: string): Map<string, number> {
  const vec = new Map<string, number>();
  for (const term of tokenizeForVector(text)) {
    vec.set(term, (vec.get(term) ?? 0) + 1);
  }
  return vec;
}

function cosineSimilarity(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (const val of a.values()) normA += val * val;
  for (const val of b.values()) normB += val * val;
  if (normA === 0 || normB === 0) return 0;

  for (const [term, valA] of a.entries()) {
    const valB = b.get(term);
    if (valB) dot += valA * valB;
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Vector similarity pattern retriever matching prompt intent and template contract
 * against curated UI component patterns.
 */
export function retrieveRelevantPatterns(
  prompt: string,
  templateId?: TemplateId,
  topK = 3
): RetrievedPattern[] {
  const queryVec = buildTermFreqVector(prompt);
  const scored: RetrievedPattern[] = UI_PATTERN_CORPUS.map((pattern) => {
    const docText = `${pattern.title} ${pattern.category} ${pattern.tags.join(' ')} ${pattern.description}`;
    const docVec = buildTermFreqVector(docText);
    let score = cosineSimilarity(queryVec, docVec);
    if (templateId && pattern.templateHints.includes(templateId)) {
      score += 0.18;
    }
    return {
      ...pattern,
      score: Number(score.toFixed(4)),
    };
  });

  return scored.sort((a, b) => b.score - a.score).slice(0, Math.max(1, topK));
}

export function formatPatternsForSystemPrompt(patterns: RetrievedPattern[]): string {
  if (patterns.length === 0) return '';
  return patterns
    .map(
      (p, i) =>
        `### Pattern ${i + 1}: ${p.title} (${p.category}, score ${p.score})\n` +
        `Guideline: ${p.description}\n` +
        `\`\`\`tsx\n${p.snippet}\n\`\`\``
    )
    .join('\n\n');
}
