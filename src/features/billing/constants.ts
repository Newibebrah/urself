import type { Plan } from './types';

export const PRICING_PLANS: Plan[] = [
  {
    id: 'basic',
    name: 'Basic',
    tagline: 'For solo founders testing their first launch.',
    price: 75000,
    period: 'month',
    projectsLimit: 3,
    revisionsLimit: 5,
    features: [
      '3 active React + Vite projects',
      '5 AI chat revisions per month',
      'Instant sandboxed live preview',
      'Clean ZIP source export',
    ],
    highlight: false,
    cta: 'Start with Basic',
  },
  {
    id: 'pro',
    name: 'Pro',
    tagline: 'For makers shipping client & SaaS websites weekly.',
    price: 177000,
    period: 'month',
    projectsLimit: 5,
    revisionsLimit: 10,
    features: [
      '5 active React + Vite projects',
      '10 AI chat revisions per month',
      'Priority DeepSeek code generation',
      'Custom domain & one-click publish',
      'Full Tailwind CSS component diffs',
    ],
    highlight: true,
    cta: 'Upgrade to Pro',
  },
  {
    id: 'king',
    name: 'King',
    tagline: 'For studios running multiple product launches.',
    price: 255000,
    period: 'month',
    projectsLimit: 10,
    revisionsLimit: 15,
    features: [
      '10 active React + Vite projects',
      '15 AI chat revisions per month',
      'Fastest build & preview workers',
      'Commercial client handoff license',
      'Direct email engineering support',
    ],
    highlight: false,
    cta: 'Choose King',
  },
];

export interface ComparisonRow {
  feature: string;
  basic: string;
  pro: string;
  king: string;
}

export const PRICING_COMPARISON_ROWS: ComparisonRow[] = [
  { feature: 'Active projects', basic: '3 projects', pro: '5 projects', king: '10 projects' },
  { feature: 'Monthly AI revisions', basic: '5 revisions', pro: '10 revisions', king: '15 revisions' },
  { feature: 'Output stack', basic: 'React + Vite + Tailwind', pro: 'React + Vite + Tailwind', king: 'React + Vite + Tailwind' },
  { feature: 'Live sandbox preview', basic: 'Included', pro: 'Priority worker', king: 'Dedicated worker' },
  { feature: 'ZIP code export', basic: 'Unlimited downloads', pro: 'Unlimited downloads', king: 'Unlimited downloads' },
  { feature: 'Commercial handoff', basic: 'Personal & indie', pro: 'Included', king: 'Multi-client agency' },
  { feature: 'Support SLA', basic: 'Community docs', pro: '48h email response', king: '24h priority support' },
];
