-- Kosha — Supabase Schema (Phase 2)
-- Run this once in: Supabase Dashboard → SQL Editor → New query → Run
-- This script is idempotent for repeated setup runs.
-- ─────────────────────────────────────────────────────────────────────────────

create extension if not exists pgcrypto;

-- Profiles table
create table if not exists profiles (
  id             uuid primary key,
  display_name   text,
  monthly_income numeric default 0,
  onboarded      boolean not null default false,
  created_at     timestamptz not null default now(),
  avatar_url     text
);

-- Transactions table
create table if not exists transactions (
  id                 uuid primary key default gen_random_uuid(),
  date               date not null,
  type               text not null check (type in ('income', 'expense', 'investment')),
  description        text not null,
  amount             numeric(12,2) not null check (amount > 0),
  category           text not null default 'other',
  investment_vehicle text,
  is_repayment       boolean not null default false,
  payment_mode       text default 'upi'
                       check (payment_mode in ('upi', 'credit_card', 'debit_card',
                                               'cash', 'net_banking', 'other')),
  notes              text,
  created_at         timestamptz not null default now(),
  user_id            uuid
);

-- Liabilities (bills & dues) table
create table if not exists liabilities (
  id                     uuid primary key default gen_random_uuid(),
  description            text not null,
  amount                 numeric(12,2) not null check (amount > 0),
  due_date               date not null,
  is_recurring           boolean not null default false,
  recurrence             text check (recurrence in ('monthly', 'quarterly', 'yearly')),
  paid                   boolean not null default false,
  linked_transaction_id  uuid references transactions(id) on delete set null,
  created_at             timestamptz not null default now(),
  user_id                uuid
);

-- Invite links table
create table if not exists invites (
  id         uuid primary key default gen_random_uuid(),
  token      text not null unique default encode(gen_random_bytes(12), 'hex'),
  created_by uuid not null,
  used_by    uuid,
  used_at    timestamptz,
  created_at timestamptz not null default now()
);

-- Phase 1 to Phase 2 compatibility: add user_id if tables already exist
alter table transactions add column if not exists user_id uuid;
alter table liabilities add column if not exists user_id uuid;

-- Enable Supabase Realtime for transactions table so cross-device sync works instantly
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'transactions'
  ) then
    alter publication supabase_realtime add table transactions;
  end if;
exception
  when undefined_object then null;
end $$;

-- Enable Supabase Realtime for liabilities table so bills sync cross-device
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'liabilities'
  ) then
    alter publication supabase_realtime add table liabilities;
  end if;
exception
  when undefined_object then null;
end $$;

-- Foreign keys against Supabase auth users
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_id_fkey'
      and conrelid = 'profiles'::regclass
  ) then
    alter table profiles
      add constraint profiles_id_fkey
      foreign key (id) references auth.users(id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'transactions_user_id_fkey'
      and conrelid = 'transactions'::regclass
  ) then
    alter table transactions
      add constraint transactions_user_id_fkey
      foreign key (user_id) references auth.users(id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'liabilities_user_id_fkey'
      and conrelid = 'liabilities'::regclass
  ) then
    alter table liabilities
      add constraint liabilities_user_id_fkey
      foreign key (user_id) references auth.users(id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'invites_created_by_fkey'
      and conrelid = 'invites'::regclass
  ) then
    alter table invites
      add constraint invites_created_by_fkey
      foreign key (created_by) references auth.users(id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'invites_used_by_fkey'
      and conrelid = 'invites'::regclass
  ) then
    alter table invites
      add constraint invites_used_by_fkey
      foreign key (used_by) references auth.users(id);
  end if;
end $$;

-- Indexes for common queries
create index if not exists idx_txn_date     on transactions(date desc);
create index if not exists idx_txn_type     on transactions(type);
create index if not exists idx_txn_category on transactions(category);
create index if not exists idx_txn_user     on transactions(user_id);

create index if not exists idx_liab_due     on liabilities(due_date);
create index if not exists idx_liab_paid    on liabilities(paid);
create index if not exists idx_liab_user    on liabilities(user_id);

create index if not exists idx_invite_token on invites(token);

-- Row Level Security (RLS)
alter table profiles     enable row level security;
alter table transactions enable row level security;
alter table liabilities  enable row level security;
alter table invites      enable row level security;

-- Profiles policies
drop policy if exists "profiles: select own" on profiles;
create policy "profiles: select own" on profiles
for select to public
using (auth.uid() = id);

drop policy if exists "profiles: insert own" on profiles;
create policy "profiles: insert own" on profiles
for insert to public
with check (auth.uid() = id);

drop policy if exists "profiles: update own" on profiles;
create policy "profiles: update own" on profiles
for update to public
using (auth.uid() = id);

-- Transactions policies
drop policy if exists "transactions: select own" on transactions;
create policy "transactions: select own" on transactions
for select to public
using (auth.uid() = user_id);

drop policy if exists "transactions: insert own" on transactions;
create policy "transactions: insert own" on transactions
for insert to public
with check (auth.uid() = user_id);

drop policy if exists "transactions: update own" on transactions;
create policy "transactions: update own" on transactions
for update to public
using (auth.uid() = user_id);

drop policy if exists "transactions: delete own" on transactions;
create policy "transactions: delete own" on transactions
for delete to public
using (auth.uid() = user_id);

-- Liabilities policies
drop policy if exists "liabilities: select own" on liabilities;
create policy "liabilities: select own" on liabilities
for select to public
using (auth.uid() = user_id);

drop policy if exists "liabilities: insert own" on liabilities;
create policy "liabilities: insert own" on liabilities
for insert to public
with check (auth.uid() = user_id);

drop policy if exists "liabilities: update own" on liabilities;
create policy "liabilities: update own" on liabilities
for update to public
using (auth.uid() = user_id);

drop policy if exists "liabilities: delete own" on liabilities;
create policy "liabilities: delete own" on liabilities
for delete to public
using (auth.uid() = user_id);

-- Invites policies
drop policy if exists "invites: select for validation" on invites;
create policy "invites: select for validation" on invites
for select to public
using (auth.role() = 'authenticated'::text);

drop policy if exists "invites: insert own" on invites;
create policy "invites: insert own" on invites
for insert to public
with check (auth.uid() = created_by);

drop policy if exists "invites: update to consume" on invites;
create policy "invites: update to consume" on invites
for update to public
using (
  (auth.uid() = created_by)
  or (used_by is null)
)
with check (
  (auth.uid() = created_by)
  or (
    used_by = auth.uid()
    and used_at is not null
  )
);

-- Create profile row automatically when a new auth user is inserted
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'on_auth_user_created'
      and tgrelid = 'auth.users'::regclass
      and not tgisinternal
  ) then
    create trigger on_auth_user_created
      after insert on auth.users
      for each row execute function public.handle_new_user();
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 2 summary
-- - Multi-user auth-backed data model
-- - RLS enabled on profiles, transactions, liabilities, invites
-- - Invite link support via token-based onboarding
-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.liabilities ENABLE ROW LEVEL SECURITY;

-- 2. Profiles Policies
CREATE POLICY "Users can view own profile" 
ON public.profiles FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" 
ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile" 
ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- 3. Transactions Policies
CREATE POLICY "Users can fully manage own transactions" 
ON public.transactions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 4. Liabilities (Bills) Policies
CREATE POLICY "Users can fully manage own liabilities" 
ON public.liabilities FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 1: Bug reports
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.bug_reports (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete set null,
  title        text not null check (char_length(title) <= 160),
  description  text not null,
  steps        text,
  severity     text not null default 'medium' check (severity in ('low', 'medium', 'high')),
  route        text,
  app_version  text,
  diagnostics  jsonb,
  status       text not null default 'open' check (status in ('open', 'triaged', 'resolved')),
  created_at   timestamptz not null default now()
);

create index if not exists idx_bug_reports_created_at on public.bug_reports(created_at desc);
create index if not exists idx_bug_reports_user on public.bug_reports(user_id);
create index if not exists idx_bug_reports_status on public.bug_reports(status);

alter table public.bug_reports enable row level security;

drop policy if exists "bug_reports: insert own" on public.bug_reports;
create policy "bug_reports: insert own" on public.bug_reports
for insert to public
with check (auth.uid() = user_id);

drop policy if exists "bug_reports: select own" on public.bug_reports;
create policy "bug_reports: select own" on public.bug_reports
for select to public
using (auth.uid() = user_id);

drop policy if exists "bug_reports: update own" on public.bug_reports;
create policy "bug_reports: update own" on public.bug_reports
for update to public
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 2: Bug reporting triage, screenshots, and duplicate handling
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.bug_reports
  add column if not exists priority text not null default 'p2',
  add column if not exists tags text[] not null default '{}'::text[],
  add column if not exists assignee text,
  add column if not exists duplicate_of uuid references public.bug_reports(id) on delete set null,
  add column if not exists fingerprint text,
  add column if not exists occurrence_count integer not null default 1,
  add column if not exists reporter_email text,
  add column if not exists screenshot_path text,
  add column if not exists environment jsonb,
  add column if not exists last_reported_at timestamptz,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists triaged_at timestamptz,
  add column if not exists resolved_at timestamptz,
  add column if not exists release_version text,
  add column if not exists notified_at timestamptz;

update public.bug_reports
set priority = case severity
  when 'high' then 'p1'
  when 'medium' then 'p2'
  else 'p3'
end
where priority is null;

alter table public.bug_reports drop constraint if exists bug_reports_priority_check;
alter table public.bug_reports
  add constraint bug_reports_priority_check
  check (priority in ('p0', 'p1', 'p2', 'p3'));

alter table public.bug_reports drop constraint if exists bug_reports_status_check;
alter table public.bug_reports
  add constraint bug_reports_status_check
  check (status in ('open', 'triaged', 'in_progress', 'fixed', 'released', 'resolved'));

create index if not exists idx_bug_reports_priority on public.bug_reports(priority);
create index if not exists idx_bug_reports_last_reported on public.bug_reports(last_reported_at desc);
create index if not exists idx_bug_reports_fingerprint_route on public.bug_reports(fingerprint, route);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'bug-reports',
  'bug-reports',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

drop policy if exists "bug_reports_storage: upload own" on storage.objects;
create policy "bug_reports_storage: upload own" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'bug-reports'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "bug_reports_storage: read own" on storage.objects;
create policy "bug_reports_storage: read own" on storage.objects
for select to authenticated
using (
  bucket_id = 'bug-reports'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "bug_reports_storage: delete own" on storage.objects;
create policy "bug_reports_storage: delete own" on storage.objects
for delete to authenticated
using (
  bucket_id = 'bug-reports'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create or replace function public.submit_bug_report(
  p_title text,
  p_description text,
  p_steps text default null,
  p_severity text default 'medium',
  p_route text default null,
  p_app_version text default null,
  p_diagnostics jsonb default null,
  p_environment jsonb default null,
  p_screenshot_path text default null,
  p_reporter_email text default null,
  p_fingerprint text default null,
  p_tags text[] default null
)
returns table(report_id uuid, is_duplicate boolean, occurrence_count integer)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_existing_id uuid;
  v_existing_occ integer;
  v_priority text;
  v_recent_count integer;
  v_tags text[] := coalesce(p_tags, '{}'::text[]);
begin
  if v_uid is null then
    raise exception 'You must be signed in to submit bug reports.';
  end if;

  if p_title is null or btrim(p_title) = '' then
    raise exception 'Bug title is required.';
  end if;

  if p_description is null or btrim(p_description) = '' then
    raise exception 'Bug description is required.';
  end if;

  if p_severity not in ('low', 'medium', 'high') then
    p_severity := 'medium';
  end if;

  select count(*) into v_recent_count
  from public.bug_reports
  where user_id = v_uid
    and created_at > now() - interval '2 minutes';

  if v_recent_count >= 5 then
    raise exception 'Too many reports in a short time. Please wait a moment and try again.';
  end if;

  if p_severity = 'high' then
    v_priority := 'p1';
  elsif p_severity = 'medium' then
    v_priority := 'p2';
  else
    v_priority := 'p3';
  end if;

  select id, occurrence_count
    into v_existing_id, v_existing_occ
  from public.bug_reports
  where user_id = v_uid
    and coalesce(fingerprint, '') = coalesce(p_fingerprint, '')
    and coalesce(route, '') = coalesce(p_route, '')
    and created_at > now() - interval '7 days'
  order by created_at desc
  limit 1;

  if v_existing_id is not null and coalesce(p_fingerprint, '') <> '' then
    update public.bug_reports
    set
      occurrence_count = coalesce(occurrence_count, 1) + 1,
      last_reported_at = now(),
      updated_at = now(),
      steps = coalesce(nullif(btrim(coalesce(p_steps, '')), ''), steps),
      diagnostics = coalesce(p_diagnostics, diagnostics),
      environment = coalesce(p_environment, environment),
      reporter_email = coalesce(nullif(btrim(coalesce(p_reporter_email, '')), ''), reporter_email),
      screenshot_path = coalesce(nullif(p_screenshot_path, ''), screenshot_path),
      tags = case
        when array_length(v_tags, 1) is null then tags
        else (
          select array_agg(distinct t)
          from unnest(coalesce(tags, '{}'::text[]) || v_tags) as t
        )
      end
    where id = v_existing_id and user_id = v_uid;

    return query
      select v_existing_id, true, coalesce(v_existing_occ, 1) + 1;
    return;
  end if;

  insert into public.bug_reports (
    user_id,
    title,
    description,
    steps,
    severity,
    priority,
    route,
    app_version,
    diagnostics,
    environment,
    screenshot_path,
    reporter_email,
    fingerprint,
    tags,
    occurrence_count,
    last_reported_at,
    updated_at
  ) values (
    v_uid,
    btrim(p_title),
    btrim(p_description),
    nullif(btrim(coalesce(p_steps, '')), ''),
    p_severity,
    v_priority,
    nullif(p_route, ''),
    nullif(p_app_version, ''),
    p_diagnostics,
    p_environment,
    nullif(p_screenshot_path, ''),
    nullif(btrim(coalesce(p_reporter_email, '')), ''),
    nullif(p_fingerprint, ''),
    v_tags,
    1,
    now(),
    now()
  ) returning id into v_existing_id;

  return query
    select v_existing_id, false, 1;
end;
$$;
