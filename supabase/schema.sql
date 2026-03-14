-- Kosha — Supabase Schema
-- Run this once in: Supabase Dashboard → SQL Editor → New query → Run
-- ─────────────────────────────────────────────────────────────────────────────

-- Transactions table
create table if not exists transactions (
  id                 uuid primary key default gen_random_uuid(),
  date               date not null,
  type               text not null check (type in ('income','expense','investment')),
  description        text not null,
  amount             numeric(12,2) not null check (amount > 0),
  category           text not null default 'other',
  investment_vehicle text,
  is_repayment       boolean not null default false,
  payment_mode       text default 'upi'
                       check (payment_mode in ('upi','credit_card','debit_card',
                                               'cash','net_banking','other')),
  notes              text,
  created_at         timestamptz not null default now()
);

-- Liabilities (bills & dues) table
create table if not exists liabilities (
  id                     uuid primary key default gen_random_uuid(),
  description            text not null,
  amount                 numeric(12,2) not null check (amount > 0),
  due_date               date not null,
  is_recurring           boolean not null default false,
  recurrence             text check (recurrence in ('monthly','quarterly','yearly')),
  paid                   boolean not null default false,
  linked_transaction_id  uuid references transactions(id) on delete set null,
  created_at             timestamptz not null default now()
);

-- Indexes for common queries
create index if not exists idx_txn_date     on transactions(date desc);
create index if not exists idx_txn_type     on transactions(type);
create index if not exists idx_txn_category on transactions(category);
create index if not exists idx_liab_due     on liabilities(due_date);
create index if not exists idx_liab_paid    on liabilities(paid);

-- ─────────────────────────────────────────────────────────────────────────────
-- NOTE: Row Level Security (RLS) is intentionally NOT enabled here.
-- This is Phase 1 — single user. Phase 2 will add auth + RLS policies.
-- ─────────────────────────────────────────────────────────────────────────────
