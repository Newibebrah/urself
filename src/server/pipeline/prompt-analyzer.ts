import type { ProjectFile } from '../../features/projects/types.ts';

export type PromptDomain =
  | 'coffee-hospitality'
  | 'portfolio'
  | 'saas-pricing'
  | 'dashboard-analytics'
  | 'healthcare-clinic'
  | 'event-invitation'
  | 'general-saas';

export interface PromptAnalysis {
  intent: 'create' | 'revise';
  domain: PromptDomain;
  brandName: string;
  darkMode: boolean;
  requestedSections: string[];
  accentHint: 'emerald' | 'amber' | 'slate' | 'rose' | 'indigo';
  relevantFiles: ProjectFile[];
  complexityScore: number;
}

const REVISION_VERBS = [
  'change',
  'update',
  'edit',
  'add',
  'remove',
  'tighten',
  'fix',
  'replace',
  'make',
  'switch',
  'adjust',
  'ubah',
  'tambah',
  'hapus',
  'ganti',
  'perbaiki',
];

export function detectDomain(prompt: string): PromptDomain {
  const p = prompt.toLowerCase();
  if (/(coffee|kopi|roastery|cafe|espresso|bakery|restaurant|bistro)/.test(p)) {
    return 'coffee-hospitality';
  }
  if (/(portfolio|designer|photographer|freelancer|cv|resume|personal)/.test(p)) {
    return 'portfolio';
  }
  if (/(pricing|tier|plan|subscription|saas|startup|landing)/.test(p)) {
    return 'saas-pricing';
  }
  if (/(invoice|dashboard|analytics|crm|admin|metrics|kpi|finance)/.test(p)) {
    return 'dashboard-analytics';
  }
  if (/(clinic|klinik|health|medical|doctor|dental|hospital)/.test(p)) {
    return 'healthcare-clinic';
  }
  if (/(wedding|nikah|invitation|undangan|event|rsvp)/.test(p)) {
    return 'event-invitation';
  }
  return 'general-saas';
}

export function extractBrandName(prompt: string, domain: PromptDomain): string {
  const quoted = prompt.match(/["“']([^"”']{2,32})["”']/);
  if (quoted?.[1]) return quoted[1].trim();

  const forMatch = prompt.match(/\b(?:for|untuk|named|called)\s+([A-Z][A-Za-z0-9&\-\s]{1,28}?)(?=[,.]|$|\s+(?:a|an|the|with|yang|dengan)\b)/);
  if (forMatch?.[1]) return forMatch[1].trim();

  const defaults: Record<PromptDomain, string> = {
    'coffee-hospitality': 'Kopi Senja',
    portfolio: 'Nadia Kusuma',
    'saas-pricing': 'MetricFlow',
    'dashboard-analytics': 'LedgerPulse',
    'healthcare-clinic': 'Klinik Sehat',
    'event-invitation': 'Arif & Maya',
    'general-saas': 'Vektor Studio',
  };
  return defaults[domain];
}

export function extractRequestedSections(prompt: string, domain: PromptDomain): string[] {
  const p = prompt.toLowerCase();
  const found: string[] = ['Hero'];
  if (/pricing|tier|plan|harga/.test(p)) found.push('Pricing');
  if (/feature|bento|benefit|fitur/.test(p)) found.push('Features');
  if (/menu|catalog|product|roast|paket/.test(p)) found.push('Catalog');
  if (/testimonial|review|proof|client/.test(p)) found.push('SocialProof');
  if (/faq|question/.test(p)) found.push('FAQ');
  if (/hour|location|contact|map|rsvp|book/.test(p)) found.push('Contact');
  if (/footer/.test(p)) found.push('Footer');

  if (found.length === 1) {
    if (domain === 'coffee-hospitality') return ['Hero', 'RoastCatalog', 'StoreHours', 'Footer'];
    if (domain === 'portfolio') return ['Hero', 'SelectedWork', 'Experience', 'Contact'];
    if (domain === 'saas-pricing') return ['Hero', 'PricingTiers', 'Comparison', 'FAQ'];
    if (domain === 'dashboard-analytics') return ['TopMetrics', 'RevenueTable', 'ActivityFeed'];
    if (domain === 'healthcare-clinic') return ['Hero', 'Services', 'Doctors', 'BookingCTA'];
    if (domain === 'event-invitation') return ['Hero', 'Schedule', 'Venue', 'RSVPForm'];
    return ['Hero', 'Capabilities', 'Metrics', 'Footer'];
  }
  return Array.from(new Set(found));
}

export function scoreFileRelevance(file: ProjectFile, prompt: string): number {
  const p = prompt.toLowerCase();
  const pathLower = file.path.toLowerCase();
  let score = 0;

  if (pathLower.endsWith('app.tsx') || pathLower.endsWith('app.jsx')) score += 50;
  if (pathLower.includes('component')) score += 20;
  if (pathLower.endsWith('package.json')) score -= 10;

  const tokens = p.split(/\W+/).filter((t) => t.length >= 3);
  for (const token of tokens) {
    if (pathLower.includes(token)) score += 30;
    if (file.content.toLowerCase().includes(token)) score += 10;
  }
  return score;
}

export function analyzePrompt(
  prompt: string,
  existingFiles: ProjectFile[] = []
): PromptAnalysis {
  const trimmed = prompt.trim();
  const lower = trimmed.toLowerCase();
  const hasRealSourceFiles = existingFiles.some(
    (f) =>
      (f.path.endsWith('.tsx') || f.path.endsWith('.jsx')) &&
      !f.content.includes('Draft workspace ready.')
  );

  const startsWithRevisionVerb = REVISION_VERBS.some(
    (v) => lower.startsWith(`${v} `) || lower.includes(` ${v} `)
  );

  const intent: 'create' | 'revise' =
    hasRealSourceFiles && (startsWithRevisionVerb || trimmed.length < 180)
      ? 'revise'
      : 'create';

  const domain = detectDomain(trimmed);
  const brandName = extractBrandName(trimmed, domain);
  const darkMode = /(dark\s*mode|dark\s*theme|obsidian|zinc-950|night|gelap)/.test(lower);

  let accentHint: PromptAnalysis['accentHint'] = 'emerald';
  if (/(warm|coffee|roast|amber|gold|bronze)/.test(lower)) accentHint = 'amber';
  else if (/(wedding|floral|rose|blush)/.test(lower)) accentHint = 'rose';
  else if (/(fintech|stripe|indigo|enterprise|analytic)/.test(lower)) accentHint = 'indigo';
  else if (/(minimal|monochrome|brutalist|slate)/.test(lower)) accentHint = 'slate';

  const requestedSections = extractRequestedSections(trimmed, domain);

  const relevantFiles = [...existingFiles]
    .sort((a, b) => scoreFileRelevance(b, trimmed) - scoreFileRelevance(a, trimmed))
    .slice(0, 5);

  const complexityScore = Math.min(
    10,
    2 + requestedSections.length + (intent === 'revise' ? 1 : 2) + (darkMode ? 1 : 0)
  );

  return {
    intent,
    domain,
    brandName,
    darkMode,
    requestedSections,
    accentHint,
    relevantFiles,
    complexityScore,
  };
}
