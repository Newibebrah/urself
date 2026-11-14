export type PlanId = 'basic' | 'pro' | 'king';

export interface Plan {
  id: PlanId;
  name: string;
  tagline: string;
  price: number; // IDR
  period: 'month';
  projectsLimit: number;
  revisionsLimit: number;
  features: string[];
  highlight: boolean;
  cta: string;
}

export interface Quota {
  planId: PlanId;
  projectsUsed: number;
  projectsMax: number;
  revisionsUsed: number;
  revisionsMax: number;
}
