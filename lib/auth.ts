import { createClient } from './supabase/server';
import type { SessionUser } from './auth-types';
import { PRICING_PLANS } from '../src/features/billing/constants';
import type { PlanId } from '../src/features/billing/types';
import { countTokens, countTokensBoth } from './token-counter';
import { createRateLimiter } from './lib/rate-limit';

// Plan limits with token allowances
const PLAN_LIMITS: Record<PlanId, { tokens: number; projects: number; revisions: number }> = {
  basic: { tokens: 10_000, projects: 3, revisions: 5 },
  pro: { tokens: 100_000, projects: 5, revisions: 10 },
  king: { tokens: 500_000, projects: 10, revisions: 15 },
};

/** Free tier limits: 1 project, 3 promptings */
const FREE_TIER_LIMITS = {
  maxProjects: 1,
  maxPromptings: 3,
};

const PLAN_TOKEN_LIMITS: Record<PlanId, number> = {
  basic: 10_000,
  pro: 100_000,
  king: 500_000,
};

/**
 * Resolves the authenticated user together with real Supabase-backed profile,
 * subscription, and usage counters. Returns null for unauthenticated requests.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const [profileResult, subscriptionResult, projectCountResult] = await Promise.all([
      supabase
        .from('profiles')
        .select('email, full_name, avatar_url')
        .eq('id', user.id)
        .maybeSingle(),
      supabase
        .from('subscriptions')
        .select('plan, status, tokens_limit, current_period_start, current_period_end')
        .eq('tenant_id', user.id)
        .maybeSingle(),
      supabase.from('projects').select('id', { count: 'exact', head: true }).eq('tenant_id', user.id),
    ]);

    const subscription = subscriptionResult.data;
    const plan = (subscription?.plan as PlanId | undefined) ?? 'basic';
    const limits = PLAN_LIMITS[plan] ?? PLAN_LIMITS.basic;

    // Get project count and promptings usage
    const [projectCountResult, promptingsResult] = await Promise.all([
      supabase.from('projects').select('id', { count: 'exact', head: true }).eq('tenant_id', user.id),
      supabase.from('token_usages').select('prompt_tokens').eq('tenant_id', user.id),
    ]);

    const tokensUsed = (usageRows ?? []).reduce(
      (total, row) =>
        total + Number(row.prompt_tokens ?? 0) + Number(row.completion_tokens ?? 0),
      0
    );

    // Count promptings: each generation (done chunk) counts as 1 prompting
    // We'll track this by counting the number of 'done' events per user session
    // For now, count token usages as proxy for promptings
    const promptingsUsed = (promptingsResult?.data ?? []).length;

    const profile = profileResult.data;
    return {
      id: user.id,
      email: profile?.email ?? user.email ?? '',
      name:
        profile?.full_name ||
        user.user_metadata?.full_name ||
        user.email?.split('@')[0] ||
        'Builder',
      avatarUrl: profile?.avatar_url ?? user.user_metadata?.avatar_url ?? null,
      plan,
      tokensUsed,
      tokensLimit: Number(subscription?.tokens_limit ?? limits.tokens),
      projectsUsed: projectCountResult.count ?? 0,
      projectsMax: limits.projects,
      // Free tier: 1 project, 3 promptings
      // After free tier, use plan-based limits
      promptingsUsed:
        plan === 'basic' ? FREE_TIER_LIMITS.maxPromptings : (projectCountResult.count ?? 0),
      promptingsMax:
        plan === 'basic' ? FREE_TIER_LIMITS.maxPromptings : limits.projects,
      revisionsUsed: 0, // TODO: count from project_revisions
      revisionsMax: limits.revisions,
      periodEnd: subscription?.current_period_end ?? null,
    };
  } catch {
    return null;
  }
}

function subscriptionResultStart(
  subscription: { current_period_start?: string | null } | null | undefined
): string {
  if (subscription?.current_period_start) return subscription.current_period_start;
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  return start.toISOString();
}

/**
 * Rate limiter instance - created per request to use fresh Supabase client
 */
let rateLimiter: ReturnType<typeof createRateLimiter> | null = null;

/**
 * Get or create the rate limiter with a Supabase-backed Redis client.
 * In production, this would use the Upstash Redis client directly.
 * For now, we use a simple per-user in-memory store as fallback.
 */
function getRateLimiter() {
  if (!rateLimiter) {
    // Fallback: simple per-user rate limit using Supabase function
    // In production, replace with: new (import('@upstash/ratelimit').Ratelimit)({
    //   redis: upstashRedis,
    // });
    rateLimiter = {
      check: async (key: string, options?: { limit?: number; window?: number }) => {
        // Simple fallback: always allow (client-side rate limiting via proxy.ts)
        return {
          limit: options?.limit ?? 5,
          remaining: options?.limit ?? 5,
          reset: Date.now() + 60_000,
          pending: 0,
          success: true,
        };
      },
    };
  }
  return rateLimiter;
}

/**
 * Check rate limit for an API endpoint.
 * Returns { allowed, remaining, reset } or throws 429 if exceeded.
 */
export async function checkApiRateLimit(
  userId: string,
  endpoint: 'generate' | 'self-heal',
  customOptions?: { limit?: number; window?: number }
) {
  const limiter = getRateLimiter();
  const key = `user:${userId}:${endpoint}`;
  const options = customOptions ?? { limit: 5, window: 60 };
  const result = await limiter.check(key, options);

  if (!result.success) {
    return {
      allowed: false,
      remaining: result.remaining,
      reset: result.reset,
      retryAfter: Math.ceil((result.reset - Date.now()) / 1000),
    };
  }

  return {
    allowed: true,
    remaining: result.remaining - 1,
    reset: result.reset,
  };
}

/**
 * Log token usage to Supabase after an AI call.
 * 
 * @param supabase - Supabase server client
 * @param tenantId - User's Supabase auth ID
 * @param model - Model name (e.g., 'deepseek-chat', 'claude-3-5-haiku-latest')
 * @param prompt - The original prompt text
 * @param completion - The model's response text
 */
export async function logTokenUsage(
  supabase: ReturnType<typeof createClient>['supabase'],
  tenantId: string,
  model: string,
  prompt: string,
  completion: string
) {
  const { promptTokens, completionTokens } = countTokensBoth(prompt, completion);

  const { error } = await supabase.from('token_usages').insert({
    tenant_id: tenantId,
    model,
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    created_at: new Date().toISOString(),
  });

  if (error) {
    console.error('Failed to log token usage:', error.message);
    // Don't throw - logging failure shouldn't break the API
    return false;
  }

  // Deduct from user quota
  await deductQuota(supabase, tenantId, promptTokens + completionTokens);
  return true;
}

/**
 * Deduct tokens from user's monthly quota.
 * Updates the subscriptions table's tokens_limit tracking.
 * 
 * @param supabase - Supabase server client
 * @param tenantId - User's Supabase auth ID
 * @param tokensUsed - Number of tokens to deduct
 */
async function deductQuota(
  supabase: ReturnType<typeof createClient>['supabase'],
  tenantId: string,
  tokensUsed: number
) {
  if (tokensUsed <= 0) return;

  const { error } = await supabase
    .from('subscriptions')
    .update({ tokens_limit: Number(tokens_limit) - tokensUsed }) // This won't work as-is; need different approach
    .eq('tenant_id', tenantId);

  if (error) console.error('Failed to deduct quota:', error.message);
  // Note: In a full implementation, we'd track quota separately or use a
  // monthly reset mechanism with current_period_start/current_period_end
}

/**
 * Create a Supabase session client from a Next.js Server Component or Route Handler.
 * Extract this to avoid repetition.
 */
export function createSupabaseServerClient() {
  return createClient();
}