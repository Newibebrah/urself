import type { BlogPost, FaqItem } from '../../types';

export const LANDING_FAQ_ITEMS: FaqItem[] = [
  {
    id: 'faq-quality',
    category: 'AI',
    question: 'What kind of code does urself.online generate?',
    answer:
      'Every prompt outputs modular TypeScript-ready React components styled with Tailwind CSS inside a standard Vite project structure. No proprietary runtime lock-in or obfuscated wrappers.',
  },
  {
    id: 'faq-ownership',
    category: 'Code',
    question: 'Do I own 100% of the exported source code?',
    answer:
      'Yes. Any ZIP export you download belongs completely to you and your clients. You can commit it to GitHub, modify it in your editor, and host it anywhere.',
  },
  {
    id: 'faq-frameworks',
    category: 'Code',
    question: 'Which frontend stack is supported right now?',
    answer:
      'During beta, all projects target React + Vite + Tailwind CSS. This keeps live browser previews fast and ensures predictable builds across Vercel, Netlify, and Cloudflare Pages.',
  },
  {
    id: 'faq-deploy',
    category: 'Code',
    question: 'How do I deploy a website after building it?',
    answer:
      'Download the project ZIP and run npm install && npm run build, or use the Publish action inside the builder workspace once custom domain hosting rolls out.',
  },
  {
    id: 'faq-limits',
    category: 'Billing',
    question: 'How do project and revision limits work?',
    answer:
      'Active projects count the workspaces saved in your dashboard. Revisions count follow-up AI chat edits per billing month. Deleting a draft frees up a project slot immediately.',
  },
  {
    id: 'faq-refund',
    category: 'Billing',
    question: 'What is your refund and cancellation policy?',
    answer:
      'You can cancel your monthly subscription at any time from Billing with zero lock-in. If you run into a billing issue within 7 days of renewal, contact support for a full review.',
  },
];

export const FULL_FAQ_ITEMS: FaqItem[] = [
  ...LANDING_FAQ_ITEMS,
  {
    id: 'faq-revisions',
    category: 'AI',
    question: 'Can I edit specific sections without regenerating the whole site?',
    answer:
      'Yes. Follow-up prompts in the builder chat apply targeted component diffs while keeping your existing layout, copy, and color tokens intact.',
  },
  {
    id: 'faq-prompts',
    category: 'AI',
    question: 'How detailed should my initial prompt be?',
    answer:
      'One to three sentences naming your business type, visual tone, and key sections is enough to start. You can refine typography, sections, and copy through follow-up chat messages.',
  },
  {
    id: 'faq-preview-safety',
    category: 'Code',
    question: 'How does the instant browser preview run safely?',
    answer:
      'Generated bundles execute inside a sandboxed iframe via an isolated Blob URL, preventing cross-origin script leaks while rendering authentic Tailwind layouts.',
  },
  {
    id: 'faq-idr-payment',
    category: 'Billing',
    question: 'Why are plans priced in Indonesian Rupiah (IDR)?',
    answer:
      'urself.online is built with transparent local pricing for Indonesian founders, indie makers, and studios—starting at Rp 75.000/month with no surprise USD FX markups.',
  },
  {
    id: 'faq-upgrade',
    category: 'Billing',
    question: 'What happens if I upgrade from Basic to Pro mid-month?',
    answer:
      'Your project and revision quotas increase immediately to 5 projects and 10 revisions, and your existing workspaces carry over seamlessly.',
  },
  {
    id: 'faq-support-sla',
    category: 'Support',
    question: 'How can I reach support if a build fails?',
    answer:
      'Pro and King workspaces receive direct email engineering support within 48h and 24h respectively. You can also inspect any build error directly in the builder preview toolbar.',
  },
];

export const MOCK_BLOG_POSTS: BlogPost[] = [
  {
    slug: 'prompt-to-production-react-architecture',
    title: 'From Natural Language to Clean React + Vite Architecture',
    excerpt: 'How structured file contracts keep AI-generated interfaces maintainable after export.',
    publishedAt: 'Nov 10, 2026',
    readTime: '5 min read',
    category: 'Engineering',
    author: 'Raka Pratama',
    coverImage: '/src/assets/images/blog_cover_ai_architecture_1794595056804.jpg',
    content: [
      'Most AI website generators optimize for a flashy first screenshot and leave behind a single 800-line file full of brittle inline styles. The moment a developer opens the exported codebase, it is faster to rewrite from scratch than to maintain.',
      'At urself.online, every generation follows a predictable React + Vite component tree: shared UI primitives, typed feature contracts, and clean Tailwind CSS utility classes with zero proprietary wrappers.',
      'When you ask the builder chat to adjust a pricing grid or swap a hero headline, the assistant emits scoped component diffs rather than scrambling unrelated layout containers. That keeps revisions deterministic and exportable at any step.',
    ],
  },
  {
    slug: 'why-we-chose-strict-1px-borders',
    title: 'Why Strict 1px Hairline Borders Beat Heavy Drop Shadows',
    excerpt: 'Designing high-clarity SaaS workspaces with disciplined neutral surfaces and emerald focus.',
    publishedAt: 'Nov 4, 2026',
    readTime: '4 min read',
    category: 'Design Systems',
    author: 'Nadia Kusuma',
    coverImage: '/src/assets/images/blog_cover_design_system_1794595057352.jpg',
    content: [
      'When every card on a screen carries a heavy shadow, nothing feels grounded. Visual hierarchy collapses into floating fog, and users struggle to scan dense tables or IDE panels.',
      'By pairing #FAFAFA neutral canvases with crisp #FFFFFF surfaces and 1px solid slate-200 borders, the interface stays quiet until an interactive state demands attention.',
      'We reserve emerald strictly for primary actions, active navigation states, live status indicators, and the AI chat focus ring—giving users immediate orientation across both marketing pages and the 3-panel builder.',
    ],
  },
  {
    slug: 'sandboxed-browser-previews-without-servers',
    title: 'Instant Browser Previews Inside Sandboxed Iframes',
    excerpt: 'Eliminating cold container boots so every chat revision renders in milliseconds.',
    publishedAt: 'Oct 27, 2026',
    readTime: '6 min read',
    category: 'Infrastructure',
    author: 'Dimas Wijaya',
    coverImage: '/src/assets/images/blog_cover_instant_preview_1794595057849.jpg',
    content: [
      'Waiting 45 seconds for a remote container to spin up breaks creative flow. When iterating on typography or spacing with AI, preview latency needs to feel as immediate as saving a local file.',
      'Our preview pipeline compiles your React modules directly in-browser and mounts the result inside an isolated iframe frame. You get desktop responsiveness checks, instant refresh, and zero cross-project state bleed.',
      'Once your layout feels right, exporting the exact Vite bundle takes one click—ready for local development or production deployment.',
    ],
  },
];
