-- Phase 2 Migration: Database correctness


drop function if exists public.generate_recurring_transactions(uuid, date);

CREATE OR REPLACE FUNCTION "public"."generate_recurring_transactions"("p_user_id" "uuid", "p_today" "date" DEFAULT NULL::"date") RETURNS integer
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare
  v_uid uuid := auth.uid();
  -- Client passes its local date; accept at most one day either side of server UTC.
  v_today date := least(greatest(coalesce(p_today, current_date), current_date - 1), current_date + 1);
  v_step int;
  v_k int;
  v_run_date date;
  v_inserted int := 0;
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
      );
      v_inserted := v_inserted + 1;
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


alter table public.liabilities add column if not exists recurrence_anchor date;
update public.liabilities set recurrence_anchor = due_date
where is_recurring and recurrence_anchor is null;

drop function if exists public.mark_liability_paid(uuid, uuid);
CREATE OR REPLACE FUNCTION "public"."mark_liability_paid"("p_liability_id" "uuid", "p_user_id" "uuid", "p_paid_on" "date" DEFAULT NULL::"date") RETURNS "json"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
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


drop function if exists public.record_loan_payment(uuid, uuid, numeric, uuid);
CREATE OR REPLACE FUNCTION "public"."record_loan_payment"("p_loan_id" "uuid", "p_user_id" "uuid", "p_amount" numeric, "p_id" "uuid" DEFAULT NULL::"uuid", "p_paid_on" "date" DEFAULT NULL::"date") RETURNS "json"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
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


CREATE OR REPLACE FUNCTION "public"."create_loan"("p_counterparty" "text", "p_amount" numeric, "p_direction" "text", "p_date" "date", "p_notes" "text", "p_payment_mode" "text", "p_sync_transaction" boolean, "p_user_id" "uuid", "p_id" "uuid" DEFAULT NULL::"uuid") RETURNS "public"."loans"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_loan public.loans%rowtype;
  v_txn_type text;
begin
  perform set_config('kosha.trusted_write', 'true', true);
  p_amount := round(p_amount, 2);
  if v_uid is null then raise exception 'Authentication required'; end if;
  if v_uid <> p_user_id then raise exception 'Cannot create loan for another user'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Loan amount must be positive'; end if;
  if p_direction not in ('given', 'taken') then raise exception 'Invalid loan direction'; end if;
  if p_counterparty is null or btrim(p_counterparty) = '' then raise exception 'Counterparty is required'; end if;

  p_id := coalesce(p_id, gen_random_uuid());

  insert into public.loans (
    id, counterparty, amount, amount_settled, direction, date,
    notes, settled, user_id
  ) values (
    p_id, btrim(p_counterparty), p_amount, 0, p_direction, p_date,
    nullif(btrim(coalesce(p_notes, '')), ''), false, p_user_id
  ) on conflict (id) do nothing;
  
  select * into v_loan from public.loans where id = p_id;
  if v_loan.id is null or v_loan.user_id <> p_user_id then
    return v_loan;
  end if;

  if p_sync_transaction then
    v_txn_type := case p_direction when 'given' then 'expense' else 'income' end;

    if not exists (
      select 1 from public.transactions
      where linked_loan_id = v_loan.id and user_id = p_user_id
    ) then
      insert into public.transactions (
        date, type, description, amount, category, is_repayment,
        payment_mode, user_id, linked_loan_id
      ) values (
        p_date, v_txn_type, 'Loan: ' || btrim(p_counterparty), p_amount, 'loans',
        true, coalesce(p_payment_mode, 'other'), p_user_id, v_loan.id
      );
    end if;
  end if;

  return v_loan;
end;
$$;


-- 2.4 Account deletion
alter table public.budgets drop constraint if exists budgets_user_id_fkey,
  add constraint budgets_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.invites drop constraint if exists invites_created_by_fkey,
  add constraint invites_created_by_fkey foreign key (created_by) references auth.users(id) on delete cascade;
alter table public.invites drop constraint if exists invites_used_by_fkey,
  add constraint invites_used_by_fkey foreign key (used_by) references auth.users(id) on delete cascade;
alter table public.split_group_invites drop constraint if exists split_group_invites_created_by_fkey,
  add constraint split_group_invites_created_by_fkey foreign key (created_by) references auth.users(id) on delete cascade;
alter table public.split_group_invites drop constraint if exists split_group_invites_consumed_by_fkey,
  add constraint split_group_invites_consumed_by_fkey foreign key (consumed_by) references auth.users(id) on delete set null;

alter table public.split_groups drop constraint if exists split_groups_user_id_fkey,
  add constraint split_groups_user_id_fkey foreign key (user_id) references auth.users(id) on delete set null;
alter table public.split_group_members drop constraint if exists split_group_members_user_id_fkey,
  add constraint split_group_members_user_id_fkey foreign key (user_id) references auth.users(id) on delete set null;
alter table public.split_expenses drop constraint if exists split_expenses_user_id_fkey,
  add constraint split_expenses_user_id_fkey foreign key (user_id) references auth.users(id) on delete set null;
alter table public.split_expense_splits drop constraint if exists split_expense_splits_user_id_fkey,
  add constraint split_expense_splits_user_id_fkey foreign key (user_id) references auth.users(id) on delete set null;
alter table public.split_settlements drop constraint if exists split_settlements_user_id_fkey,
  add constraint split_settlements_user_id_fkey foreign key (user_id) references auth.users(id) on delete set null;

CREATE OR REPLACE FUNCTION public.ensure_group_has_admin()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
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

drop trigger if exists trg_ensure_group_has_admin on public.split_group_access;
create trigger trg_ensure_group_has_admin
  after delete on public.split_group_access
  for each row execute function public.ensure_group_has_admin();


grant execute on function public.generate_recurring_transactions(uuid, date) to authenticated;
grant execute on function public.mark_liability_paid(uuid, uuid, date) to authenticated;
grant execute on function public.record_loan_payment(uuid, uuid, numeric, uuid, date) to authenticated;
