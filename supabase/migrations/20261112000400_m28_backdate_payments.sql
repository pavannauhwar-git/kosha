-- M-28: bill and loan payments can be recorded with the date they were
-- actually paid, up to a year back (catching up on an earlier payment).
-- Future dates are still capped at tomorrow to allow for time zones.

CREATE OR REPLACE FUNCTION public.mark_liability_paid(p_liability_id uuid, p_user_id uuid, p_paid_on date DEFAULT NULL::date, p_transaction_id uuid DEFAULT NULL::uuid) RETURNS json
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  v_liability liabilities%rowtype;
  v_txn transactions%rowtype;
  v_txn_id uuid;
  v_next_due date;
  v_txn_mode text;
  v_paid_on date := least(greatest(coalesce(p_paid_on, current_date), current_date - 366), current_date + 1);
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

  if p_transaction_id is not null then
    select * into v_txn from transactions
    where id = p_transaction_id and user_id = p_user_id
    for update;
    if not found then raise exception 'Transaction not found or access denied'; end if;
    if v_txn.type <> 'expense' then
      raise exception 'Only an expense can be linked to a bill';
    end if;
    if v_txn.linked_bill_id is not null and v_txn.linked_bill_id <> p_liability_id then
      raise exception 'This transaction is already linked to another bill';
    end if;
    if v_txn.linked_split_expense_id is not null
       or v_txn.linked_split_settlement_id is not null
       or v_txn.linked_loan_id is not null then
      raise exception 'This transaction is managed by Splitwise or a loan and cannot be linked to a bill';
    end if;

    if v_txn.linked_bill_id is distinct from p_liability_id then
      update transactions set linked_bill_id = p_liability_id where id = p_transaction_id;
    end if;
    v_txn_id := p_transaction_id;
    v_paid_on := v_txn.date;
  else
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
  end if;

  update liabilities
  set paid = true, linked_transaction_id = v_txn_id, paid_at = v_paid_on
  where id = p_liability_id;

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
  v_paid_on date := least(greatest(coalesce(p_paid_on, current_date), current_date - 366), current_date + 1);
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
