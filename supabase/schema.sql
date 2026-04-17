-- Kosha — Supabase Schema (Phase 2)
-- Run this once in: Supabase Dashboard → SQL Editor → New query → Run
-- This script is idempotent for repeated setup runs.
-- ─────────────────────────────────────────────────────────────────────────────

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

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

-- Monthly net changes cache (for fast get_running_balance)
create table if not exists monthly_net_changes (
  user_id uuid not null, -- FK added later for compatibility
  month_start date not null,
  net_change numeric not null default 0,
  primary key (user_id, month_start)
);

alter table monthly_net_changes enable row level security;
drop policy if exists "Users can read own monthly net changes" on monthly_net_changes;
create policy "Users can read own monthly net changes"
  on monthly_net_changes for select
  to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.maintain_monthly_net_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month_start date;
  v_amount numeric;
begin
  if tg_op = 'DELETE' then
    if old.user_id is not null then
      v_month_start := date_trunc('month', old.date)::date;
      v_amount := case when old.type = 'income' then -old.amount else old.amount end;
      update public.monthly_net_changes
      set net_change = net_change + v_amount
      where user_id = old.user_id and month_start = v_month_start;
    end if;
    return old;
  end if;

  if tg_op = 'INSERT' then
    if new.user_id is not null then
      v_month_start := date_trunc('month', new.date)::date;
      v_amount := case when new.type = 'income' then new.amount else -new.amount end;
      insert into public.monthly_net_changes (user_id, month_start, net_change)
      values (new.user_id, v_month_start, v_amount)
      on conflict (user_id, month_start)
      do update set net_change = monthly_net_changes.net_change + excluded.net_change;
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if old.date is distinct from new.date or old.amount is distinct from new.amount or old.type is distinct from new.type or old.user_id is distinct from new.user_id then
      if old.user_id is not null then
        v_month_start := date_trunc('month', old.date)::date;
        v_amount := case when old.type = 'income' then -old.amount else old.amount end;
        update public.monthly_net_changes
        set net_change = net_change + v_amount
        where user_id = old.user_id and month_start = v_month_start;
      end if;
      if new.user_id is not null then
        v_month_start := date_trunc('month', new.date)::date;
        v_amount := case when new.type = 'income' then new.amount else -new.amount end;
        insert into public.monthly_net_changes (user_id, month_start, net_change)
        values (new.user_id, v_month_start, v_amount)
        on conflict (user_id, month_start)
        do update set net_change = monthly_net_changes.net_change + excluded.net_change;
      end if;
    end if;
    return new;
  end if;
end;
$$;

drop trigger if exists trg_maintain_monthly_net_change on transactions;
create trigger trg_maintain_monthly_net_change
after insert or update or delete on transactions
for each row execute function maintain_monthly_net_change();

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
create index if not exists idx_txn_user_date_created
  on transactions(user_id, date desc, created_at desc);
create index if not exists idx_txn_user_type_date_created
  on transactions(user_id, type, date desc, created_at desc);
create index if not exists idx_txn_user_category_date_created
  on transactions(user_id, category, date desc, created_at desc);
create index if not exists idx_txn_user_date
  on transactions(user_id, date);
create index if not exists idx_txn_desc_trgm
  on transactions using gin (description gin_trgm_ops);
create index if not exists idx_txn_recurring_due on transactions(user_id, next_run_date)
  where is_recurring = true;

create index if not exists idx_txn_source_txn
  on transactions(source_transaction_id)
  where source_transaction_id is not null;

create index if not exists idx_liab_due     on liabilities(due_date);
create index if not exists idx_liab_paid    on liabilities(paid);
create index if not exists idx_liab_user    on liabilities(user_id);

create index if not exists idx_liab_linked_txn
  on liabilities(linked_transaction_id)
  where linked_transaction_id is not null;

create index if not exists idx_invite_token on invites(token);

-- Row Level Security (RLS)
alter table profiles     enable row level security;
alter table transactions enable row level security;
alter table liabilities  enable row level security;
alter table invites      enable row level security;

-- Profiles policies
drop policy if exists "profiles: select own" on profiles;
create policy "profiles: select own" on profiles
for select to authenticated
using ((select auth.uid()) = id);

drop policy if exists "profiles: insert own" on profiles;
create policy "profiles: insert own" on profiles
for insert to authenticated
with check ((select auth.uid()) = id);

drop policy if exists "profiles: update own" on profiles;
create policy "profiles: update own" on profiles
for update to authenticated
using ((select auth.uid()) = id);

-- Transactions policies
drop policy if exists "transactions: select own" on transactions;
create policy "transactions: select own" on transactions
for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "transactions: insert own" on transactions;
create policy "transactions: insert own" on transactions
for insert to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "transactions: update own" on transactions;
create policy "transactions: update own" on transactions
for update to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "transactions: delete own" on transactions;
create policy "transactions: delete own" on transactions
for delete to authenticated
using ((select auth.uid()) = user_id);

-- Liabilities policies
drop policy if exists "liabilities: select own" on liabilities;
create policy "liabilities: select own" on liabilities
for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "liabilities: insert own" on liabilities;
create policy "liabilities: insert own" on liabilities
for insert to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "liabilities: update own" on liabilities;
create policy "liabilities: update own" on liabilities
for update to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "liabilities: delete own" on liabilities;
create policy "liabilities: delete own" on liabilities
for delete to authenticated
using ((select auth.uid()) = user_id);

-- Invites policies
drop policy if exists "invites: select for validation" on invites;
create policy "invites: select for validation" on invites
for select to authenticated
using (true);

drop policy if exists "invites: insert own" on invites;
create policy "invites: insert own" on invites
for insert to authenticated
with check ((select auth.uid()) = created_by);

drop policy if exists "invites: update to consume" on invites;
create policy "invites: update to consume" on invites
for update to authenticated
using (
  ((select auth.uid()) = created_by)
  or (used_by is null)
)
with check (
  ((select auth.uid()) = created_by)
  or (
    used_by = (select auth.uid())
    and used_at is not null
  )
);
 
drop policy if exists "invites: delete own" on invites;
create policy "invites: delete own" on invites
for delete to authenticated
using ((select auth.uid()) = created_by);

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
-- Phase 2 summary (broad convenience policies, idempotent)
-- ─────────────────────────────────────────────────────────────────────────────

-- NOTE: The broad "Users can fully manage own X" FOR ALL policies below are intentionally
-- NOT recreated. The specific per-operation policies above already cover all access.
-- Having both would create "Multiple Permissive Policies" warnings and Realtime instability.
drop policy if exists "Users can view own profile" on public.profiles;
drop policy if exists "Users can insert own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Users can fully manage own transactions" on public.transactions;
drop policy if exists "Users can fully manage own liabilities" on public.liabilities;

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
for insert to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "bug_reports: select own" on public.bug_reports;
create policy "bug_reports: select own" on public.bug_reports
for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "bug_reports: update own" on public.bug_reports;
create policy "bug_reports: update own" on public.bug_reports
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

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
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "bug_reports_storage: read own" on storage.objects;
create policy "bug_reports_storage: read own" on storage.objects
for select to authenticated
using (
  bucket_id = 'bug-reports'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "bug_reports_storage: delete own" on storage.objects;
create policy "bug_reports_storage: delete own" on storage.objects
for delete to authenticated
using (
  bucket_id = 'bug-reports'
  and (storage.foldername(name))[1] = (select auth.uid())::text
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
  p_user_ids uuid[],
  p_end_date date
)
returns numeric
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(
    (
      -- Sum fully completed months from the cache
      select sum(net_change)
      from monthly_net_changes
      where user_id = any(p_user_ids)
        and month_start < date_trunc('month', p_end_date)::date
    ), 0
  ) + coalesce(
    (
      -- Sum raw transactions for the current partial month up to p_end_date
      select sum(case when type = 'income' then amount else -amount end)
      from transactions
      where user_id = any(p_user_ids)
        and date >= date_trunc('month', p_end_date)::date
        and date <= p_end_date
    ), 0
  );
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
  entity_type text not null check (entity_type in ('transaction', 'liability', 'loan', 'split_group', 'split_group_member', 'split_expense', 'split_settlement', 'split_group_invite')),
  entity_id   uuid not null,
  metadata    jsonb,
  created_at  timestamptz not null default now()
);

-- Broaden entity_type constraint if table already exists with old constraint
do $$
begin
  alter table public.financial_events
    drop constraint if exists financial_events_entity_type_check;
  alter table public.financial_events
    add constraint financial_events_entity_type_check
    check (entity_type in ('transaction', 'liability', 'loan', 'split_group', 'split_group_member', 'split_expense', 'split_settlement', 'split_group_invite'));
exception
  when others then null;
end $$;

create index if not exists idx_financial_events_user_created
  on public.financial_events(user_id, created_at desc);

create index if not exists idx_financial_events_entity
  on public.financial_events(entity_type, entity_id, created_at desc);

alter table public.financial_events enable row level security;

drop policy if exists "financial_events: select own" on public.financial_events;
create policy "financial_events: select own" on public.financial_events
for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "financial_events: insert own" on public.financial_events;
create policy "financial_events: insert own" on public.financial_events
for insert to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "financial_events: update none" on public.financial_events;
create policy "financial_events: update none" on public.financial_events
for update to authenticated
using (false)
with check (false);

drop policy if exists "financial_events: delete none" on public.financial_events;
create policy "financial_events: delete none" on public.financial_events
for delete to authenticated
using (false);
--
-- Returns one row per (type, is_repayment, category, investment_vehicle) group.
-- The JS hook aggregates these ~5–30 rows instead of ~50–300 raw rows.

create or replace function public.get_month_summary(
  p_user_ids uuid[],
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
  where user_id = any(p_user_ids)
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
  p_user_ids uuid[],
  p_year    int
)
returns table (
  monthly_data  json,
  category_data json,
  vehicle_data  json,
  totals        json,
  top5_expenses json
)
language sql
stable
security invoker
set search_path = public
as $$
  with year_data as (
    select id, date, type, amount, description, category,
           investment_vehicle, is_repayment
    from transactions
    where user_id = any(p_user_ids)
      and date between make_date(p_year, 1, 1) and make_date(p_year, 12, 31)
  ),
  monthly_agg as (
    select
      extract(month from date)::int as month_num,
      sum(case when type = 'income' and not is_repayment then amount else 0 end) as income,
      sum(case when type = 'expense'    then amount else 0 end)       as expense,
      sum(case when type = 'investment' then amount else 0 end)       as investment
    from year_data
    group by extract(month from date)
  ),
  category_agg as (
    select coalesce(category, 'other') as category, sum(amount) as cat_total
    from year_data
    where type = 'expense'
    group by coalesce(category, 'other')
  ),
  vehicle_agg as (
    select coalesce(investment_vehicle, 'Other') as vehicle, sum(amount) as veh_total
    from year_data
    where type = 'investment'
    group by coalesce(investment_vehicle, 'Other')
  ),
  totals_agg as (
    select
      coalesce(sum(case when type = 'income' and not is_repayment then amount end), 0) as income,
      coalesce(sum(case when type = 'income' and is_repayment     then amount end), 0) as repayments,
      coalesce(sum(case when type = 'expense'    then amount end), 0) as expense,
      coalesce(sum(case when type = 'investment' then amount end), 0) as investment,
      count(*) as count
    from year_data
  ),
  top5_agg as (
    select id, date, type, amount, description, category
    from year_data
    where type = 'expense'
    order by amount desc
    limit 5
  )
  select
    (select json_agg(row_to_json(m) order by m.month_num) from monthly_agg m),
    (select json_object_agg(category, cat_total) from category_agg),
    (select json_object_agg(vehicle, veh_total) from vehicle_agg),
    (select json_build_object(
      'income',     income,
      'repayments', repayments,
      'expense',    expense,
      'investment', investment,
      'count',      count
    ) from totals_agg),
    (select json_agg(row_to_json(e)) from top5_agg e);
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
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "reconciliation_reviews: insert own" on public.reconciliation_reviews;
create policy "reconciliation_reviews: insert own" on public.reconciliation_reviews
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "reconciliation_reviews: update own" on public.reconciliation_reviews;
create policy "reconciliation_reviews: update own" on public.reconciliation_reviews
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "reconciliation_reviews: delete own" on public.reconciliation_reviews;
create policy "reconciliation_reviews: delete own" on public.reconciliation_reviews
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Category Budgets — per-category monthly spending limits
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists category_budgets (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null,
  category       text not null,
  monthly_limit  numeric(12,2) not null check (monthly_limit > 0),
  created_at     timestamptz not null default now()
);

create unique index if not exists idx_budgets_user_category
  on category_budgets(user_id, category);
create index if not exists idx_budgets_user
  on category_budgets(user_id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'category_budgets_user_id_fkey'
      and conrelid = 'category_budgets'::regclass
  ) then
    alter table category_budgets
      add constraint category_budgets_user_id_fkey
      foreign key (user_id) references auth.users(id);
  end if;
end $$;

alter table category_budgets enable row level security;

drop policy if exists "category_budgets: select own" on category_budgets;
create policy "category_budgets: select own" on category_budgets
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "category_budgets: insert own" on category_budgets;
create policy "category_budgets: insert own" on category_budgets
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "category_budgets: update own" on category_budgets;
create policy "category_budgets: update own" on category_budgets
  for update to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "category_budgets: delete own" on category_budgets;
create policy "category_budgets: delete own" on category_budgets
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- User Custom Categories
-- Per-user categories with guardrails: name length, slug format, cap via trigger
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists user_categories (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  type       text not null check (type in ('expense', 'income', 'investment')),
  label      text not null check (char_length(trim(label)) between 2 and 30),
  slug       text not null check (slug ~ '^custom_[a-z0-9_]+$'),
  icon       text not null default 'Tag',
  color      text not null default '#6B7280',
  bg         text not null default '#F3F4F6',
  archived   boolean not null default false,
  created_at timestamptz not null default now(),
  unique(user_id, slug)
);

-- Keep type constraint aligned for existing databases created before
-- investment custom categories were introduced.
alter table if exists user_categories
  drop constraint if exists user_categories_type_check;

alter table if exists user_categories
  add constraint user_categories_type_check
  check (type in ('expense', 'income', 'investment'));

create index if not exists idx_user_cat_user
  on user_categories(user_id) where archived = false;

alter table user_categories enable row level security;

drop policy if exists "user_categories: select own" on user_categories;
create policy "user_categories: select own" on user_categories
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "user_categories: insert own" on user_categories;
create policy "user_categories: insert own" on user_categories
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "user_categories: update own" on user_categories;
create policy "user_categories: update own" on user_categories
  for update to authenticated
  using ((select auth.uid()) = user_id);

-- Enforce max 15 active custom categories per user
create or replace function check_user_category_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (
    select count(*) from user_categories
    where user_id = NEW.user_id and archived = false
  ) >= 15 then
    raise exception 'Maximum 15 custom categories allowed per user';
  end if;
  return NEW;
end;
$$;

drop trigger if exists enforce_user_category_limit on user_categories;
create trigger enforce_user_category_limit
  before insert on user_categories
  for each row execute function check_user_category_limit();

-- ═════════════════════════════════════════════════════════════════════════════
-- ── SPLITWISE-LIKE SHARED EXPENSES (additive) ─────────────────────────────
-- ═════════════════════════════════════════════════════════════════════════════

create table if not exists split_groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  is_archived boolean not null default false,
  user_id     uuid
);

create table if not exists split_group_members (
  id              uuid primary key default gen_random_uuid(),
  group_id        uuid not null references split_groups(id) on delete cascade,
  display_name    text not null,
  is_self         boolean not null default false,
  linked_user_id  uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  user_id         uuid
);

create table if not exists split_expenses (
  id                 uuid primary key default gen_random_uuid(),
  group_id           uuid not null references split_groups(id) on delete cascade,
  paid_by_member_id  uuid not null references split_group_members(id) on delete restrict,
  description        text not null,
  amount             numeric(12,2) not null check (amount > 0),
  expense_date       date not null default current_date,
  split_method       text not null check (split_method in ('equal', 'exact', 'percent', 'shares')),
  notes              text,
  created_at         timestamptz not null default now(),
  user_id            uuid
);

create table if not exists split_expense_splits (
  id          uuid primary key default gen_random_uuid(),
  expense_id  uuid not null references split_expenses(id) on delete cascade,
  member_id   uuid not null references split_group_members(id) on delete cascade,
  share       numeric(12,2) not null check (share >= 0),
  percent     numeric(9,4),
  shares      numeric(12,4),
  created_at  timestamptz not null default now(),
  user_id     uuid
);

create table if not exists split_settlements (
  id               uuid primary key default gen_random_uuid(),
  group_id         uuid not null references split_groups(id) on delete cascade,
  payer_member_id  uuid not null references split_group_members(id) on delete restrict,
  payee_member_id  uuid not null references split_group_members(id) on delete restrict,
  amount           numeric(12,2) not null check (amount > 0),
  settled_at       date not null default current_date,
  note             text,
  created_at       timestamptz not null default now(),
  user_id          uuid
);

create table if not exists split_group_access (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references split_groups(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null default 'member' check (role in ('admin', 'member', 'viewer')),
  created_at  timestamptz not null default now(),
  unique (group_id, user_id)
);

create table if not exists split_group_invites (
  id           uuid primary key default gen_random_uuid(),
  group_id     uuid not null references split_groups(id) on delete cascade,
  token        text not null unique default encode(gen_random_bytes(12), 'hex'),
  role         text not null default 'member' check (role in ('viewer', 'member', 'admin')),
  created_by   uuid not null references auth.users(id) on delete cascade,
  consumed_by  uuid references auth.users(id) on delete set null,
  consumed_at  timestamptz,
  revoked_at   timestamptz,
  created_at   timestamptz not null default now()
);

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'split_group_invites_role_check'
      and conrelid = 'split_group_invites'::regclass
  ) then
    alter table split_group_invites
      drop constraint split_group_invites_role_check;
  end if;

  -- Update existing data before adding the new constraint
  update split_group_invites set role = 'admin' where role = 'owner';
  update split_group_invites set role = 'member' where role = 'viewer';

  alter table split_group_invites
    add constraint split_group_invites_role_check
    check (role in ('viewer', 'member', 'admin'));
exception
  when duplicate_object then null;
end $$;

-- Expand split_group_access role constraint to 3-tier model
do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'split_group_access_role_check'
      and conrelid = 'split_group_access'::regclass
  ) then
    alter table split_group_access
      drop constraint split_group_access_role_check;
  end if;

  -- Update existing data before adding the new constraint
  update split_group_access set role = 'admin' where role = 'owner';
  update split_group_access set role = 'member' where role = 'viewer';

  alter table split_group_access
    add constraint split_group_access_role_check
    check (role in ('admin', 'member', 'viewer'));
exception
  when duplicate_object then null;
end $$;

create index if not exists idx_split_groups_user on split_groups(user_id);
create index if not exists idx_split_group_members_group on split_group_members(group_id);
create index if not exists idx_split_group_members_user on split_group_members(user_id);
create unique index if not exists idx_split_group_members_group_linked_user_unique
  on split_group_members(group_id, linked_user_id)
  where linked_user_id is not null;
create unique index if not exists idx_split_group_members_group_name_unique
  on split_group_members(group_id, lower(display_name));
create index if not exists idx_split_expenses_group_date on split_expenses(group_id, expense_date desc);
create index if not exists idx_split_expenses_user on split_expenses(user_id);
create unique index if not exists idx_split_expense_splits_unique_member
  on split_expense_splits(expense_id, member_id);
create index if not exists idx_split_expense_splits_user on split_expense_splits(user_id);
create index if not exists idx_split_settlements_group_date on split_settlements(group_id, settled_at desc);
create index if not exists idx_split_settlements_user on split_settlements(user_id);
create index if not exists idx_split_group_access_user on split_group_access(user_id);
create index if not exists idx_split_group_access_group on split_group_access(group_id);
create index if not exists idx_split_group_invites_group on split_group_invites(group_id);
create index if not exists idx_split_group_invites_created_by on split_group_invites(created_by);
create index if not exists idx_split_group_invites_token on split_group_invites(token);

-- Indexes for unindexed FK columns (fixes Performance Advisor warnings)
create index if not exists idx_split_expense_splits_member
  on split_expense_splits(member_id);
create index if not exists idx_split_expenses_paid_by_member
  on split_expenses(paid_by_member_id);
create index if not exists idx_split_group_invites_consumed_by
  on split_group_invites(consumed_by)
  where consumed_by is not null;
create index if not exists idx_split_group_members_linked_user
  on split_group_members(linked_user_id)
  where linked_user_id is not null;
create index if not exists idx_split_settlements_payer
  on split_settlements(payer_member_id);
create index if not exists idx_split_settlements_payee
  on split_settlements(payee_member_id);


do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_name = 'split_groups' and column_name = 'is_archived'
  ) then
    alter table split_groups add column is_archived boolean not null default false;
  end if;
end $$;
create index if not exists idx_split_group_invites_active on split_group_invites(group_id, created_at desc)
  where consumed_by is null and revoked_at is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'split_groups_user_id_fkey'
      and conrelid = 'split_groups'::regclass
  ) then
    alter table split_groups
      add constraint split_groups_user_id_fkey
      foreign key (user_id) references auth.users(id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'split_group_members_user_id_fkey'
      and conrelid = 'split_group_members'::regclass
  ) then
    alter table split_group_members
      add constraint split_group_members_user_id_fkey
      foreign key (user_id) references auth.users(id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'split_expenses_user_id_fkey'
      and conrelid = 'split_expenses'::regclass
  ) then
    alter table split_expenses
      add constraint split_expenses_user_id_fkey
      foreign key (user_id) references auth.users(id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'split_expense_splits_user_id_fkey'
      and conrelid = 'split_expense_splits'::regclass
  ) then
    alter table split_expense_splits
      add constraint split_expense_splits_user_id_fkey
      foreign key (user_id) references auth.users(id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'split_settlements_user_id_fkey'
      and conrelid = 'split_settlements'::regclass
  ) then
    alter table split_settlements
      add constraint split_settlements_user_id_fkey
      foreign key (user_id) references auth.users(id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'split_group_invites_created_by_fkey'
      and conrelid = 'split_group_invites'::regclass
  ) then
    alter table split_group_invites
      add constraint split_group_invites_created_by_fkey
      foreign key (created_by) references auth.users(id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'split_group_invites_consumed_by_fkey'
      and conrelid = 'split_group_invites'::regclass
  ) then
    alter table split_group_invites
      add constraint split_group_invites_consumed_by_fkey
      foreign key (consumed_by) references auth.users(id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'split_groups'
  ) then
    alter publication supabase_realtime add table split_groups;
  end if;
exception
  when undefined_object then null;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'split_group_members'
  ) then
    alter publication supabase_realtime add table split_group_members;
  end if;
exception
  when undefined_object then null;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'split_expenses'
  ) then
    alter publication supabase_realtime add table split_expenses;
  end if;
exception
  when undefined_object then null;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'split_expense_splits'
  ) then
    alter publication supabase_realtime add table split_expense_splits;
  end if;
exception
  when undefined_object then null;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'split_settlements'
  ) then
    alter publication supabase_realtime add table split_settlements;
  end if;
exception
  when undefined_object then null;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'split_group_access'
  ) then
    alter publication supabase_realtime add table split_group_access;
  end if;
exception
  when undefined_object then null;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'split_group_invites'
  ) then
    alter publication supabase_realtime add table split_group_invites;
  end if;
exception
  when undefined_object then null;
end $$;

alter table split_groups enable row level security;
alter table split_group_members enable row level security;
alter table split_expenses enable row level security;
alter table split_expense_splits enable row level security;
alter table split_settlements enable row level security;
alter table split_group_access enable row level security;
alter table split_group_invites enable row level security;

-- is_split_group_owner checks for 'admin' role (renamed from 'owner')
create or replace function public.is_split_group_owner(
  p_group_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from split_group_access a
    where a.group_id = p_group_id
      and a.user_id = p_user_id
      and a.role = 'admin'
  );
$$;

-- is_split_group_member_or_above checks for 'admin' or 'member' role
create or replace function public.is_split_group_member_or_above(
  p_group_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from split_group_access a
    where a.group_id = p_group_id
      and a.user_id = p_user_id
      and a.role in ('admin', 'member')
  );
$$;

create or replace function public.has_split_group_access(
  p_group_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from split_group_access a
    where a.group_id = p_group_id
      and a.user_id = p_user_id
  );
$$;

create or replace function public.split_group_member_profiles(
  p_group_id uuid
)
returns table(user_id uuid, display_name text, avatar_url text)
language sql
stable
security definer
set search_path = public
as $$
  select distinct
    p.id as user_id,
    p.display_name,
    p.avatar_url
  from split_group_members m
  join profiles p on p.id = m.linked_user_id
  where m.group_id = p_group_id
    and public.has_split_group_access(p_group_id, auth.uid());
$$;

create or replace function public.split_create_group(
  p_name text,
  p_self_display_name text default null
)
returns split_groups
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_group split_groups%rowtype;
  v_name text := btrim(coalesce(p_name, ''));
  v_self_name text := nullif(btrim(coalesce(p_self_display_name, '')), '');
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if v_name = '' then
    raise exception 'Group name is required';
  end if;

  if v_self_name is null then
    select nullif(btrim(p.display_name), '') into v_self_name
    from profiles p
    where p.id = v_uid;

    if v_self_name is null then
      select nullif(
        btrim(
          coalesce(
            u.raw_user_meta_data ->> 'full_name',
            split_part(u.email, '@', 1)
          )
        ),
        ''
      )
      into v_self_name
      from auth.users u
      where u.id = v_uid;
    end if;
  end if;

  v_self_name := coalesce(v_self_name, 'You');

  insert into split_groups (name, user_id)
  values (v_name, v_uid)
  returning * into v_group;

  insert into split_group_access (group_id, user_id, role)
  values (v_group.id, v_uid, 'admin')
  on conflict (group_id, user_id) do update
    set role = 'admin';

  insert into split_group_members (
    group_id,
    display_name,
    is_self,
    linked_user_id,
    user_id
  ) values (
    v_group.id,
    v_self_name,
    true,
    v_uid,
    v_uid
  )
  on conflict (group_id, linked_user_id)
  where linked_user_id is not null
  do update set
    display_name = excluded.display_name,
    is_self = true,
    user_id = excluded.user_id;

  return v_group;
end;
$$;

insert into split_group_access (group_id, user_id, role)
select g.id, g.user_id, 'admin'
from split_groups g
where g.user_id is not null
on conflict (group_id, user_id) do update
  set role = 'admin';

do $$
declare
  p record;
begin
  for p in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'split_groups'
  loop
    execute format('drop policy if exists %I on split_groups', p.policyname);
  end loop;
end $$;

create policy "split_groups: select own" on split_groups
  for select to authenticated
  using (public.has_split_group_access(split_groups.id));

create policy "split_groups: insert own" on split_groups
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "split_groups: update own" on split_groups
  for update to authenticated
  using (public.is_split_group_owner(split_groups.id))
  with check (public.is_split_group_owner(split_groups.id));

create policy "split_groups: delete own" on split_groups
  for delete to authenticated
  using (public.is_split_group_owner(split_groups.id));

drop policy if exists "split_group_access: select own" on split_group_access;
create policy "split_group_access: select own" on split_group_access
  for select to authenticated
  using (
    ((select auth.uid()) = user_id)
    or public.is_split_group_owner(split_group_access.group_id)
  );

drop policy if exists "split_group_access: insert owner" on split_group_access;
create policy "split_group_access: insert owner" on split_group_access
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and role in ('admin', 'member', 'viewer')
    and public.is_split_group_owner(split_group_access.group_id)
  );

drop policy if exists "split_group_access: update owner" on split_group_access;
create policy "split_group_access: update owner" on split_group_access
  for update to authenticated
  using (public.is_split_group_owner(split_group_access.group_id))
  with check (
    role in ('admin', 'member', 'viewer')
    and public.is_split_group_owner(split_group_access.group_id)
  );

drop policy if exists "split_group_access: delete owner" on split_group_access;
create policy "split_group_access: delete owner" on split_group_access
  for delete to authenticated
  using (public.is_split_group_owner(split_group_access.group_id));

drop policy if exists "split_group_members: select own" on split_group_members;
create policy "split_group_members: select own" on split_group_members
  for select to authenticated
  using (public.has_split_group_access(split_group_members.group_id));

drop policy if exists "split_group_members: insert own" on split_group_members;
create policy "split_group_members: insert own" on split_group_members
  for insert to authenticated
  with check (
    ((select auth.uid()) = user_id)
    and public.is_split_group_owner(split_group_members.group_id)
  );

drop policy if exists "split_group_members: update own" on split_group_members;
create policy "split_group_members: update own" on split_group_members
  for update to authenticated
  using (public.is_split_group_owner(split_group_members.group_id))
  with check (
    ((select auth.uid()) = user_id)
    and public.is_split_group_owner(split_group_members.group_id)
  );

drop policy if exists "split_group_members: delete own" on split_group_members;
create policy "split_group_members: delete own" on split_group_members
  for delete to authenticated
  using (public.is_split_group_owner(split_group_members.group_id));

drop policy if exists "split_expenses: select own" on split_expenses;
create policy "split_expenses: select own" on split_expenses
  for select to authenticated
  using (public.has_split_group_access(split_expenses.group_id));

drop policy if exists "split_expenses: insert own" on split_expenses;
create policy "split_expenses: insert own" on split_expenses
  for insert to authenticated
  with check (
    ((select auth.uid()) = user_id)
    and public.is_split_group_member_or_above(split_expenses.group_id)
  );

drop policy if exists "split_expenses: update own" on split_expenses;
create policy "split_expenses: update own" on split_expenses
  for update to authenticated
  using (public.is_split_group_member_or_above(split_expenses.group_id))
  with check (
    ((select auth.uid()) = user_id)
    and public.is_split_group_member_or_above(split_expenses.group_id)
  );

drop policy if exists "split_expenses: delete own" on split_expenses;
create policy "split_expenses: delete own" on split_expenses
  for delete to authenticated
  using (public.is_split_group_member_or_above(split_expenses.group_id));

drop policy if exists "split_expense_splits: select own" on split_expense_splits;
create policy "split_expense_splits: select own" on split_expense_splits
  for select to authenticated
  using (
    exists (
      select 1
      from split_expenses e
      where e.id = split_expense_splits.expense_id
        and public.has_split_group_access(e.group_id)
    )
  );

drop policy if exists "split_expense_splits: insert own" on split_expense_splits;
create policy "split_expense_splits: insert own" on split_expense_splits
  for insert to authenticated
  with check (
    ((select auth.uid()) = user_id)
    and exists (
      select 1
      from split_expenses e
      where e.id = split_expense_splits.expense_id
        and public.is_split_group_member_or_above(e.group_id)
    )
  );

drop policy if exists "split_expense_splits: update own" on split_expense_splits;
create policy "split_expense_splits: update own" on split_expense_splits
  for update to authenticated
  using (
    exists (
      select 1
      from split_expenses e
      where e.id = split_expense_splits.expense_id
        and public.is_split_group_member_or_above(e.group_id)
    )
  )
  with check (
    ((select auth.uid()) = user_id)
    and exists (
      select 1
      from split_expenses e
      where e.id = split_expense_splits.expense_id
        and public.is_split_group_member_or_above(e.group_id)
    )
  );

drop policy if exists "split_expense_splits: delete own" on split_expense_splits;
create policy "split_expense_splits: delete own" on split_expense_splits
  for delete to authenticated
  using (
    exists (
      select 1
      from split_expenses e
      where e.id = split_expense_splits.expense_id
        and public.is_split_group_member_or_above(e.group_id)
    )
  );

drop policy if exists "split_settlements: select own" on split_settlements;
create policy "split_settlements: select own" on split_settlements
  for select to authenticated
  using (public.has_split_group_access(split_settlements.group_id));

drop policy if exists "split_settlements: insert own" on split_settlements;
create policy "split_settlements: insert own" on split_settlements
  for insert to authenticated
  with check (
    ((select auth.uid()) = user_id)
    and public.is_split_group_member_or_above(split_settlements.group_id)
  );

drop policy if exists "split_settlements: update own" on split_settlements;
create policy "split_settlements: update own" on split_settlements
  for update to authenticated
  using (public.is_split_group_member_or_above(split_settlements.group_id))
  with check (
    ((select auth.uid()) = user_id)
    and public.is_split_group_member_or_above(split_settlements.group_id)
  );

drop policy if exists "split_settlements: delete own" on split_settlements;
create policy "split_settlements: delete own" on split_settlements
  for delete to authenticated
  using (public.is_split_group_member_or_above(split_settlements.group_id));

drop policy if exists "split_group_invites: select own" on split_group_invites;
create policy "split_group_invites: select own" on split_group_invites
  for select to authenticated
  using (
    public.is_split_group_owner(split_group_invites.group_id)
    or ((select auth.uid()) = consumed_by)
  );

drop policy if exists "split_group_invites: insert owner" on split_group_invites;
create policy "split_group_invites: insert owner" on split_group_invites
  for insert to authenticated
  with check (
    ((select auth.uid()) = created_by)
    and role in ('viewer', 'member', 'admin')
    and public.is_split_group_owner(split_group_invites.group_id)
  );

drop policy if exists "split_group_invites: update owner" on split_group_invites;
create policy "split_group_invites: update owner" on split_group_invites
  for update to authenticated
  using (public.is_split_group_owner(split_group_invites.group_id))
  with check (
    role in ('viewer', 'member', 'admin')
    and public.is_split_group_owner(split_group_invites.group_id)
  );

drop policy if exists "split_group_invites: delete owner" on split_group_invites;
create policy "split_group_invites: delete owner" on split_group_invites
  for delete to authenticated
  using (public.is_split_group_owner(split_group_invites.group_id));

create or replace function public.touch_split_group_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.ensure_split_group_user_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  new.user_id := auth.uid();
  return new;
end;
$$;

drop trigger if exists trg_split_group_user_id on split_groups;
create trigger trg_split_group_user_id
  before insert on split_groups
  for each row execute function public.ensure_split_group_user_id();

drop trigger if exists trg_touch_split_group_updated_at on split_groups;
create trigger trg_touch_split_group_updated_at
  before update on split_groups
  for each row execute function public.touch_split_group_updated_at();

create or replace function public.ensure_split_group_owner_access()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id is not null then
    insert into split_group_access (group_id, user_id, role)
    values (new.id, new.user_id, 'admin')
    on conflict (group_id, user_id) do update
      set role = 'admin';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_split_group_owner_access on split_groups;
create trigger trg_split_group_owner_access
  after insert on split_groups
  for each row execute function public.ensure_split_group_owner_access();

create or replace function public.split_create_group_invite(
  p_group_id uuid,
  p_role text default 'member'
)
returns split_group_invites
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_invite split_group_invites%rowtype;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_split_group_owner(p_group_id, v_uid) then
    raise exception 'Split group not found';
  end if;

  insert into split_group_invites (
    group_id,
    role,
    created_by
  ) values (
    p_group_id,
    'member',
    v_uid
  ) returning * into v_invite;

  return v_invite;
end;
$$;

create or replace function public.split_preview_group_invite(
  p_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite split_group_invites%rowtype;
  v_group split_groups%rowtype;
begin
  if p_token is null or btrim(p_token) = '' then
    raise exception 'Invite token is required';
  end if;

  select * into v_invite
  from split_group_invites i
  where i.token = btrim(p_token)
    and i.revoked_at is null
    and i.consumed_by is null;

  if not found then
    raise exception 'Invite not found or already used';
  end if;

  select * into v_group
  from split_groups g
  where g.id = v_invite.group_id;

  if not found then
    raise exception 'Split group not found';
  end if;

  return jsonb_build_object(
    'group_id', v_group.id,
    'group_name', v_group.name,
    'invited_role', coalesce(v_invite.role, 'viewer')
  );
end;
$$;

create or replace function public.split_consume_group_invite(
  p_token text
)
returns split_groups
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_invite split_group_invites%rowtype;
  v_group split_groups%rowtype;
  v_account_name text;
  v_existing_member_id uuid;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if p_token is null or btrim(p_token) = '' then
    raise exception 'Invite token is required';
  end if;

  select * into v_invite
  from split_group_invites i
  where i.token = btrim(p_token)
    and i.revoked_at is null
    and i.consumed_by is null
  for update;

  if not found then
    raise exception 'Invite not found or already used';
  end if;

  select * into v_group
  from split_groups g
  where g.id = v_invite.group_id;

  if not found then
    raise exception 'Split group not found';
  end if;

  insert into split_group_access (
    group_id,
    user_id,
    role
  ) values (
    v_invite.group_id,
    v_uid,
    case
      when v_group.user_id = v_uid then 'admin'
      when coalesce(v_invite.role, 'member') = 'admin' then 'admin'
      else 'member'
    end
  )
  on conflict (group_id, user_id) do update
    set role = case
      when excluded.role = 'admin' then 'admin'
      else split_group_access.role
    end;

  select nullif(btrim(p.display_name), '') into v_account_name
  from profiles p
  where p.id = v_uid;

  if v_account_name is null then
    select nullif(
      btrim(
        coalesce(
          u.raw_user_meta_data ->> 'full_name',
          split_part(u.email, '@', 1)
        )
      ),
      ''
    )
    into v_account_name
    from auth.users u
    where u.id = v_uid;
  end if;

  v_account_name := coalesce(v_account_name, 'Member');

  update split_group_members
  set display_name = v_account_name,
      user_id = v_uid,
      linked_user_id = v_uid
  where group_id = v_invite.group_id
    and linked_user_id = v_uid;

  if not found then
    select m.id into v_existing_member_id
    from split_group_members m
    where m.group_id = v_invite.group_id
      and lower(m.display_name) = lower(v_account_name)
    limit 1
    for update;

    if v_existing_member_id is not null then
      update split_group_members
      set display_name = v_account_name,
          user_id = v_uid,
          linked_user_id = v_uid
      where id = v_existing_member_id;
    else
      insert into split_group_members (
        group_id,
        display_name,
        is_self,
        linked_user_id,
        user_id
      ) values (
        v_invite.group_id,
        v_account_name,
        false,
        v_uid,
        v_uid
      );
    end if;
  end if;

  update split_group_invites
  set consumed_by = v_uid,
      consumed_at = now()
  where id = v_invite.id
    and consumed_by is null;

  return v_group;
end;
$$;

create or replace function public.split_set_group_access_role(
  p_group_id uuid,
  p_user_id uuid,
  p_role text
)
returns split_group_access
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_target split_group_access%rowtype;
  v_admin_count integer := 0;
  v_role text := lower(coalesce(nullif(btrim(p_role), ''), 'member'));
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if v_role not in ('admin', 'member', 'viewer') then
    raise exception 'Role must be admin, member, or viewer';
  end if;

  if not public.is_split_group_owner(p_group_id, v_uid) then
    raise exception 'Split group not found';
  end if;

  select * into v_target
  from split_group_access a
  where a.group_id = p_group_id
    and a.user_id = p_user_id
  for update;

  if not found then
    raise exception 'Member access not found';
  end if;

  -- Prevent removing the last admin
  if v_target.role = 'admin' and v_role <> 'admin' then
    select count(*)::integer into v_admin_count
    from split_group_access a
    where a.group_id = p_group_id
      and a.role = 'admin';

    if v_admin_count <= 1 then
      raise exception 'At least one admin is required';
    end if;
  end if;

  update split_group_access
  set role = v_role
  where id = v_target.id
  returning * into v_target;

  return v_target;
end;
$$;

create or replace function public.split_group_balances(
  p_group_id uuid,
  p_user_id uuid
)
returns table(member_id uuid, net numeric)
language sql
stable
security invoker
set search_path = public
as $$
  with members as (
    select m.id
    from split_group_members m
    where m.group_id = p_group_id
      and m.user_id = p_user_id
  ),
  paid as (
    select e.paid_by_member_id as member_id, sum(e.amount)::numeric as total_paid
    from split_expenses e
    where e.group_id = p_group_id
      and e.user_id = p_user_id
    group by e.paid_by_member_id
  ),
  owed as (
    select s.member_id, sum(s.share)::numeric as total_owed
    from split_expense_splits s
    join split_expenses e on e.id = s.expense_id
    where e.group_id = p_group_id
      and e.user_id = p_user_id
      and s.user_id = p_user_id
    group by s.member_id
  ),
  in_settle as (
    select st.payee_member_id as member_id, sum(st.amount)::numeric as total_in
    from split_settlements st
    where st.group_id = p_group_id
      and st.user_id = p_user_id
    group by st.payee_member_id
  ),
  out_settle as (
    select st.payer_member_id as member_id, sum(st.amount)::numeric as total_out
    from split_settlements st
    where st.group_id = p_group_id
      and st.user_id = p_user_id
    group by st.payer_member_id
  )
  select
    m.id as member_id,
    coalesce(p.total_paid, 0)
    - coalesce(o.total_owed, 0)
    - coalesce(i.total_in, 0)
    + coalesce(ot.total_out, 0) as net
  from members m
  left join paid p on p.member_id = m.id
  left join owed o on o.member_id = m.id
  left join in_settle i on i.member_id = m.id
  left join out_settle ot on ot.member_id = m.id;
$$;

create or replace function public.split_create_expense(
  p_group_id uuid,
  p_paid_by_member_id uuid,
  p_description text,
  p_amount numeric,
  p_expense_date date,
  p_split_method text,
  p_notes text,
  p_splits jsonb
)
returns split_expenses
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_group split_groups%rowtype;
  v_expense split_expenses%rowtype;
  v_sum numeric := 0;
  v_item jsonb;
  v_member_id uuid;
  v_share numeric;
  v_percent numeric;
  v_shares numeric;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Expense amount must be positive';
  end if;

  if p_description is null or btrim(p_description) = '' then
    raise exception 'Expense description is required';
  end if;

  if p_split_method not in ('equal', 'exact', 'percent', 'shares') then
    raise exception 'Invalid split method';
  end if;

  select * into v_group
  from split_groups
  where id = p_group_id;

  if not found then
    raise exception 'Split group not found';
  end if;

  if not public.is_split_group_member_or_above(p_group_id, v_uid) then
    raise exception 'Split group not found';
  end if;

  if not exists (
    select 1
    from split_group_members m
    where m.id = p_paid_by_member_id
      and m.group_id = p_group_id
  ) then
    raise exception 'Payer must be a member of the group';
  end if;

  if p_splits is null or jsonb_typeof(p_splits) <> 'array' or jsonb_array_length(p_splits) = 0 then
    raise exception 'At least one split row is required';
  end if;

  insert into split_expenses (
    group_id,
    paid_by_member_id,
    description,
    amount,
    expense_date,
    split_method,
    notes,
    user_id
  ) values (
    p_group_id,
    p_paid_by_member_id,
    btrim(p_description),
    p_amount,
    coalesce(p_expense_date, current_date),
    p_split_method,
    nullif(btrim(coalesce(p_notes, '')), ''),
    v_uid
  ) returning * into v_expense;

  for v_item in select * from jsonb_array_elements(p_splits)
  loop
    v_member_id := nullif(v_item->>'member_id', '')::uuid;
    v_share := coalesce((v_item->>'share')::numeric, 0);
    v_percent := nullif(v_item->>'percent', '')::numeric;
    v_shares := nullif(v_item->>'shares', '')::numeric;

    if v_member_id is null then
      raise exception 'split member_id is required';
    end if;

    if v_share < 0 then
      raise exception 'split share cannot be negative';
    end if;

    if not exists (
      select 1
      from split_group_members m
      where m.id = v_member_id
        and m.group_id = p_group_id
    ) then
      raise exception 'Split includes a member outside this group';
    end if;

    insert into split_expense_splits (
      expense_id,
      member_id,
      share,
      percent,
      shares,
      user_id
    ) values (
      v_expense.id,
      v_member_id,
      v_share,
      v_percent,
      v_shares,
      v_uid
    );

    v_sum := v_sum + v_share;
  end loop;

  if abs(v_sum - p_amount) > 0.01 then
    raise exception 'Split total (%) does not match amount (%)', v_sum, p_amount;
  end if;

  return v_expense;
end;
$$;

create or replace function public.split_record_settlement(
  p_group_id uuid,
  p_payer_member_id uuid,
  p_payee_member_id uuid,
  p_amount numeric,
  p_settled_at date default current_date,
  p_note text default null
)
returns split_settlements
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row split_settlements%rowtype;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Settlement amount must be positive';
  end if;

  if p_payer_member_id is null or p_payee_member_id is null then
    raise exception 'Payer and payee are required';
  end if;

  if p_payer_member_id = p_payee_member_id then
    raise exception 'Payer and payee cannot be the same';
  end if;

  if not public.is_split_group_member_or_above(p_group_id, v_uid) then
    raise exception 'Split group not found';
  end if;

  if not exists (
    select 1
    from split_group_members m
    where m.id = p_payer_member_id
      and m.group_id = p_group_id
  ) then
    raise exception 'Payer is not in this group';
  end if;

  if not exists (
    select 1
    from split_group_members m
    where m.id = p_payee_member_id
      and m.group_id = p_group_id
  ) then
    raise exception 'Payee is not in this group';
  end if;

  insert into split_settlements (
    group_id,
    payer_member_id,
    payee_member_id,
    amount,
    settled_at,
    note,
    user_id
  ) values (
    p_group_id,
    p_payer_member_id,
    p_payee_member_id,
    p_amount,
    coalesce(p_settled_at, current_date),
    nullif(btrim(coalesce(p_note, '')), ''),
    v_uid
  ) returning * into v_row;

  return v_row;
end;
$$;

-- ═════════════════════════════════════════════════════════════════════════════
-- ── LOANS ─────────────────────────────────────────────────────────────────────
-- ═════════════════════════════════════════════════════════════════════════════

-- Loans table — tracks money lent to or borrowed from others.
-- Separate from liabilities because:
--   1. loan_given is a receivable (asset), not a liability
--   2. loans support partial repayment (amount_settled)
--   3. loans have interest tracking

create table if not exists loans (
  id              uuid primary key default gen_random_uuid(),
  direction       text not null check (direction in ('given', 'taken')),
  counterparty    text not null,
  amount          numeric(12,2) not null check (amount > 0),
  amount_settled  numeric(12,2) not null default 0 check (amount_settled >= 0),
  interest_rate   numeric(5,2) not null default 0 check (interest_rate >= 0),
  loan_date       date not null default current_date,
  due_date        date,
  note            text,
  settled         boolean not null default false,
  created_at      timestamptz not null default now(),
  user_id         uuid
);

create index if not exists idx_loans_user      on loans(user_id);
create index if not exists idx_loans_settled   on loans(settled);
create index if not exists idx_loans_direction on loans(direction);

-- Foreign key against Supabase auth users
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'loans_user_id_fkey'
      and conrelid = 'loans'::regclass
  ) then
    alter table loans
      add constraint loans_user_id_fkey
      foreign key (user_id) references auth.users(id);
  end if;
end $$;

-- Enable Supabase Realtime for loans table
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'loans'
  ) then
    alter publication supabase_realtime add table loans;
  end if;
exception
  when undefined_object then null;
end $$;

alter table loans enable row level security;

drop policy if exists "loans: select own" on loans;
create policy "loans: select own" on loans
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "loans: insert own" on loans;
create policy "loans: insert own" on loans
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "loans: update own" on loans;
create policy "loans: update own" on loans
  for update to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "loans: delete own" on loans;
create policy "loans: delete own" on loans
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ── record_loan_payment — atomic partial/full repayment ──────────────────────
-- Creates a linked transaction and updates the loan's settled amount.
-- If the payment brings amount_settled >= amount, settles the loan.

create or replace function public.record_loan_payment(
  p_loan_id  uuid,
  p_user_id  uuid,
  p_amount   numeric
)
returns json
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_loan      loans%rowtype;
  v_txn_id    uuid;
  v_new_settled numeric;
  v_fully_settled boolean;
  v_txn_type  text;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Payment amount must be positive';
  end if;

  -- Lock and fetch the loan row
  select * into v_loan
  from loans
  where id = p_loan_id and user_id = p_user_id
  for update;

  if not found then
    raise exception 'Loan not found or access denied';
  end if;

  if v_loan.settled then
    raise exception 'Loan is already fully settled';
  end if;

  v_new_settled := v_loan.amount_settled + p_amount;
  if v_new_settled > v_loan.amount then
    raise exception 'Payment exceeds remaining balance (remaining: %)',
      (v_loan.amount - v_loan.amount_settled);
  end if;

  v_fully_settled := v_new_settled >= v_loan.amount;

  -- Determine transaction type:
  --   loan_given: someone is paying you back → income
  --   loan_taken: you are repaying someone → expense
  v_txn_type := case v_loan.direction
    when 'given' then 'income'
    else 'expense'
  end;

  -- Step 1: Insert linked transaction
  insert into transactions (
    date, type, description, amount, category,
    is_repayment, payment_mode, notes, user_id
  ) values (
    current_date,
    v_txn_type,
    'Loan payment: ' || v_loan.counterparty,
    p_amount,
    'loans',
    true,
    'other',
    case v_loan.direction
      when 'given' then 'Payment received from ' || v_loan.counterparty
      else 'Payment made to ' || v_loan.counterparty
    end,
    p_user_id
  )
  returning id into v_txn_id;

  -- Step 2: Update loan
  update loans
  set amount_settled = v_new_settled,
      settled        = v_fully_settled
  where id = p_loan_id;

  return json_build_object(
    'transaction_id',    v_txn_id,
    'loan_id',           p_loan_id,
    'payment_amount',    p_amount,
    'new_amount_settled', v_new_settled,
    'fully_settled',     v_fully_settled
  );
end;
$$;

-- ═════════════════════════════════════════════════════════════════════════════
-- ── MEMBER DELETION & LEAVING GROUPS ─────────────────────────────────────────
-- ═════════════════════════════════════════════════════════════════════════════

create or replace function public.cleanup_access_after_member_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.linked_user_id is not null then
    delete from split_group_access
    where group_id = old.group_id
      and user_id = old.linked_user_id;
  end if;
  return old;
end;
$$;

drop trigger if exists trg_cleanup_access_after_member_delete on split_group_members;
create trigger trg_cleanup_access_after_member_delete
  after delete on split_group_members
  for each row execute function public.cleanup_access_after_member_delete();

create or replace function public.split_leave_group(
  p_group_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_owner_count integer := 0;
  v_has_access boolean := false;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select exists (
    select 1
    from split_group_access
    where group_id = p_group_id and user_id = v_uid
  ) into v_has_access;

  if not v_has_access then
    raise exception 'You do not have access to this group';
  end if;

  select count(*)::integer into v_owner_count
  from split_group_access
  where group_id = p_group_id and role = 'admin';

  if v_owner_count = 1 and exists (
    select 1
    from split_group_access
    where group_id = p_group_id and user_id = v_uid and role = 'admin'
  ) then
    raise exception 'You must assign another admin or delete the group first';
  end if;

  delete from split_group_access
  where group_id = p_group_id
    and user_id = v_uid;

  update split_group_members
  set linked_user_id = null
  where group_id = p_group_id
    and linked_user_id = v_uid;
end;
$$;