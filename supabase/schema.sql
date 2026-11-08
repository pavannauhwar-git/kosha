-- ─────────────────────────────────────────────────────────────────────────────
-- Kosha — Supabase schema (idempotent snapshot of production)
--
-- Generated from a pg_dump of production (PostgreSQL 17.6, 8 Nov 2026), plus the
-- same-day fixes to split_update_expense, create_loan and submit_bug_report.
-- Safe to run any number of times, on a fresh Supabase project or on an existing
-- one: tables and columns are added only when missing, functions and triggers are
-- replaced, policies are dropped and recreated, constraints and publication
-- entries are guarded, and every object's privileges are reset to match
-- production. Foreign keys and CHECK constraints whose definition has drifted
-- are recreated. Everything runs in one transaction.
--
-- Not included, because Supabase manages them on every project: the pgbouncer
-- schema, the extensions.* helper functions, the platform event triggers
-- (pgrst_*, issue_*), supabase_vault, realtime.messages and supabase_admin's
-- default privileges.
--
-- The storage buckets, storage.objects policies and the auth.users trigger at the
-- end are carried over from the previous schema.sql: pg_dump of the public schema
-- does not include the storage and auth schemas, so verify them separately.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

SET LOCAL statement_timeout = 0;
SET LOCAL lock_timeout = 0;
SET LOCAL idle_in_transaction_session_timeout = 0;
SET LOCAL standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', true);
SET LOCAL check_function_bodies = false;
SET LOCAL xmloption = content;
SET LOCAL client_min_messages = warning;
SET LOCAL row_security = off;
SET LOCAL default_tablespace = '';
SET LOCAL default_table_access_method = heap;

-- ═════════════════════════════════════════════════════════════════════════════
-- Extensions
-- ═════════════════════════════════════════════════════════════════════════════

CREATE SCHEMA IF NOT EXISTS extensions;

CREATE EXTENSION IF NOT EXISTS hypopg WITH SCHEMA extensions;

CREATE EXTENSION IF NOT EXISTS index_advisor WITH SCHEMA extensions;

CREATE EXTENSION IF NOT EXISTS pg_stat_statements WITH SCHEMA extensions;

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;

-- ═════════════════════════════════════════════════════════════════════════════
-- Tables and functions (dependency order from pg_dump)
-- ═════════════════════════════════════════════════════════════════════════════

-- Function: public.bug_reports_protect_notified_at()
CREATE OR REPLACE FUNCTION public.bug_reports_protect_notified_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  -- Service tooling may set it: edge function uses the service_role key;
  -- a DB admin runs as postgres.
  if current_user in ('service_role', 'postgres') then
    return new;
  end if;
  -- Any other caller (authenticated / anon) cannot change notified_at.
  new.notified_at := old.notified_at;
  return new;
end;
$$;

-- Function: public.check_user_category_limit()
CREATE OR REPLACE FUNCTION public.check_user_category_limit() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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

-- Function: public.cleanup_access_after_member_delete()
CREATE OR REPLACE FUNCTION public.cleanup_access_after_member_delete() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if old.linked_user_id is not null then
    delete from split_group_access
    where group_id = old.group_id
      and user_id = old.linked_user_id;
  end if;
  return old;
end;
$$;

-- Function: public.consume_wallet_invite(text)
CREATE OR REPLACE FUNCTION public.consume_wallet_invite(p_token text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_invite_id uuid;
  v_invite_creator uuid;
  v_invite_expires_at timestamptz;
  v_invite_used_by uuid;
  v_rows_updated integer;
begin
  if v_uid is null then
    return jsonb_build_object('consumed', false, 'reason', 'unauthenticated');
  end if;

  select id, created_by, expires_at, used_by
    into v_invite_id, v_invite_creator, v_invite_expires_at, v_invite_used_by
  from public.invites
  where token = p_token
  for update;

  if not found then
    return jsonb_build_object('consumed', false, 'reason', 'invite-not-found-or-used');
  end if;

  if v_invite_used_by is not null then
    return jsonb_build_object('consumed', false, 'reason', 'invite-not-found-or-used');
  end if;

  if v_invite_creator = v_uid then
    return jsonb_build_object('consumed', false, 'reason', 'cannot-consume-own-invite');
  end if;

  -- 1:1 partner model: reject if either party is already linked to someone.
  if exists (
    select 1 from public.invites
    where used_by is not null
      and (created_by = v_uid or used_by = v_uid
        or created_by = v_invite_creator or used_by = v_invite_creator)
  ) then
    return jsonb_build_object('consumed', false, 'reason', 'already-linked');
  end if;

  if v_invite_expires_at is not null and v_invite_expires_at <= now() then
    return jsonb_build_object('consumed', false, 'reason', 'invite-expired');
  end if;

  update public.invites
     set used_by = v_uid, used_at = now()
   where id = v_invite_id
     and used_by is null;
  get diagnostics v_rows_updated = row_count;

  if v_rows_updated = 0 then
    return jsonb_build_object('consumed', false, 'reason', 'invite-not-found-or-used');
  end if;

  return jsonb_build_object('consumed', true, 'inviteId', v_invite_id);
end;
$$;

-- Table: public.loans
CREATE TABLE IF NOT EXISTS public.loans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    direction text NOT NULL,
    counterparty text NOT NULL,
    amount numeric(12,2) NOT NULL,
    amount_settled numeric(12,2) DEFAULT 0 NOT NULL,
    interest_rate numeric(5,2) DEFAULT 0 NOT NULL,
    loan_date date DEFAULT CURRENT_DATE NOT NULL,
    due_date date,
    note text,
    settled boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    user_id uuid,
    CONSTRAINT loans_amount_check CHECK ((amount > (0)::numeric)),
    CONSTRAINT loans_amount_settled_check CHECK ((amount_settled >= (0)::numeric)),
    CONSTRAINT loans_direction_check CHECK ((direction = ANY (ARRAY['given'::text, 'taken'::text]))),
    CONSTRAINT loans_interest_rate_check CHECK ((interest_rate >= (0)::numeric))
);

ALTER TABLE public.loans
    ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid() NOT NULL,
    ADD COLUMN IF NOT EXISTS direction text NOT NULL,
    ADD COLUMN IF NOT EXISTS counterparty text NOT NULL,
    ADD COLUMN IF NOT EXISTS amount numeric(12,2) NOT NULL,
    ADD COLUMN IF NOT EXISTS amount_settled numeric(12,2) DEFAULT 0 NOT NULL,
    ADD COLUMN IF NOT EXISTS interest_rate numeric(5,2) DEFAULT 0 NOT NULL,
    ADD COLUMN IF NOT EXISTS loan_date date DEFAULT CURRENT_DATE NOT NULL,
    ADD COLUMN IF NOT EXISTS due_date date,
    ADD COLUMN IF NOT EXISTS note text,
    ADD COLUMN IF NOT EXISTS settled boolean DEFAULT false NOT NULL,
    ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now() NOT NULL,
    ADD COLUMN IF NOT EXISTS user_id uuid;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.loans'::regclass AND conname = 'loans_amount_check'
             AND pg_catalog.pg_get_constraintdef(oid) <> $c$CHECK ((amount > (0)::numeric))$c$) THEN
    ALTER TABLE public.loans DROP CONSTRAINT loans_amount_check;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.loans'::regclass AND conname = 'loans_amount_check') THEN
    ALTER TABLE ONLY public.loans ADD CONSTRAINT loans_amount_check CHECK ((amount > (0)::numeric));
  END IF;
END
$do$;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.loans'::regclass AND conname = 'loans_amount_settled_check'
             AND pg_catalog.pg_get_constraintdef(oid) <> $c$CHECK ((amount_settled >= (0)::numeric))$c$) THEN
    ALTER TABLE public.loans DROP CONSTRAINT loans_amount_settled_check;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.loans'::regclass AND conname = 'loans_amount_settled_check') THEN
    ALTER TABLE ONLY public.loans ADD CONSTRAINT loans_amount_settled_check CHECK ((amount_settled >= (0)::numeric));
  END IF;
END
$do$;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.loans'::regclass AND conname = 'loans_direction_check'
             AND pg_catalog.pg_get_constraintdef(oid) <> $c$CHECK ((direction = ANY (ARRAY['given'::text, 'taken'::text])))$c$) THEN
    ALTER TABLE public.loans DROP CONSTRAINT loans_direction_check;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.loans'::regclass AND conname = 'loans_direction_check') THEN
    ALTER TABLE ONLY public.loans ADD CONSTRAINT loans_direction_check CHECK ((direction = ANY (ARRAY['given'::text, 'taken'::text])));
  END IF;
END
$do$;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.loans'::regclass AND conname = 'loans_interest_rate_check'
             AND pg_catalog.pg_get_constraintdef(oid) <> $c$CHECK ((interest_rate >= (0)::numeric))$c$) THEN
    ALTER TABLE public.loans DROP CONSTRAINT loans_interest_rate_check;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.loans'::regclass AND conname = 'loans_interest_rate_check') THEN
    ALTER TABLE ONLY public.loans ADD CONSTRAINT loans_interest_rate_check CHECK ((interest_rate >= (0)::numeric));
  END IF;
END
$do$;

ALTER TABLE ONLY public.loans REPLICA IDENTITY FULL;

-- Function: public.create_loan(uuid,text,text,numeric,numeric,date,date,text,uuid)
CREATE OR REPLACE FUNCTION public.create_loan(p_user_id uuid, p_direction text, p_counterparty text, p_amount numeric, p_interest_rate numeric DEFAULT 0, p_loan_date date DEFAULT CURRENT_DATE, p_due_date date DEFAULT NULL::date, p_note text DEFAULT NULL::text, p_id uuid DEFAULT NULL::uuid) RETURNS json
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  v_loan   public.loans%rowtype;
  v_txn_id uuid;
  v_txn_type  text;
  v_description  text;
  v_notes        text;
begin
  perform set_config('kosha.trusted_write', 'true', true);
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'Authentication required';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Loan amount must be positive';
  end if;

  if p_direction not in ('given', 'taken') then
    raise exception 'Direction must be given or taken';
  end if;

  if p_counterparty is null or btrim(p_counterparty) = '' then
    raise exception 'Counterparty name is required';
  end if;

  v_txn_type := case p_direction when 'given' then 'expense' else 'income' end;

  v_description := case p_direction
    when 'given' then 'Loan given to ' || btrim(p_counterparty)
    else              'Loan taken from ' || btrim(p_counterparty)
  end;

  v_notes := case p_direction
    when 'given' then 'Money lent to ' || btrim(p_counterparty)
    else              'Money borrowed from ' || btrim(p_counterparty)
  end;

  p_id := coalesce(p_id, gen_random_uuid());

  insert into public.loans (
    id, direction, counterparty, amount, interest_rate,
    loan_date, due_date, note, settled, amount_settled, user_id
  ) values (
    p_id,
    p_direction,
    btrim(p_counterparty),
    p_amount,
    coalesce(p_interest_rate, 0),
    coalesce(p_loan_date, current_date),
    p_due_date,
    nullif(btrim(coalesce(p_note, '')), ''),
    false,
    0,
    p_user_id
  )
  on conflict (id) do nothing;

  select * into v_loan from public.loans where id = p_id;

  insert into transactions (
    date, type, description, amount, category,
    is_repayment, payment_mode, user_id,
    linked_loan_id, notes
  )
  select
    coalesce(p_loan_date, current_date),
    v_txn_type,
    v_description,
    p_amount,
    'loans',
    false,
    'other',
    p_user_id,
    v_loan.id,
    nullif(btrim(coalesce(p_note, '')), '')
  where not exists (
    select 1 from transactions where linked_loan_id = v_loan.id and is_repayment = false
  )
  returning id into v_txn_id;

  if v_txn_id is null then
    select id into v_txn_id from transactions where linked_loan_id = v_loan.id limit 1;
  end if;

  return json_build_object(
    'loan_id',        v_loan.id,
    'transaction_id', v_txn_id,
    'direction',      v_loan.direction,
    'counterparty',   v_loan.counterparty,
    'amount',         v_loan.amount,
    'interest_rate',  v_loan.interest_rate,
    'loan_date',      v_loan.loan_date,
    'due_date',       v_loan.due_date,
    'note',           v_loan.note,
    'settled',        v_loan.settled,
    'amount_settled', v_loan.amount_settled,
    'created_at',     v_loan.created_at
  );
end;
$$;

-- Function: public.delete_liability_with_txns(uuid)
CREATE OR REPLACE FUNCTION public.delete_liability_with_txns(p_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_uid uuid := auth.uid();
  v_owner uuid;
  v_rows integer;
begin
  if v_uid is null then
    raise exception using errcode = '28000', message = 'unauthenticated';
  end if;
  if p_id is null then
    raise exception using errcode = '22023', message = 'p_id is required';
  end if;

  select user_id into v_owner from public.liabilities where id = p_id;
  if v_owner is null then
    return false;
  end if;

  if v_owner <> v_uid then
    raise exception using errcode = '42501', message = 'forbidden';
  end if;

  delete from public.liabilities where id = p_id and user_id = v_uid;
  get diagnostics v_rows = row_count;
  return v_rows > 0;
end;
$$;

-- Function: public.delete_loan_with_txns(uuid)
CREATE OR REPLACE FUNCTION public.delete_loan_with_txns(p_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_uid uuid := auth.uid();
  v_owner uuid;
  v_rows integer;
begin
  if v_uid is null then
    raise exception using errcode = '28000', message = 'unauthenticated';
  end if;
  if p_id is null then
    raise exception using errcode = '22023', message = 'p_id is required';
  end if;

  select user_id into v_owner from public.loans where id = p_id;
  if v_owner is null then return false; end if;
  if v_owner <> v_uid then
    raise exception using errcode = '42501', message = 'forbidden';
  end if;

  delete from public.loans where id = p_id and user_id = v_uid;
  get diagnostics v_rows = row_count;
  return v_rows > 0;
end;
$$;

-- Function: public.delete_split_expense_atomic(uuid)
CREATE OR REPLACE FUNCTION public.delete_split_expense_atomic(p_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_uid uuid := auth.uid();
  v_group_id uuid;
  v_linked_txn uuid;
  v_rows integer;
begin
  if v_uid is null then
    raise exception using errcode = '28000', message = 'unauthenticated';
  end if;
  if p_id is null then
    raise exception using errcode = '22023', message = 'p_id is required';
  end if;

  select group_id, linked_transaction_id
    into v_group_id, v_linked_txn
  from public.split_expenses
  where id = p_id;

  if v_group_id is null then return false; end if;

  if not public.is_split_group_member_or_above(v_group_id, v_uid) then
    raise exception using errcode = '42501', message = 'forbidden';
  end if;

  delete from public.transactions where linked_split_expense_id = p_id;

  delete from public.split_expenses where id = p_id;
  get diagnostics v_rows = row_count;
  return v_rows > 0;
end;
$$;

-- Function: public.delete_split_settlement_atomic(uuid)
CREATE OR REPLACE FUNCTION public.delete_split_settlement_atomic(p_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_uid uuid := auth.uid();
  v_group_id uuid;
  v_payer_txn uuid;
  v_payee_txn uuid;
  v_rows integer;
begin
  if v_uid is null then
    raise exception using errcode = '28000', message = 'unauthenticated';
  end if;
  if p_id is null then
    raise exception using errcode = '22023', message = 'p_id is required';
  end if;

  select group_id, payer_transaction_id, payee_transaction_id
    into v_group_id, v_payer_txn, v_payee_txn
  from public.split_settlements
  where id = p_id;

  if v_group_id is null then return false; end if;

  if not public.is_split_group_member_or_above(v_group_id, v_uid) then
    raise exception using errcode = '42501', message = 'forbidden';
  end if;

  if v_payer_txn is not null then
    delete from public.transactions where id = v_payer_txn;
  end if;
  if v_payee_txn is not null then
    delete from public.transactions where id = v_payee_txn;
  end if;

  delete from public.transactions where linked_split_settlement_id = p_id;

  delete from public.split_settlements where id = p_id;
  get diagnostics v_rows = row_count;
  return v_rows > 0;
end;
$$;

-- Function: public.enforce_invite_active_limit()
CREATE OR REPLACE FUNCTION public.enforce_invite_active_limit() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_active_count integer;
begin
  select count(*) into v_active_count
    from public.invites
    where created_by = new.created_by
      and used_by is null;

  if v_active_count >= 1 then
    raise exception using
      errcode = 'P0001',
      message = 'invite_limit_reached',
      hint    = 'Each user can keep only one active (unused) invite link at a time.';
  end if;

  return new;
end;
$$;

-- Function: public.enforce_reconciliation_review_ownership()
CREATE OR REPLACE FUNCTION public.enforce_reconciliation_review_ownership() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
  v_txn_owner uuid;
BEGIN
  SELECT user_id INTO v_txn_owner FROM public.transactions WHERE id = NEW.transaction_id;

  IF v_txn_owner IS NULL OR v_txn_owner <> NEW.user_id THEN
    RAISE EXCEPTION 'Transaction does not belong to the reviewing user';
  END IF;

  RETURN NEW;
END;
$$;

-- Function: public.ensure_group_has_admin()
CREATE OR REPLACE FUNCTION public.ensure_group_has_admin() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  if old.role = 'admin' and not exists (
    select 1 from public.split_group_access where group_id = old.group_id and role = 'admin'
  ) then
    update public.split_group_access set role = 'admin'
    where id = (
      select id from public.split_group_access
      where group_id = old.group_id
      order by case role when 'member' then 0 else 1 end, created_at
      limit 1
    );
  end if;
  return old;
end;
$$;

-- Function: public.ensure_split_group_owner_access()
CREATE OR REPLACE FUNCTION public.ensure_split_group_owner_access() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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

-- Function: public.ensure_split_group_user_id()
CREATE OR REPLACE FUNCTION public.ensure_split_group_user_id() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  new.user_id := auth.uid();
  return new;
end;
$$;

-- Function: public.generate_recurring_transactions(uuid,date)
CREATE OR REPLACE FUNCTION public.generate_recurring_transactions(p_user_id uuid, p_today date DEFAULT NULL::date) RETURNS integer
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
declare
  v_uid uuid := auth.uid();
  -- Client passes its local date; accept at most one day either side of server UTC.
  v_today date := least(greatest(coalesce(p_today, current_date), current_date - 1), current_date + 1);
  v_step int;
  v_k int;
  v_run_date date;
  v_inserted int := 0;
  v_rowcount int;
  v_guard int;
  rec record;
begin
  if v_uid is null then raise exception 'Authentication required.'; end if;
  if v_uid <> p_user_id then raise exception 'Cannot generate recurring transactions for another user.'; end if;

  perform pg_advisory_xact_lock(hashtext('kosha:recurring:' || p_user_id::text));

  for rec in
    select * from public.transactions
    where user_id = p_user_id and is_recurring = true and recurrence is not null
  loop
    v_step := case rec.recurrence when 'monthly' then 1 when 'quarterly' then 3 when 'yearly' then 12 end;
    continue when v_step is null;

    v_run_date := coalesce(rec.next_run_date, (rec.date + make_interval(months => v_step))::date);
    continue when v_run_date > v_today;

    -- Whole months between the anchor and the next run (self-heals rows that already drifted).
    v_k := ((extract(year from v_run_date) - extract(year from rec.date)) * 12
          + (extract(month from v_run_date) - extract(month from rec.date)))::int;
    v_guard := 0;

    while v_run_date <= v_today and v_guard < 120 loop
      insert into public.transactions (
        date, type, description, amount, category, investment_vehicle, is_repayment,
        payment_mode, notes, is_recurring, recurrence, next_run_date,
        source_transaction_id, is_auto_generated, user_id
      ) values (
        v_run_date, rec.type, rec.description, rec.amount, rec.category, rec.investment_vehicle,
        rec.is_repayment, rec.payment_mode, rec.notes, false, null, null,
        rec.id, true, rec.user_id
      ) on conflict (source_transaction_id, date) where source_transaction_id is not null do nothing;
      get diagnostics v_rowcount = row_count;
      v_inserted := v_inserted + v_rowcount;
      v_guard := v_guard + 1;
      v_k := v_k + v_step;
      v_run_date := (rec.date + make_interval(months => v_k))::date;
    end loop;

    update public.transactions set next_run_date = v_run_date
    where id = rec.id and user_id = p_user_id;
  end loop;

  return v_inserted;
end;
$$;

-- Function: public.get_month_summary(uuid,text)
CREATE OR REPLACE FUNCTION public.get_month_summary(p_user_id uuid, p_month text) RETURNS TABLE(total_income numeric, total_expense numeric, total_investment numeric, category text, investment_vehicle text, total numeric)
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
  -- (Uses the exact same existing query)
  with month_bounds as (
    select
      (p_month || '-01')::date as start_date,
      ((p_month || '-01')::date + interval '1 month' - interval '1 day')::date as end_date
  ),
  month_txns as (
    select t.amount, t.type, t.category, t.investment_vehicle
    from public.transactions t
    cross join month_bounds b
    where t.user_id = p_user_id
      and t.date >= b.start_date
      and t.date <= b.end_date
  ),
  totals as (
    select
      coalesce(sum(amount) filter (where type = 'income'), 0) as total_income,
      coalesce(sum(amount) filter (where type = 'expense'), 0) as total_expense,
      coalesce(sum(amount) filter (where type = 'investment'), 0) as total_investment
    from month_txns
  )
  select
    totals.total_income,
    totals.total_expense,
    totals.total_investment,
    null::text as category,
    null::text as investment_vehicle,
    null::numeric as total
  from totals

  union all

  select
    null::numeric, null::numeric, null::numeric,
    category,
    null::text,
    sum(amount) as total
  from month_txns
  where type = 'expense'
  group by category

  union all

  select
    null::numeric, null::numeric, null::numeric,
    null::text,
    investment_vehicle,
    sum(amount) as total
  from month_txns
  where type = 'investment'
  group by investment_vehicle;
$$;

-- Function: public.get_month_summary(uuid[],integer,integer)
CREATE OR REPLACE FUNCTION public.get_month_summary(p_user_ids uuid[], p_year integer, p_month integer) RETURNS TABLE(type text, is_repayment boolean, category text, investment_vehicle text, total numeric)
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  select type, is_repayment, coalesce(category, 'other'), coalesce(investment_vehicle, 'Other'), sum(amount)
  from transactions where user_id = any(p_user_ids)
    and date >= make_date(p_year, p_month, 1)
    and date <= (make_date(p_year, p_month, 1) + interval '1 month - 1 day')::date
  group by type, is_repayment, category, investment_vehicle
$$;

-- Function: public.get_month_summary(uuid,integer,integer)
CREATE OR REPLACE FUNCTION public.get_month_summary(p_user_id uuid, p_year integer, p_month integer) RETURNS TABLE(type text, is_repayment boolean, category text, investment_vehicle text, total numeric)
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
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

-- Function: public.get_running_balance(uuid[],date)
CREATE OR REPLACE FUNCTION public.get_running_balance(p_user_ids uuid[], p_end_date date) RETURNS numeric
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
  SELECT coalesce(
    (
      SELECT sum(net_change)
      FROM public.monthly_net_changes
      WHERE user_id = ANY(p_user_ids)
        AND month_start < date_trunc('month', p_end_date)::date
    ), 0
  ) + coalesce(
    (
      SELECT sum(CASE WHEN type = 'income' THEN amount ELSE -amount END)
      FROM public.transactions
      WHERE user_id = ANY(p_user_ids)
        AND date >= date_trunc('month', p_end_date)::date
        AND date <= p_end_date
    ), 0
  );
$$;

-- Function: public.get_running_balance(uuid,date)
CREATE OR REPLACE FUNCTION public.get_running_balance(p_user_id uuid, p_end_date date) RETURNS numeric
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  select coalesce(
    sum(case when type = 'income' then amount else -amount end),
    0
  )
  from transactions
  where user_id  = p_user_id
    and date    <= p_end_date
$$;

-- Function: public.get_transaction_signal_aggregates(uuid,text,text,text,text,date,date)
CREATE OR REPLACE FUNCTION public.get_transaction_signal_aggregates(p_user_id uuid, p_type text DEFAULT NULL::text, p_category text DEFAULT NULL::text, p_payment_mode text DEFAULT NULL::text, p_search text DEFAULT NULL::text, p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date) RETURNS json
    LANGUAGE plpgsql STABLE
    SET search_path TO 'public'
    AS $$
declare
  v_needle text;
  v_result json;
begin
  -- Normalise the search needle the same way the JS client does
  v_needle := lower(trim(regexp_replace(coalesce(p_search, ''), '[,%()]', ' ', 'g')));
  if v_needle = '' then
    v_needle := null;
  end if;

  select json_build_object(
    'rowCount',              coalesce(agg.row_count, 0),
    'activeDays',            coalesce(agg.active_days, 0),
    'minDate',               agg.min_date,
    'maxDate',               agg.max_date,
    'expenseCount',          coalesce(agg.expense_count, 0),
    'paymentModeCounts',     coalesce(pm.counts, '{}'::json),
    'expenseCategoryCounts', coalesce(ec.counts, '{}'::json)
  )
  into v_result
  from (
    -- Core aggregates: one pass over the filtered rows
    select
      count(*)                                               as row_count,
      count(distinct date)                                   as active_days,
      min(date)::text                                        as min_date,
      max(date)::text                                        as max_date,
      count(*) filter (where type = 'expense')               as expense_count
    from transactions t
    where t.user_id = p_user_id
      and (p_type         is null or t.type         = p_type)
      and (p_category     is null or t.category     = p_category)
      and (p_payment_mode is null or t.payment_mode = p_payment_mode)
      and (p_start_date   is null or t.date        >= p_start_date)
      and (p_end_date     is null or t.date        <= p_end_date)
      and (
        v_needle is null
        or lower(t.description) like '%' || v_needle || '%'
        or lower(coalesce(t.notes, '')) like '%' || v_needle || '%'
        or t.category in (
            -- mirror the JS CATEGORY_LABEL_BY_ID lookup: match category IDs
            -- whose label contains the search needle
            select c.id from (
              values
                ('food','food'),('transport','transport'),('shopping','shopping'),
                ('entertainment','entertainment'),('health','health'),('utilities','utilities'),
                ('travel','travel'),('education','education'),('personal','personal'),
                ('home','home'),('insurance','insurance'),('taxes','taxes'),
                ('gifts','gifts'),('investments','investments'),('salary','salary'),
                ('freelance','freelance'),('business','business'),('rental','rental'),
                ('dividends','dividends'),('other','other')
            ) as c(id, label)
            where lower(c.label) like '%' || v_needle || '%'
          )
      )
  ) agg
  -- Payment-mode breakdown (all types)
  cross join lateral (
    select json_object_agg(payment_mode, cnt) as counts
    from (
      select coalesce(t2.payment_mode, 'other') as payment_mode, count(*) as cnt
      from transactions t2
      where t2.user_id = p_user_id
        and (p_type         is null or t2.type         = p_type)
        and (p_category     is null or t2.category     = p_category)
        and (p_payment_mode is null or t2.payment_mode = p_payment_mode)
        and (p_start_date   is null or t2.date        >= p_start_date)
        and (p_end_date     is null or t2.date        <= p_end_date)
        and (
          v_needle is null
          or lower(t2.description) like '%' || v_needle || '%'
          or lower(coalesce(t2.notes, '')) like '%' || v_needle || '%'
        )
      group by coalesce(t2.payment_mode, 'other')
    ) s
  ) pm
  -- Expense-category breakdown (expenses only)
  cross join lateral (
    select json_object_agg(category, cnt) as counts
    from (
      select coalesce(t3.category, 'other') as category, count(*) as cnt
      from transactions t3
      where t3.user_id = p_user_id
        and t3.type = 'expense'
        and (p_payment_mode is null or t3.payment_mode = p_payment_mode)
        and (p_start_date   is null or t3.date        >= p_start_date)
        and (p_end_date     is null or t3.date        <= p_end_date)
        and (
          v_needle is null
          or lower(t3.description) like '%' || v_needle || '%'
          or lower(coalesce(t3.notes, '')) like '%' || v_needle || '%'
        )
      group by coalesce(t3.category, 'other')
    ) s
  ) ec;

  return coalesce(v_result, json_build_object(
    'rowCount', 0, 'activeDays', 0, 'minDate', null, 'maxDate', null,
    'expenseCount', 0, 'paymentModeCounts', '{}'::json, 'expenseCategoryCounts', '{}'::json
  ));
end;
$$;

-- Function: public.get_transaction_signal_aggregates(uuid,text,text,text,text,date,date,uuid,uuid,uuid,uuid)
CREATE OR REPLACE FUNCTION public.get_transaction_signal_aggregates(p_user_id uuid, p_type text DEFAULT NULL::text, p_category text DEFAULT NULL::text, p_payment_mode text DEFAULT NULL::text, p_search text DEFAULT NULL::text, p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date, p_linked_loan_id uuid DEFAULT NULL::uuid, p_linked_bill_id uuid DEFAULT NULL::uuid, p_linked_split_expense_id uuid DEFAULT NULL::uuid, p_linked_split_settlement_id uuid DEFAULT NULL::uuid) RETURNS json
    LANGUAGE plpgsql STABLE
    SET search_path TO 'public'
    AS $$
declare
  v_needle text;
  v_result json;
begin
  -- Normalise the search needle the same way the JS client does
  v_needle := lower(trim(regexp_replace(coalesce(p_search, ''), '[,%()]', ' ', 'g')));
  if v_needle = '' then
    v_needle := null;
  end if;

  select json_build_object(
    'rowCount',              coalesce(agg.row_count, 0),
    'activeDays',            coalesce(agg.active_days, 0),
    'minDate',               agg.min_date,
    'maxDate',               agg.max_date,
    'expenseCount',          coalesce(agg.expense_count, 0),
    'paymentModeCounts',     coalesce(pm.counts, '{}'::json),
    'expenseCategoryCounts', coalesce(ec.counts, '{}'::json)
  )
  into v_result
  from (
    -- Core aggregates: one pass over the filtered rows
    select
      count(*)                                               as row_count,
      count(distinct date)                                   as active_days,
      min(date)::text                                        as min_date,
      max(date)::text                                        as max_date,
      count(*) filter (where type = 'expense')               as expense_count
    from transactions t
    where t.user_id = p_user_id
      and (p_type         is null or t.type         = p_type)
      and (p_category     is null or t.category     = p_category)
      and (p_payment_mode is null or t.payment_mode = p_payment_mode)
      and (p_start_date   is null or t.date        >= p_start_date)
      and (p_end_date     is null or t.date        <= p_end_date)
      and (p_linked_loan_id is null or t.linked_loan_id = p_linked_loan_id)
      and (p_linked_bill_id is null or t.linked_bill_id = p_linked_bill_id)
      and (p_linked_split_expense_id is null or t.linked_split_expense_id = p_linked_split_expense_id)
      and (p_linked_split_settlement_id is null or t.linked_split_settlement_id = p_linked_split_settlement_id)
      and (
        v_needle is null
        or lower(t.description) like '%' || v_needle || '%'
        or lower(coalesce(t.notes, '')) like '%' || v_needle || '%'
        or t.category in (
            select c.id from (
              values
                ('food','food'),('transport','transport'),('shopping','shopping'),
                ('entertainment','entertainment'),('health','health'),('utilities','utilities'),
                ('travel','travel'),('education','education'),('personal','personal'),
                ('home','home'),('insurance','insurance'),('taxes','taxes'),
                ('gifts','gifts'),('investments','investments'),('salary','salary'),
                ('freelance','freelance'),('business','business'),('rental','rental'),
                ('dividends','dividends'),('other','other')
            ) as c(id, label)
            where lower(c.label) like '%' || v_needle || '%'
          )
      )
  ) agg
  cross join lateral (
    select json_object_agg(payment_mode, cnt) as counts
    from (
      select coalesce(t2.payment_mode, 'other') as payment_mode, count(*) as cnt
      from transactions t2
      where t2.user_id = p_user_id
        and (p_type         is null or t2.type         = p_type)
        and (p_category     is null or t2.category     = p_category)
        and (p_payment_mode is null or t2.payment_mode = p_payment_mode)
        and (p_start_date   is null or t2.date        >= p_start_date)
        and (p_end_date     is null or t2.date        <= p_end_date)
        and (p_linked_loan_id is null or t2.linked_loan_id = p_linked_loan_id)
        and (p_linked_bill_id is null or t2.linked_bill_id = p_linked_bill_id)
        and (p_linked_split_expense_id is null or t2.linked_split_expense_id = p_linked_split_expense_id)
        and (p_linked_split_settlement_id is null or t2.linked_split_settlement_id = p_linked_split_settlement_id)
        and (
          v_needle is null
          or lower(t2.description) like '%' || v_needle || '%'
          or lower(coalesce(t2.notes, '')) like '%' || v_needle || '%'
        )
      group by coalesce(t2.payment_mode, 'other')
    ) s
  ) pm
  cross join lateral (
    select json_object_agg(category, cnt) as counts
    from (
      select coalesce(t3.category, 'other') as category, count(*) as cnt
      from transactions t3
      where t3.user_id = p_user_id
        and t3.type = 'expense'
        and (p_payment_mode is null or t3.payment_mode = p_payment_mode)
        and (p_start_date   is null or t3.date        >= p_start_date)
        and (p_end_date     is null or t3.date        <= p_end_date)
        and (p_linked_loan_id is null or t3.linked_loan_id = p_linked_loan_id)
        and (p_linked_bill_id is null or t3.linked_bill_id = p_linked_bill_id)
        and (p_linked_split_expense_id is null or t3.linked_split_expense_id = p_linked_split_expense_id)
        and (p_linked_split_settlement_id is null or t3.linked_split_settlement_id = p_linked_split_settlement_id)
        and (
          v_needle is null
          or lower(t3.description) like '%' || v_needle || '%'
          or lower(coalesce(t3.notes, '')) like '%' || v_needle || '%'
        )
      group by coalesce(t3.category, 'other')
    ) s
  ) ec;

  return coalesce(v_result, json_build_object(
    'rowCount', 0, 'activeDays', 0, 'minDate', null, 'maxDate', null,
    'expenseCount', 0, 'paymentModeCounts', '{}'::json, 'expenseCategoryCounts', '{}'::json
  ));
end;
$$;

-- Function: public.get_year_summary(uuid[],integer)
CREATE OR REPLACE FUNCTION public.get_year_summary(p_user_ids uuid[], p_year integer) RETURNS TABLE(monthly_data json, category_data json, vehicle_data json, totals json, top5_expenses json)
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
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

-- Function: public.get_year_summary(uuid,integer)
CREATE OR REPLACE FUNCTION public.get_year_summary(p_user_id uuid, p_year integer) RETURNS TABLE(monthly_data json, category_data json, vehicle_data json, totals json, top5_expenses json)
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  select * from public.get_year_summary(ARRAY[p_user_id], p_year);
$$;

-- Function: public.guard_split_direct_writes()
CREATE OR REPLACE FUNCTION public.guard_split_direct_writes() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  if current_user in ('authenticated', 'anon')
     and current_setting('kosha.trusted_write', true) is distinct from 'true' then
    raise exception using errcode = '42501',
      message = 'Split data can only be changed through the app''s split functions.';
  end if;
  return coalesce(new, old);
end;
$$;

-- Function: public.guard_transaction_link_columns()
CREATE OR REPLACE FUNCTION public.guard_transaction_link_columns() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  if current_user not in ('authenticated', 'anon')
     or current_setting('kosha.trusted_write', true) = 'true' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.linked_split_expense_id is not null
       or new.linked_split_settlement_id is not null
       or new.linked_loan_id is not null then
      raise exception using errcode = '42501',
        message = 'Linked split and loan columns are managed by the server';
    end if;
  elsif new.linked_split_expense_id    is distinct from old.linked_split_expense_id
     or new.linked_split_settlement_id is distinct from old.linked_split_settlement_id
     or new.linked_loan_id             is distinct from old.linked_loan_id then
    raise exception using errcode = '42501',
      message = 'Linked split and loan columns are managed by the server';
  end if;

  if new.linked_bill_id is not null
     and (tg_op = 'INSERT' or new.linked_bill_id is distinct from old.linked_bill_id)
     and not exists (
       select 1 from public.liabilities l
       where l.id = new.linked_bill_id and l.user_id = new.user_id
     ) then
    raise exception using errcode = '42501', message = 'Bill does not belong to this user';
  end if;

  return new;
end;
$$;

-- Function: public.handle_new_user()
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Function: public.has_split_group_access(uuid,uuid)
CREATE OR REPLACE FUNCTION public.has_split_group_access(p_group_id uuid, p_user_id uuid DEFAULT auth.uid()) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1
    from split_group_access a
    where a.group_id = p_group_id
      and a.user_id = p_user_id
  );
$$;

-- Function: public.is_linked(uuid)
CREATE OR REPLACE FUNCTION public.is_linked(target_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select target_user_id = auth.uid() or exists (
    select 1 from public.invites
    where (created_by = auth.uid() and used_by = target_user_id)
       or (used_by = auth.uid() and created_by = target_user_id)
  );
$$;

-- Function: public.is_linked(uuid,uuid)
CREATE OR REPLACE FUNCTION public.is_linked(target_user_id uuid, p_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select p_user_id = target_user_id or exists (
    select 1 from public.invites
    where (created_by = p_user_id and used_by = target_user_id)
       or (used_by = p_user_id and created_by = target_user_id)
  );
$$;

-- Function: public.is_split_group_member_or_above(uuid,uuid)
CREATE OR REPLACE FUNCTION public.is_split_group_member_or_above(p_group_id uuid, p_user_id uuid DEFAULT auth.uid()) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1
    from split_group_access a
    where a.group_id = p_group_id
      and a.user_id = p_user_id
      and a.role in ('admin', 'member')
  );
$$;

-- Function: public.is_split_group_owner(uuid,uuid)
CREATE OR REPLACE FUNCTION public.is_split_group_owner(p_group_id uuid, p_user_id uuid DEFAULT auth.uid()) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1
    from split_group_access a
    where a.group_id = p_group_id
      and a.user_id = p_user_id
      and a.role = 'admin'
  );
$$;

-- Function: public.log_financial_event_trg()
CREATE OR REPLACE FUNCTION public.log_financial_event_trg() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_user uuid;
  v_action text;
  v_entity_type text;
  v_entity_id uuid;
  v_metadata jsonb;
begin
  if tg_op = 'DELETE' then
    v_entity_id := old.id;
  else
    v_entity_id := new.id;
  end if;

  -- Determine the user_id to attribute the event to. Owner-keyed tables
  -- (transactions/liabilities/loans) carry user_id directly; split_*
  -- tables are scoped to a group, so we fall back to the calling user.
  if tg_table_name in ('transactions', 'liabilities', 'loans') then
    if tg_op = 'DELETE' then
      v_user := old.user_id;
    else
      v_user := new.user_id;
    end if;
  else
    v_user := auth.uid();
  end if;

  if v_user is null then
    -- Nothing to attribute the event to (e.g. a system migration insert).
    -- Skip the audit write rather than fabricating a user_id.
    return coalesce(new, old);
  end if;

  case tg_table_name
    when 'transactions' then
      v_entity_type := 'transaction';
      v_action := case tg_op
        when 'INSERT' then 'transaction_added'
        when 'UPDATE' then 'transaction_updated'
        when 'DELETE' then 'transaction_deleted'
      end;
    when 'liabilities' then
      v_entity_type := 'liability';
      -- Preserve the "marked paid" distinction the old client emitted —
      -- it's the only update transition worth distinguishing at this
      -- table; everything else collapses to 'liability_updated'.
      v_action := case tg_op
        when 'INSERT' then 'liability_added'
        when 'UPDATE' then case
          when (new.paid is distinct from old.paid) and new.paid then 'liability_marked_paid'
          else 'liability_updated'
        end
        when 'DELETE' then 'liability_deleted'
      end;
    when 'loans' then
      v_entity_type := 'loan';
      v_action := case tg_op
        when 'INSERT' then 'loan_added'
        when 'UPDATE' then 'loan_updated'
        when 'DELETE' then 'loan_deleted'
      end;
    when 'split_expenses' then
      v_entity_type := 'split_expense';
      v_action := case tg_op
        when 'INSERT' then 'splitwise_expense_added'
        when 'UPDATE' then 'splitwise_expense_updated'
        when 'DELETE' then 'splitwise_expense_deleted'
      end;
    when 'split_settlements' then
      v_entity_type := 'split_settlement';
      v_action := case tg_op
        when 'INSERT' then 'splitwise_settlement_added'
        when 'UPDATE' then 'splitwise_settlement_updated'
        when 'DELETE' then 'splitwise_settlement_deleted'
      end;
    else
      return coalesce(new, old);
  end case;

  -- Keep metadata small and stable. On DELETE we capture a row snapshot
  -- so the audit history can be replayed even after the source row is
  -- gone. INSERT/UPDATE rely on the row itself as the source of truth.
  v_metadata := case tg_op
    when 'DELETE' then jsonb_build_object('snapshot', to_jsonb(old))
    else null
  end;

  insert into public.financial_events (user_id, action, entity_type, entity_id, metadata)
  values (v_user, v_action, v_entity_type, v_entity_id, v_metadata);

  return coalesce(new, old);
exception
  when others then
    raise warning 'log_financial_event_trg failed for %.%: %', tg_table_name, tg_op, sqlerrm;
    return coalesce(new, old);
end;
$$;

-- Function: public.maintain_monthly_net_change()
CREATE OR REPLACE FUNCTION public.maintain_monthly_net_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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

-- Function: public.mark_liability_paid(uuid,uuid,date)
CREATE OR REPLACE FUNCTION public.mark_liability_paid(p_liability_id uuid, p_user_id uuid, p_paid_on date DEFAULT NULL::date) RETURNS json
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  v_liability liabilities%rowtype;
  v_txn_id uuid;
  v_next_due date;
  v_txn_mode text;
  v_paid_on date := least(greatest(coalesce(p_paid_on, current_date), current_date - 1), current_date + 1);
  v_anchor date;
  v_step int;
  v_k int;
begin
  select * into v_liability from liabilities
  where id = p_liability_id and user_id = p_user_id
  for update;
  if not found then raise exception 'Liability not found or access denied'; end if;

  if v_liability.paid then
    -- Idempotent: a retry after a lost response returns the original result.
    return json_build_object(
      'transaction_id', v_liability.linked_transaction_id,
      'liability_id', p_liability_id,
      'next_due_date', null,
      'already_paid', true
    );
  end if;

  v_txn_mode := case v_liability.payment_mode
    when 'card' then 'credit_card'
    when 'bank' then 'net_banking'
    when 'upi' then 'upi'
    when 'cash' then 'cash'
    else 'other'
  end;

  insert into transactions (date, type, description, amount, category, is_repayment, payment_mode, user_id, linked_bill_id)
  values (v_paid_on, 'expense', v_liability.description, v_liability.amount, 'bills', false, v_txn_mode, p_user_id, p_liability_id)
  returning id into v_txn_id;

  update liabilities set paid = true, linked_transaction_id = v_txn_id where id = p_liability_id;

  if v_liability.is_recurring and v_liability.recurrence is not null then
    v_step := case v_liability.recurrence when 'quarterly' then 3 when 'yearly' then 12 else 1 end;
    v_anchor := coalesce(v_liability.recurrence_anchor, v_liability.due_date);
    v_k := ((extract(year from v_liability.due_date) - extract(year from v_anchor)) * 12
          + (extract(month from v_liability.due_date) - extract(month from v_anchor)))::int + v_step;
    v_next_due := (v_anchor + make_interval(months => v_k))::date;

    insert into liabilities (description, amount, due_date, is_recurring, recurrence, paid, payment_mode, user_id, recurrence_anchor)
    values (v_liability.description, v_liability.amount, v_next_due, true, v_liability.recurrence, false,
            v_liability.payment_mode, p_user_id, v_anchor);
  end if;

  return json_build_object('transaction_id', v_txn_id, 'liability_id', p_liability_id, 'next_due_date', v_next_due);
end;
$$;

-- Function: public.on_split_group_delete_cleanup()
CREATE OR REPLACE FUNCTION public.on_split_group_delete_cleanup() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  -- Delete all transactions linked to expenses in the group being deleted
  delete from public.transactions
  where linked_split_expense_id in (
    select id from public.split_expenses where group_id = old.id
  );

  -- Delete all transactions linked to settlements in the group being deleted
  delete from public.transactions
  where linked_split_settlement_id in (
    select id from public.split_settlements where group_id = old.id
  );

  return old;
end;
$$;

-- Function: public.prevent_bug_report_tampering()
CREATE OR REPLACE FUNCTION public.prevent_bug_report_tampering() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF current_setting('role', true) = 'service_role' THEN
      RETURN NEW;
    END IF;

    IF NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'Users cannot modify the status of a bug report';
    END IF;
    IF NEW.priority IS DISTINCT FROM OLD.priority THEN
      RAISE EXCEPTION 'Users cannot modify the priority of a bug report';
    END IF;
    IF NEW.assignee IS DISTINCT FROM OLD.assignee THEN
      RAISE EXCEPTION 'Users cannot modify the assignee of a bug report';
    END IF;
    IF NEW.resolved_at IS DISTINCT FROM OLD.resolved_at THEN
      RAISE EXCEPTION 'Users cannot modify the resolved_at timestamp of a bug report';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Function: public.prevent_immutable_update()
CREATE OR REPLACE FUNCTION public.prevent_immutable_update() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF current_setting('role', true) = 'service_role' THEN
      RETURN NEW;
    END IF;

    IF NEW.id IS DISTINCT FROM OLD.id THEN
      RAISE EXCEPTION 'Updating the id column is not allowed';
    END IF;

    IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Updating the created_at column is not allowed';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Function: public.record_loan_payment(uuid,uuid,numeric,uuid,date)
CREATE OR REPLACE FUNCTION public.record_loan_payment(p_loan_id uuid, p_user_id uuid, p_amount numeric, p_id uuid DEFAULT NULL::uuid, p_paid_on date DEFAULT NULL::date) RETURNS json
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  v_loan public.loans%rowtype;
  v_existing public.transactions%rowtype;
  v_new_settled numeric;
  v_fully_settled boolean;
  v_txn_type text;
  v_paid_on date := least(greatest(coalesce(p_paid_on, current_date), current_date - 1), current_date + 1);
begin
  perform set_config('kosha.trusted_write', 'true', true);
  p_amount := round(p_amount, 2);
  if p_amount is null or p_amount <= 0 then raise exception 'Payment amount must be positive'; end if;

  select * into v_loan from public.loans
  where id = p_loan_id and user_id = p_user_id
  for update;
  if not found then raise exception 'Loan not found or access denied'; end if;

  -- Idempotency first: a retry with the same id returns the original outcome.
  if p_id is not null then
    select * into v_existing from public.transactions where id = p_id and user_id = p_user_id;
    if found then
      return json_build_object(
        'transaction_id', p_id, 'loan_id', p_loan_id, 'payment_amount', v_existing.amount,
        'new_amount_settled', v_loan.amount_settled, 'fully_settled', v_loan.settled
      );
    end if;
  end if;

  if v_loan.settled then raise exception 'Loan is already fully settled'; end if;

  v_new_settled := v_loan.amount_settled + p_amount;
  if v_new_settled > v_loan.amount then
    raise exception 'Payment exceeds remaining balance (remaining: %)', (v_loan.amount - v_loan.amount_settled);
  end if;
  v_fully_settled := v_new_settled >= v_loan.amount;
  v_txn_type := case v_loan.direction when 'given' then 'income' else 'expense' end;

  insert into transactions (id, date, type, description, amount, category, is_repayment, payment_mode, user_id, linked_loan_id)
  values (coalesce(p_id, gen_random_uuid()), v_paid_on, v_txn_type, 'Loan payment: ' || v_loan.counterparty,
          p_amount, 'loans', true, 'other', p_user_id, p_loan_id)
  returning id into p_id;

  update public.loans set amount_settled = v_new_settled, settled = v_fully_settled where id = p_loan_id;

  return json_build_object('transaction_id', p_id, 'loan_id', p_loan_id, 'payment_amount', p_amount,
                           'new_amount_settled', v_new_settled, 'fully_settled', v_fully_settled);
end;
$$;

-- Function: public.rls_auto_enable()
CREATE OR REPLACE FUNCTION public.rls_auto_enable() RETURNS event_trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;

-- Table: public.split_group_members
CREATE TABLE IF NOT EXISTS public.split_group_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    group_id uuid NOT NULL,
    display_name text NOT NULL,
    is_self boolean DEFAULT false NOT NULL,
    linked_user_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    user_id uuid,
    archived_at timestamp with time zone
);

ALTER TABLE public.split_group_members
    ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid() NOT NULL,
    ADD COLUMN IF NOT EXISTS group_id uuid NOT NULL,
    ADD COLUMN IF NOT EXISTS display_name text NOT NULL,
    ADD COLUMN IF NOT EXISTS is_self boolean DEFAULT false NOT NULL,
    ADD COLUMN IF NOT EXISTS linked_user_id uuid,
    ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now() NOT NULL,
    ADD COLUMN IF NOT EXISTS user_id uuid,
    ADD COLUMN IF NOT EXISTS archived_at timestamp with time zone;

-- Function: public.split_archive_member(uuid)
CREATE OR REPLACE FUNCTION public.split_archive_member(p_member_id uuid) RETURNS public.split_group_members
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_uid uuid := auth.uid();
  v_member public.split_group_members%rowtype;
  v_balance numeric;
begin
  if v_uid is null then raise exception using errcode = '28000', message = 'unauthenticated'; end if;

  select * into v_member from public.split_group_members where id = p_member_id for update;
  if not found then raise exception 'Member not found'; end if;

  perform 1 from public.split_groups where id = v_member.group_id for update;

  if not public.is_split_group_owner(v_member.group_id, v_uid) then
    raise exception using errcode = '42501', message = 'Only a group admin can remove members.';
  end if;
  if v_member.archived_at is not null then return v_member; end if;
  if v_member.linked_user_id = v_uid then
    raise exception 'Use "Leave group" to remove yourself.';
  end if;

  v_balance := public.split_member_net_balance(p_member_id);
  if v_balance <> 0 then
    raise exception using errcode = 'P0001',
      message = format('This member still has an unsettled balance of %s. Settle up first.', v_balance);
  end if;

  update public.split_group_members set archived_at = now()
  where id = p_member_id
  returning * into v_member;

  if v_member.linked_user_id is not null then
    delete from public.split_group_access
    where group_id = v_member.group_id and user_id = v_member.linked_user_id;
  end if;

  return v_member;
end;
$$;

-- Table: public.split_groups
CREATE TABLE IF NOT EXISTS public.split_groups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    user_id uuid,
    is_archived boolean DEFAULT false NOT NULL,
    banner_id text
);

ALTER TABLE public.split_groups
    ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid() NOT NULL,
    ADD COLUMN IF NOT EXISTS name text NOT NULL,
    ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now() NOT NULL,
    ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now() NOT NULL,
    ADD COLUMN IF NOT EXISTS user_id uuid,
    ADD COLUMN IF NOT EXISTS is_archived boolean DEFAULT false NOT NULL,
    ADD COLUMN IF NOT EXISTS banner_id text;

-- Function: public.split_consume_group_invite(text)
CREATE OR REPLACE FUNCTION public.split_consume_group_invite(p_token text) RETURNS public.split_groups
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_invite split_group_invites%rowtype;
  v_group split_groups%rowtype;
  v_account_name text;
  v_existing_member_id uuid;
  v_member_name text;
  v_suffix int;
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
    and (i.expires_at is null or i.expires_at > now())
  for update;

  if not found then
    raise exception 'Invite not found, already used or expired';
  end if;

  select * into v_group
  from split_groups g
  where g.id = v_invite.group_id
  for update;

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
      else coalesce(v_invite.role, 'member')
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
      and m.linked_user_id is null
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
      v_member_name := v_account_name;
      v_suffix := 1;
      loop
        begin
          insert into split_group_members (group_id, display_name, is_self, linked_user_id, user_id)
          values (v_invite.group_id, v_member_name, false, v_uid, v_uid);
          exit;
        exception
          when unique_violation then
            v_suffix := v_suffix + 1;
            if v_suffix > 20 then
              raise exception 'Could not add you to this group: too many members named %', v_account_name;
            end if;
            v_member_name := v_account_name || ' (' || v_suffix || ')';
        end;
      end loop;
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

-- Table: public.split_expenses
CREATE TABLE IF NOT EXISTS public.split_expenses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    group_id uuid NOT NULL,
    paid_by_member_id uuid NOT NULL,
    description text NOT NULL,
    amount numeric(12,2) NOT NULL,
    expense_date date DEFAULT CURRENT_DATE NOT NULL,
    split_method text NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    user_id uuid,
    linked_transaction_id uuid,
    CONSTRAINT split_expenses_amount_check CHECK ((amount > (0)::numeric)),
    CONSTRAINT split_expenses_split_method_check CHECK ((split_method = ANY (ARRAY['equal'::text, 'exact'::text, 'percent'::text, 'shares'::text])))
);

ALTER TABLE public.split_expenses
    ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid() NOT NULL,
    ADD COLUMN IF NOT EXISTS group_id uuid NOT NULL,
    ADD COLUMN IF NOT EXISTS paid_by_member_id uuid NOT NULL,
    ADD COLUMN IF NOT EXISTS description text NOT NULL,
    ADD COLUMN IF NOT EXISTS amount numeric(12,2) NOT NULL,
    ADD COLUMN IF NOT EXISTS expense_date date DEFAULT CURRENT_DATE NOT NULL,
    ADD COLUMN IF NOT EXISTS split_method text NOT NULL,
    ADD COLUMN IF NOT EXISTS notes text,
    ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now() NOT NULL,
    ADD COLUMN IF NOT EXISTS user_id uuid,
    ADD COLUMN IF NOT EXISTS linked_transaction_id uuid;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.split_expenses'::regclass AND conname = 'split_expenses_amount_check'
             AND pg_catalog.pg_get_constraintdef(oid) <> $c$CHECK ((amount > (0)::numeric))$c$) THEN
    ALTER TABLE public.split_expenses DROP CONSTRAINT split_expenses_amount_check;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.split_expenses'::regclass AND conname = 'split_expenses_amount_check') THEN
    ALTER TABLE ONLY public.split_expenses ADD CONSTRAINT split_expenses_amount_check CHECK ((amount > (0)::numeric));
  END IF;
END
$do$;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.split_expenses'::regclass AND conname = 'split_expenses_split_method_check'
             AND pg_catalog.pg_get_constraintdef(oid) <> $c$CHECK ((split_method = ANY (ARRAY['equal'::text, 'exact'::text, 'percent'::text, 'shares'::text])))$c$) THEN
    ALTER TABLE public.split_expenses DROP CONSTRAINT split_expenses_split_method_check;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.split_expenses'::regclass AND conname = 'split_expenses_split_method_check') THEN
    ALTER TABLE ONLY public.split_expenses ADD CONSTRAINT split_expenses_split_method_check CHECK ((split_method = ANY (ARRAY['equal'::text, 'exact'::text, 'percent'::text, 'shares'::text])));
  END IF;
END
$do$;

-- Function: public.split_create_expense(uuid,uuid,text,numeric,date,text,text,jsonb,boolean,text,uuid)
CREATE OR REPLACE FUNCTION public.split_create_expense(p_group_id uuid, p_paid_by_member_id uuid, p_description text, p_amount numeric, p_expense_date date DEFAULT CURRENT_DATE, p_split_method text DEFAULT 'equal'::text, p_notes text DEFAULT NULL::text, p_splits jsonb DEFAULT '[]'::jsonb, p_sync_transaction boolean DEFAULT true, p_transaction_category text DEFAULT 'other'::text, p_id uuid DEFAULT NULL::uuid) RETURNS public.split_expenses
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_group public.split_groups%rowtype;
  v_expense public.split_expenses%rowtype;
  v_sum numeric := 0;
  v_item jsonb;
  v_member_id uuid;
  v_share numeric;
  v_percent numeric;
  v_shares numeric;
  v_payer_uid uuid;
  v_txn_id uuid;
begin
  perform set_config('kosha.trusted_write', 'true', true);
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if exists (select 1 from public.split_groups where id = p_group_id and is_archived) then
    raise exception using errcode = '42501', message = 'This group is archived (read-only).';
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
  from public.split_groups
  where id = p_group_id;

  if not found then
    raise exception 'Split group not found';
  end if;

  if not public.is_split_group_member_or_above(p_group_id, v_uid) then
    raise exception 'Split group not found';
  end if;

  select linked_user_id into v_payer_uid
  from split_group_members m
  where m.id = p_paid_by_member_id
    and m.group_id = p_group_id;

  if v_payer_uid is null and not exists (
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

  p_id := coalesce(p_id, gen_random_uuid());

  insert into split_expenses (
    id,
    group_id,
    paid_by_member_id,
    description,
    amount,
    expense_date,
    split_method,
    notes,
    user_id
  ) values (
    p_id,
    p_group_id,
    p_paid_by_member_id,
    btrim(p_description),
    p_amount,
    coalesce(p_expense_date, current_date),
    p_split_method,
    nullif(btrim(coalesce(p_notes, '')), ''),
    v_uid
  ) on conflict (id) do nothing;

  select * into v_expense from split_expenses where id = p_id;

  -- If splits already exist for this expense ID, it was already created (idempotency hit).
  if exists (select 1 from public.split_expense_splits where expense_id = v_expense.id) then
    return v_expense;
  end if;

  for v_item in select * from jsonb_array_elements(p_splits)
  loop
    v_member_id := nullif(v_item->>'member_id', '')::uuid;
    v_share := round(coalesce((v_item->>'share')::numeric, 0), 2);
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

    insert into public.split_expense_splits (
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

  if v_sum <> round(p_amount, 2) then
    raise exception 'Split total (%) does not match amount (%)', v_sum, p_amount;
  end if;

  if p_sync_transaction and v_payer_uid = v_uid then
    insert into public.transactions (
      date, type, description, amount, category, user_id, linked_split_expense_id, notes
    ) values (
      coalesce(p_expense_date, current_date),
      'expense',
      btrim(p_description),
      p_amount,
      coalesce(p_transaction_category, 'other'),
      v_uid,
      v_expense.id,
      nullif(btrim(coalesce(p_notes, '')), '')
    ) returning id into v_txn_id;

    update public.split_expenses set linked_transaction_id = v_txn_id where id = v_expense.id;
  end if;

  return v_expense;
end;
$$;

-- Function: public.split_create_group(text,text,uuid)
CREATE OR REPLACE FUNCTION public.split_create_group(p_name text, p_self_display_name text DEFAULT NULL::text, p_id uuid DEFAULT NULL::uuid) RETURNS public.split_groups
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_uid uuid := auth.uid();
  v_group public.split_groups%rowtype;
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
    from public.profiles p
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

  p_id := coalesce(p_id, gen_random_uuid());

  insert into public.split_groups (id, name, user_id)
  values (p_id, v_name, v_uid)
  on conflict (id) do nothing
  returning * into v_group;

  if v_group.id is null then
    -- Row already existed. Only an idempotent retry by the original creator is
    -- allowed, and it must not touch access or membership.
    select * into v_group from public.split_groups where id = p_id;
    if v_group.user_id is distinct from v_uid then
      raise exception using errcode = '42501', message = 'forbidden';
    end if;
    return v_group;
  end if;

  insert into public.split_group_access (group_id, user_id, role)
  values (v_group.id, v_uid, 'admin')
  on conflict (group_id, user_id) do update set role = 'admin';

  insert into public.split_group_members (
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

-- Table: public.split_group_invites
CREATE TABLE IF NOT EXISTS public.split_group_invites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    group_id uuid NOT NULL,
    token text DEFAULT encode(extensions.gen_random_bytes(12), 'hex'::text) NOT NULL,
    role text DEFAULT 'viewer'::text NOT NULL,
    created_by uuid NOT NULL,
    consumed_by uuid,
    consumed_at timestamp with time zone,
    revoked_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '7 days'::interval),
    CONSTRAINT split_group_invites_role_check CHECK ((role = ANY (ARRAY['viewer'::text, 'member'::text, 'admin'::text])))
);

ALTER TABLE public.split_group_invites
    ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid() NOT NULL,
    ADD COLUMN IF NOT EXISTS group_id uuid NOT NULL,
    ADD COLUMN IF NOT EXISTS token text DEFAULT encode(extensions.gen_random_bytes(12), 'hex'::text) NOT NULL,
    ADD COLUMN IF NOT EXISTS role text DEFAULT 'viewer'::text NOT NULL,
    ADD COLUMN IF NOT EXISTS created_by uuid NOT NULL,
    ADD COLUMN IF NOT EXISTS consumed_by uuid,
    ADD COLUMN IF NOT EXISTS consumed_at timestamp with time zone,
    ADD COLUMN IF NOT EXISTS revoked_at timestamp with time zone,
    ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now() NOT NULL,
    ADD COLUMN IF NOT EXISTS expires_at timestamp with time zone DEFAULT (now() + '7 days'::interval);

ALTER TABLE public.split_group_invites ALTER COLUMN expires_at SET DEFAULT (now() + '7 days'::interval);

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.split_group_invites'::regclass AND conname = 'split_group_invites_role_check'
             AND pg_catalog.pg_get_constraintdef(oid) <> $c$CHECK ((role = ANY (ARRAY['viewer'::text, 'member'::text, 'admin'::text])))$c$) THEN
    ALTER TABLE public.split_group_invites DROP CONSTRAINT split_group_invites_role_check;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.split_group_invites'::regclass AND conname = 'split_group_invites_role_check') THEN
    ALTER TABLE ONLY public.split_group_invites ADD CONSTRAINT split_group_invites_role_check CHECK ((role = ANY (ARRAY['viewer'::text, 'member'::text, 'admin'::text])));
  END IF;
END
$do$;

-- Function: public.split_create_group_invite(uuid,text,uuid)
CREATE OR REPLACE FUNCTION public.split_create_group_invite(p_group_id uuid, p_role text DEFAULT 'member'::text, p_id uuid DEFAULT NULL::uuid) RETURNS public.split_group_invites
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_invite public.split_group_invites%rowtype;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_split_group_owner(p_group_id, v_uid) then
    raise exception 'Split group not found';
  end if;

  p_id := coalesce(p_id, gen_random_uuid());

  insert into public.split_group_invites (
    id,
    group_id,
    role,
    created_by
  ) values (
    p_id,
    p_group_id,
    p_role,
    v_uid
  ) on conflict (id) do nothing;

  select * into v_invite from public.split_group_invites where id = p_id;

  return v_invite;
end;
$$;

-- Function: public.split_group_member_profiles(uuid)
CREATE OR REPLACE FUNCTION public.split_group_member_profiles(p_group_id uuid) RETURNS TABLE(user_id uuid, display_name text, avatar_url text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select distinct
    p.id as user_id,
    p.display_name,
    p.avatar_url
  from split_group_members m
  join profiles p on p.id = m.linked_user_id
  where m.group_id = p_group_id
    and public.has_split_group_access(p_group_id, auth.uid());
$$;

-- Function: public.split_leave_group(uuid)
CREATE OR REPLACE FUNCTION public.split_leave_group(p_group_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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

-- Function: public.split_member_net_balance(uuid)
CREATE OR REPLACE FUNCTION public.split_member_net_balance(p_member_id uuid) RETURNS numeric
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
  select
      coalesce((select sum(e.amount) from public.split_expenses e       where e.paid_by_member_id = p_member_id), 0)
    - coalesce((select sum(s.share)  from public.split_expense_splits s where s.member_id        = p_member_id), 0)
    + coalesce((select sum(t.amount) from public.split_settlements t    where t.payer_member_id  = p_member_id), 0)
    - coalesce((select sum(t.amount) from public.split_settlements t    where t.payee_member_id  = p_member_id), 0);
$$;

-- Function: public.split_preview_group_invite(text)
CREATE OR REPLACE FUNCTION public.split_preview_group_invite(p_token text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_invite public.split_group_invites%rowtype;
  v_group public.split_groups%rowtype;
begin
  select * into v_invite from public.split_group_invites
  where token = btrim(p_token)
    and revoked_at is null
    and consumed_by is null
    and (expires_at is null or expires_at > now());
  if not found then
    raise exception 'Invite not found, already used or expired';
  end if;

  select * into v_group from public.split_groups where id = v_invite.group_id;
  if not found then
    raise exception 'Group not found';
  end if;

  return jsonb_build_object(
    'group_id', case when auth.uid() is not null then v_group.id end,
    'group_name', v_group.name,
    'invited_role', coalesce(v_invite.role, 'viewer')
  );
end;
$$;

-- Table: public.split_settlements
CREATE TABLE IF NOT EXISTS public.split_settlements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    group_id uuid NOT NULL,
    payer_member_id uuid NOT NULL,
    payee_member_id uuid NOT NULL,
    amount numeric(12,2) NOT NULL,
    settled_at date DEFAULT CURRENT_DATE NOT NULL,
    note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    user_id uuid,
    payer_transaction_id uuid,
    payee_transaction_id uuid,
    CONSTRAINT split_settlements_amount_check CHECK ((amount > (0)::numeric))
);

ALTER TABLE public.split_settlements
    ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid() NOT NULL,
    ADD COLUMN IF NOT EXISTS group_id uuid NOT NULL,
    ADD COLUMN IF NOT EXISTS payer_member_id uuid NOT NULL,
    ADD COLUMN IF NOT EXISTS payee_member_id uuid NOT NULL,
    ADD COLUMN IF NOT EXISTS amount numeric(12,2) NOT NULL,
    ADD COLUMN IF NOT EXISTS settled_at date DEFAULT CURRENT_DATE NOT NULL,
    ADD COLUMN IF NOT EXISTS note text,
    ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now() NOT NULL,
    ADD COLUMN IF NOT EXISTS user_id uuid,
    ADD COLUMN IF NOT EXISTS payer_transaction_id uuid,
    ADD COLUMN IF NOT EXISTS payee_transaction_id uuid;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.split_settlements'::regclass AND conname = 'split_settlements_amount_check'
             AND pg_catalog.pg_get_constraintdef(oid) <> $c$CHECK ((amount > (0)::numeric))$c$) THEN
    ALTER TABLE public.split_settlements DROP CONSTRAINT split_settlements_amount_check;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.split_settlements'::regclass AND conname = 'split_settlements_amount_check') THEN
    ALTER TABLE ONLY public.split_settlements ADD CONSTRAINT split_settlements_amount_check CHECK ((amount > (0)::numeric));
  END IF;
END
$do$;

-- Function: public.split_record_settlement(uuid,uuid,uuid,numeric,date,text,boolean,uuid)
CREATE OR REPLACE FUNCTION public.split_record_settlement(p_group_id uuid, p_payer_member_id uuid, p_payee_member_id uuid, p_amount numeric, p_settled_at date DEFAULT CURRENT_DATE, p_note text DEFAULT NULL::text, p_sync_transaction boolean DEFAULT true, p_id uuid DEFAULT NULL::uuid) RETURNS public.split_settlements
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_row public.split_settlements%rowtype;
  v_payer_uid uuid;
  v_payee_uid uuid;
  v_payer_txn_id uuid;
  v_payee_txn_id uuid;
  v_payer_name text;
  v_payee_name text;
begin
  perform set_config('kosha.trusted_write', 'true', true);
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

  select linked_user_id, display_name into v_payer_uid, v_payer_name
  from split_group_members where id = p_payer_member_id and group_id = p_group_id;
  if v_payer_uid is null and not exists (
    select 1 from split_group_members m where m.id = p_payer_member_id and m.group_id = p_group_id
  ) then
    raise exception 'Payer is not in this group';
  end if;

  select linked_user_id, display_name into v_payee_uid, v_payee_name
  from split_group_members where id = p_payee_member_id and group_id = p_group_id;
  if v_payee_uid is null and not exists (
    select 1 from split_group_members m where m.id = p_payee_member_id and m.group_id = p_group_id
  ) then
    raise exception 'Payee is not in this group';
  end if;

  p_id := coalesce(p_id, gen_random_uuid());

  insert into public.split_settlements (
    id,
    group_id,
    payer_member_id,
    payee_member_id,
    amount,
    settled_at,
    note,
    user_id
  ) values (
    p_id,
    p_group_id,
    p_payer_member_id,
    p_payee_member_id,
    p_amount,
    coalesce(p_settled_at, current_date),
    nullif(btrim(coalesce(p_note, '')), ''),
    v_uid
  ) on conflict (id) do nothing;

  select * into v_row from public.split_settlements where id = p_id;

  if not found then
    return v_row;
  end if;

  if p_sync_transaction then
    -- Payer sees: "Settled with [payee name]"
    if v_payer_uid is not null and v_payer_uid = v_uid and not exists (
      select 1 from public.transactions
      where linked_split_settlement_id = v_row.id
        and user_id = v_payer_uid
    ) then
      insert into public.transactions (date, type, description, amount, category, user_id, is_repayment, linked_split_settlement_id, notes)
      values (coalesce(p_settled_at, current_date), 'expense', 'Settled with ' || coalesce(v_payee_name, 'member'), p_amount, 'other', v_uid, true, v_row.id, nullif(btrim(coalesce(p_note, '')), ''))
      returning id into v_payer_txn_id;
    end if;

    -- Payee sees: "Received from [payer name]"
    if v_payee_uid is not null and v_payee_uid = v_uid and not exists (
      select 1 from public.transactions
      where linked_split_settlement_id = v_row.id
        and user_id = v_payee_uid
    ) then
      insert into public.transactions (date, type, description, amount, category, user_id, is_repayment, linked_split_settlement_id, notes)
      values (coalesce(p_settled_at, current_date), 'income', 'Received from ' || coalesce(v_payer_name, 'member'), p_amount, 'other', v_uid, true, v_row.id, nullif(btrim(coalesce(p_note, '')), ''))
      returning id into v_payee_txn_id;
    end if;

    if v_payer_txn_id is not null or v_payee_txn_id is not null then
      update public.split_settlements
      set payer_transaction_id = coalesce(v_payer_txn_id, payer_transaction_id),
          payee_transaction_id = coalesce(v_payee_txn_id, payee_transaction_id)
      where id = v_row.id;
    end if;
  end if;

  return v_row;
end;
$$;

-- Table: public.split_group_access
CREATE TABLE IF NOT EXISTS public.split_group_access (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    group_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role text DEFAULT 'viewer'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT split_group_access_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'member'::text, 'viewer'::text])))
);

ALTER TABLE public.split_group_access
    ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid() NOT NULL,
    ADD COLUMN IF NOT EXISTS group_id uuid NOT NULL,
    ADD COLUMN IF NOT EXISTS user_id uuid NOT NULL,
    ADD COLUMN IF NOT EXISTS role text DEFAULT 'viewer'::text NOT NULL,
    ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now() NOT NULL;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.split_group_access'::regclass AND conname = 'split_group_access_role_check'
             AND pg_catalog.pg_get_constraintdef(oid) <> $c$CHECK ((role = ANY (ARRAY['admin'::text, 'member'::text, 'viewer'::text])))$c$) THEN
    ALTER TABLE public.split_group_access DROP CONSTRAINT split_group_access_role_check;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.split_group_access'::regclass AND conname = 'split_group_access_role_check') THEN
    ALTER TABLE ONLY public.split_group_access ADD CONSTRAINT split_group_access_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'member'::text, 'viewer'::text])));
  END IF;
END
$do$;

-- Function: public.split_set_group_access_role(uuid,uuid,text)
CREATE OR REPLACE FUNCTION public.split_set_group_access_role(p_group_id uuid, p_user_id uuid, p_role text) RETURNS public.split_group_access
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
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

-- Function: public.split_update_expense(uuid,uuid,text,numeric,date,text,text,jsonb,boolean,text)
CREATE OR REPLACE FUNCTION public.split_update_expense(p_expense_id uuid, p_paid_by_member_id uuid, p_description text, p_amount numeric, p_expense_date date, p_split_method text, p_notes text, p_splits jsonb, p_sync_transaction boolean DEFAULT true, p_transaction_category text DEFAULT 'other'::text) RETURNS public.split_expenses
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_uid uuid := auth.uid();
  v_expense public.split_expenses%rowtype;
  v_group_id uuid;
  v_linked_txn uuid;
  v_existing_owner uuid;
  v_effective_owner uuid;
  v_payer_uid uuid;
  v_sum numeric := 0;
  v_item jsonb;
  v_member_id uuid;
  v_share numeric;
  v_percent numeric;
  v_shares numeric;
begin
  if v_uid is null then
    raise exception using errcode = '28000', message = 'unauthenticated';
  end if;
  if p_expense_id is null then
    raise exception using errcode = '22023', message = 'p_expense_id is required';
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
  if p_splits is null or jsonb_typeof(p_splits) <> 'array' or jsonb_array_length(p_splits) = 0 then
    raise exception 'At least one split row is required';
  end if;

  -- Lock the expense so concurrent edits / deletes serialise.
  select * into v_expense
  from public.split_expenses
  where id = p_expense_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Split expense not found';
  end if;

  v_group_id := v_expense.group_id;
  v_linked_txn := v_expense.linked_transaction_id;

  -- Authorisation: caller must be a member of the group (or above).
  if not public.is_split_group_member_or_above(v_group_id, v_uid) then
    raise exception using errcode = '42501', message = 'forbidden';
  end if;
  if exists (select 1 from public.split_groups where id = v_group_id and is_archived) then
    raise exception using errcode = '42501', message = 'This group is archived (read-only).';
  end if;

  -- Payer must belong to the group; capture the app user it maps to (if any).
  select linked_user_id into v_payer_uid
  from public.split_group_members m
  where m.id = p_paid_by_member_id
    and m.group_id = v_group_id;

  if not exists (
    select 1 from public.split_group_members m
    where m.id = p_paid_by_member_id and m.group_id = v_group_id
  ) then
    raise exception 'Payer must be a member of the group';
  end if;

  -- Update the expense row. Preserve the original owner (user_id) and id.
  update public.split_expenses
  set
    paid_by_member_id = p_paid_by_member_id,
    description       = btrim(p_description),
    amount            = p_amount,
    expense_date      = coalesce(p_expense_date, current_date),
    split_method      = p_split_method,
    notes             = nullif(btrim(coalesce(p_notes, '')), '')
  where id = p_expense_id;

  -- Replace the splits.
  delete from public.split_expense_splits where expense_id = p_expense_id;

  for v_item in select * from jsonb_array_elements(p_splits)
  loop
    v_member_id := nullif(v_item->>'member_id', '')::uuid;
    v_share := round(coalesce((v_item->>'share')::numeric, 0), 2);
    v_percent := nullif(v_item->>'percent', '')::numeric;
    v_shares := nullif(v_item->>'shares', '')::numeric;

    if v_member_id is null then
      raise exception 'split member_id is required';
    end if;
    if v_share < 0 then
      raise exception 'split share cannot be negative';
    end if;
    if not exists (
      select 1 from public.split_group_members m
      where m.id = v_member_id and m.group_id = v_group_id and m.archived_at is null
    ) then
      raise exception 'Split includes a member outside this group';
    end if;

    insert into public.split_expense_splits (
      expense_id, member_id, share, percent, shares, user_id
    ) values (
      p_expense_id, v_member_id, v_share, v_percent, v_shares, v_expense.user_id
    );

    v_sum := v_sum + v_share;
  end loop;

  if v_sum <> round(p_amount, 2) then
    raise exception 'Split total (%) does not match amount (%)', v_sum, p_amount;
  end if;

  -- Reconcile the linked personal-ledger transaction. The transaction belongs
  -- to the payer's app user. To avoid spawning a transaction into a third
  -- party's ledger (which split_create_expense never does), we only create or
  -- keep a transaction for the payer when the payer is the editor OR a
  -- transaction already exists for that payer (i.e. the payer is unchanged).
  if v_linked_txn is not null then
    select user_id into v_existing_owner from public.transactions where id = v_linked_txn and linked_split_expense_id = p_expense_id;
  end if;

  if coalesce(p_sync_transaction, true)
     and v_payer_uid is not null
     and (v_payer_uid = v_uid or v_payer_uid = v_existing_owner) then
    v_effective_owner := v_payer_uid;
  else
    v_effective_owner := null;
  end if;

  if v_effective_owner is not null then
    if v_linked_txn is not null and v_existing_owner = v_effective_owner then
      update public.transactions
      set
        date        = coalesce(p_expense_date, current_date),
        type        = 'expense',
        description = btrim(p_description),
        amount      = p_amount,
        category    = coalesce(p_transaction_category, 'other'),
        notes       = nullif(btrim(coalesce(p_notes, '')), ''),
        linked_split_expense_id = p_expense_id
      where id = v_linked_txn;
    else
      -- Payer moved to the editor while a txn existed for someone else, or no
      -- txn existed yet: drop the stale one (if any) and create a fresh one.
      if v_linked_txn is not null then
        delete from public.transactions where id = v_linked_txn and linked_split_expense_id = p_expense_id;
      end if;
      insert into public.transactions (
        date, type, description, amount, category, user_id, linked_split_expense_id, notes
      ) values (
        coalesce(p_expense_date, current_date),
        'expense',
        btrim(p_description),
        p_amount,
        coalesce(p_transaction_category, 'other'),
        v_effective_owner,
        p_expense_id,
        nullif(btrim(coalesce(p_notes, '')), '')
      ) returning id into v_linked_txn;
      update public.split_expenses set linked_transaction_id = v_linked_txn where id = p_expense_id;
    end if;
  else
    -- No txn should exist (sync off, external payer, or payer reassigned away
    -- from both the editor and the existing owner): remove any stale txn.
    if v_linked_txn is not null then
      delete from public.transactions where id = v_linked_txn and linked_split_expense_id = p_expense_id;
      update public.split_expenses set linked_transaction_id = null where id = p_expense_id;
    end if;
  end if;

  select * into v_expense from public.split_expenses where id = p_expense_id;
  return v_expense;
end;
$$;

-- Function: public.submit_bug_report(text,text,text,text,text,text,jsonb,jsonb,text,text,text,text[])
CREATE OR REPLACE FUNCTION public.submit_bug_report(p_title text, p_description text, p_steps text DEFAULT NULL::text, p_severity text DEFAULT 'medium'::text, p_route text DEFAULT NULL::text, p_app_version text DEFAULT NULL::text, p_diagnostics jsonb DEFAULT NULL::jsonb, p_environment jsonb DEFAULT NULL::jsonb, p_screenshot_path text DEFAULT NULL::text, p_reporter_email text DEFAULT NULL::text, p_fingerprint text DEFAULT NULL::text, p_tags text[] DEFAULT NULL::text[]) RETURNS TABLE(report_id uuid, is_duplicate boolean, occurrence_count integer)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_existing_id uuid;
  v_existing_occ integer;
  v_priority text;
  v_recent_count integer;
  v_tags text[] := coalesce(p_tags, '{}'::text[]);
BEGIN
  -- 1. Identity & Validation
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to submit bug reports.';
  END IF;

  IF p_title IS NULL OR btrim(p_title) = '' THEN
    RAISE EXCEPTION 'Bug title is required.';
  END IF;

  IF p_description IS NULL OR btrim(p_description) = '' THEN
    RAISE EXCEPTION 'Bug description is required.';
  END IF;

  -- 2. Anti-Spam (Max 5 reports per 2 minutes)
  SELECT count(*) INTO v_recent_count
  FROM public.bug_reports
  WHERE user_id = v_uid
    AND created_at > now() - interval '2 minutes';

  IF v_recent_count >= 5 THEN
    RAISE EXCEPTION 'Too many reports in a short time. Please wait a moment and try again.';
  END IF;

  -- 3. Categorization
  IF p_severity NOT IN ('low', 'medium', 'high') THEN
    p_severity := 'medium';
  END IF;

  IF p_severity = 'high' THEN
    v_priority := 'p1';
  ELSIF p_severity = 'medium' THEN
    v_priority := 'p2';
  ELSE
    v_priority := 'p3';
  END IF;

  -- 4. Duplicate Detection
  SELECT id, bug_reports.occurrence_count
    INTO v_existing_id, v_existing_occ
  FROM public.bug_reports
  WHERE user_id = v_uid
    AND coalesce(fingerprint, '') = coalesce(p_fingerprint, '')
    AND coalesce(route, '') = coalesce(p_route, '')
    AND created_at > now() - interval '7 days'
  ORDER BY created_at DESC
  LIMIT 1;

  -- 5. Update Existing or Insert New
  IF v_existing_id IS NOT NULL AND coalesce(p_fingerprint, '') <> '' THEN
    UPDATE public.bug_reports
    SET
      occurrence_count = coalesce(bug_reports.occurrence_count, 1) + 1,
      last_reported_at = now(),
      updated_at = now(),
      steps = coalesce(nullif(btrim(coalesce(p_steps, '')), ''), bug_reports.steps),
      diagnostics = coalesce(p_diagnostics, bug_reports.diagnostics),
      environment = coalesce(p_environment, bug_reports.environment),
      reporter_email = coalesce(nullif(btrim(coalesce(p_reporter_email, '')), ''), bug_reports.reporter_email),
      screenshot_path = coalesce(nullif(p_screenshot_path, ''), bug_reports.screenshot_path),
      tags = CASE
        WHEN array_length(v_tags, 1) IS NULL THEN bug_reports.tags
        ELSE (
          SELECT array_agg(DISTINCT t)
          FROM unnest(coalesce(bug_reports.tags, '{}'::text[]) || v_tags) AS t
        )
      END
    WHERE id = v_existing_id AND user_id = v_uid;

    RETURN QUERY
      SELECT v_existing_id, true, (coalesce(v_existing_occ, 1) + 1)::integer;
    RETURN;
  END IF;

  -- The fix: Added RETURN QUERY prefix to the INSERT statement
  RETURN QUERY
  INSERT INTO public.bug_reports (
    user_id, title, description, steps, severity, priority, route,
    app_version, diagnostics, environment, screenshot_path,
    reporter_email, fingerprint, tags, occurrence_count,
    last_reported_at, updated_at
  ) VALUES (
    v_uid, p_title, p_description, p_steps, p_severity, v_priority, p_route,
    p_app_version, p_diagnostics, p_environment, p_screenshot_path,
    p_reporter_email, p_fingerprint, v_tags, 1, now(), now()
  )
  RETURNING id, false, 1;
END;
$$;

-- Function: public.sync_split_to_transaction()
CREATE OR REPLACE FUNCTION public.sync_split_to_transaction() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  if new.linked_transaction_id is not null then
    perform set_config('kosha.syncing_split', 'true', true);
    update public.transactions
       set amount      = new.amount,
           description = new.description,
           date        = new.expense_date
     where id = new.linked_transaction_id
       and linked_split_expense_id = new.id
       and (amount      is distinct from new.amount
         or description is distinct from new.description
         or date        is distinct from new.expense_date);
  end if;
  return new;
end;
$$;

-- Function: public.sync_transaction_to_split()
CREATE OR REPLACE FUNCTION public.sync_transaction_to_split() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  if new.linked_split_expense_id is not null then
    if new.amount is distinct from old.amount then
      if current_setting('kosha.syncing_split', true) is distinct from 'true' then
        raise exception 'Cannot change the amount of a shared expense directly. Please edit it in the Splitwise group instead.';
      end if;
    end if;
    update public.split_expenses
       set amount       = new.amount,
           description  = new.description,
           expense_date = new.date
     where id = new.linked_split_expense_id
       and linked_transaction_id = new.id
       and (amount       is distinct from new.amount
         or description  is distinct from new.description
         or expense_date is distinct from new.date);
  end if;
  return new;
end;
$$;

-- Function: public.touch_split_group_updated_at()
CREATE OR REPLACE FUNCTION public.touch_split_group_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Function: public.unlink_partner_atomic(uuid)
CREATE OR REPLACE FUNCTION public.unlink_partner_atomic(p_partner_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_uid uuid := auth.uid();
  v_rows integer;
begin
  if v_uid is null then
    raise exception using errcode = '28000', message = 'unauthenticated';
  end if;
  if p_partner_id is null then
    raise exception using errcode = '22023', message = 'p_partner_id is required';
  end if;

  delete from public.invites
   where (created_by = v_uid          and used_by = p_partner_id)
      or (created_by = p_partner_id  and used_by = v_uid);
  get diagnostics v_rows = row_count;

  return v_rows > 0;
end;
$$;

-- Table: public.budgets
CREATE TABLE IF NOT EXISTS public.budgets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    category text NOT NULL,
    amount numeric NOT NULL,
    month_start date NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT budgets_amount_check CHECK ((amount >= (0)::numeric))
);

ALTER TABLE public.budgets
    ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid() NOT NULL,
    ADD COLUMN IF NOT EXISTS user_id uuid NOT NULL,
    ADD COLUMN IF NOT EXISTS category text NOT NULL,
    ADD COLUMN IF NOT EXISTS amount numeric NOT NULL,
    ADD COLUMN IF NOT EXISTS month_start date NOT NULL,
    ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.budgets'::regclass AND conname = 'budgets_amount_check'
             AND pg_catalog.pg_get_constraintdef(oid) <> $c$CHECK ((amount >= (0)::numeric))$c$) THEN
    ALTER TABLE public.budgets DROP CONSTRAINT budgets_amount_check;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.budgets'::regclass AND conname = 'budgets_amount_check') THEN
    ALTER TABLE ONLY public.budgets ADD CONSTRAINT budgets_amount_check CHECK ((amount >= (0)::numeric));
  END IF;
END
$do$;

-- Table: public.bug_reports
CREATE TABLE IF NOT EXISTS public.bug_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    title text NOT NULL,
    description text NOT NULL,
    steps text,
    severity text DEFAULT 'medium'::text NOT NULL,
    route text,
    app_version text,
    diagnostics jsonb,
    status text DEFAULT 'open'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    priority text DEFAULT 'p2'::text NOT NULL,
    tags text[] DEFAULT '{}'::text[] NOT NULL,
    assignee text,
    duplicate_of uuid,
    fingerprint text,
    occurrence_count integer DEFAULT 1 NOT NULL,
    reporter_email text,
    screenshot_path text,
    environment jsonb,
    last_reported_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    triaged_at timestamp with time zone,
    resolved_at timestamp with time zone,
    release_version text,
    notified_at timestamp with time zone,
    CONSTRAINT bug_reports_priority_check CHECK ((priority = ANY (ARRAY['p0'::text, 'p1'::text, 'p2'::text, 'p3'::text]))),
    CONSTRAINT bug_reports_severity_check CHECK ((severity = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text]))),
    CONSTRAINT bug_reports_status_check CHECK ((status = ANY (ARRAY['open'::text, 'triaged'::text, 'in_progress'::text, 'fixed'::text, 'released'::text, 'resolved'::text]))),
    CONSTRAINT bug_reports_title_check CHECK ((char_length(title) <= 160))
);

ALTER TABLE public.bug_reports
    ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid() NOT NULL,
    ADD COLUMN IF NOT EXISTS user_id uuid,
    ADD COLUMN IF NOT EXISTS title text NOT NULL,
    ADD COLUMN IF NOT EXISTS description text NOT NULL,
    ADD COLUMN IF NOT EXISTS steps text,
    ADD COLUMN IF NOT EXISTS severity text DEFAULT 'medium'::text NOT NULL,
    ADD COLUMN IF NOT EXISTS route text,
    ADD COLUMN IF NOT EXISTS app_version text,
    ADD COLUMN IF NOT EXISTS diagnostics jsonb,
    ADD COLUMN IF NOT EXISTS status text DEFAULT 'open'::text NOT NULL,
    ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now() NOT NULL,
    ADD COLUMN IF NOT EXISTS priority text DEFAULT 'p2'::text NOT NULL,
    ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}'::text[] NOT NULL,
    ADD COLUMN IF NOT EXISTS assignee text,
    ADD COLUMN IF NOT EXISTS duplicate_of uuid,
    ADD COLUMN IF NOT EXISTS fingerprint text,
    ADD COLUMN IF NOT EXISTS occurrence_count integer DEFAULT 1 NOT NULL,
    ADD COLUMN IF NOT EXISTS reporter_email text,
    ADD COLUMN IF NOT EXISTS screenshot_path text,
    ADD COLUMN IF NOT EXISTS environment jsonb,
    ADD COLUMN IF NOT EXISTS last_reported_at timestamp with time zone,
    ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now() NOT NULL,
    ADD COLUMN IF NOT EXISTS triaged_at timestamp with time zone,
    ADD COLUMN IF NOT EXISTS resolved_at timestamp with time zone,
    ADD COLUMN IF NOT EXISTS release_version text,
    ADD COLUMN IF NOT EXISTS notified_at timestamp with time zone;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.bug_reports'::regclass AND conname = 'bug_reports_priority_check'
             AND pg_catalog.pg_get_constraintdef(oid) <> $c$CHECK ((priority = ANY (ARRAY['p0'::text, 'p1'::text, 'p2'::text, 'p3'::text])))$c$) THEN
    ALTER TABLE public.bug_reports DROP CONSTRAINT bug_reports_priority_check;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.bug_reports'::regclass AND conname = 'bug_reports_priority_check') THEN
    ALTER TABLE ONLY public.bug_reports ADD CONSTRAINT bug_reports_priority_check CHECK ((priority = ANY (ARRAY['p0'::text, 'p1'::text, 'p2'::text, 'p3'::text])));
  END IF;
END
$do$;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.bug_reports'::regclass AND conname = 'bug_reports_severity_check'
             AND pg_catalog.pg_get_constraintdef(oid) <> $c$CHECK ((severity = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text])))$c$) THEN
    ALTER TABLE public.bug_reports DROP CONSTRAINT bug_reports_severity_check;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.bug_reports'::regclass AND conname = 'bug_reports_severity_check') THEN
    ALTER TABLE ONLY public.bug_reports ADD CONSTRAINT bug_reports_severity_check CHECK ((severity = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text])));
  END IF;
END
$do$;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.bug_reports'::regclass AND conname = 'bug_reports_status_check'
             AND pg_catalog.pg_get_constraintdef(oid) <> $c$CHECK ((status = ANY (ARRAY['open'::text, 'triaged'::text, 'in_progress'::text, 'fixed'::text, 'released'::text, 'resolved'::text])))$c$) THEN
    ALTER TABLE public.bug_reports DROP CONSTRAINT bug_reports_status_check;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.bug_reports'::regclass AND conname = 'bug_reports_status_check') THEN
    ALTER TABLE ONLY public.bug_reports ADD CONSTRAINT bug_reports_status_check CHECK ((status = ANY (ARRAY['open'::text, 'triaged'::text, 'in_progress'::text, 'fixed'::text, 'released'::text, 'resolved'::text])));
  END IF;
END
$do$;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.bug_reports'::regclass AND conname = 'bug_reports_title_check'
             AND pg_catalog.pg_get_constraintdef(oid) <> $c$CHECK ((char_length(title) <= 160))$c$) THEN
    ALTER TABLE public.bug_reports DROP CONSTRAINT bug_reports_title_check;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.bug_reports'::regclass AND conname = 'bug_reports_title_check') THEN
    ALTER TABLE ONLY public.bug_reports ADD CONSTRAINT bug_reports_title_check CHECK ((char_length(title) <= 160));
  END IF;
END
$do$;

-- Table: public.category_budgets
CREATE TABLE IF NOT EXISTS public.category_budgets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    category text NOT NULL,
    monthly_limit numeric(12,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT category_budgets_monthly_limit_check CHECK ((monthly_limit > (0)::numeric))
);

ALTER TABLE public.category_budgets
    ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid() NOT NULL,
    ADD COLUMN IF NOT EXISTS user_id uuid NOT NULL,
    ADD COLUMN IF NOT EXISTS category text NOT NULL,
    ADD COLUMN IF NOT EXISTS monthly_limit numeric(12,2) NOT NULL,
    ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now() NOT NULL;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.category_budgets'::regclass AND conname = 'category_budgets_monthly_limit_check'
             AND pg_catalog.pg_get_constraintdef(oid) <> $c$CHECK ((monthly_limit > (0)::numeric))$c$) THEN
    ALTER TABLE public.category_budgets DROP CONSTRAINT category_budgets_monthly_limit_check;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.category_budgets'::regclass AND conname = 'category_budgets_monthly_limit_check') THEN
    ALTER TABLE ONLY public.category_budgets ADD CONSTRAINT category_budgets_monthly_limit_check CHECK ((monthly_limit > (0)::numeric));
  END IF;
END
$do$;

-- Table: public.financial_events
CREATE TABLE IF NOT EXISTS public.financial_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    action text NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid NOT NULL,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT financial_events_entity_type_check CHECK ((entity_type = ANY (ARRAY['transaction'::text, 'liability'::text, 'loan'::text, 'split_group'::text, 'split_group_member'::text, 'split_expense'::text, 'split_settlement'::text, 'split_group_invite'::text])))
);

ALTER TABLE public.financial_events
    ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid() NOT NULL,
    ADD COLUMN IF NOT EXISTS user_id uuid NOT NULL,
    ADD COLUMN IF NOT EXISTS action text NOT NULL,
    ADD COLUMN IF NOT EXISTS entity_type text NOT NULL,
    ADD COLUMN IF NOT EXISTS entity_id uuid NOT NULL,
    ADD COLUMN IF NOT EXISTS metadata jsonb,
    ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now() NOT NULL;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.financial_events'::regclass AND conname = 'financial_events_entity_type_check'
             AND pg_catalog.pg_get_constraintdef(oid) <> $c$CHECK ((entity_type = ANY (ARRAY['transaction'::text, 'liability'::text, 'loan'::text, 'split_group'::text, 'split_group_member'::text, 'split_expense'::text, 'split_settlement'::text, 'split_group_invite'::text])))$c$) THEN
    ALTER TABLE public.financial_events DROP CONSTRAINT financial_events_entity_type_check;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.financial_events'::regclass AND conname = 'financial_events_entity_type_check') THEN
    ALTER TABLE ONLY public.financial_events ADD CONSTRAINT financial_events_entity_type_check CHECK ((entity_type = ANY (ARRAY['transaction'::text, 'liability'::text, 'loan'::text, 'split_group'::text, 'split_group_member'::text, 'split_expense'::text, 'split_settlement'::text, 'split_group_invite'::text])));
  END IF;
END
$do$;

-- Table: public.invites
CREATE TABLE IF NOT EXISTS public.invites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    token text DEFAULT encode(extensions.gen_random_bytes(12), 'hex'::text) NOT NULL,
    created_by uuid NOT NULL,
    used_by uuid,
    used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '7 days'::interval)
);

ALTER TABLE public.invites
    ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid() NOT NULL,
    ADD COLUMN IF NOT EXISTS token text DEFAULT encode(extensions.gen_random_bytes(12), 'hex'::text) NOT NULL,
    ADD COLUMN IF NOT EXISTS created_by uuid NOT NULL,
    ADD COLUMN IF NOT EXISTS used_by uuid,
    ADD COLUMN IF NOT EXISTS used_at timestamp with time zone,
    ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now() NOT NULL,
    ADD COLUMN IF NOT EXISTS expires_at timestamp with time zone DEFAULT (now() + '7 days'::interval);

ALTER TABLE public.invites ALTER COLUMN expires_at SET DEFAULT (now() + '7 days'::interval);

-- Table: public.liabilities
CREATE TABLE IF NOT EXISTS public.liabilities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    description text NOT NULL,
    amount numeric(12,2) NOT NULL,
    due_date date NOT NULL,
    is_recurring boolean DEFAULT false NOT NULL,
    recurrence text,
    paid boolean DEFAULT false NOT NULL,
    linked_transaction_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    user_id uuid,
    payment_mode text DEFAULT 'upi'::text,
    recurrence_anchor date,
    CONSTRAINT liabilities_amount_check CHECK ((amount > (0)::numeric)),
    CONSTRAINT liabilities_payment_mode_check CHECK ((payment_mode = ANY (ARRAY['upi'::text, 'cash'::text, 'bank'::text, 'card'::text]))),
    CONSTRAINT liabilities_recurrence_check CHECK ((recurrence = ANY (ARRAY['monthly'::text, 'quarterly'::text, 'yearly'::text])))
);

ALTER TABLE public.liabilities
    ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid() NOT NULL,
    ADD COLUMN IF NOT EXISTS description text NOT NULL,
    ADD COLUMN IF NOT EXISTS amount numeric(12,2) NOT NULL,
    ADD COLUMN IF NOT EXISTS due_date date NOT NULL,
    ADD COLUMN IF NOT EXISTS is_recurring boolean DEFAULT false NOT NULL,
    ADD COLUMN IF NOT EXISTS recurrence text,
    ADD COLUMN IF NOT EXISTS paid boolean DEFAULT false NOT NULL,
    ADD COLUMN IF NOT EXISTS linked_transaction_id uuid,
    ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now() NOT NULL,
    ADD COLUMN IF NOT EXISTS user_id uuid,
    ADD COLUMN IF NOT EXISTS payment_mode text DEFAULT 'upi'::text,
    ADD COLUMN IF NOT EXISTS recurrence_anchor date;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.liabilities'::regclass AND conname = 'liabilities_amount_check'
             AND pg_catalog.pg_get_constraintdef(oid) <> $c$CHECK ((amount > (0)::numeric))$c$) THEN
    ALTER TABLE public.liabilities DROP CONSTRAINT liabilities_amount_check;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.liabilities'::regclass AND conname = 'liabilities_amount_check') THEN
    ALTER TABLE ONLY public.liabilities ADD CONSTRAINT liabilities_amount_check CHECK ((amount > (0)::numeric));
  END IF;
END
$do$;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.liabilities'::regclass AND conname = 'liabilities_payment_mode_check'
             AND pg_catalog.pg_get_constraintdef(oid) <> $c$CHECK ((payment_mode = ANY (ARRAY['upi'::text, 'cash'::text, 'bank'::text, 'card'::text])))$c$) THEN
    ALTER TABLE public.liabilities DROP CONSTRAINT liabilities_payment_mode_check;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.liabilities'::regclass AND conname = 'liabilities_payment_mode_check') THEN
    ALTER TABLE ONLY public.liabilities ADD CONSTRAINT liabilities_payment_mode_check CHECK ((payment_mode = ANY (ARRAY['upi'::text, 'cash'::text, 'bank'::text, 'card'::text])));
  END IF;
END
$do$;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.liabilities'::regclass AND conname = 'liabilities_recurrence_check'
             AND pg_catalog.pg_get_constraintdef(oid) <> $c$CHECK ((recurrence = ANY (ARRAY['monthly'::text, 'quarterly'::text, 'yearly'::text])))$c$) THEN
    ALTER TABLE public.liabilities DROP CONSTRAINT liabilities_recurrence_check;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.liabilities'::regclass AND conname = 'liabilities_recurrence_check') THEN
    ALTER TABLE ONLY public.liabilities ADD CONSTRAINT liabilities_recurrence_check CHECK ((recurrence = ANY (ARRAY['monthly'::text, 'quarterly'::text, 'yearly'::text])));
  END IF;
END
$do$;

ALTER TABLE ONLY public.liabilities REPLICA IDENTITY FULL;

-- Table: public.monthly_net_changes
CREATE TABLE IF NOT EXISTS public.monthly_net_changes (
    user_id uuid NOT NULL,
    month_start date NOT NULL,
    net_change numeric DEFAULT 0 NOT NULL
);

ALTER TABLE public.monthly_net_changes
    ADD COLUMN IF NOT EXISTS user_id uuid NOT NULL,
    ADD COLUMN IF NOT EXISTS month_start date NOT NULL,
    ADD COLUMN IF NOT EXISTS net_change numeric DEFAULT 0 NOT NULL;

-- Table: public.profiles
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid NOT NULL,
    display_name text,
    monthly_income numeric(12,2) DEFAULT 0,
    onboarded boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    avatar_url text
);

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS id uuid NOT NULL,
    ADD COLUMN IF NOT EXISTS display_name text,
    ADD COLUMN IF NOT EXISTS monthly_income numeric(12,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS onboarded boolean DEFAULT false NOT NULL,
    ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now() NOT NULL,
    ADD COLUMN IF NOT EXISTS avatar_url text;

-- Table: public.reconciliation_reviews
CREATE TABLE IF NOT EXISTS public.reconciliation_reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    transaction_id uuid NOT NULL,
    status text DEFAULT 'reviewed'::text NOT NULL,
    statement_line text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT reconciliation_reviews_status_check CHECK ((status = ANY (ARRAY['reviewed'::text, 'linked'::text])))
);

ALTER TABLE public.reconciliation_reviews
    ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid() NOT NULL,
    ADD COLUMN IF NOT EXISTS user_id uuid NOT NULL,
    ADD COLUMN IF NOT EXISTS transaction_id uuid NOT NULL,
    ADD COLUMN IF NOT EXISTS status text DEFAULT 'reviewed'::text NOT NULL,
    ADD COLUMN IF NOT EXISTS statement_line text,
    ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now() NOT NULL,
    ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now() NOT NULL;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.reconciliation_reviews'::regclass AND conname = 'reconciliation_reviews_status_check'
             AND pg_catalog.pg_get_constraintdef(oid) <> $c$CHECK ((status = ANY (ARRAY['reviewed'::text, 'linked'::text])))$c$) THEN
    ALTER TABLE public.reconciliation_reviews DROP CONSTRAINT reconciliation_reviews_status_check;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.reconciliation_reviews'::regclass AND conname = 'reconciliation_reviews_status_check') THEN
    ALTER TABLE ONLY public.reconciliation_reviews ADD CONSTRAINT reconciliation_reviews_status_check CHECK ((status = ANY (ARRAY['reviewed'::text, 'linked'::text])));
  END IF;
END
$do$;

-- Table: public.split_expense_splits
CREATE TABLE IF NOT EXISTS public.split_expense_splits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    expense_id uuid NOT NULL,
    member_id uuid NOT NULL,
    share numeric(12,2) NOT NULL,
    percent numeric(9,4),
    shares numeric(12,4),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    user_id uuid,
    CONSTRAINT split_expense_splits_share_check CHECK ((share >= (0)::numeric))
);

ALTER TABLE public.split_expense_splits
    ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid() NOT NULL,
    ADD COLUMN IF NOT EXISTS expense_id uuid NOT NULL,
    ADD COLUMN IF NOT EXISTS member_id uuid NOT NULL,
    ADD COLUMN IF NOT EXISTS share numeric(12,2) NOT NULL,
    ADD COLUMN IF NOT EXISTS percent numeric(9,4),
    ADD COLUMN IF NOT EXISTS shares numeric(12,4),
    ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now() NOT NULL,
    ADD COLUMN IF NOT EXISTS user_id uuid;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.split_expense_splits'::regclass AND conname = 'split_expense_splits_share_check'
             AND pg_catalog.pg_get_constraintdef(oid) <> $c$CHECK ((share >= (0)::numeric))$c$) THEN
    ALTER TABLE public.split_expense_splits DROP CONSTRAINT split_expense_splits_share_check;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.split_expense_splits'::regclass AND conname = 'split_expense_splits_share_check') THEN
    ALTER TABLE ONLY public.split_expense_splits ADD CONSTRAINT split_expense_splits_share_check CHECK ((share >= (0)::numeric));
  END IF;
END
$do$;

-- Table: public.transactions
CREATE TABLE IF NOT EXISTS public.transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    date date NOT NULL,
    type text NOT NULL,
    description text NOT NULL,
    amount numeric(12,2) NOT NULL,
    category text DEFAULT 'other'::text NOT NULL,
    investment_vehicle text,
    is_repayment boolean DEFAULT false NOT NULL,
    payment_mode text DEFAULT 'upi'::text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    user_id uuid,
    is_recurring boolean DEFAULT false NOT NULL,
    recurrence text,
    next_run_date date,
    source_transaction_id uuid,
    is_auto_generated boolean DEFAULT false NOT NULL,
    linked_split_expense_id uuid,
    linked_split_settlement_id uuid,
    linked_bill_id uuid,
    linked_loan_id uuid,
    CONSTRAINT transactions_amount_check CHECK ((amount > (0)::numeric)),
    CONSTRAINT transactions_payment_mode_check CHECK ((payment_mode = ANY (ARRAY['upi'::text, 'credit_card'::text, 'debit_card'::text, 'cash'::text, 'net_banking'::text, 'wallet'::text, 'other'::text]))),
    CONSTRAINT transactions_recurrence_check CHECK (((recurrence = ANY (ARRAY['monthly'::text, 'quarterly'::text, 'yearly'::text])) OR (recurrence IS NULL))),
    CONSTRAINT transactions_type_check CHECK ((type = ANY (ARRAY['income'::text, 'expense'::text, 'investment'::text])))
);

ALTER TABLE public.transactions
    ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid() NOT NULL,
    ADD COLUMN IF NOT EXISTS date date NOT NULL,
    ADD COLUMN IF NOT EXISTS type text NOT NULL,
    ADD COLUMN IF NOT EXISTS description text NOT NULL,
    ADD COLUMN IF NOT EXISTS amount numeric(12,2) NOT NULL,
    ADD COLUMN IF NOT EXISTS category text DEFAULT 'other'::text NOT NULL,
    ADD COLUMN IF NOT EXISTS investment_vehicle text,
    ADD COLUMN IF NOT EXISTS is_repayment boolean DEFAULT false NOT NULL,
    ADD COLUMN IF NOT EXISTS payment_mode text DEFAULT 'upi'::text,
    ADD COLUMN IF NOT EXISTS notes text,
    ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now() NOT NULL,
    ADD COLUMN IF NOT EXISTS user_id uuid,
    ADD COLUMN IF NOT EXISTS is_recurring boolean DEFAULT false NOT NULL,
    ADD COLUMN IF NOT EXISTS recurrence text,
    ADD COLUMN IF NOT EXISTS next_run_date date,
    ADD COLUMN IF NOT EXISTS source_transaction_id uuid,
    ADD COLUMN IF NOT EXISTS is_auto_generated boolean DEFAULT false NOT NULL,
    ADD COLUMN IF NOT EXISTS linked_split_expense_id uuid,
    ADD COLUMN IF NOT EXISTS linked_split_settlement_id uuid,
    ADD COLUMN IF NOT EXISTS linked_bill_id uuid,
    ADD COLUMN IF NOT EXISTS linked_loan_id uuid;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.transactions'::regclass AND conname = 'transactions_amount_check'
             AND pg_catalog.pg_get_constraintdef(oid) <> $c$CHECK ((amount > (0)::numeric))$c$) THEN
    ALTER TABLE public.transactions DROP CONSTRAINT transactions_amount_check;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.transactions'::regclass AND conname = 'transactions_amount_check') THEN
    ALTER TABLE ONLY public.transactions ADD CONSTRAINT transactions_amount_check CHECK ((amount > (0)::numeric));
  END IF;
END
$do$;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.transactions'::regclass AND conname = 'transactions_payment_mode_check'
             AND pg_catalog.pg_get_constraintdef(oid) <> $c$CHECK ((payment_mode = ANY (ARRAY['upi'::text, 'credit_card'::text, 'debit_card'::text, 'cash'::text, 'net_banking'::text, 'wallet'::text, 'other'::text])))$c$) THEN
    ALTER TABLE public.transactions DROP CONSTRAINT transactions_payment_mode_check;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.transactions'::regclass AND conname = 'transactions_payment_mode_check') THEN
    ALTER TABLE ONLY public.transactions ADD CONSTRAINT transactions_payment_mode_check CHECK ((payment_mode = ANY (ARRAY['upi'::text, 'credit_card'::text, 'debit_card'::text, 'cash'::text, 'net_banking'::text, 'wallet'::text, 'other'::text])));
  END IF;
END
$do$;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.transactions'::regclass AND conname = 'transactions_recurrence_check'
             AND pg_catalog.pg_get_constraintdef(oid) <> $c$CHECK (((recurrence = ANY (ARRAY['monthly'::text, 'quarterly'::text, 'yearly'::text])) OR (recurrence IS NULL)))$c$) THEN
    ALTER TABLE public.transactions DROP CONSTRAINT transactions_recurrence_check;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.transactions'::regclass AND conname = 'transactions_recurrence_check') THEN
    ALTER TABLE ONLY public.transactions ADD CONSTRAINT transactions_recurrence_check CHECK (((recurrence = ANY (ARRAY['monthly'::text, 'quarterly'::text, 'yearly'::text])) OR (recurrence IS NULL)));
  END IF;
END
$do$;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.transactions'::regclass AND conname = 'transactions_type_check'
             AND pg_catalog.pg_get_constraintdef(oid) <> $c$CHECK ((type = ANY (ARRAY['income'::text, 'expense'::text, 'investment'::text])))$c$) THEN
    ALTER TABLE public.transactions DROP CONSTRAINT transactions_type_check;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.transactions'::regclass AND conname = 'transactions_type_check') THEN
    ALTER TABLE ONLY public.transactions ADD CONSTRAINT transactions_type_check CHECK ((type = ANY (ARRAY['income'::text, 'expense'::text, 'investment'::text])));
  END IF;
END
$do$;

ALTER TABLE ONLY public.transactions REPLICA IDENTITY FULL;

-- Table: public.user_categories
CREATE TABLE IF NOT EXISTS public.user_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    type text NOT NULL,
    label text NOT NULL,
    slug text NOT NULL,
    icon text DEFAULT 'Tag'::text NOT NULL,
    color text DEFAULT '#6B7280'::text NOT NULL,
    bg text DEFAULT '#F3F4F6'::text NOT NULL,
    archived boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_categories_label_check CHECK (((char_length(TRIM(BOTH FROM label)) >= 2) AND (char_length(TRIM(BOTH FROM label)) <= 30))),
    CONSTRAINT user_categories_slug_check CHECK ((slug ~ '^custom_[a-z0-9_]+$'::text)),
    CONSTRAINT user_categories_type_check CHECK ((type = ANY (ARRAY['expense'::text, 'income'::text, 'investment'::text])))
);

ALTER TABLE public.user_categories
    ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid() NOT NULL,
    ADD COLUMN IF NOT EXISTS user_id uuid NOT NULL,
    ADD COLUMN IF NOT EXISTS type text NOT NULL,
    ADD COLUMN IF NOT EXISTS label text NOT NULL,
    ADD COLUMN IF NOT EXISTS slug text NOT NULL,
    ADD COLUMN IF NOT EXISTS icon text DEFAULT 'Tag'::text NOT NULL,
    ADD COLUMN IF NOT EXISTS color text DEFAULT '#6B7280'::text NOT NULL,
    ADD COLUMN IF NOT EXISTS bg text DEFAULT '#F3F4F6'::text NOT NULL,
    ADD COLUMN IF NOT EXISTS archived boolean DEFAULT false NOT NULL,
    ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now() NOT NULL;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.user_categories'::regclass AND conname = 'user_categories_label_check'
             AND pg_catalog.pg_get_constraintdef(oid) <> $c$CHECK (((char_length(TRIM(BOTH FROM label)) >= 2) AND (char_length(TRIM(BOTH FROM label)) <= 30)))$c$) THEN
    ALTER TABLE public.user_categories DROP CONSTRAINT user_categories_label_check;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.user_categories'::regclass AND conname = 'user_categories_label_check') THEN
    ALTER TABLE ONLY public.user_categories ADD CONSTRAINT user_categories_label_check CHECK (((char_length(TRIM(BOTH FROM label)) >= 2) AND (char_length(TRIM(BOTH FROM label)) <= 30)));
  END IF;
END
$do$;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.user_categories'::regclass AND conname = 'user_categories_slug_check'
             AND pg_catalog.pg_get_constraintdef(oid) <> $c$CHECK ((slug ~ '^custom_[a-z0-9_]+$'::text))$c$) THEN
    ALTER TABLE public.user_categories DROP CONSTRAINT user_categories_slug_check;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.user_categories'::regclass AND conname = 'user_categories_slug_check') THEN
    ALTER TABLE ONLY public.user_categories ADD CONSTRAINT user_categories_slug_check CHECK ((slug ~ '^custom_[a-z0-9_]+$'::text));
  END IF;
END
$do$;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.user_categories'::regclass AND conname = 'user_categories_type_check'
             AND pg_catalog.pg_get_constraintdef(oid) <> $c$CHECK ((type = ANY (ARRAY['expense'::text, 'income'::text, 'investment'::text])))$c$) THEN
    ALTER TABLE public.user_categories DROP CONSTRAINT user_categories_type_check;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.user_categories'::regclass AND conname = 'user_categories_type_check') THEN
    ALTER TABLE ONLY public.user_categories ADD CONSTRAINT user_categories_type_check CHECK ((type = ANY (ARRAY['expense'::text, 'income'::text, 'investment'::text])));
  END IF;
END
$do$;

-- ═════════════════════════════════════════════════════════════════════════════
-- Primary keys, unique and foreign-key constraints
-- ═════════════════════════════════════════════════════════════════════════════

DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.budgets'::regclass AND conname = 'budgets_pkey') THEN
    ALTER TABLE ONLY public.budgets ADD CONSTRAINT budgets_pkey PRIMARY KEY (id);
  END IF;
END
$do$;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.bug_reports'::regclass AND conname = 'bug_reports_description_len'
             AND pg_catalog.pg_get_constraintdef(oid) <> $c$CHECK ((char_length(description) <= 4000)) NOT VALID$c$) THEN
    ALTER TABLE public.bug_reports DROP CONSTRAINT bug_reports_description_len;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.bug_reports'::regclass AND conname = 'bug_reports_description_len') THEN
    ALTER TABLE ONLY public.bug_reports ADD CONSTRAINT bug_reports_description_len CHECK ((char_length(description) <= 4000)) NOT VALID;
  END IF;
END
$do$;

DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.bug_reports'::regclass AND conname = 'bug_reports_pkey') THEN
    ALTER TABLE ONLY public.bug_reports ADD CONSTRAINT bug_reports_pkey PRIMARY KEY (id);
  END IF;
END
$do$;

DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.category_budgets'::regclass AND conname = 'category_budgets_pkey') THEN
    ALTER TABLE ONLY public.category_budgets ADD CONSTRAINT category_budgets_pkey PRIMARY KEY (id);
  END IF;
END
$do$;

DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.financial_events'::regclass AND conname = 'financial_events_pkey') THEN
    ALTER TABLE ONLY public.financial_events ADD CONSTRAINT financial_events_pkey PRIMARY KEY (id);
  END IF;
END
$do$;

DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.invites'::regclass AND conname = 'invites_pkey') THEN
    ALTER TABLE ONLY public.invites ADD CONSTRAINT invites_pkey PRIMARY KEY (id);
  END IF;
END
$do$;

DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.invites'::regclass AND conname = 'invites_token_key') THEN
    ALTER TABLE ONLY public.invites ADD CONSTRAINT invites_token_key UNIQUE (token);
  END IF;
END
$do$;

DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.liabilities'::regclass AND conname = 'liabilities_pkey') THEN
    ALTER TABLE ONLY public.liabilities ADD CONSTRAINT liabilities_pkey PRIMARY KEY (id);
  END IF;
END
$do$;

DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.loans'::regclass AND conname = 'loans_pkey') THEN
    ALTER TABLE ONLY public.loans ADD CONSTRAINT loans_pkey PRIMARY KEY (id);
  END IF;
END
$do$;

DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.monthly_net_changes'::regclass AND conname = 'monthly_net_changes_pkey') THEN
    ALTER TABLE ONLY public.monthly_net_changes ADD CONSTRAINT monthly_net_changes_pkey PRIMARY KEY (user_id, month_start);
  END IF;
END
$do$;

DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.profiles'::regclass AND conname = 'profiles_pkey') THEN
    ALTER TABLE ONLY public.profiles ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);
  END IF;
END
$do$;

DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.reconciliation_reviews'::regclass AND conname = 'reconciliation_reviews_pkey') THEN
    ALTER TABLE ONLY public.reconciliation_reviews ADD CONSTRAINT reconciliation_reviews_pkey PRIMARY KEY (id);
  END IF;
END
$do$;

DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.reconciliation_reviews'::regclass AND conname = 'reconciliation_reviews_user_id_transaction_id_key') THEN
    ALTER TABLE ONLY public.reconciliation_reviews ADD CONSTRAINT reconciliation_reviews_user_id_transaction_id_key UNIQUE (user_id, transaction_id);
  END IF;
END
$do$;

DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.split_expense_splits'::regclass AND conname = 'split_expense_splits_pkey') THEN
    ALTER TABLE ONLY public.split_expense_splits ADD CONSTRAINT split_expense_splits_pkey PRIMARY KEY (id);
  END IF;
END
$do$;

DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.split_expenses'::regclass AND conname = 'split_expenses_pkey') THEN
    ALTER TABLE ONLY public.split_expenses ADD CONSTRAINT split_expenses_pkey PRIMARY KEY (id);
  END IF;
END
$do$;

DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.split_group_access'::regclass AND conname = 'split_group_access_group_id_user_id_key') THEN
    ALTER TABLE ONLY public.split_group_access ADD CONSTRAINT split_group_access_group_id_user_id_key UNIQUE (group_id, user_id);
  END IF;
END
$do$;

DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.split_group_access'::regclass AND conname = 'split_group_access_pkey') THEN
    ALTER TABLE ONLY public.split_group_access ADD CONSTRAINT split_group_access_pkey PRIMARY KEY (id);
  END IF;
END
$do$;

DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.split_group_invites'::regclass AND conname = 'split_group_invites_pkey') THEN
    ALTER TABLE ONLY public.split_group_invites ADD CONSTRAINT split_group_invites_pkey PRIMARY KEY (id);
  END IF;
END
$do$;

DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.split_group_invites'::regclass AND conname = 'split_group_invites_token_key') THEN
    ALTER TABLE ONLY public.split_group_invites ADD CONSTRAINT split_group_invites_token_key UNIQUE (token);
  END IF;
END
$do$;

DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.split_group_members'::regclass AND conname = 'split_group_members_pkey') THEN
    ALTER TABLE ONLY public.split_group_members ADD CONSTRAINT split_group_members_pkey PRIMARY KEY (id);
  END IF;
END
$do$;

DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.split_groups'::regclass AND conname = 'split_groups_pkey') THEN
    ALTER TABLE ONLY public.split_groups ADD CONSTRAINT split_groups_pkey PRIMARY KEY (id);
  END IF;
END
$do$;

DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.split_settlements'::regclass AND conname = 'split_settlements_pkey') THEN
    ALTER TABLE ONLY public.split_settlements ADD CONSTRAINT split_settlements_pkey PRIMARY KEY (id);
  END IF;
END
$do$;

DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.transactions'::regclass AND conname = 'transactions_pkey') THEN
    ALTER TABLE ONLY public.transactions ADD CONSTRAINT transactions_pkey PRIMARY KEY (id);
  END IF;
END
$do$;

DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.user_categories'::regclass AND conname = 'user_categories_pkey') THEN
    ALTER TABLE ONLY public.user_categories ADD CONSTRAINT user_categories_pkey PRIMARY KEY (id);
  END IF;
END
$do$;

DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.user_categories'::regclass AND conname = 'user_categories_user_id_slug_key') THEN
    ALTER TABLE ONLY public.user_categories ADD CONSTRAINT user_categories_user_id_slug_key UNIQUE (user_id, slug);
  END IF;
END
$do$;

-- ═════════════════════════════════════════════════════════════════════════════
-- Indexes
-- ═════════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_budgets_user ON public.budgets USING btree (user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_budgets_user_category ON public.category_budgets USING btree (user_id, category);

CREATE INDEX IF NOT EXISTS idx_bug_reports_created_at ON public.bug_reports USING btree (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bug_reports_duplicate ON public.bug_reports USING btree (duplicate_of);

CREATE INDEX IF NOT EXISTS idx_bug_reports_fingerprint_route ON public.bug_reports USING btree (fingerprint, route);

CREATE INDEX IF NOT EXISTS idx_bug_reports_last_reported ON public.bug_reports USING btree (last_reported_at DESC);

CREATE INDEX IF NOT EXISTS idx_bug_reports_priority ON public.bug_reports USING btree (priority);

CREATE INDEX IF NOT EXISTS idx_bug_reports_status ON public.bug_reports USING btree (status);

CREATE INDEX IF NOT EXISTS idx_bug_reports_user ON public.bug_reports USING btree (user_id);

CREATE INDEX IF NOT EXISTS idx_financial_events_entity ON public.financial_events USING btree (entity_type, entity_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_financial_events_user_created ON public.financial_events USING btree (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_invite_created_by ON public.invites USING btree (created_by);

CREATE INDEX IF NOT EXISTS idx_invite_token ON public.invites USING btree (token);

CREATE INDEX IF NOT EXISTS idx_invite_used_by ON public.invites USING btree (used_by);

CREATE INDEX IF NOT EXISTS idx_invites_token_active ON public.invites USING btree (token) WHERE (used_by IS NULL);

CREATE INDEX IF NOT EXISTS idx_liab_due ON public.liabilities USING btree (due_date);

CREATE INDEX IF NOT EXISTS idx_liab_linked_txn ON public.liabilities USING btree (linked_transaction_id) WHERE (linked_transaction_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_liab_paid ON public.liabilities USING btree (paid);

CREATE INDEX IF NOT EXISTS idx_liab_user ON public.liabilities USING btree (user_id);

CREATE INDEX IF NOT EXISTS idx_liab_user_due ON public.liabilities USING btree (user_id, due_date);

CREATE INDEX IF NOT EXISTS idx_liab_user_paid_due ON public.liabilities USING btree (user_id, paid, due_date);

CREATE INDEX IF NOT EXISTS idx_liabilities_linked_txn ON public.liabilities USING btree (linked_transaction_id);

CREATE INDEX IF NOT EXISTS idx_loans_direction ON public.loans USING btree (direction);

CREATE INDEX IF NOT EXISTS idx_loans_settled ON public.loans USING btree (settled);

CREATE INDEX IF NOT EXISTS idx_loans_user ON public.loans USING btree (user_id);

CREATE INDEX IF NOT EXISTS idx_recon_reviews_transaction_id ON public.reconciliation_reviews USING btree (transaction_id);

CREATE INDEX IF NOT EXISTS idx_reconciliation_reviews_user ON public.reconciliation_reviews USING btree (user_id);

CREATE INDEX IF NOT EXISTS idx_reconciliation_reviews_user_txn ON public.reconciliation_reviews USING btree (user_id, transaction_id);

CREATE INDEX IF NOT EXISTS idx_split_expense_splits_expense ON public.split_expense_splits USING btree (expense_id);

CREATE INDEX IF NOT EXISTS idx_split_expense_splits_member ON public.split_expense_splits USING btree (member_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_split_expense_splits_unique_member ON public.split_expense_splits USING btree (expense_id, member_id);

CREATE INDEX IF NOT EXISTS idx_split_expense_splits_user ON public.split_expense_splits USING btree (user_id);

CREATE INDEX IF NOT EXISTS idx_split_expenses_group_date ON public.split_expenses USING btree (group_id, expense_date DESC);

CREATE INDEX IF NOT EXISTS idx_split_expenses_linked_transaction ON public.split_expenses USING btree (linked_transaction_id);

CREATE INDEX IF NOT EXISTS idx_split_expenses_paid_by_member ON public.split_expenses USING btree (paid_by_member_id);

CREATE INDEX IF NOT EXISTS idx_split_expenses_user ON public.split_expenses USING btree (user_id);

CREATE INDEX IF NOT EXISTS idx_split_group_access_group ON public.split_group_access USING btree (group_id);

CREATE INDEX IF NOT EXISTS idx_split_group_access_user ON public.split_group_access USING btree (user_id);

CREATE INDEX IF NOT EXISTS idx_split_group_invites_active ON public.split_group_invites USING btree (group_id, created_at DESC) WHERE ((consumed_by IS NULL) AND (revoked_at IS NULL));

CREATE INDEX IF NOT EXISTS idx_split_group_invites_consumed_by ON public.split_group_invites USING btree (consumed_by) WHERE (consumed_by IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_split_group_invites_created_by ON public.split_group_invites USING btree (created_by);

CREATE INDEX IF NOT EXISTS idx_split_group_invites_group ON public.split_group_invites USING btree (group_id);

CREATE INDEX IF NOT EXISTS idx_split_group_invites_token ON public.split_group_invites USING btree (token);

CREATE INDEX IF NOT EXISTS idx_split_group_members_group ON public.split_group_members USING btree (group_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_split_group_members_group_linked_user_unique ON public.split_group_members USING btree (group_id, linked_user_id) WHERE (linked_user_id IS NOT NULL);

CREATE UNIQUE INDEX IF NOT EXISTS idx_split_group_members_group_name_unique ON public.split_group_members USING btree (group_id, lower(display_name));

CREATE INDEX IF NOT EXISTS idx_split_group_members_linked_user ON public.split_group_members USING btree (linked_user_id) WHERE (linked_user_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_split_group_members_user ON public.split_group_members USING btree (user_id);

CREATE INDEX IF NOT EXISTS idx_split_groups_user ON public.split_groups USING btree (user_id);

CREATE INDEX IF NOT EXISTS idx_split_settlements_group_date ON public.split_settlements USING btree (group_id, settled_at DESC);

CREATE INDEX IF NOT EXISTS idx_split_settlements_payee ON public.split_settlements USING btree (payee_member_id);

CREATE INDEX IF NOT EXISTS idx_split_settlements_payee_transaction ON public.split_settlements USING btree (payee_transaction_id);

CREATE INDEX IF NOT EXISTS idx_split_settlements_payer ON public.split_settlements USING btree (payer_member_id);

CREATE INDEX IF NOT EXISTS idx_split_settlements_payer_transaction ON public.split_settlements USING btree (payer_transaction_id);

CREATE INDEX IF NOT EXISTS idx_split_settlements_user ON public.split_settlements USING btree (user_id);

CREATE INDEX IF NOT EXISTS idx_transactions_linked_bill ON public.transactions USING btree (linked_bill_id);

CREATE INDEX IF NOT EXISTS idx_transactions_linked_loan ON public.transactions USING btree (linked_loan_id);

CREATE INDEX IF NOT EXISTS idx_transactions_linked_split_expense ON public.transactions USING btree (linked_split_expense_id);

CREATE INDEX IF NOT EXISTS idx_transactions_linked_split_settlement ON public.transactions USING btree (linked_split_settlement_id);

CREATE INDEX IF NOT EXISTS idx_txn_category ON public.transactions USING btree (category);

CREATE INDEX IF NOT EXISTS idx_txn_date ON public.transactions USING btree (date DESC);

CREATE INDEX IF NOT EXISTS idx_txn_desc_trgm ON public.transactions USING gin (description extensions.gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_txn_recurring_due ON public.transactions USING btree (user_id, next_run_date) WHERE (is_recurring = true);

CREATE INDEX IF NOT EXISTS idx_txn_source_txn ON public.transactions USING btree (source_transaction_id) WHERE (source_transaction_id IS NOT NULL);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_txn_source_date ON public.transactions USING btree (source_transaction_id, date) WHERE (source_transaction_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_txn_type ON public.transactions USING btree (type);

CREATE INDEX IF NOT EXISTS idx_txn_user ON public.transactions USING btree (user_id);

CREATE INDEX IF NOT EXISTS idx_txn_user_category_date_created ON public.transactions USING btree (user_id, category, date DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_txn_user_date ON public.transactions USING btree (user_id, date);

CREATE INDEX IF NOT EXISTS idx_txn_user_date_created ON public.transactions USING btree (user_id, date DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_txn_user_type_date_created ON public.transactions USING btree (user_id, type, date DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_cat_user ON public.user_categories USING btree (user_id) WHERE (archived = false);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_categories_user_label_unique ON public.user_categories USING btree (user_id, lower(TRIM(BOTH FROM label))) WHERE (archived = false);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_invites_active_per_user ON public.invites USING btree (created_by) WHERE (used_by IS NULL);

-- ═════════════════════════════════════════════════════════════════════════════
-- Triggers
-- ═════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE TRIGGER check_bug_report_tampering BEFORE UPDATE ON public.bug_reports FOR EACH ROW EXECUTE FUNCTION public.prevent_bug_report_tampering();

CREATE OR REPLACE TRIGGER check_reconciliation_review_ownership BEFORE INSERT OR UPDATE ON public.reconciliation_reviews FOR EACH ROW EXECUTE FUNCTION public.enforce_reconciliation_review_ownership();

CREATE OR REPLACE TRIGGER enforce_user_category_limit BEFORE INSERT ON public.user_categories FOR EACH ROW EXECUTE FUNCTION public.check_user_category_limit();

CREATE OR REPLACE TRIGGER prevent_immutable_budgets BEFORE UPDATE ON public.budgets FOR EACH ROW EXECUTE FUNCTION public.prevent_immutable_update();

CREATE OR REPLACE TRIGGER prevent_immutable_liabilities BEFORE UPDATE ON public.liabilities FOR EACH ROW EXECUTE FUNCTION public.prevent_immutable_update();

CREATE OR REPLACE TRIGGER prevent_immutable_loans BEFORE UPDATE ON public.loans FOR EACH ROW EXECUTE FUNCTION public.prevent_immutable_update();

CREATE OR REPLACE TRIGGER prevent_immutable_split_expenses BEFORE UPDATE ON public.split_expenses FOR EACH ROW EXECUTE FUNCTION public.prevent_immutable_update();

CREATE OR REPLACE TRIGGER prevent_immutable_split_groups BEFORE UPDATE ON public.split_groups FOR EACH ROW EXECUTE FUNCTION public.prevent_immutable_update();

CREATE OR REPLACE TRIGGER prevent_immutable_transactions BEFORE UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.prevent_immutable_update();

CREATE OR REPLACE TRIGGER trg_bug_reports_protect BEFORE UPDATE ON public.bug_reports FOR EACH ROW EXECUTE FUNCTION public.bug_reports_protect_notified_at();

CREATE OR REPLACE TRIGGER trg_cleanup_access_after_member_delete AFTER DELETE ON public.split_group_members FOR EACH ROW EXECUTE FUNCTION public.cleanup_access_after_member_delete();

CREATE OR REPLACE TRIGGER trg_ensure_group_has_admin AFTER DELETE ON public.split_group_access FOR EACH ROW EXECUTE FUNCTION public.ensure_group_has_admin();

CREATE OR REPLACE TRIGGER trg_guard_split_expense_splits BEFORE INSERT OR DELETE OR UPDATE ON public.split_expense_splits FOR EACH ROW EXECUTE FUNCTION public.guard_split_direct_writes();

CREATE OR REPLACE TRIGGER trg_guard_split_expenses BEFORE INSERT OR DELETE OR UPDATE ON public.split_expenses FOR EACH ROW EXECUTE FUNCTION public.guard_split_direct_writes();

CREATE OR REPLACE TRIGGER trg_guard_split_settlements BEFORE INSERT OR DELETE OR UPDATE ON public.split_settlements FOR EACH ROW EXECUTE FUNCTION public.guard_split_direct_writes();

CREATE OR REPLACE TRIGGER trg_guard_transaction_link_columns BEFORE INSERT OR UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.guard_transaction_link_columns();

CREATE OR REPLACE TRIGGER trg_invites_enforce_active_limit BEFORE INSERT ON public.invites FOR EACH ROW EXECUTE FUNCTION public.enforce_invite_active_limit();

CREATE OR REPLACE TRIGGER trg_log_financial_event_liabilities AFTER INSERT OR DELETE OR UPDATE ON public.liabilities FOR EACH ROW EXECUTE FUNCTION public.log_financial_event_trg();

CREATE OR REPLACE TRIGGER trg_log_financial_event_loans AFTER INSERT OR DELETE OR UPDATE ON public.loans FOR EACH ROW EXECUTE FUNCTION public.log_financial_event_trg();

CREATE OR REPLACE TRIGGER trg_log_financial_event_split_expenses AFTER INSERT OR DELETE OR UPDATE ON public.split_expenses FOR EACH ROW EXECUTE FUNCTION public.log_financial_event_trg();

CREATE OR REPLACE TRIGGER trg_log_financial_event_split_settlements AFTER INSERT OR DELETE OR UPDATE ON public.split_settlements FOR EACH ROW EXECUTE FUNCTION public.log_financial_event_trg();

CREATE OR REPLACE TRIGGER trg_log_financial_event_transactions AFTER INSERT OR DELETE OR UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.log_financial_event_trg();

CREATE OR REPLACE TRIGGER trg_maintain_monthly_net_change AFTER INSERT OR DELETE OR UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.maintain_monthly_net_change();

CREATE OR REPLACE TRIGGER trg_split_group_delete_cleanup BEFORE DELETE ON public.split_groups FOR EACH ROW EXECUTE FUNCTION public.on_split_group_delete_cleanup();

CREATE OR REPLACE TRIGGER trg_split_group_owner_access AFTER INSERT ON public.split_groups FOR EACH ROW EXECUTE FUNCTION public.ensure_split_group_owner_access();

CREATE OR REPLACE TRIGGER trg_split_group_user_id BEFORE INSERT ON public.split_groups FOR EACH ROW EXECUTE FUNCTION public.ensure_split_group_user_id();

CREATE OR REPLACE TRIGGER trg_sync_split_to_tx AFTER UPDATE ON public.split_expenses FOR EACH ROW WHEN (((old.amount IS DISTINCT FROM new.amount) OR (old.description IS DISTINCT FROM new.description) OR (old.expense_date IS DISTINCT FROM new.expense_date))) EXECUTE FUNCTION public.sync_split_to_transaction();

CREATE OR REPLACE TRIGGER trg_sync_tx_to_split AFTER UPDATE ON public.transactions FOR EACH ROW WHEN (((old.amount IS DISTINCT FROM new.amount) OR (old.description IS DISTINCT FROM new.description) OR (old.date IS DISTINCT FROM new.date))) EXECUTE FUNCTION public.sync_transaction_to_split();

CREATE OR REPLACE TRIGGER trg_touch_split_group_updated_at BEFORE UPDATE ON public.split_groups FOR EACH ROW EXECUTE FUNCTION public.touch_split_group_updated_at();

-- ═════════════════════════════════════════════════════════════════════════════
-- Primary keys, unique and foreign-key constraints
-- ═════════════════════════════════════════════════════════════════════════════

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.budgets'::regclass AND conname = 'budgets_user_id_fkey'
             AND pg_catalog.pg_get_constraintdef(oid) <> $c$FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE$c$) THEN
    ALTER TABLE public.budgets DROP CONSTRAINT budgets_user_id_fkey;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.budgets'::regclass AND conname = 'budgets_user_id_fkey') THEN
    ALTER TABLE ONLY public.budgets ADD CONSTRAINT budgets_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END
$do$;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.bug_reports'::regclass AND conname = 'bug_reports_duplicate_of_fkey'
             AND pg_catalog.pg_get_constraintdef(oid) <> $c$FOREIGN KEY (duplicate_of) REFERENCES public.bug_reports(id) ON DELETE SET NULL$c$) THEN
    ALTER TABLE public.bug_reports DROP CONSTRAINT bug_reports_duplicate_of_fkey;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.bug_reports'::regclass AND conname = 'bug_reports_duplicate_of_fkey') THEN
    ALTER TABLE ONLY public.bug_reports ADD CONSTRAINT bug_reports_duplicate_of_fkey FOREIGN KEY (duplicate_of) REFERENCES public.bug_reports(id) ON DELETE SET NULL;
  END IF;
END
$do$;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.bug_reports'::regclass AND conname = 'bug_reports_user_id_fkey'
             AND pg_catalog.pg_get_constraintdef(oid) <> $c$FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL$c$) THEN
    ALTER TABLE public.bug_reports DROP CONSTRAINT bug_reports_user_id_fkey;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.bug_reports'::regclass AND conname = 'bug_reports_user_id_fkey') THEN
    ALTER TABLE ONLY public.bug_reports ADD CONSTRAINT bug_reports_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END
$do$;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.category_budgets'::regclass AND conname = 'category_budgets_user_id_fkey'
             AND pg_catalog.pg_get_constraintdef(oid) <> $c$FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE$c$) THEN
    ALTER TABLE public.category_budgets DROP CONSTRAINT category_budgets_user_id_fkey;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.category_budgets'::regclass AND conname = 'category_budgets_user_id_fkey') THEN
    ALTER TABLE ONLY public.category_budgets ADD CONSTRAINT category_budgets_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END
$do$;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.financial_events'::regclass AND conname = 'financial_events_user_id_fkey'
             AND pg_catalog.pg_get_constraintdef(oid) <> $c$FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE$c$) THEN
    ALTER TABLE public.financial_events DROP CONSTRAINT financial_events_user_id_fkey;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.financial_events'::regclass AND conname = 'financial_events_user_id_fkey') THEN
    ALTER TABLE ONLY public.financial_events ADD CONSTRAINT financial_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END
$do$;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.invites'::regclass AND conname = 'invites_created_by_fkey'
             AND pg_catalog.pg_get_constraintdef(oid) <> $c$FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE$c$) THEN
    ALTER TABLE public.invites DROP CONSTRAINT invites_created_by_fkey;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.invites'::regclass AND conname = 'invites_created_by_fkey') THEN
    ALTER TABLE ONLY public.invites ADD CONSTRAINT invites_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END
$do$;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.invites'::regclass AND conname = 'invites_used_by_fkey'
             AND pg_catalog.pg_get_constraintdef(oid) <> $c$FOREIGN KEY (used_by) REFERENCES auth.users(id) ON DELETE CASCADE$c$) THEN
    ALTER TABLE public.invites DROP CONSTRAINT invites_used_by_fkey;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.invites'::regclass AND conname = 'invites_used_by_fkey') THEN
    ALTER TABLE ONLY public.invites ADD CONSTRAINT invites_used_by_fkey FOREIGN KEY (used_by) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END
$do$;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.liabilities'::regclass AND conname = 'liabilities_linked_transaction_id_fkey'
             AND pg_catalog.pg_get_constraintdef(oid) <> $c$FOREIGN KEY (linked_transaction_id) REFERENCES public.transactions(id) ON DELETE SET NULL$c$) THEN
    ALTER TABLE public.liabilities DROP CONSTRAINT liabilities_linked_transaction_id_fkey;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.liabilities'::regclass AND conname = 'liabilities_linked_transaction_id_fkey') THEN
    ALTER TABLE ONLY public.liabilities ADD CONSTRAINT liabilities_linked_transaction_id_fkey FOREIGN KEY (linked_transaction_id) REFERENCES public.transactions(id) ON DELETE SET NULL;
  END IF;
END
$do$;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.liabilities'::regclass AND conname = 'liabilities_user_id_fkey'
             AND pg_catalog.pg_get_constraintdef(oid) <> $c$FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE$c$) THEN
    ALTER TABLE public.liabilities DROP CONSTRAINT liabilities_user_id_fkey;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.liabilities'::regclass AND conname = 'liabilities_user_id_fkey') THEN
    ALTER TABLE ONLY public.liabilities ADD CONSTRAINT liabilities_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END
$do$;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.loans'::regclass AND conname = 'loans_user_id_fkey'
             AND pg_catalog.pg_get_constraintdef(oid) <> $c$FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE$c$) THEN
    ALTER TABLE public.loans DROP CONSTRAINT loans_user_id_fkey;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.loans'::regclass AND conname = 'loans_user_id_fkey') THEN
    ALTER TABLE ONLY public.loans ADD CONSTRAINT loans_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END
$do$;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.monthly_net_changes'::regclass AND conname = 'monthly_net_changes_user_id_fkey'
             AND pg_catalog.pg_get_constraintdef(oid) <> $c$FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE$c$) THEN
    ALTER TABLE public.monthly_net_changes DROP CONSTRAINT monthly_net_changes_user_id_fkey;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.monthly_net_changes'::regclass AND conname = 'monthly_net_changes_user_id_fkey') THEN
    ALTER TABLE ONLY public.monthly_net_changes ADD CONSTRAINT monthly_net_changes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END
$do$;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.profiles'::regclass AND conname = 'profiles_id_fkey'
             AND pg_catalog.pg_get_constraintdef(oid) <> $c$FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE$c$) THEN
    ALTER TABLE public.profiles DROP CONSTRAINT profiles_id_fkey;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.profiles'::regclass AND conname = 'profiles_id_fkey') THEN
    ALTER TABLE ONLY public.profiles ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END
$do$;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.reconciliation_reviews'::regclass AND conname = 'reconciliation_reviews_transaction_id_fkey'
             AND pg_catalog.pg_get_constraintdef(oid) <> $c$FOREIGN KEY (transaction_id) REFERENCES public.transactions(id) ON DELETE CASCADE$c$) THEN
    ALTER TABLE public.reconciliation_reviews DROP CONSTRAINT reconciliation_reviews_transaction_id_fkey;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.reconciliation_reviews'::regclass AND conname = 'reconciliation_reviews_transaction_id_fkey') THEN
    ALTER TABLE ONLY public.reconciliation_reviews ADD CONSTRAINT reconciliation_reviews_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES public.transactions(id) ON DELETE CASCADE;
  END IF;
END
$do$;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.reconciliation_reviews'::regclass AND conname = 'reconciliation_reviews_user_id_fkey'
             AND pg_catalog.pg_get_constraintdef(oid) <> $c$FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE$c$) THEN
    ALTER TABLE public.reconciliation_reviews DROP CONSTRAINT reconciliation_reviews_user_id_fkey;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.reconciliation_reviews'::regclass AND conname = 'reconciliation_reviews_user_id_fkey') THEN
    ALTER TABLE ONLY public.reconciliation_reviews ADD CONSTRAINT reconciliation_reviews_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END
$do$;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.split_expense_splits'::regclass AND conname = 'split_expense_splits_expense_id_fkey'
             AND pg_catalog.pg_get_constraintdef(oid) <> $c$FOREIGN KEY (expense_id) REFERENCES public.split_expenses(id) ON DELETE CASCADE$c$) THEN
    ALTER TABLE public.split_expense_splits DROP CONSTRAINT split_expense_splits_expense_id_fkey;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.split_expense_splits'::regclass AND conname = 'split_expense_splits_expense_id_fkey') THEN
    ALTER TABLE ONLY public.split_expense_splits ADD CONSTRAINT split_expense_splits_expense_id_fkey FOREIGN KEY (expense_id) REFERENCES public.split_expenses(id) ON DELETE CASCADE;
  END IF;
END
$do$;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.split_expense_splits'::regclass AND conname = 'split_expense_splits_member_id_fkey'
             AND pg_catalog.pg_get_constraintdef(oid) <> $c$FOREIGN KEY (member_id) REFERENCES public.split_group_members(id) ON DELETE RESTRICT$c$) THEN
    ALTER TABLE public.split_expense_splits DROP CONSTRAINT split_expense_splits_member_id_fkey;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.split_expense_splits'::regclass AND conname = 'split_expense_splits_member_id_fkey') THEN
    ALTER TABLE ONLY public.split_expense_splits ADD CONSTRAINT split_expense_splits_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.split_group_members(id) ON DELETE RESTRICT;
  END IF;
END
$do$;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.split_expense_splits'::regclass AND conname = 'split_expense_splits_user_id_fkey'
             AND pg_catalog.pg_get_constraintdef(oid) <> $c$FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL$c$) THEN
    ALTER TABLE public.split_expense_splits DROP CONSTRAINT split_expense_splits_user_id_fkey;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.split_expense_splits'::regclass AND conname = 'split_expense_splits_user_id_fkey') THEN
    ALTER TABLE ONLY public.split_expense_splits ADD CONSTRAINT split_expense_splits_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END
$do$;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.split_expenses'::regclass AND conname = 'split_expenses_group_id_fkey'
             AND pg_catalog.pg_get_constraintdef(oid) <> $c$FOREIGN KEY (group_id) REFERENCES public.split_groups(id) ON DELETE CASCADE$c$) THEN
    ALTER TABLE public.split_expenses DROP CONSTRAINT split_expenses_group_id_fkey;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.split_expenses'::regclass AND conname = 'split_expenses_group_id_fkey') THEN
    ALTER TABLE ONLY public.split_expenses ADD CONSTRAINT split_expenses_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.split_groups(id) ON DELETE CASCADE;
  END IF;
END
$do$;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.split_expenses'::regclass AND conname = 'split_expenses_linked_transaction_id_fkey'
             AND pg_catalog.pg_get_constraintdef(oid) <> $c$FOREIGN KEY (linked_transaction_id) REFERENCES public.transactions(id) ON DELETE SET NULL$c$) THEN
    ALTER TABLE public.split_expenses DROP CONSTRAINT split_expenses_linked_transaction_id_fkey;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.split_expenses'::regclass AND conname = 'split_expenses_linked_transaction_id_fkey') THEN
    ALTER TABLE ONLY public.split_expenses ADD CONSTRAINT split_expenses_linked_transaction_id_fkey FOREIGN KEY (linked_transaction_id) REFERENCES public.transactions(id) ON DELETE SET NULL;
  END IF;
END
$do$;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.split_expenses'::regclass AND conname = 'split_expenses_paid_by_member_id_fkey'
             AND pg_catalog.pg_get_constraintdef(oid) <> $c$FOREIGN KEY (paid_by_member_id) REFERENCES public.split_group_members(id) ON DELETE RESTRICT$c$) THEN
    ALTER TABLE public.split_expenses DROP CONSTRAINT split_expenses_paid_by_member_id_fkey;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.split_expenses'::regclass AND conname = 'split_expenses_paid_by_member_id_fkey') THEN
    ALTER TABLE ONLY public.split_expenses ADD CONSTRAINT split_expenses_paid_by_member_id_fkey FOREIGN KEY (paid_by_member_id) REFERENCES public.split_group_members(id) ON DELETE RESTRICT;
  END IF;
END
$do$;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.split_expenses'::regclass AND conname = 'split_expenses_user_id_fkey'
             AND pg_catalog.pg_get_constraintdef(oid) <> $c$FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL$c$) THEN
    ALTER TABLE public.split_expenses DROP CONSTRAINT split_expenses_user_id_fkey;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.split_expenses'::regclass AND conname = 'split_expenses_user_id_fkey') THEN
    ALTER TABLE ONLY public.split_expenses ADD CONSTRAINT split_expenses_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END
$do$;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.split_group_access'::regclass AND conname = 'split_group_access_group_id_fkey'
             AND pg_catalog.pg_get_constraintdef(oid) <> $c$FOREIGN KEY (group_id) REFERENCES public.split_groups(id) ON DELETE CASCADE$c$) THEN
    ALTER TABLE public.split_group_access DROP CONSTRAINT split_group_access_group_id_fkey;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.split_group_access'::regclass AND conname = 'split_group_access_group_id_fkey') THEN
    ALTER TABLE ONLY public.split_group_access ADD CONSTRAINT split_group_access_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.split_groups(id) ON DELETE CASCADE;
  END IF;
END
$do$;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.split_group_access'::regclass AND conname = 'split_group_access_user_id_fkey'
             AND pg_catalog.pg_get_constraintdef(oid) <> $c$FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE$c$) THEN
    ALTER TABLE public.split_group_access DROP CONSTRAINT split_group_access_user_id_fkey;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.split_group_access'::regclass AND conname = 'split_group_access_user_id_fkey') THEN
    ALTER TABLE ONLY public.split_group_access ADD CONSTRAINT split_group_access_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END
$do$;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.split_group_invites'::regclass AND conname = 'split_group_invites_consumed_by_fkey'
             AND pg_catalog.pg_get_constraintdef(oid) <> $c$FOREIGN KEY (consumed_by) REFERENCES auth.users(id) ON DELETE SET NULL$c$) THEN
    ALTER TABLE public.split_group_invites DROP CONSTRAINT split_group_invites_consumed_by_fkey;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.split_group_invites'::regclass AND conname = 'split_group_invites_consumed_by_fkey') THEN
    ALTER TABLE ONLY public.split_group_invites ADD CONSTRAINT split_group_invites_consumed_by_fkey FOREIGN KEY (consumed_by) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END
$do$;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.split_group_invites'::regclass AND conname = 'split_group_invites_created_by_fkey'
             AND pg_catalog.pg_get_constraintdef(oid) <> $c$FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE$c$) THEN
    ALTER TABLE public.split_group_invites DROP CONSTRAINT split_group_invites_created_by_fkey;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.split_group_invites'::regclass AND conname = 'split_group_invites_created_by_fkey') THEN
    ALTER TABLE ONLY public.split_group_invites ADD CONSTRAINT split_group_invites_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END
$do$;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.split_group_invites'::regclass AND conname = 'split_group_invites_group_id_fkey'
             AND pg_catalog.pg_get_constraintdef(oid) <> $c$FOREIGN KEY (group_id) REFERENCES public.split_groups(id) ON DELETE CASCADE$c$) THEN
    ALTER TABLE public.split_group_invites DROP CONSTRAINT split_group_invites_group_id_fkey;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.split_group_invites'::regclass AND conname = 'split_group_invites_group_id_fkey') THEN
    ALTER TABLE ONLY public.split_group_invites ADD CONSTRAINT split_group_invites_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.split_groups(id) ON DELETE CASCADE;
  END IF;
END
$do$;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.split_group_members'::regclass AND conname = 'split_group_members_group_id_fkey'
             AND pg_catalog.pg_get_constraintdef(oid) <> $c$FOREIGN KEY (group_id) REFERENCES public.split_groups(id) ON DELETE CASCADE$c$) THEN
    ALTER TABLE public.split_group_members DROP CONSTRAINT split_group_members_group_id_fkey;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.split_group_members'::regclass AND conname = 'split_group_members_group_id_fkey') THEN
    ALTER TABLE ONLY public.split_group_members ADD CONSTRAINT split_group_members_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.split_groups(id) ON DELETE CASCADE;
  END IF;
END
$do$;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.split_group_members'::regclass AND conname = 'split_group_members_linked_user_id_fkey'
             AND pg_catalog.pg_get_constraintdef(oid) <> $c$FOREIGN KEY (linked_user_id) REFERENCES auth.users(id) ON DELETE SET NULL$c$) THEN
    ALTER TABLE public.split_group_members DROP CONSTRAINT split_group_members_linked_user_id_fkey;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.split_group_members'::regclass AND conname = 'split_group_members_linked_user_id_fkey') THEN
    ALTER TABLE ONLY public.split_group_members ADD CONSTRAINT split_group_members_linked_user_id_fkey FOREIGN KEY (linked_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END
$do$;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.split_group_members'::regclass AND conname = 'split_group_members_user_id_fkey'
             AND pg_catalog.pg_get_constraintdef(oid) <> $c$FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL$c$) THEN
    ALTER TABLE public.split_group_members DROP CONSTRAINT split_group_members_user_id_fkey;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.split_group_members'::regclass AND conname = 'split_group_members_user_id_fkey') THEN
    ALTER TABLE ONLY public.split_group_members ADD CONSTRAINT split_group_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END
$do$;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.split_groups'::regclass AND conname = 'split_groups_user_id_fkey'
             AND pg_catalog.pg_get_constraintdef(oid) <> $c$FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL$c$) THEN
    ALTER TABLE public.split_groups DROP CONSTRAINT split_groups_user_id_fkey;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.split_groups'::regclass AND conname = 'split_groups_user_id_fkey') THEN
    ALTER TABLE ONLY public.split_groups ADD CONSTRAINT split_groups_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END
$do$;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.split_settlements'::regclass AND conname = 'split_settlements_group_id_fkey'
             AND pg_catalog.pg_get_constraintdef(oid) <> $c$FOREIGN KEY (group_id) REFERENCES public.split_groups(id) ON DELETE CASCADE$c$) THEN
    ALTER TABLE public.split_settlements DROP CONSTRAINT split_settlements_group_id_fkey;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.split_settlements'::regclass AND conname = 'split_settlements_group_id_fkey') THEN
    ALTER TABLE ONLY public.split_settlements ADD CONSTRAINT split_settlements_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.split_groups(id) ON DELETE CASCADE;
  END IF;
END
$do$;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.split_settlements'::regclass AND conname = 'split_settlements_payee_member_id_fkey'
             AND pg_catalog.pg_get_constraintdef(oid) <> $c$FOREIGN KEY (payee_member_id) REFERENCES public.split_group_members(id) ON DELETE RESTRICT$c$) THEN
    ALTER TABLE public.split_settlements DROP CONSTRAINT split_settlements_payee_member_id_fkey;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.split_settlements'::regclass AND conname = 'split_settlements_payee_member_id_fkey') THEN
    ALTER TABLE ONLY public.split_settlements ADD CONSTRAINT split_settlements_payee_member_id_fkey FOREIGN KEY (payee_member_id) REFERENCES public.split_group_members(id) ON DELETE RESTRICT;
  END IF;
END
$do$;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.split_settlements'::regclass AND conname = 'split_settlements_payee_transaction_id_fkey'
             AND pg_catalog.pg_get_constraintdef(oid) <> $c$FOREIGN KEY (payee_transaction_id) REFERENCES public.transactions(id) ON DELETE SET NULL$c$) THEN
    ALTER TABLE public.split_settlements DROP CONSTRAINT split_settlements_payee_transaction_id_fkey;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.split_settlements'::regclass AND conname = 'split_settlements_payee_transaction_id_fkey') THEN
    ALTER TABLE ONLY public.split_settlements ADD CONSTRAINT split_settlements_payee_transaction_id_fkey FOREIGN KEY (payee_transaction_id) REFERENCES public.transactions(id) ON DELETE SET NULL;
  END IF;
END
$do$;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.split_settlements'::regclass AND conname = 'split_settlements_payer_member_id_fkey'
             AND pg_catalog.pg_get_constraintdef(oid) <> $c$FOREIGN KEY (payer_member_id) REFERENCES public.split_group_members(id) ON DELETE RESTRICT$c$) THEN
    ALTER TABLE public.split_settlements DROP CONSTRAINT split_settlements_payer_member_id_fkey;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.split_settlements'::regclass AND conname = 'split_settlements_payer_member_id_fkey') THEN
    ALTER TABLE ONLY public.split_settlements ADD CONSTRAINT split_settlements_payer_member_id_fkey FOREIGN KEY (payer_member_id) REFERENCES public.split_group_members(id) ON DELETE RESTRICT;
  END IF;
END
$do$;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.split_settlements'::regclass AND conname = 'split_settlements_payer_transaction_id_fkey'
             AND pg_catalog.pg_get_constraintdef(oid) <> $c$FOREIGN KEY (payer_transaction_id) REFERENCES public.transactions(id) ON DELETE SET NULL$c$) THEN
    ALTER TABLE public.split_settlements DROP CONSTRAINT split_settlements_payer_transaction_id_fkey;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.split_settlements'::regclass AND conname = 'split_settlements_payer_transaction_id_fkey') THEN
    ALTER TABLE ONLY public.split_settlements ADD CONSTRAINT split_settlements_payer_transaction_id_fkey FOREIGN KEY (payer_transaction_id) REFERENCES public.transactions(id) ON DELETE SET NULL;
  END IF;
END
$do$;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.split_settlements'::regclass AND conname = 'split_settlements_user_id_fkey'
             AND pg_catalog.pg_get_constraintdef(oid) <> $c$FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL$c$) THEN
    ALTER TABLE public.split_settlements DROP CONSTRAINT split_settlements_user_id_fkey;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.split_settlements'::regclass AND conname = 'split_settlements_user_id_fkey') THEN
    ALTER TABLE ONLY public.split_settlements ADD CONSTRAINT split_settlements_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END
$do$;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.transactions'::regclass AND conname = 'transactions_linked_bill_id_fkey'
             AND pg_catalog.pg_get_constraintdef(oid) <> $c$FOREIGN KEY (linked_bill_id) REFERENCES public.liabilities(id) ON DELETE CASCADE$c$) THEN
    ALTER TABLE public.transactions DROP CONSTRAINT transactions_linked_bill_id_fkey;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.transactions'::regclass AND conname = 'transactions_linked_bill_id_fkey') THEN
    ALTER TABLE ONLY public.transactions ADD CONSTRAINT transactions_linked_bill_id_fkey FOREIGN KEY (linked_bill_id) REFERENCES public.liabilities(id) ON DELETE CASCADE;
  END IF;
END
$do$;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.transactions'::regclass AND conname = 'transactions_linked_loan_id_fkey'
             AND pg_catalog.pg_get_constraintdef(oid) <> $c$FOREIGN KEY (linked_loan_id) REFERENCES public.loans(id) ON DELETE CASCADE$c$) THEN
    ALTER TABLE public.transactions DROP CONSTRAINT transactions_linked_loan_id_fkey;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.transactions'::regclass AND conname = 'transactions_linked_loan_id_fkey') THEN
    ALTER TABLE ONLY public.transactions ADD CONSTRAINT transactions_linked_loan_id_fkey FOREIGN KEY (linked_loan_id) REFERENCES public.loans(id) ON DELETE CASCADE;
  END IF;
END
$do$;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.transactions'::regclass AND conname = 'transactions_linked_split_expense_id_fkey'
             AND pg_catalog.pg_get_constraintdef(oid) <> $c$FOREIGN KEY (linked_split_expense_id) REFERENCES public.split_expenses(id) ON DELETE SET NULL$c$) THEN
    ALTER TABLE public.transactions DROP CONSTRAINT transactions_linked_split_expense_id_fkey;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.transactions'::regclass AND conname = 'transactions_linked_split_expense_id_fkey') THEN
    ALTER TABLE ONLY public.transactions ADD CONSTRAINT transactions_linked_split_expense_id_fkey FOREIGN KEY (linked_split_expense_id) REFERENCES public.split_expenses(id) ON DELETE SET NULL;
  END IF;
END
$do$;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.transactions'::regclass AND conname = 'transactions_linked_split_settlement_id_fkey'
             AND pg_catalog.pg_get_constraintdef(oid) <> $c$FOREIGN KEY (linked_split_settlement_id) REFERENCES public.split_settlements(id) ON DELETE SET NULL$c$) THEN
    ALTER TABLE public.transactions DROP CONSTRAINT transactions_linked_split_settlement_id_fkey;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.transactions'::regclass AND conname = 'transactions_linked_split_settlement_id_fkey') THEN
    ALTER TABLE ONLY public.transactions ADD CONSTRAINT transactions_linked_split_settlement_id_fkey FOREIGN KEY (linked_split_settlement_id) REFERENCES public.split_settlements(id) ON DELETE SET NULL;
  END IF;
END
$do$;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.transactions'::regclass AND conname = 'transactions_source_transaction_id_fkey'
             AND pg_catalog.pg_get_constraintdef(oid) <> $c$FOREIGN KEY (source_transaction_id) REFERENCES public.transactions(id) ON DELETE SET NULL$c$) THEN
    ALTER TABLE public.transactions DROP CONSTRAINT transactions_source_transaction_id_fkey;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.transactions'::regclass AND conname = 'transactions_source_transaction_id_fkey') THEN
    ALTER TABLE ONLY public.transactions ADD CONSTRAINT transactions_source_transaction_id_fkey FOREIGN KEY (source_transaction_id) REFERENCES public.transactions(id) ON DELETE SET NULL;
  END IF;
END
$do$;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.transactions'::regclass AND conname = 'transactions_user_id_fkey'
             AND pg_catalog.pg_get_constraintdef(oid) <> $c$FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE$c$) THEN
    ALTER TABLE public.transactions DROP CONSTRAINT transactions_user_id_fkey;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.transactions'::regclass AND conname = 'transactions_user_id_fkey') THEN
    ALTER TABLE ONLY public.transactions ADD CONSTRAINT transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END
$do$;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.user_categories'::regclass AND conname = 'user_categories_user_id_fkey'
             AND pg_catalog.pg_get_constraintdef(oid) <> $c$FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE$c$) THEN
    ALTER TABLE public.user_categories DROP CONSTRAINT user_categories_user_id_fkey;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.user_categories'::regclass AND conname = 'user_categories_user_id_fkey') THEN
    ALTER TABLE ONLY public.user_categories ADD CONSTRAINT user_categories_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END
$do$;

-- ═════════════════════════════════════════════════════════════════════════════
-- Row level security and policies
-- ═════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Users can read own monthly net changes" ON public.monthly_net_changes;
CREATE POLICY "Users can read own monthly net changes" ON public.monthly_net_changes FOR SELECT TO authenticated USING (public.is_linked(user_id));

-- ═════════════════════════════════════════════════════════════════════════════
-- Retired objects (present in older databases, no longer used)
-- ═════════════════════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.create_loan(text, numeric, text, date, text, text, boolean, uuid, uuid);

DROP POLICY IF EXISTS "invites: update own" ON public.invites;

DROP POLICY IF EXISTS "bug_reports: insert own" ON public.bug_reports;

DROP POLICY IF EXISTS "bug_reports: update own" ON public.bug_reports;

-- ═════════════════════════════════════════════════════════════════════════════
-- Row level security and policies
-- ═════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "budgets: delete own" ON public.budgets;
CREATE POLICY "budgets: delete own" ON public.budgets FOR DELETE TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id));

DROP POLICY IF EXISTS "budgets: insert own" ON public.budgets;
CREATE POLICY "budgets: insert own" ON public.budgets FOR INSERT TO authenticated WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

DROP POLICY IF EXISTS "budgets: select own" ON public.budgets;
CREATE POLICY "budgets: select own" ON public.budgets FOR SELECT TO authenticated USING (public.is_linked(user_id));

DROP POLICY IF EXISTS "budgets: update own" ON public.budgets;
CREATE POLICY "budgets: update own" ON public.budgets FOR UPDATE TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

ALTER TABLE public.bug_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bug_reports: select own" ON public.bug_reports;
CREATE POLICY "bug_reports: select own" ON public.bug_reports FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id));

ALTER TABLE public.category_budgets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "category_budgets: delete own" ON public.category_budgets;
CREATE POLICY "category_budgets: delete own" ON public.category_budgets FOR DELETE TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id));

DROP POLICY IF EXISTS "category_budgets: insert own" ON public.category_budgets;
CREATE POLICY "category_budgets: insert own" ON public.category_budgets FOR INSERT TO authenticated WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

DROP POLICY IF EXISTS "category_budgets: select own" ON public.category_budgets;
CREATE POLICY "category_budgets: select own" ON public.category_budgets FOR SELECT TO authenticated USING (public.is_linked(user_id));

DROP POLICY IF EXISTS "category_budgets: update own" ON public.category_budgets;
CREATE POLICY "category_budgets: update own" ON public.category_budgets FOR UPDATE TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id));

ALTER TABLE public.financial_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "financial_events: delete none" ON public.financial_events;
CREATE POLICY "financial_events: delete none" ON public.financial_events FOR DELETE USING (false);

DROP POLICY IF EXISTS "financial_events: insert blocked" ON public.financial_events;
CREATE POLICY "financial_events: insert blocked" ON public.financial_events FOR INSERT TO authenticated WITH CHECK (false);

DROP POLICY IF EXISTS "financial_events: select own" ON public.financial_events;
CREATE POLICY "financial_events: select own" ON public.financial_events FOR SELECT TO authenticated USING (public.is_linked(user_id));

DROP POLICY IF EXISTS "financial_events: update none" ON public.financial_events;
CREATE POLICY "financial_events: update none" ON public.financial_events FOR UPDATE USING (false) WITH CHECK (false);

ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invites: delete own" ON public.invites;
CREATE POLICY "invites: delete own" ON public.invites FOR DELETE TO authenticated USING ((( SELECT auth.uid() AS uid) = created_by));

DROP POLICY IF EXISTS "invites: insert own" ON public.invites;
CREATE POLICY "invites: insert own" ON public.invites FOR INSERT TO authenticated WITH CHECK (((( SELECT auth.uid() AS uid) = created_by) AND (used_by IS NULL) AND (used_at IS NULL)));

DROP POLICY IF EXISTS "invites: select own" ON public.invites;
CREATE POLICY "invites: select own" ON public.invites FOR SELECT TO authenticated USING (((( SELECT auth.uid() AS uid) = created_by) OR (( SELECT auth.uid() AS uid) = used_by)));

ALTER TABLE public.liabilities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "liabilities: delete own" ON public.liabilities;
CREATE POLICY "liabilities: delete own" ON public.liabilities FOR DELETE TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id));

DROP POLICY IF EXISTS "liabilities: insert own" ON public.liabilities;
CREATE POLICY "liabilities: insert own" ON public.liabilities FOR INSERT TO authenticated WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

DROP POLICY IF EXISTS "liabilities: select own" ON public.liabilities;
CREATE POLICY "liabilities: select own" ON public.liabilities FOR SELECT TO authenticated USING (public.is_linked(user_id));

DROP POLICY IF EXISTS "liabilities: update own" ON public.liabilities;
CREATE POLICY "liabilities: update own" ON public.liabilities FOR UPDATE TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id));

ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "loans: delete own" ON public.loans;
CREATE POLICY "loans: delete own" ON public.loans FOR DELETE TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id));

DROP POLICY IF EXISTS "loans: insert own" ON public.loans;
CREATE POLICY "loans: insert own" ON public.loans FOR INSERT TO authenticated WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

DROP POLICY IF EXISTS "loans: select own" ON public.loans;
CREATE POLICY "loans: select own" ON public.loans FOR SELECT TO authenticated USING (public.is_linked(user_id));

DROP POLICY IF EXISTS "loans: update own" ON public.loans;
CREATE POLICY "loans: update own" ON public.loans FOR UPDATE TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

ALTER TABLE public.monthly_net_changes ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles: insert own" ON public.profiles;
CREATE POLICY "profiles: insert own" ON public.profiles FOR INSERT TO authenticated WITH CHECK ((( SELECT auth.uid() AS uid) = id));

DROP POLICY IF EXISTS "profiles: select own" ON public.profiles;
CREATE POLICY "profiles: select own" ON public.profiles FOR SELECT TO authenticated USING (public.is_linked(id));

DROP POLICY IF EXISTS "profiles: update own" ON public.profiles;
CREATE POLICY "profiles: update own" ON public.profiles FOR UPDATE TO authenticated USING ((( SELECT auth.uid() AS uid) = id)) WITH CHECK ((( SELECT auth.uid() AS uid) = id));

ALTER TABLE public.reconciliation_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reconciliation_reviews: delete own" ON public.reconciliation_reviews;
CREATE POLICY "reconciliation_reviews: delete own" ON public.reconciliation_reviews FOR DELETE TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id));

DROP POLICY IF EXISTS "reconciliation_reviews: insert own" ON public.reconciliation_reviews;
CREATE POLICY "reconciliation_reviews: insert own" ON public.reconciliation_reviews FOR INSERT TO authenticated WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

DROP POLICY IF EXISTS "reconciliation_reviews: select own" ON public.reconciliation_reviews;
CREATE POLICY "reconciliation_reviews: select own" ON public.reconciliation_reviews FOR SELECT TO authenticated USING (public.is_linked(user_id));

DROP POLICY IF EXISTS "reconciliation_reviews: update own" ON public.reconciliation_reviews;
CREATE POLICY "reconciliation_reviews: update own" ON public.reconciliation_reviews FOR UPDATE TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

ALTER TABLE public.split_expense_splits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "split_expense_splits: delete own" ON public.split_expense_splits;
CREATE POLICY "split_expense_splits: delete own" ON public.split_expense_splits FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.split_expenses e
  WHERE ((e.id = split_expense_splits.expense_id) AND public.is_split_group_member_or_above(e.group_id)))));

DROP POLICY IF EXISTS "split_expense_splits: insert own" ON public.split_expense_splits;
CREATE POLICY "split_expense_splits: insert own" ON public.split_expense_splits FOR INSERT TO authenticated WITH CHECK (((( SELECT auth.uid() AS uid) = user_id) AND (EXISTS ( SELECT 1
   FROM public.split_expenses e
  WHERE ((e.id = split_expense_splits.expense_id) AND public.is_split_group_member_or_above(e.group_id))))));

DROP POLICY IF EXISTS "split_expense_splits: select own" ON public.split_expense_splits;
CREATE POLICY "split_expense_splits: select own" ON public.split_expense_splits FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.split_expenses e
  WHERE ((e.id = split_expense_splits.expense_id) AND public.has_split_group_access(e.group_id)))));

DROP POLICY IF EXISTS "split_expense_splits: update own" ON public.split_expense_splits;
CREATE POLICY "split_expense_splits: update own" ON public.split_expense_splits FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.split_expenses e
  WHERE ((e.id = split_expense_splits.expense_id) AND public.is_split_group_member_or_above(e.group_id))))) WITH CHECK (((( SELECT auth.uid() AS uid) = user_id) AND (EXISTS ( SELECT 1
   FROM public.split_expenses e
  WHERE ((e.id = split_expense_splits.expense_id) AND public.is_split_group_member_or_above(e.group_id))))));

ALTER TABLE public.split_expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "split_expenses: delete own" ON public.split_expenses;
CREATE POLICY "split_expenses: delete own" ON public.split_expenses FOR DELETE TO authenticated USING (public.is_split_group_member_or_above(group_id));

DROP POLICY IF EXISTS "split_expenses: insert own" ON public.split_expenses;
CREATE POLICY "split_expenses: insert own" ON public.split_expenses FOR INSERT TO authenticated WITH CHECK (((( SELECT auth.uid() AS uid) = user_id) AND public.is_split_group_member_or_above(group_id)));

DROP POLICY IF EXISTS "split_expenses: select own" ON public.split_expenses;
CREATE POLICY "split_expenses: select own" ON public.split_expenses FOR SELECT TO authenticated USING (public.has_split_group_access(group_id));

DROP POLICY IF EXISTS "split_expenses: update own" ON public.split_expenses;
CREATE POLICY "split_expenses: update own" ON public.split_expenses FOR UPDATE TO authenticated USING (public.is_split_group_member_or_above(group_id)) WITH CHECK (((( SELECT auth.uid() AS uid) = user_id) AND public.is_split_group_member_or_above(group_id)));

ALTER TABLE public.split_group_access ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "split_group_access: delete owner" ON public.split_group_access;
CREATE POLICY "split_group_access: delete owner" ON public.split_group_access FOR DELETE TO authenticated USING (public.is_split_group_owner(group_id));

DROP POLICY IF EXISTS "split_group_access: insert owner" ON public.split_group_access;
CREATE POLICY "split_group_access: insert owner" ON public.split_group_access FOR INSERT TO authenticated WITH CHECK (((( SELECT auth.uid() AS uid) = user_id) AND (role = ANY (ARRAY['admin'::text, 'member'::text, 'viewer'::text])) AND public.is_split_group_owner(group_id)));

DROP POLICY IF EXISTS "split_group_access: select own" ON public.split_group_access;
CREATE POLICY "split_group_access: select own" ON public.split_group_access FOR SELECT TO authenticated USING (public.has_split_group_access(group_id));

DROP POLICY IF EXISTS "split_group_access: update owner" ON public.split_group_access;
CREATE POLICY "split_group_access: update owner" ON public.split_group_access FOR UPDATE TO authenticated USING (public.is_split_group_owner(group_id)) WITH CHECK (((role = ANY (ARRAY['admin'::text, 'member'::text, 'viewer'::text])) AND public.is_split_group_owner(group_id)));

ALTER TABLE public.split_group_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "split_group_invites: delete owner" ON public.split_group_invites;
CREATE POLICY "split_group_invites: delete owner" ON public.split_group_invites FOR DELETE TO authenticated USING (public.is_split_group_owner(group_id));

DROP POLICY IF EXISTS "split_group_invites: insert owner" ON public.split_group_invites;
CREATE POLICY "split_group_invites: insert owner" ON public.split_group_invites FOR INSERT TO authenticated WITH CHECK (((( SELECT auth.uid() AS uid) = created_by) AND (role = ANY (ARRAY['viewer'::text, 'member'::text, 'admin'::text])) AND public.is_split_group_owner(group_id)));

DROP POLICY IF EXISTS "split_group_invites: select own" ON public.split_group_invites;
CREATE POLICY "split_group_invites: select own" ON public.split_group_invites FOR SELECT TO authenticated USING ((public.is_split_group_owner(group_id) OR (( SELECT auth.uid() AS uid) = consumed_by)));

DROP POLICY IF EXISTS "split_group_invites: update owner" ON public.split_group_invites;
CREATE POLICY "split_group_invites: update owner" ON public.split_group_invites FOR UPDATE TO authenticated USING (public.is_split_group_owner(group_id)) WITH CHECK (((role = ANY (ARRAY['viewer'::text, 'member'::text, 'admin'::text])) AND public.is_split_group_owner(group_id)));

ALTER TABLE public.split_group_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "split_group_members: insert own" ON public.split_group_members;
CREATE POLICY "split_group_members: insert own" ON public.split_group_members FOR INSERT TO authenticated WITH CHECK (((( SELECT auth.uid() AS uid) = user_id) AND public.is_split_group_owner(group_id)));

DROP POLICY IF EXISTS "split_group_members: select own" ON public.split_group_members;
CREATE POLICY "split_group_members: select own" ON public.split_group_members FOR SELECT TO authenticated USING (public.has_split_group_access(group_id));

DROP POLICY IF EXISTS "split_group_members: update own" ON public.split_group_members;
CREATE POLICY "split_group_members: update own" ON public.split_group_members FOR UPDATE TO authenticated USING (public.is_split_group_owner(group_id)) WITH CHECK (((( SELECT auth.uid() AS uid) = user_id) AND public.is_split_group_owner(group_id)));

ALTER TABLE public.split_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "split_groups: delete own" ON public.split_groups;
CREATE POLICY "split_groups: delete own" ON public.split_groups FOR DELETE TO authenticated USING (public.is_split_group_owner(id));

DROP POLICY IF EXISTS "split_groups: insert own" ON public.split_groups;
CREATE POLICY "split_groups: insert own" ON public.split_groups FOR INSERT TO authenticated WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

DROP POLICY IF EXISTS "split_groups: select own" ON public.split_groups;
CREATE POLICY "split_groups: select own" ON public.split_groups FOR SELECT TO authenticated USING (public.has_split_group_access(id));

DROP POLICY IF EXISTS "split_groups: update own" ON public.split_groups;
CREATE POLICY "split_groups: update own" ON public.split_groups FOR UPDATE TO authenticated USING (public.is_split_group_owner(id)) WITH CHECK (public.is_split_group_owner(id));

ALTER TABLE public.split_settlements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "split_settlements: delete own" ON public.split_settlements;
CREATE POLICY "split_settlements: delete own" ON public.split_settlements FOR DELETE TO authenticated USING (public.is_split_group_member_or_above(group_id));

DROP POLICY IF EXISTS "split_settlements: insert own" ON public.split_settlements;
CREATE POLICY "split_settlements: insert own" ON public.split_settlements FOR INSERT TO authenticated WITH CHECK (((( SELECT auth.uid() AS uid) = user_id) AND public.is_split_group_member_or_above(group_id)));

DROP POLICY IF EXISTS "split_settlements: select own" ON public.split_settlements;
CREATE POLICY "split_settlements: select own" ON public.split_settlements FOR SELECT TO authenticated USING (public.has_split_group_access(group_id));

DROP POLICY IF EXISTS "split_settlements: update own" ON public.split_settlements;
CREATE POLICY "split_settlements: update own" ON public.split_settlements FOR UPDATE TO authenticated USING (public.is_split_group_member_or_above(group_id)) WITH CHECK (((( SELECT auth.uid() AS uid) = user_id) AND public.is_split_group_member_or_above(group_id)));

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "transactions: delete own" ON public.transactions;
CREATE POLICY "transactions: delete own" ON public.transactions FOR DELETE TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id));

DROP POLICY IF EXISTS "transactions: insert own" ON public.transactions;
CREATE POLICY "transactions: insert own" ON public.transactions FOR INSERT TO authenticated WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

DROP POLICY IF EXISTS "transactions: select own" ON public.transactions;
CREATE POLICY "transactions: select own" ON public.transactions FOR SELECT TO authenticated USING (public.is_linked(user_id));

DROP POLICY IF EXISTS "transactions: update own" ON public.transactions;
CREATE POLICY "transactions: update own" ON public.transactions FOR UPDATE TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id));

ALTER TABLE public.user_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_categories: insert own" ON public.user_categories;
CREATE POLICY "user_categories: insert own" ON public.user_categories FOR INSERT TO authenticated WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

DROP POLICY IF EXISTS "user_categories: select own" ON public.user_categories;
CREATE POLICY "user_categories: select own" ON public.user_categories FOR SELECT TO authenticated USING (public.is_linked(user_id));

DROP POLICY IF EXISTS "user_categories: update own" ON public.user_categories;
CREATE POLICY "user_categories: update own" ON public.user_categories FOR UPDATE TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id));

-- ═════════════════════════════════════════════════════════════════════════════
-- Realtime publication
-- ═════════════════════════════════════════════════════════════════════════════

DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime WITH (publish = 'insert, update, delete, truncate');
  END IF;
END
$do$;

DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_publication_tables
                 WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'liabilities') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.liabilities;
  END IF;
END
$do$;

DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_publication_tables
                 WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'loans') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.loans;
  END IF;
END
$do$;

DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_publication_tables
                 WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'split_expense_splits') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.split_expense_splits;
  END IF;
END
$do$;

DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_publication_tables
                 WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'split_expenses') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.split_expenses;
  END IF;
END
$do$;

DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_publication_tables
                 WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'split_group_access') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.split_group_access;
  END IF;
END
$do$;

DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_publication_tables
                 WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'split_group_invites') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.split_group_invites;
  END IF;
END
$do$;

DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_publication_tables
                 WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'split_group_members') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.split_group_members;
  END IF;
END
$do$;

DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_publication_tables
                 WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'split_groups') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.split_groups;
  END IF;
END
$do$;

DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_publication_tables
                 WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'split_settlements') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.split_settlements;
  END IF;
END
$do$;

DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_publication_tables
                 WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'transactions') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.transactions;
  END IF;
END
$do$;

-- ═════════════════════════════════════════════════════════════════════════════
-- Privileges (each object is reset, then granted exactly as in production)
-- ═════════════════════════════════════════════════════════════════════════════

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;

REVOKE ALL ON FUNCTION public.bug_reports_protect_notified_at() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.bug_reports_protect_notified_at() FROM PUBLIC;
GRANT ALL ON FUNCTION public.bug_reports_protect_notified_at() TO authenticated;
GRANT ALL ON FUNCTION public.bug_reports_protect_notified_at() TO service_role;

REVOKE ALL ON FUNCTION public.check_user_category_limit() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.check_user_category_limit() FROM PUBLIC;
GRANT ALL ON FUNCTION public.check_user_category_limit() TO service_role;

REVOKE ALL ON FUNCTION public.cleanup_access_after_member_delete() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.cleanup_access_after_member_delete() FROM PUBLIC;
GRANT ALL ON FUNCTION public.cleanup_access_after_member_delete() TO service_role;

REVOKE ALL ON FUNCTION public.consume_wallet_invite(p_token text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.consume_wallet_invite(p_token text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.consume_wallet_invite(p_token text) TO authenticated;
GRANT ALL ON FUNCTION public.consume_wallet_invite(p_token text) TO service_role;

REVOKE ALL ON TABLE public.loans FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON TABLE public.loans TO anon;
GRANT ALL ON TABLE public.loans TO authenticated;
GRANT ALL ON TABLE public.loans TO service_role;

REVOKE ALL ON FUNCTION public.create_loan(p_user_id uuid, p_direction text, p_counterparty text, p_amount numeric, p_interest_rate numeric, p_loan_date date, p_due_date date, p_note text, p_id uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.create_loan(p_user_id uuid, p_direction text, p_counterparty text, p_amount numeric, p_interest_rate numeric, p_loan_date date, p_due_date date, p_note text, p_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.create_loan(p_user_id uuid, p_direction text, p_counterparty text, p_amount numeric, p_interest_rate numeric, p_loan_date date, p_due_date date, p_note text, p_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.create_loan(p_user_id uuid, p_direction text, p_counterparty text, p_amount numeric, p_interest_rate numeric, p_loan_date date, p_due_date date, p_note text, p_id uuid) TO service_role;

REVOKE ALL ON FUNCTION public.delete_liability_with_txns(p_id uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.delete_liability_with_txns(p_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.delete_liability_with_txns(p_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.delete_liability_with_txns(p_id uuid) TO service_role;

REVOKE ALL ON FUNCTION public.delete_loan_with_txns(p_id uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.delete_loan_with_txns(p_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.delete_loan_with_txns(p_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.delete_loan_with_txns(p_id uuid) TO service_role;

REVOKE ALL ON FUNCTION public.delete_split_expense_atomic(p_id uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.delete_split_expense_atomic(p_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.delete_split_expense_atomic(p_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.delete_split_expense_atomic(p_id uuid) TO service_role;

REVOKE ALL ON FUNCTION public.delete_split_settlement_atomic(p_id uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.delete_split_settlement_atomic(p_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.delete_split_settlement_atomic(p_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.delete_split_settlement_atomic(p_id uuid) TO service_role;

REVOKE ALL ON FUNCTION public.enforce_invite_active_limit() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.enforce_invite_active_limit() FROM PUBLIC;
GRANT ALL ON FUNCTION public.enforce_invite_active_limit() TO service_role;

REVOKE ALL ON FUNCTION public.enforce_reconciliation_review_ownership() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.enforce_reconciliation_review_ownership() FROM PUBLIC;
GRANT ALL ON FUNCTION public.enforce_reconciliation_review_ownership() TO service_role;

REVOKE ALL ON FUNCTION public.ensure_group_has_admin() FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.ensure_group_has_admin() TO service_role;

REVOKE ALL ON FUNCTION public.ensure_split_group_owner_access() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.ensure_split_group_owner_access() FROM PUBLIC;
GRANT ALL ON FUNCTION public.ensure_split_group_owner_access() TO service_role;

REVOKE ALL ON FUNCTION public.ensure_split_group_user_id() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.ensure_split_group_user_id() FROM PUBLIC;
GRANT ALL ON FUNCTION public.ensure_split_group_user_id() TO service_role;

REVOKE ALL ON FUNCTION public.generate_recurring_transactions(p_user_id uuid, p_today date) FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.generate_recurring_transactions(p_user_id uuid, p_today date) TO anon;
GRANT ALL ON FUNCTION public.generate_recurring_transactions(p_user_id uuid, p_today date) TO authenticated;
GRANT ALL ON FUNCTION public.generate_recurring_transactions(p_user_id uuid, p_today date) TO service_role;

REVOKE ALL ON FUNCTION public.get_month_summary(p_user_id uuid, p_month text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_month_summary(p_user_id uuid, p_month text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_month_summary(p_user_id uuid, p_month text) TO authenticated;
GRANT ALL ON FUNCTION public.get_month_summary(p_user_id uuid, p_month text) TO service_role;

REVOKE ALL ON FUNCTION public.get_month_summary(p_user_ids uuid[], p_year integer, p_month integer) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_month_summary(p_user_ids uuid[], p_year integer, p_month integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_month_summary(p_user_ids uuid[], p_year integer, p_month integer) TO authenticated;
GRANT ALL ON FUNCTION public.get_month_summary(p_user_ids uuid[], p_year integer, p_month integer) TO service_role;

REVOKE ALL ON FUNCTION public.get_month_summary(p_user_id uuid, p_year integer, p_month integer) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_month_summary(p_user_id uuid, p_year integer, p_month integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_month_summary(p_user_id uuid, p_year integer, p_month integer) TO authenticated;
GRANT ALL ON FUNCTION public.get_month_summary(p_user_id uuid, p_year integer, p_month integer) TO service_role;

REVOKE ALL ON FUNCTION public.get_running_balance(p_user_ids uuid[], p_end_date date) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_running_balance(p_user_ids uuid[], p_end_date date) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_running_balance(p_user_ids uuid[], p_end_date date) TO authenticated;
GRANT ALL ON FUNCTION public.get_running_balance(p_user_ids uuid[], p_end_date date) TO service_role;

REVOKE ALL ON FUNCTION public.get_running_balance(p_user_id uuid, p_end_date date) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_running_balance(p_user_id uuid, p_end_date date) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_running_balance(p_user_id uuid, p_end_date date) TO authenticated;
GRANT ALL ON FUNCTION public.get_running_balance(p_user_id uuid, p_end_date date) TO service_role;

REVOKE ALL ON FUNCTION public.get_transaction_signal_aggregates(p_user_id uuid, p_type text, p_category text, p_payment_mode text, p_search text, p_start_date date, p_end_date date) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_transaction_signal_aggregates(p_user_id uuid, p_type text, p_category text, p_payment_mode text, p_search text, p_start_date date, p_end_date date) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_transaction_signal_aggregates(p_user_id uuid, p_type text, p_category text, p_payment_mode text, p_search text, p_start_date date, p_end_date date) TO authenticated;
GRANT ALL ON FUNCTION public.get_transaction_signal_aggregates(p_user_id uuid, p_type text, p_category text, p_payment_mode text, p_search text, p_start_date date, p_end_date date) TO service_role;

REVOKE ALL ON FUNCTION public.get_transaction_signal_aggregates(p_user_id uuid, p_type text, p_category text, p_payment_mode text, p_search text, p_start_date date, p_end_date date, p_linked_loan_id uuid, p_linked_bill_id uuid, p_linked_split_expense_id uuid, p_linked_split_settlement_id uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_transaction_signal_aggregates(p_user_id uuid, p_type text, p_category text, p_payment_mode text, p_search text, p_start_date date, p_end_date date, p_linked_loan_id uuid, p_linked_bill_id uuid, p_linked_split_expense_id uuid, p_linked_split_settlement_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_transaction_signal_aggregates(p_user_id uuid, p_type text, p_category text, p_payment_mode text, p_search text, p_start_date date, p_end_date date, p_linked_loan_id uuid, p_linked_bill_id uuid, p_linked_split_expense_id uuid, p_linked_split_settlement_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_transaction_signal_aggregates(p_user_id uuid, p_type text, p_category text, p_payment_mode text, p_search text, p_start_date date, p_end_date date, p_linked_loan_id uuid, p_linked_bill_id uuid, p_linked_split_expense_id uuid, p_linked_split_settlement_id uuid) TO service_role;

REVOKE ALL ON FUNCTION public.get_year_summary(p_user_ids uuid[], p_year integer) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_year_summary(p_user_ids uuid[], p_year integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_year_summary(p_user_ids uuid[], p_year integer) TO authenticated;
GRANT ALL ON FUNCTION public.get_year_summary(p_user_ids uuid[], p_year integer) TO service_role;

REVOKE ALL ON FUNCTION public.get_year_summary(p_user_id uuid, p_year integer) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_year_summary(p_user_id uuid, p_year integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_year_summary(p_user_id uuid, p_year integer) TO authenticated;
GRANT ALL ON FUNCTION public.get_year_summary(p_user_id uuid, p_year integer) TO service_role;

REVOKE ALL ON FUNCTION public.guard_split_direct_writes() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.guard_split_direct_writes() FROM PUBLIC;
GRANT ALL ON FUNCTION public.guard_split_direct_writes() TO authenticated;
GRANT ALL ON FUNCTION public.guard_split_direct_writes() TO service_role;

REVOKE ALL ON FUNCTION public.guard_transaction_link_columns() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.guard_transaction_link_columns() FROM PUBLIC;
GRANT ALL ON FUNCTION public.guard_transaction_link_columns() TO authenticated;
GRANT ALL ON FUNCTION public.guard_transaction_link_columns() TO service_role;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
GRANT ALL ON FUNCTION public.handle_new_user() TO service_role;

REVOKE ALL ON FUNCTION public.has_split_group_access(p_group_id uuid, p_user_id uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.has_split_group_access(p_group_id uuid, p_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.has_split_group_access(p_group_id uuid, p_user_id uuid) TO service_role;
GRANT ALL ON FUNCTION public.has_split_group_access(p_group_id uuid, p_user_id uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.is_linked(target_user_id uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.is_linked(target_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.is_linked(target_user_id uuid) TO service_role;
GRANT ALL ON FUNCTION public.is_linked(target_user_id uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.is_linked(target_user_id uuid, p_user_id uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.is_linked(target_user_id uuid, p_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.is_linked(target_user_id uuid, p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.is_linked(target_user_id uuid, p_user_id uuid) TO service_role;

REVOKE ALL ON FUNCTION public.is_split_group_member_or_above(p_group_id uuid, p_user_id uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.is_split_group_member_or_above(p_group_id uuid, p_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.is_split_group_member_or_above(p_group_id uuid, p_user_id uuid) TO service_role;
GRANT ALL ON FUNCTION public.is_split_group_member_or_above(p_group_id uuid, p_user_id uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.is_split_group_owner(p_group_id uuid, p_user_id uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.is_split_group_owner(p_group_id uuid, p_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.is_split_group_owner(p_group_id uuid, p_user_id uuid) TO service_role;
GRANT ALL ON FUNCTION public.is_split_group_owner(p_group_id uuid, p_user_id uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.log_financial_event_trg() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.log_financial_event_trg() FROM PUBLIC;
GRANT ALL ON FUNCTION public.log_financial_event_trg() TO service_role;

REVOKE ALL ON FUNCTION public.maintain_monthly_net_change() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.maintain_monthly_net_change() FROM PUBLIC;
GRANT ALL ON FUNCTION public.maintain_monthly_net_change() TO service_role;

REVOKE ALL ON FUNCTION public.mark_liability_paid(p_liability_id uuid, p_user_id uuid, p_paid_on date) FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.mark_liability_paid(p_liability_id uuid, p_user_id uuid, p_paid_on date) TO anon;
GRANT ALL ON FUNCTION public.mark_liability_paid(p_liability_id uuid, p_user_id uuid, p_paid_on date) TO authenticated;
GRANT ALL ON FUNCTION public.mark_liability_paid(p_liability_id uuid, p_user_id uuid, p_paid_on date) TO service_role;

REVOKE ALL ON FUNCTION public.on_split_group_delete_cleanup() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.on_split_group_delete_cleanup() FROM PUBLIC;
GRANT ALL ON FUNCTION public.on_split_group_delete_cleanup() TO service_role;

REVOKE ALL ON FUNCTION public.prevent_bug_report_tampering() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.prevent_bug_report_tampering() FROM PUBLIC;
GRANT ALL ON FUNCTION public.prevent_bug_report_tampering() TO service_role;

REVOKE ALL ON FUNCTION public.prevent_immutable_update() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.prevent_immutable_update() FROM PUBLIC;
GRANT ALL ON FUNCTION public.prevent_immutable_update() TO service_role;

REVOKE ALL ON FUNCTION public.record_loan_payment(p_loan_id uuid, p_user_id uuid, p_amount numeric, p_id uuid, p_paid_on date) FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.record_loan_payment(p_loan_id uuid, p_user_id uuid, p_amount numeric, p_id uuid, p_paid_on date) TO anon;
GRANT ALL ON FUNCTION public.record_loan_payment(p_loan_id uuid, p_user_id uuid, p_amount numeric, p_id uuid, p_paid_on date) TO authenticated;
GRANT ALL ON FUNCTION public.record_loan_payment(p_loan_id uuid, p_user_id uuid, p_amount numeric, p_id uuid, p_paid_on date) TO service_role;

REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC;
GRANT ALL ON FUNCTION public.rls_auto_enable() TO service_role;

REVOKE ALL ON TABLE public.split_group_members FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE public.split_group_members TO anon;
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE public.split_group_members TO authenticated;
GRANT ALL ON TABLE public.split_group_members TO service_role;

REVOKE ALL ON FUNCTION public.split_archive_member(p_member_id uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.split_archive_member(p_member_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.split_archive_member(p_member_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.split_archive_member(p_member_id uuid) TO service_role;

REVOKE ALL ON TABLE public.split_groups FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON TABLE public.split_groups TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.split_groups TO authenticated;
GRANT ALL ON TABLE public.split_groups TO service_role;
GRANT UPDATE(name) ON TABLE public.split_groups TO authenticated;
GRANT UPDATE(updated_at) ON TABLE public.split_groups TO authenticated;
GRANT UPDATE(is_archived) ON TABLE public.split_groups TO authenticated;
GRANT UPDATE(banner_id) ON TABLE public.split_groups TO authenticated;

REVOKE ALL ON FUNCTION public.split_consume_group_invite(p_token text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.split_consume_group_invite(p_token text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.split_consume_group_invite(p_token text) TO authenticated;
GRANT ALL ON FUNCTION public.split_consume_group_invite(p_token text) TO service_role;

REVOKE ALL ON TABLE public.split_expenses FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON TABLE public.split_expenses TO anon;
GRANT ALL ON TABLE public.split_expenses TO authenticated;
GRANT ALL ON TABLE public.split_expenses TO service_role;

REVOKE ALL ON FUNCTION public.split_create_expense(p_group_id uuid, p_paid_by_member_id uuid, p_description text, p_amount numeric, p_expense_date date, p_split_method text, p_notes text, p_splits jsonb, p_sync_transaction boolean, p_transaction_category text, p_id uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.split_create_expense(p_group_id uuid, p_paid_by_member_id uuid, p_description text, p_amount numeric, p_expense_date date, p_split_method text, p_notes text, p_splits jsonb, p_sync_transaction boolean, p_transaction_category text, p_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.split_create_expense(p_group_id uuid, p_paid_by_member_id uuid, p_description text, p_amount numeric, p_expense_date date, p_split_method text, p_notes text, p_splits jsonb, p_sync_transaction boolean, p_transaction_category text, p_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.split_create_expense(p_group_id uuid, p_paid_by_member_id uuid, p_description text, p_amount numeric, p_expense_date date, p_split_method text, p_notes text, p_splits jsonb, p_sync_transaction boolean, p_transaction_category text, p_id uuid) TO service_role;

REVOKE ALL ON FUNCTION public.split_create_group(p_name text, p_self_display_name text, p_id uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.split_create_group(p_name text, p_self_display_name text, p_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.split_create_group(p_name text, p_self_display_name text, p_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.split_create_group(p_name text, p_self_display_name text, p_id uuid) TO service_role;

REVOKE ALL ON TABLE public.split_group_invites FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON TABLE public.split_group_invites TO anon;
GRANT ALL ON TABLE public.split_group_invites TO authenticated;
GRANT ALL ON TABLE public.split_group_invites TO service_role;

REVOKE ALL ON FUNCTION public.split_create_group_invite(p_group_id uuid, p_role text, p_id uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.split_create_group_invite(p_group_id uuid, p_role text, p_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.split_create_group_invite(p_group_id uuid, p_role text, p_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.split_create_group_invite(p_group_id uuid, p_role text, p_id uuid) TO service_role;

REVOKE ALL ON FUNCTION public.split_group_member_profiles(p_group_id uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.split_group_member_profiles(p_group_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.split_group_member_profiles(p_group_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.split_group_member_profiles(p_group_id uuid) TO service_role;

REVOKE ALL ON FUNCTION public.split_leave_group(p_group_id uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.split_leave_group(p_group_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.split_leave_group(p_group_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.split_leave_group(p_group_id uuid) TO service_role;

REVOKE ALL ON FUNCTION public.split_member_net_balance(p_member_id uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.split_member_net_balance(p_member_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.split_member_net_balance(p_member_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.split_member_net_balance(p_member_id uuid) TO service_role;

REVOKE ALL ON FUNCTION public.split_preview_group_invite(p_token text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.split_preview_group_invite(p_token text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.split_preview_group_invite(p_token text) TO anon;
GRANT ALL ON FUNCTION public.split_preview_group_invite(p_token text) TO authenticated;
GRANT ALL ON FUNCTION public.split_preview_group_invite(p_token text) TO service_role;

REVOKE ALL ON TABLE public.split_settlements FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON TABLE public.split_settlements TO anon;
GRANT ALL ON TABLE public.split_settlements TO authenticated;
GRANT ALL ON TABLE public.split_settlements TO service_role;

REVOKE ALL ON FUNCTION public.split_record_settlement(p_group_id uuid, p_payer_member_id uuid, p_payee_member_id uuid, p_amount numeric, p_settled_at date, p_note text, p_sync_transaction boolean, p_id uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.split_record_settlement(p_group_id uuid, p_payer_member_id uuid, p_payee_member_id uuid, p_amount numeric, p_settled_at date, p_note text, p_sync_transaction boolean, p_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.split_record_settlement(p_group_id uuid, p_payer_member_id uuid, p_payee_member_id uuid, p_amount numeric, p_settled_at date, p_note text, p_sync_transaction boolean, p_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.split_record_settlement(p_group_id uuid, p_payer_member_id uuid, p_payee_member_id uuid, p_amount numeric, p_settled_at date, p_note text, p_sync_transaction boolean, p_id uuid) TO service_role;

REVOKE ALL ON TABLE public.split_group_access FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON TABLE public.split_group_access TO anon;
GRANT ALL ON TABLE public.split_group_access TO authenticated;
GRANT ALL ON TABLE public.split_group_access TO service_role;

REVOKE ALL ON FUNCTION public.split_set_group_access_role(p_group_id uuid, p_user_id uuid, p_role text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.split_set_group_access_role(p_group_id uuid, p_user_id uuid, p_role text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.split_set_group_access_role(p_group_id uuid, p_user_id uuid, p_role text) TO authenticated;
GRANT ALL ON FUNCTION public.split_set_group_access_role(p_group_id uuid, p_user_id uuid, p_role text) TO service_role;

REVOKE ALL ON FUNCTION public.split_update_expense(p_expense_id uuid, p_paid_by_member_id uuid, p_description text, p_amount numeric, p_expense_date date, p_split_method text, p_notes text, p_splits jsonb, p_sync_transaction boolean, p_transaction_category text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.split_update_expense(p_expense_id uuid, p_paid_by_member_id uuid, p_description text, p_amount numeric, p_expense_date date, p_split_method text, p_notes text, p_splits jsonb, p_sync_transaction boolean, p_transaction_category text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.split_update_expense(p_expense_id uuid, p_paid_by_member_id uuid, p_description text, p_amount numeric, p_expense_date date, p_split_method text, p_notes text, p_splits jsonb, p_sync_transaction boolean, p_transaction_category text) TO authenticated;
GRANT ALL ON FUNCTION public.split_update_expense(p_expense_id uuid, p_paid_by_member_id uuid, p_description text, p_amount numeric, p_expense_date date, p_split_method text, p_notes text, p_splits jsonb, p_sync_transaction boolean, p_transaction_category text) TO service_role;

REVOKE ALL ON FUNCTION public.submit_bug_report(p_title text, p_description text, p_steps text, p_severity text, p_route text, p_app_version text, p_diagnostics jsonb, p_environment jsonb, p_screenshot_path text, p_reporter_email text, p_fingerprint text, p_tags text[]) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.submit_bug_report(p_title text, p_description text, p_steps text, p_severity text, p_route text, p_app_version text, p_diagnostics jsonb, p_environment jsonb, p_screenshot_path text, p_reporter_email text, p_fingerprint text, p_tags text[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.submit_bug_report(p_title text, p_description text, p_steps text, p_severity text, p_route text, p_app_version text, p_diagnostics jsonb, p_environment jsonb, p_screenshot_path text, p_reporter_email text, p_fingerprint text, p_tags text[]) TO authenticated;
GRANT ALL ON FUNCTION public.submit_bug_report(p_title text, p_description text, p_steps text, p_severity text, p_route text, p_app_version text, p_diagnostics jsonb, p_environment jsonb, p_screenshot_path text, p_reporter_email text, p_fingerprint text, p_tags text[]) TO service_role;

REVOKE ALL ON FUNCTION public.sync_split_to_transaction() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.sync_split_to_transaction() FROM PUBLIC;
GRANT ALL ON FUNCTION public.sync_split_to_transaction() TO service_role;

REVOKE ALL ON FUNCTION public.sync_transaction_to_split() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.sync_transaction_to_split() FROM PUBLIC;
GRANT ALL ON FUNCTION public.sync_transaction_to_split() TO service_role;

REVOKE ALL ON FUNCTION public.touch_split_group_updated_at() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.touch_split_group_updated_at() FROM PUBLIC;
GRANT ALL ON FUNCTION public.touch_split_group_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.touch_split_group_updated_at() TO service_role;

REVOKE ALL ON FUNCTION public.unlink_partner_atomic(p_partner_id uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.unlink_partner_atomic(p_partner_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.unlink_partner_atomic(p_partner_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.unlink_partner_atomic(p_partner_id uuid) TO service_role;

REVOKE ALL ON TABLE public.budgets FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON TABLE public.budgets TO anon;
GRANT ALL ON TABLE public.budgets TO authenticated;
GRANT ALL ON TABLE public.budgets TO service_role;

REVOKE ALL ON TABLE public.bug_reports FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.bug_reports TO anon;
GRANT SELECT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.bug_reports TO authenticated;
GRANT ALL ON TABLE public.bug_reports TO service_role;

REVOKE ALL ON TABLE public.category_budgets FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON TABLE public.category_budgets TO anon;
GRANT ALL ON TABLE public.category_budgets TO authenticated;
GRANT ALL ON TABLE public.category_budgets TO service_role;

REVOKE ALL ON TABLE public.financial_events FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON TABLE public.financial_events TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.financial_events TO authenticated;
GRANT ALL ON TABLE public.financial_events TO service_role;

REVOKE ALL ON TABLE public.invites FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON TABLE public.invites TO anon;
GRANT ALL ON TABLE public.invites TO authenticated;
GRANT ALL ON TABLE public.invites TO service_role;
GRANT INSERT(created_by) ON TABLE public.invites TO authenticated;

REVOKE ALL ON TABLE public.liabilities FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON TABLE public.liabilities TO anon;
GRANT ALL ON TABLE public.liabilities TO authenticated;
GRANT ALL ON TABLE public.liabilities TO service_role;

REVOKE ALL ON TABLE public.monthly_net_changes FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON TABLE public.monthly_net_changes TO anon;
GRANT ALL ON TABLE public.monthly_net_changes TO authenticated;
GRANT ALL ON TABLE public.monthly_net_changes TO service_role;

REVOKE ALL ON TABLE public.profiles FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON TABLE public.profiles TO anon;
GRANT ALL ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;

REVOKE ALL ON TABLE public.reconciliation_reviews FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON TABLE public.reconciliation_reviews TO anon;
GRANT ALL ON TABLE public.reconciliation_reviews TO authenticated;
GRANT ALL ON TABLE public.reconciliation_reviews TO service_role;

REVOKE ALL ON TABLE public.split_expense_splits FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON TABLE public.split_expense_splits TO anon;
GRANT ALL ON TABLE public.split_expense_splits TO authenticated;
GRANT ALL ON TABLE public.split_expense_splits TO service_role;

REVOKE ALL ON TABLE public.transactions FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON TABLE public.transactions TO anon;
GRANT ALL ON TABLE public.transactions TO authenticated;
GRANT ALL ON TABLE public.transactions TO service_role;

REVOKE ALL ON TABLE public.user_categories FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON TABLE public.user_categories TO anon;
GRANT ALL ON TABLE public.user_categories TO authenticated;
GRANT ALL ON TABLE public.user_categories TO service_role;

-- ═════════════════════════════════════════════════════════════════════════════
-- Default privileges for objects created later by postgres
-- ═════════════════════════════════════════════════════════════════════════════

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;

-- ═════════════════════════════════════════════════════════════════════════════
-- Event trigger: enable RLS automatically on new public tables
-- ═════════════════════════════════════════════════════════════════════════════

DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_event_trigger WHERE evtname = 'ensure_rls') THEN
    CREATE EVENT TRIGGER ensure_rls ON ddl_command_end
    WHEN TAG IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
    EXECUTE FUNCTION public.rls_auto_enable();
  END IF;
END
$do$;

-- ═════════════════════════════════════════════════════════════════════════════
-- Storage buckets, storage policies and the new-user trigger on auth.users
-- (not covered by the public-schema dump; carried over from the previous file)
-- ═════════════════════════════════════════════════════════════════════════════

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

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set public = false;

drop policy if exists "avatars_storage: upload own" on storage.objects;

create policy "avatars_storage: upload own" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'avatars'
  and name like ((select auth.uid())::text || '-%')
);

drop policy if exists "avatars_storage: update own" on storage.objects;

create policy "avatars_storage: update own" on storage.objects
for update to authenticated
using (
  bucket_id = 'avatars'
  and name like ((select auth.uid())::text || '-%')
);

drop policy if exists "avatars_storage: read" on storage.objects;

create policy "avatars_storage: read" on storage.objects
for select to authenticated
using (
  bucket_id = 'avatars'
  and (
    -- Owner can read their own avatar.
    name like ((select auth.uid())::text || '-%')
    -- Linked partner can read each other's avatar (needed by ProfileMenu
    -- and any partner-view UI). The first 36 chars of the avatar filename
    -- are the owner's UUID — see the upload policy above. We validate the
    -- UUID shape with a regex BEFORE casting so a malformed filename
    -- cannot throw a SQL error and fail the policy evaluation in an
    -- unpredictable way.
    or (
      length(name) >= 37
      and substring(name from 1 for 36) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      and public.is_linked((substring(name from 1 for 36))::uuid)
    )
  )
);

drop policy if exists "avatars_storage: delete own" on storage.objects;

create policy "avatars_storage: delete own" on storage.objects
for delete to authenticated
using (
  bucket_id = 'avatars'
  and name like ((select auth.uid())::text || '-%')
);

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'group-banners',
  'group-banners',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set public = false;

drop policy if exists "group_banners: upload" on storage.objects;
create policy "group_banners: upload" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'group-banners'
  and length(name) >= 37
  and substring(name from 1 for 36) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and public.is_split_group_owner((substring(name from 1 for 36))::uuid)
);

drop policy if exists "group_banners: update" on storage.objects;
create policy "group_banners: update" on storage.objects
for update to authenticated
using (
  bucket_id = 'group-banners'
  and length(name) >= 37
  and substring(name from 1 for 36) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and public.is_split_group_owner((substring(name from 1 for 36))::uuid)
);

drop policy if exists "group_banners: delete" on storage.objects;
create policy "group_banners: delete" on storage.objects
for delete to authenticated
using (
  bucket_id = 'group-banners'
  and length(name) >= 37
  and substring(name from 1 for 36) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and public.is_split_group_owner((substring(name from 1 for 36))::uuid)
);

drop policy if exists "group_banners: read" on storage.objects;
create policy "group_banners: read" on storage.objects
for select to authenticated
using (
  bucket_id = 'group-banners'
  and length(name) >= 37
  and substring(name from 1 for 36) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and public.has_split_group_access((substring(name from 1 for 36))::uuid)
);

COMMIT;
