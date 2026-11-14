-- urself.online production schema
-- Every tenant-owned table carries tenant_id and is protected by RLS (tenant_id = auth.uid()).

create extension if not exists "pgcrypto";

do $$
begin
  if not exists (select 1 from pg_type where typname = 'project_status') then
    create type public.project_status as enum ('draft', 'generating', 'ready', 'failed');
  end if;
  if not exists (select 1 from pg_type where typname = 'plan_id') then
    create type public.plan_id as enum ('basic', 'pro', 'king');
  end if;
  if not exists (select 1 from pg_type where typname = 'revision_source') then
    create type public.revision_source as enum ('seed', 'manual', 'ai-generation', 'rollback', 'branch');
  end if;
  if not exists (select 1 from pg_type where typname = 'domain_status') then
    create type public.domain_status as enum ('unverified', 'pending', 'active', 'error');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- profiles: public mirror of auth.users
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- subscriptions: one row per tenant
-- ---------------------------------------------------------------------------
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null unique references auth.users (id) on delete cascade,
  plan public.plan_id not null default 'basic',
  status text not null default 'active' check (status in ('active', 'past_due', 'canceled', 'expired')),
  tokens_limit bigint not null default 10000,
  current_period_start timestamptz not null default now(),
  current_period_end timestamptz not null default (now() + interval '1 month'),
  midtrans_order_id text,
  midtrans_transaction_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- projects
-- ---------------------------------------------------------------------------
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  framework text not null default 'react-vite',
  status public.project_status not null default 'draft',
  thumbnail_color text,
  initial_prompt text,
  branched_from_id uuid references public.projects (id) on delete set null,
  branched_from_name text,
  prompt_state jsonb not null default '{}'::jsonb,
  slug text unique,
  published_at timestamptz,
  custom_domain text unique,
  domain_status public.domain_status not null default 'unverified',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists projects_tenant_updated_idx
  on public.projects (tenant_id, updated_at desc);

-- ---------------------------------------------------------------------------
-- project_files: every file is versioned. Latest version per path wins.
-- ---------------------------------------------------------------------------
create table if not exists public.project_files (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  path text not null,
  content text not null,
  version integer not null check (version > 0),
  created_at timestamptz not null default now(),
  unique (project_id, path, version)
);

create index if not exists project_files_project_path_idx
  on public.project_files (project_id, path, version desc);

-- ---------------------------------------------------------------------------
-- project_revisions: immutable JSON snapshots for history / rollback
-- ---------------------------------------------------------------------------
create table if not exists public.project_revisions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  version integer not null check (version > 0),
  label text not null,
  summary text not null,
  source public.revision_source not null default 'manual',
  agent text,
  prompt text,
  files jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (project_id, version)
);

create index if not exists project_revisions_project_version_idx
  on public.project_revisions (project_id, version desc);

-- ---------------------------------------------------------------------------
-- project_messages: builder conversation history
-- ---------------------------------------------------------------------------
create table if not exists public.project_messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  summary text,
  diff_lines jsonb,
  created_at timestamptz not null default now()
);

create index if not exists project_messages_project_created_idx
  on public.project_messages (project_id, created_at asc);

-- ---------------------------------------------------------------------------
-- token_usages: metering for AI calls (used from Phase 2 onward)
-- ---------------------------------------------------------------------------
create table if not exists public.token_usages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid references public.projects (id) on delete set null,
  model text not null,
  prompt_tokens integer not null default 0 check (prompt_tokens >= 0),
  completion_tokens integer not null default 0 check (completion_tokens >= 0),
  created_at timestamptz not null default now()
);

create index if not exists token_usages_tenant_created_idx
  on public.token_usages (tenant_id, created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists subscriptions_touch_updated_at on public.subscriptions;
create trigger subscriptions_touch_updated_at
  before update on public.subscriptions
  for each row execute function public.touch_updated_at();

drop trigger if exists projects_touch_updated_at on public.projects;
create trigger projects_touch_updated_at
  before update on public.projects
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- New auth user -> profile + basic subscription
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;

  insert into public.subscriptions (tenant_id, plan, status, tokens_limit)
  values (new.id, 'basic', 'active', 10000)
  on conflict (tenant_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.subscriptions enable row level security;
alter table public.projects enable row level security;
alter table public.project_files enable row level security;
alter table public.project_revisions enable row level security;
alter table public.project_messages enable row level security;
alter table public.token_usages enable row level security;

-- profiles
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- subscriptions (read-only for the tenant; webhook writes use the service role)
drop policy if exists "subscriptions_select_own" on public.subscriptions;
create policy "subscriptions_select_own" on public.subscriptions
  for select using (tenant_id = auth.uid());

-- projects
drop policy if exists "projects_select_own" on public.projects;
create policy "projects_select_own" on public.projects
  for select using (tenant_id = auth.uid());

drop policy if exists "projects_insert_own" on public.projects;
create policy "projects_insert_own" on public.projects
  for insert with check (tenant_id = auth.uid());

drop policy if exists "projects_update_own" on public.projects;
create policy "projects_update_own" on public.projects
  for update using (tenant_id = auth.uid()) with check (tenant_id = auth.uid());

drop policy if exists "projects_delete_own" on public.projects;
create policy "projects_delete_own" on public.projects
  for delete using (tenant_id = auth.uid());

-- project_files
drop policy if exists "project_files_select_own" on public.project_files;
create policy "project_files_select_own" on public.project_files
  for select using (tenant_id = auth.uid());

drop policy if exists "project_files_insert_own" on public.project_files;
create policy "project_files_insert_own" on public.project_files
  for insert with check (tenant_id = auth.uid());

drop policy if exists "project_files_update_own" on public.project_files;
create policy "project_files_update_own" on public.project_files
  for update using (tenant_id = auth.uid()) with check (tenant_id = auth.uid());

drop policy if exists "project_files_delete_own" on public.project_files;
create policy "project_files_delete_own" on public.project_files
  for delete using (tenant_id = auth.uid());

-- project_revisions
drop policy if exists "project_revisions_select_own" on public.project_revisions;
create policy "project_revisions_select_own" on public.project_revisions
  for select using (tenant_id = auth.uid());

drop policy if exists "project_revisions_insert_own" on public.project_revisions;
create policy "project_revisions_insert_own" on public.project_revisions
  for insert with check (tenant_id = auth.uid());

drop policy if exists "project_revisions_update_own" on public.project_revisions;
create policy "project_revisions_update_own" on public.project_revisions
  for update using (tenant_id = auth.uid()) with check (tenant_id = auth.uid());

drop policy if exists "project_revisions_delete_own" on public.project_revisions;
create policy "project_revisions_delete_own" on public.project_revisions
  for delete using (tenant_id = auth.uid());

-- project_messages
drop policy if exists "project_messages_select_own" on public.project_messages;
create policy "project_messages_select_own" on public.project_messages
  for select using (tenant_id = auth.uid());

drop policy if exists "project_messages_insert_own" on public.project_messages;
create policy "project_messages_insert_own" on public.project_messages
  for insert with check (tenant_id = auth.uid());

drop policy if exists "project_messages_delete_own" on public.project_messages;
create policy "project_messages_delete_own" on public.project_messages
  for delete using (tenant_id = auth.uid());

-- token_usages
drop policy if exists "token_usages_select_own" on public.token_usages;
create policy "token_usages_select_own" on public.token_usages
  for select using (tenant_id = auth.uid());

drop policy if exists "token_usages_insert_own" on public.token_usages;
create policy "token_usages_insert_own" on public.token_usages
  for insert with check (tenant_id = auth.uid());

-- Public read access for published sites (no auth required)
drop policy if exists "projects_public_published" on public.projects;
create policy "projects_public_published" on public.projects
  for select to anon using (published_at is not null and slug is not null);

drop policy if exists "project_files_public_published" on public.project_files;
create policy "project_files_public_published" on public.project_files
  for select to anon using (
    exists (
      select 1 from public.projects p
      where p.id = project_files.project_id
        and p.published_at is not null
        and p.slug is not null
    )
  );
