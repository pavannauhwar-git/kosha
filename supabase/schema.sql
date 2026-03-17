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
using ((auth.uid() = created_by) or (used_by is null));

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