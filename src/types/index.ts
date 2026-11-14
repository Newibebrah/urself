import type { PlanId, Quota } from '../features/billing/types';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  plan: PlanId;
}

export const MOCK_USER: UserProfile = {
  id: 'usr_mock_01',
  name: 'Demo User',
  email: 'demo@urself.online',
  avatarUrl: '/src/assets/images/avatar_demo_user_1794595056974.jpg',
  plan: 'pro',
};

export const MOCK_QUOTA: Quota = {
  planId: 'pro',
  projectsUsed: 3,
  projectsMax: 5,
  revisionsUsed: 4,
  revisionsMax: 10,
};

export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  publishedAt: string;
  readTime: string;
  category: string;
  author: string;
  coverImage: string;
  content: string[];
}

export interface FaqItem {
  id: string;
  category: 'Billing' | 'AI' | 'Code' | 'Support';
  question: string;
  answer: string;
}

export interface BuilderMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  summary?: string;
  diffLines?: { type: 'add' | 'remove' | 'context'; text: string }[];
}

export interface ApiKeyItem {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsed: string;
}
