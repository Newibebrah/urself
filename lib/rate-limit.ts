import type { Redis } from '@upstash/redis';
import type { RateLimitOptions, RateLimitReturn } from '@upstash/ratelimit';

// Rate limit configuration
const DEFAULT_LIMIT = 5;      // max requests
const DEFAULT_WINDOW = 60;    // per minute (seconds)

// Extend the standard RateLimitReturn with our custom fields
export interface RatelimitResult extends RateLimitReturn {
  remaining: number;
  reset: number;
}

/**
 * Creates a rate limiter scoped to a user.
 * 
 * @param redis - Upstash Redis client
 * @param identifier - Unique identifier (usually user_id or IP)
 * @param options - Rate limit config (limit, window in seconds)
 * @returns Rate limit check result
 */
export function createRateLimiter(redis: Redis) {
  const ratelimit = new (await import('@upstash/ratelimit')).Ratelimit({
    redis: redis as Redis,
    /** 
     * If you would like to have an "ignore" list for certain users, define it here 
     * e.g. const ignoreList = ['user_1', 'user_2'];
     * The request will succeed if the user is in the ignore list.
     * NOTE: This is not compatible with the Ratelimit bypass feature.
    */
    // enableAbility: false,
  });

  return async function checkRateLimit(
    key: string,
    options?: { limit?: number; window?: number }
  ): Promise<RatelimitResult> {
    const limit = options?.limit ?? DEFAULT_LIMIT;
    const window = options?.window ?? DEFAULT_WINDOW;
    
    const { limit: lim, remaining, reset, pending } = await ratelimit.limit(key, {
      limit: lim,
      window,
    });

    return {
      limit: lim,
      remaining,
      reset,
      pending,
      success: pending === 0,
    };
  };
}

export type { RateLimitOptions, RateLimitReturn };