import type { BuilderMessage } from '../../types';

export const HERO_SUGGESTION_PROMPTS: string[] = [
  'Landing page for a specialty coffee shop',
  'Personal portfolio with dark mode',
  'SaaS pricing page with 3 tiers',
];

export const MOCK_BUILDER_CONVERSATIONS: Record<string, BuilderMessage[]> = {
  'mock-1': [
    {
      id: 'msg-1',
      role: 'user',
      content: 'Build a landing page for Kopi Senja, a specialty Indonesian coffee roastery in Jakarta. Warm minimal editorial aesthetic with a hero, roast menu, and store hours.',
      timestamp: '10:12 AM',
      summary: 'Initial prompt · Kopi Senja landing',
    },
    {
      id: 'msg-2',
      role: 'assistant',
      content: 'Generated a production-ready React + Vite landing page for Kopi Senja featuring a minimalist hero, 3 single-origin roast cards (Aceh Gayo, Flores Bajawa, Toraja Sapan), and a clean Senopati store hours footer.',
      timestamp: '10:12 AM',
      summary: 'Created src/App.tsx + 2 components',
      diffLines: [
        { type: 'context', text: '<section className="mx-auto max-w-5xl px-6 py-24">' },
        { type: 'add', text: '  <RoastCatalog origins={["Gayo", "Flores", "Toraja"]} />' },
        { type: 'add', text: '  <StoreHours location="Jl. Senopati No. 48" />' },
        { type: 'context', text: '</section>' },
      ],
    },
    {
      id: 'msg-3',
      role: 'user',
      content: 'Tighten the hero headline spacing and add an Order Beans CTA button in emerald.',
      timestamp: '10:18 AM',
      summary: 'Revision · Hero CTA & spacing',
    },
    {
      id: 'msg-4',
      role: 'assistant',
      content: 'Updated the hero section with tighter display tracking and added a primary emerald "Order Beans" action button alongside a secondary "Visit Roastery" link.',
      timestamp: '10:18 AM',
      summary: 'Updated src/App.tsx',
      diffLines: [
        { type: 'remove', text: '<h1 className="mt-4 text-4xl font-semibold">' },
        { type: 'add', text: '<h1 className="mt-4 text-5xl font-bold tracking-tight">' },
        { type: 'add', text: '<button className="bg-emerald-600 text-white rounded-lg px-5 py-2.5">Order Beans</button>' },
      ],
    },
  ],
};

export function getConversationForProject(projectId: string, projectName: string): BuilderMessage[] {
  if (MOCK_BUILDER_CONVERSATIONS[projectId]) {
    return MOCK_BUILDER_CONVERSATIONS[projectId];
  }
  return [
    {
      id: `${projectId}-1`,
      role: 'user',
      content: `Create a clean, responsive React + Vite website for "${projectName}".`,
      timestamp: '09:40 AM',
      summary: `Initial prompt · ${projectName}`,
    },
    {
      id: `${projectId}-2`,
      role: 'assistant',
      content: `Scaffolded ${projectName} with modular Tailwind components, responsive layout sections, and clean semantic HTML ready for preview and export.`,
      timestamp: '09:40 AM',
      summary: 'Created src/App.tsx',
      diffLines: [
        { type: 'add', text: 'export default function App() {' },
        { type: 'add', text: `  return <PageShell title="${projectName}" />;` },
        { type: 'add', text: '}' },
      ],
    },
  ];
}
