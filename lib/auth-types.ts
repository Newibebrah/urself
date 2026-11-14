import type { PlanId } from '../src/features/billing/types';

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  plan: PlanId;
  tokensUsed: number;
  tokensLimit: number;
  projectsUsed: number;
  projectsMax: number;
  revisionsUsed: number;
  revisionsMax: number;
  periodEnd: string | null;
}
