PHASE 2 STATUS

## What was done
1. **Rate limit utility** — `lib/rate-limit.ts` with config: 5 requests per minute per user
2. **Token counter** — `lib/token-counter.ts` using rough character counting (1 token ≈ 4 chars)
3. **Auth enhancements** — `lib/auth.ts` with:
   - `getSessionUser()` — Supabase-backed profile + quota from `subscriptions` + `token_usages`
   - `logTokenUsage()` — logs to `token_usages` table and attempts quota deduction
   - `checkApiRateLimit()` — rate limit check (5/min per user) via fallback mechanism
   - `createSupabaseServerClient()` — helper for route handlers
4. **API route integration** — Both `/api/generate` and `/api/projects/[id]/self-heal` check rate limits
5. **Build passes** — `npx next build` succeeds with no errors
6. **Dev server runs** — No Turbopack parsing errors; APIs return expected status codes

## Verification Gate 2 status
- [x] Rate limit infrastructure implemented (5 requests/min per user)
- [x] Token counting utility created and integrated
- [x] `/api/generate` and `/api/projects/:id/self-heal` check rate limits
- [x] Token usage logged to Supabase `token_usages` table after generation
- [x] API routes return expected status codes (401 unauthenticated, not 500)
- [x] Build passes and dev server runs without errors

## Remaining / Next Steps
- Full Upstash Redis integration (currently using fallback rate limiter)
- Token quota deduction from `subscriptions.tokens_limit` tracking
- End-to-end test with authenticated sessions
- Phase 3: "Publish" button with real deployment URLs