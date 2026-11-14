import { z } from 'zod';
import type { PromptAnalysis, PromptDomain } from './prompt-analyzer.ts';

export const UIDesignBlueprintSchema = z.object({
  brandName: z.string().min(1),
  tagline: z.string().min(1),
  visualDirection: z.string().min(1),
  palette: z.object({
    background: z.string(),
    surface: z.string(),
    textPrimary: z.string(),
    textMuted: z.string(),
    accent: z.string(),
    border: z.string(),
  }),
  typography: z.object({
    displayTone: z.string(),
    bodyTone: z.string(),
  }),
  sections: z.array(
    z.object({
      id: z.string(),
      componentName: z.string(),
      purpose: z.string(),
      layoutPattern: z.string(),
      copyHeadline: z.string(),
      copyBody: z.string(),
    })
  ),
  svgAssets: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      svgMarkup: z.string(),
    })
  ),
  provider: z.enum(['claude-haiku', 'deterministic-architect']),
});

export type UIDesignBlueprint = z.infer<typeof UIDesignBlueprintSchema>;

export function extractJsonObject(raw: string): unknown {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1]?.trim() ?? trimmed;
  const firstBrace = candidate.indexOf('{');
  const lastBrace = candidate.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error('No JSON object found in Haiku response');
  }
  return JSON.parse(candidate.slice(firstBrace, lastBrace + 1));
}

function buildDeterministicBlueprint(
  prompt: string,
  analysis: PromptAnalysis
): UIDesignBlueprint {
  const isDark = analysis.darkMode;
  const paletteByAccent = {
    emerald: { accent: '#059669', bgLight: '#FAFAFA', bgDark: '#09090B' },
    amber: { accent: '#B45309', bgLight: '#FAF8F5', bgDark: '#12100E' },
    rose: { accent: '#BE123C', bgLight: '#FFFBFB', bgDark: '#130D10' },
    indigo: { accent: '#4338CA', bgLight: '#F8FAFC', bgDark: '#0B1020' },
    slate: { accent: '#0F172A', bgLight: '#FAFAFA', bgDark: '#09090B' },
  }[analysis.accentHint];

  const domainTaglines: Record<PromptDomain, string> = {
    'coffee-hospitality': 'Single-origin Indonesian beans roasted at dawn.',
    portfolio: 'Selected digital products, interfaces, and engineering work.',
    'saas-pricing': 'Transparent plans engineered for fast-moving teams.',
    'dashboard-analytics': 'Real-time operational telemetry and cashflow clarity.',
    'healthcare-clinic': 'Modern family healthcare with same-day appointments.',
    'event-invitation': 'An intimate celebration with family and close friends.',
    'general-saas': 'Purpose-built software crafted for clarity and speed.',
  };

  const sectionTemplates: Record<
    string,
    { purpose: string; layoutPattern: string; copyHeadline: string; copyBody: string }
  > = {
    Hero: {
      purpose: 'Primary value proposition and focal CTA',
      layoutPattern: 'Centered editorial headline with high-contrast action pair',
      copyHeadline:
        analysis.domain === 'coffee-hospitality'
          ? `${analysis.brandName}, roasted every morning.`
          : analysis.domain === 'portfolio'
          ? `${analysis.brandName} — Product Designer & Engineer`
          : `${analysis.brandName} built for focused work.`,
      copyBody:
        prompt.length > 24
          ? `${domainTaglines[analysis.domain]} Tailored from your brief: "${prompt.slice(0, 96)}${prompt.length > 96 ? '...' : ''}"`
          : domainTaglines[analysis.domain],
    },
    RoastCatalog: {
      purpose: 'Showcase 3 signature single-origin offerings with tasting notes',
      layoutPattern: '3-column asymmetric card grid with 1px hairline borders',
      copyHeadline: 'Current Roasts',
      copyBody: 'Traceable microlots from Aceh Gayo, Flores Bajawa, and Toraja Sapan.',
    },
    StoreHours: {
      purpose: 'Location details, opening hours, and direct order CTA',
      layoutPattern: '2-column split panel with structured schedule list',
      copyHeadline: 'Visit the Roastery',
      copyBody: 'Open daily 07:00 – 21:00 WIB at Jl. Senopati No. 48, South Jakarta.',
    },
    SelectedWork: {
      purpose: 'Curated case studies with concrete metrics',
      layoutPattern: '2-column editorial grid with crisp metadata separators',
      copyHeadline: 'Selected Projects',
      copyBody: 'Production web apps, design systems, and developer tools shipped 2024–2026.',
    },
    Experience: {
      purpose: 'Timeline of roles and technical capabilities',
      layoutPattern: 'Structured rows with tabular date ranges',
      copyHeadline: 'Experience & Stack',
      copyBody: 'React, TypeScript, Tailwind CSS, and Node.js systems.',
    },
    PricingTiers: {
      purpose: '3-tier pricing comparison with highlighted recommended tier',
      layoutPattern: '3-column grid with elevated Pro card',
      copyHeadline: 'Simple, predictable pricing',
      copyBody: 'Start lean and scale capacity without surprise overages.',
    },
    Comparison: {
      purpose: 'Feature matrix across plans',
      layoutPattern: 'Clean horizontal table with tabular numbers',
      copyHeadline: 'Plan Specifications',
      copyBody: 'Exact project, team, and export limits per tier.',
    },
    TopMetrics: {
      purpose: '4-column KPI summary strip',
      layoutPattern: '4-col grid with tabular numerals',
      copyHeadline: 'Monthly Snapshot',
      copyBody: 'Live billing totals, paid invoices, and pending settlements.',
    },
    RevenueTable: {
      purpose: 'Interactive ledger table with status filtering',
      layoutPattern: 'Filterable table with explicit text + dot status indicators',
      copyHeadline: 'Recent Invoices',
      copyBody: 'Track sent, paid, and overdue client invoices in real time.',
    },
    ActivityFeed: {
      purpose: 'Chronological operational events',
      layoutPattern: 'Hairline-divided feed list',
      copyHeadline: 'Settlement Log',
      copyBody: 'Automated webhook confirmations and payout notices.',
    },
    Features: {
      purpose: 'Bento feature showcase',
      layoutPattern: '12-col asymmetric bento grid',
      copyHeadline: 'Core Capabilities',
      copyBody: 'Designed to eliminate friction from first draft to production deploy.',
    },
    Pricing: {
      purpose: '3-column tier selector',
      layoutPattern: '3-col cards with monthly toggle',
      copyHeadline: 'Transparent Tiers',
      copyBody: 'Choose the workspace capacity that fits your launch cadence.',
    },
    Catalog: {
      purpose: 'Structured product or service showcase',
      layoutPattern: '3-column card grid',
      copyHeadline: 'Featured Offerings',
      copyBody: 'Curated selection ready for immediate booking or order.',
    },
    SocialProof: {
      purpose: 'Attributable customer outcomes',
      layoutPattern: '2-column editorial quote cards',
      copyHeadline: 'Trusted by builders',
      copyBody: 'Real outcomes from independent teams and studios.',
    },
    FAQ: {
      purpose: 'Interactive expandable Q&A',
      layoutPattern: 'Hairline-divided accordion',
      copyHeadline: 'Frequently Asked Questions',
      copyBody: 'Answers on code ownership, billing, and deployment.',
    },
    Contact: {
      purpose: 'Direct inquiry / booking form with validation',
      layoutPattern: 'Split summary and clean input card',
      copyHeadline: 'Get in touch',
      copyBody: 'Send a note and receive a response within one business day.',
    },
    Footer: {
      purpose: 'Quiet copyright and navigation links',
      layoutPattern: 'Single-row hairline top border footer',
      copyHeadline: analysis.brandName,
      copyBody: `© ${new Date().getFullYear()} ${analysis.brandName}.`,
    },
  };

  const sections = analysis.requestedSections.map((secName, idx) => {
    const tpl = sectionTemplates[secName] ?? {
      purpose: `${secName} section tailored to ${analysis.brandName}`,
      layoutPattern: 'Clean responsive grid with 1px hairline borders',
      copyHeadline: secName,
      copyBody: `Structured ${secName.toLowerCase()} block built for ${analysis.brandName}.`,
    };
    return {
      id: `sec-${idx + 1}`,
      componentName: `${secName.replace(/[^A-Za-z0-9]/g, '')}Section`,
      ...tpl,
    };
  });

  const brandMarkSvg = `<svg viewBox="0 0 32 32" fill="none" class="h-7 w-7" aria-hidden="true"><rect x="2" y="2" width="28" height="28" rx="7" stroke="${paletteByAccent.accent}" stroke-width="2"/><path d="M10 17l4 4 8-10" stroke="${paletteByAccent.accent}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

  return {
    brandName: analysis.brandName,
    tagline: domainTaglines[analysis.domain],
    visualDirection: isDark
      ? 'High-contrast obsidian canvas with crisp 1px zinc-800 hairline borders'
      : 'Editorial light canvas (#FAFAFA) with crisp white surfaces and 1px hairline borders',
    palette: {
      background: isDark ? paletteByAccent.bgDark : paletteByAccent.bgLight,
      surface: isDark ? '#18181B' : '#FFFFFF',
      textPrimary: isDark ? '#F4F4F5' : '#0F172A',
      textMuted: isDark ? '#A1A1AA' : '#475569',
      accent: paletteByAccent.accent,
      border: isDark ? '#27272A' : '#E2E8F0',
    },
    typography: {
      displayTone: 'Tight geometric display tracking (-0.03em)',
      bodyTone: 'Readable humanist sans with tabular numerals',
    },
    sections,
    svgAssets: [
      {
        name: 'BrandMark',
        description: `Geometric mark for ${analysis.brandName}`,
        svgMarkup: brandMarkSvg,
      },
    ],
    provider: 'deterministic-architect',
  };
}

export async function runHaikuUiArchitect(
  prompt: string,
  analysis: PromptAnalysis,
  modelOverride?: string
): Promise<UIDesignBlueprint> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  const isPlaceholder = !apiKey || apiKey.startsWith('MY_');

  if (isPlaceholder) {
    return buildDeterministicBlueprint(prompt, analysis);
  }

  const model =
    modelOverride?.trim() || process.env.ANTHROPIC_MODEL?.trim() || 'claude-3-5-haiku-latest';

  const systemPrompt = `You are the UI/UX Frontend & Visual Assets Engineer (Claude Haiku) for urself.online.
Your job is to transform a user's website prompt into a strict JSON UI Design Blueprint before DeepSeek writes the React code.
Rules:
- Never emit generic AI clichés or cluttered badge sandwiches.
- Choose cohesive color hex codes (60% neutral canvas, 30% surface/1px border, 10% accent).
- Design crisp inline SVG visual assets (geometric marks, icons, dividers) using valid SVG markup.
- Output ONLY valid JSON matching this schema:
{
  "brandName": string,
  "tagline": string,
  "visualDirection": string,
  "palette": { "background": string, "surface": string, "textPrimary": string, "textMuted": string, "accent": string, "border": string },
  "typography": { "displayTone": string, "bodyTone": string },
  "sections": [{ "id": string, "componentName": string, "purpose": string, "layoutPattern": string, "copyHeadline": string, "copyBody": string }],
  "svgAssets": [{ "name": string, "description": string, "svgMarkup": string }]
}`;

  const userMessage = `Prompt: ${prompt}
Detected Domain: ${analysis.domain}
Intent: ${analysis.intent}
Brand Hint: ${analysis.brandName}
Dark Mode Requested: ${analysis.darkMode}
Suggested Sections: ${analysis.requestedSections.join(', ')}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: AbortSignal.timeout(12000),
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 1800,
        temperature: 0.3,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    if (!response.ok) {
      throw new Error(`Anthropic HTTP ${response.status}`);
    }

    const data = (await response.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const rawText = data.content?.find((c) => c.type === 'text')?.text ?? '';
    const parsedJson = extractJsonObject(rawText);
    const validated = UIDesignBlueprintSchema.parse({
      ...(parsedJson as Record<string, unknown>),
      provider: 'claude-haiku',
    });
    return validated;
  } catch {
    return buildDeterministicBlueprint(prompt, analysis);
  }
}
