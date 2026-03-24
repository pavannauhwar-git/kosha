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
  is_recurring       boolean not null default false,
  recurrence         text check (recurrence in ('monthly', 'quarterly', 'yearly')),
  next_run_date      date,
  source_transaction_id uuid references transactions(id) on delete set null,
  is_auto_generated  boolean not null default false,
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
alter table transactions add column if not exists is_recurring boolean not null default false;
alter table transactions add column if not exists recurrence text;
alter table transactions add column if not exists next_run_date date;
alter table transactions add column if not exists source_transaction_id uuid references transactions(id) on delete set null;
alter table transactions add column if not exists is_auto_generated boolean not null default false;

alter table transactions drop constraint if exists transactions_recurrence_check;
alter table transactions
  add constraint transactions_recurrence_check
  check (recurrence in ('monthly', 'quarterly', 'yearly') or recurrence is null);
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
create index if not exists idx_txn_recurring_due on transactions(user_id, next_run_date)
  where is_recurring = true;

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

-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 002: Performance RPCs
-- Run in: Supabase Dashboard → SQL Editor → New query → Run
--
-- WHAT THIS FIXES:
--   1. get_running_balance  — replaces full table scan with server-side SUM()
--   2. get_month_summary    — replaces raw row fetch + JS aggregation
--   3. get_year_summary     — replaces raw row fetch + JS aggregation
--   4. mark_liability_paid  — makes 3-step bill payment atomic (data safety fix)
-- ─────────────────────────────────────────────────────────────────────────────


-- ── 1. get_running_balance ───────────────────────────────────────────────────
-- Previously: fetched ALL income rows and ALL expense+investment rows ever
--             recorded, returning thousands of `amount` values to the client
--             just to sum them in JavaScript.
-- Now: single query, server-side SUM, returns one row with one number.

create or replace function public.get_running_balance(
  p_user_id uuid,
  p_end_date date
)
returns numeric
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(
    sum(case when type = 'income' then amount else -amount end),
    0
  )
  from transactions
  where user_id  = p_user_id
    and date    <= p_end_date
$$;


-- ── 1b. generate_recurring_transactions ────────────────────────────────────
-- Materializes due recurring transactions and advances next_run_date.

create or replace function public.generate_recurring_transactions(
  p_user_id uuid,
  p_today   date default current_date
)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_inserted integer := 0;
  v_run_date date;
  rec record;
begin
  if v_uid is null then
    raise exception 'Authentication required.';
  end if;

  if v_uid <> p_user_id then
    raise exception 'Cannot generate recurring transactions for another user.';
  end if;

  for rec in
    select *
    from public.transactions
    where user_id = p_user_id
      and is_recurring = true
      and recurrence is not null
      and coalesce(next_run_date, date) <= p_today
    order by coalesce(next_run_date, date) asc
  loop
    v_run_date := coalesce(rec.next_run_date, rec.date);

    while v_run_date <= p_today loop
      insert into public.transactions (
        date,
        type,
        description,
        amount,
        category,
        investment_vehicle,
        is_repayment,
        payment_mode,
        notes,
        is_recurring,
        recurrence,
        next_run_date,
        source_transaction_id,
        is_auto_generated,
        user_id
      )
      values (
        v_run_date,
        rec.type,
        rec.description,
        rec.amount,
        rec.category,
        rec.investment_vehicle,
        rec.is_repayment,
        rec.payment_mode,
        rec.notes,
        false,
        null,
        null,
        rec.id,
        true,
        rec.user_id
      );

      v_inserted := v_inserted + 1;

      v_run_date := case rec.recurrence
        when 'monthly'   then (v_run_date + interval '1 month')::date
        when 'quarterly' then (v_run_date + interval '3 months')::date
        when 'yearly'    then (v_run_date + interval '1 year')::date
        else null
      end;

      if v_run_date is null then
        exit;
      end if;
    end loop;

    update public.transactions
    set
      next_run_date = v_run_date
    where id = rec.id
      and user_id = p_user_id;
  end loop;

  return v_inserted;
end;
$$;


-- ── 2. get_month_summary ─────────────────────────────────────────────────────
-- Previously: fetched every raw transaction row for the month (~50–300 rows),
--             then ran a JavaScript for-loop to sum by type/category/vehicle.
-- Now: GROUP BY on the server, returns ~5–30 pre-aggregated rows.


-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 003: Financial audit event log
-- Immutable event records for transaction/liability mutations.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.financial_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  action      text not null,
  entity_type text not null check (entity_type in ('transaction', 'liability')),
  entity_id   uuid not null,
  metadata    jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists idx_financial_events_user_created
  on public.financial_events(user_id, created_at desc);

create index if not exists idx_financial_events_entity
  on public.financial_events(entity_type, entity_id, created_at desc);

alter table public.financial_events enable row level security;

drop policy if exists "financial_events: select own" on public.financial_events;
create policy "financial_events: select own" on public.financial_events
for select to public
using (auth.uid() = user_id);

drop policy if exists "financial_events: insert own" on public.financial_events;
create policy "financial_events: insert own" on public.financial_events
for insert to public
with check (auth.uid() = user_id);

drop policy if exists "financial_events: update none" on public.financial_events;
create policy "financial_events: update none" on public.financial_events
for update to public
using (false)
with check (false);

drop policy if exists "financial_events: delete none" on public.financial_events;
create policy "financial_events: delete none" on public.financial_events
for delete to public
using (false);
--
-- Returns one row per (type, is_repayment, category, investment_vehicle) group.
-- The JS hook aggregates these ~5–30 rows instead of ~50–300 raw rows.

create or replace function public.get_month_summary(
  p_user_id uuid,
  p_year    int,
  p_month   int
)
returns table (
  type               text,
  is_repayment       boolean,
  category           text,
  investment_vehicle text,
  total              numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    type,
    is_repayment,
    coalesce(category, 'other')           as category,
    coalesce(investment_vehicle, 'Other') as investment_vehicle,
    sum(amount)                           as total
  from transactions
  where user_id = p_user_id
    and date   >= make_date(p_year, p_month, 1)
    and date   <= (make_date(p_year, p_month, 1) + interval '1 month - 1 day')::date
  group by type, is_repayment, category, investment_vehicle
$$;


-- ── 3. get_year_summary ──────────────────────────────────────────────────────
-- Previously: fetched ALL transactions for the year (~100–1000+ rows) and
--             computed monthly buckets + category/vehicle totals in JavaScript.
-- Now: two queries returned as JSON arrays, fully aggregated on the server.
--
-- Returns a single row with:
--   monthly_data  — 12-entry JSON array [{month, income, expense, investment}]
--   category_data — JSON object {category: total}
--   vehicle_data  — JSON object {vehicle: total}
--   totals        — JSON object {income, repayments, expense, investment}
--   top5_expenses — JSON array of top 5 expense transactions

create or replace function public.get_year_summary(
  p_user_id uuid,
  p_year    int
)
returns table (
  monthly_data  json,
  category_data json,
  vehicle_data  json,
  totals        json,
  top5_expenses json
)
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_monthly  json;
  v_category json;
  v_vehicle  json;
  v_totals   json;
  v_top5     json;
begin
  -- Monthly income / expense / investment buckets
  select json_agg(row_to_json(m) order by m.month_num)
  into v_monthly
  from (
    select
      extract(month from date)::int                                   as month_num,
      sum(case when type = 'income' and not is_repayment then amount else 0 end) as income,
      sum(case when type = 'expense'    then amount else 0 end)       as expense,
      sum(case when type = 'investment' then amount else 0 end)       as investment
    from transactions
    where user_id = p_user_id
      and date between make_date(p_year, 1, 1) and make_date(p_year, 12, 31)
    group by extract(month from date)
  ) m;

  -- Category totals (expenses only)
  select json_object_agg(category, cat_total)
  into v_category
  from (
    select coalesce(category, 'other') as category, sum(amount) as cat_total
    from transactions
    where user_id = p_user_id
      and type    = 'expense'
      and date between make_date(p_year, 1, 1) and make_date(p_year, 12, 31)
    group by category
  ) c;

  -- Investment vehicle totals
  select json_object_agg(vehicle, veh_total)
  into v_vehicle
  from (
    select coalesce(investment_vehicle, 'Other') as vehicle, sum(amount) as veh_total
    from transactions
    where user_id = p_user_id
      and type    = 'investment'
      and date between make_date(p_year, 1, 1) and make_date(p_year, 12, 31)
    group by investment_vehicle
  ) v;

  -- Grand totals
  select json_build_object(
    'income',      coalesce(sum(case when type = 'income' and not is_repayment then amount end), 0),
    'repayments',  coalesce(sum(case when type = 'income' and is_repayment     then amount end), 0),
    'expense',     coalesce(sum(case when type = 'expense'    then amount end), 0),
    'investment',  coalesce(sum(case when type = 'investment' then amount end), 0),
    'count',       count(*)
  )
  into v_totals
  from transactions
  where user_id = p_user_id
    and date between make_date(p_year, 1, 1) and make_date(p_year, 12, 31);

  -- Top 5 expenses
  select json_agg(row_to_json(e))
  into v_top5
  from (
    select id, date, type, amount, description, category
    from transactions
    where user_id = p_user_id
      and type    = 'expense'
      and date between make_date(p_year, 1, 1) and make_date(p_year, 12, 31)
    order by amount desc
    limit 5
  ) e;

  return query select v_monthly, v_category, v_vehicle, v_totals, v_top5;
end;
$$;


-- ── 4. mark_liability_paid ───────────────────────────────────────────────────
-- Previously: 3 sequential client-side DB calls with no atomicity.
--             If call 2 or 3 failed after call 1 succeeded, an expense
--             transaction was created without the liability being marked paid.
-- Now: single atomic transaction — all 3 operations succeed or all roll back.

create or replace function public.mark_liability_paid(
  p_liability_id uuid,
  p_user_id      uuid
)
returns json
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_liability  liabilities%rowtype;
  v_txn_id     uuid;
  v_next_due   date;
begin
  -- Lock and fetch the liability row
  select * into v_liability
  from liabilities
  where id = p_liability_id and user_id = p_user_id
  for update;

  if not found then
    raise exception 'Liability not found or access denied';
  end if;

  if v_liability.paid then
    raise exception 'Liability is already marked paid';
  end if;

  -- Step 1: Insert the linked expense transaction
  insert into transactions (
    date, type, description, amount, category,
    is_repayment, payment_mode, notes, user_id
  ) values (
    current_date,
    'expense',
    v_liability.description,
    v_liability.amount,
    'bills',
    false,
    'other',
    'Auto-created from bill: ' || v_liability.description,
    p_user_id
  )
  returning id into v_txn_id;

  -- Step 2: Mark the liability as paid
  update liabilities
  set paid                  = true,
      linked_transaction_id = v_txn_id
  where id = p_liability_id;

  -- Step 3: If recurring, insert the next period
  if v_liability.is_recurring and v_liability.recurrence is not null then
    v_next_due := case v_liability.recurrence
      when 'monthly'   then v_liability.due_date + interval '1 month'
      when 'quarterly' then v_liability.due_date + interval '3 months'
      when 'yearly'    then v_liability.due_date + interval '1 year'
      else                  v_liability.due_date + interval '1 month'
    end;

    insert into liabilities (
      description, amount, due_date, is_recurring, recurrence, paid, user_id
    ) values (
      v_liability.description,
      v_liability.amount,
      v_next_due,
      true,
      v_liability.recurrence,
      false,
      p_user_id
    );
  end if;

  -- Return the created transaction ID for cache injection
  return json_build_object(
    'transaction_id',    v_txn_id,
    'liability_id',      p_liability_id,
    'next_due_date',     v_next_due
  );
end;
$$;

-- ── Migration 003: budgets table ─────────────────────────────────────────────
create table if not exists public.budgets (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  category   text not null,
  amount     numeric(12,2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, category)
);

create index if not exists idx_budgets_user on public.budgets(user_id);

alter table public.budgets enable row level security;

-- ── Migration 004: reconciliation review state ─────────────────────────────
create table if not exists public.reconciliation_reviews (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  status         text not null check (status in ('reviewed', 'linked')),
  statement_line text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (user_id, transaction_id)
);

create index if not exists idx_recon_reviews_user_status
  on public.reconciliation_reviews(user_id, status);

create index if not exists idx_recon_reviews_txn
  on public.reconciliation_reviews(transaction_id);

alter table public.reconciliation_reviews enable row level security;

drop policy if exists "reconciliation_reviews: select own" on public.reconciliation_reviews;
create policy "reconciliation_reviews: select own" on public.reconciliation_reviews
  for select
  using (auth.uid() = user_id);

drop policy if exists "reconciliation_reviews: insert own" on public.reconciliation_reviews;
create policy "reconciliation_reviews: insert own" on public.reconciliation_reviews
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "reconciliation_reviews: update own" on public.reconciliation_reviews;
create policy "reconciliation_reviews: update own" on public.reconciliation_reviews
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "reconciliation_reviews: delete own" on public.reconciliation_reviews;
create policy "reconciliation_reviews: delete own" on public.reconciliation_reviews
  for delete
  using (auth.uid() = user_id);