-- H-18 + M-31: mark_liability_paid can link an existing transaction, and
-- records the payment date on the bill.
--
-- H-18: "Link & Auto-fill" in Add Transaction set linked_bill_id on the new
-- transaction but never marked the bill paid or rolled a recurring bill
-- forward, so the bill stayed pending and could be paid twice. The client now
-- saves the transaction and then calls this function with p_transaction_id.
--
-- M-31: payment-discipline insights had no payment date and counted every
-- past-due paid bill as late. paid_at stores it; existing paid bills are
-- backfilled from their linked transaction's date.
--
-- Adding a parameter changes the signature, so the old 3-argument version is
-- dropped first. Callers that pass only the first three named arguments keep
-- working through the defaults.

ALTER TABLE public.liabilities ADD COLUMN IF NOT EXISTS paid_at date;

DROP FUNCTION IF EXISTS public.mark_liability_paid(uuid, uuid, date);

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

REVOKE ALL ON FUNCTION public.mark_liability_paid(p_liability_id uuid, p_user_id uuid, p_paid_on date, p_transaction_id uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.mark_liability_paid(p_liability_id uuid, p_user_id uuid, p_paid_on date, p_transaction_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.mark_liability_paid(p_liability_id uuid, p_user_id uuid, p_paid_on date, p_transaction_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.mark_liability_paid(p_liability_id uuid, p_user_id uuid, p_paid_on date, p_transaction_id uuid) TO service_role;

-- One-off backfill for bills paid before paid_at existed. The audit trigger is
-- paused so this doesn't write one 'liability_updated' event per bill.
ALTER TABLE public.liabilities DISABLE TRIGGER trg_log_financial_event_liabilities;

UPDATE public.liabilities l
SET paid_at = t.date
FROM public.transactions t
WHERE l.paid
  AND l.paid_at IS NULL
  AND l.linked_transaction_id = t.id;

ALTER TABLE public.liabilities ENABLE TRIGGER trg_log_financial_event_liabilities;
