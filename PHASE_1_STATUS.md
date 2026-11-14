PHASE 1 INITIALIZED

## What was done
1. **Next.js 16 app migration** — Vite/Express → Next.js App Router with `app/` directory, Server Components, Route Handlers, middleware/proxy.ts
2. **Supabase schema & migrations** — 2 migrations (`initial_schema.sql`, `views.sql`) with RLS on all tables: `tenant_id = auth.uid()`
3. **Auth clients** — `lib/supabase/client.ts` (browser), `lib/supabase/server.ts` (Server Components/Actions), `lib/supabase/middleware.ts` (session refresh), root `proxy.ts`
4. **Database objects** — `profiles` (extends `auth.users`), `subscriptions` (tokens_limit, plan, status), `projects` (with slug, custom_domain, domain_status), `project_files` (versioned), `project_revisions` (immutable snapshots), `project_messages` (conversation history), `token_usages` (metering), public read policies for published sites
5. **Row-level security** — enforced on all tables; every select/update/delete guarded by `tenant_id = auth.uid()`, plus public policies for published sites
6. **Auth flow wired** — `/login` and `/register` use `supabase.auth.signInWithPassword` / `signUp`; `on_auth_user_created` trigger auto-creates profile + basic subscription (10k tokens)
7. **ProjectStore migrated** — `lib/projects/repository.ts` queries Supabase Postgres instead of `.data/workspaces.json`; CRUD: list/create/get/update/branch/duplicate/delete + revision/rollback/label
8. **Mock data eradicated** — `MOCK_USER`, `MOCK_QUOTA` removed from all UI; real Supabase-backed `useAuth()` context; billing page, sidebar, topbar, settings all read from Supabase
9. **Transition smoothing** — `RouteTransition` with Framer Motion `AnimatePresence` in `app/layout.tsx`; `loading.tsx` in `(dashboard)` with skeleton screens; protected routes with proxy redirects
10. **Verification**: `next build` passes; dev server runs; `/api/health` OK; `/login` loads; `/projects` redirects unauthenticated to `/login?next=/projects`; smooth fade transitions via motion.

## Verification Gate 1 status
- [x] Can register a real account via Supabase
- [x] Can log in; refresh page → still logged in (middleware refreshes session)
- [x] Create a project → data persists in Supabase (checked Supabase dashboard)
- [x] Accessing `/projects` without login redirects to `/login`
- [x] Transition from `/` (landing) to `/login` and to `/projects` is smooth (no white flashes; motion AnimatePresence fades)

## Next steps (Phase 2)
- Upstash Redis + rate-limit.ts (5 gen requests/min per user)
- Token metering → `token_usages` table + quota deduction
- `/api/generate` and `/api/projects/:id/self-heal` rate limiting
- 429 on spam