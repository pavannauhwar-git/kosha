-- H-12: edit a loan through one function.
-- The client used to update the loans row directly, so the amount could drop
-- below what was already repaid, `settled` was never recomputed and the
-- disbursement transaction kept the old amount, date and name.

CREATE OR REPLACE FUNCTION public.update_loan(p_loan_id uuid, p_user_id uuid, p_direction text, p_counterparty text, p_amount numeric, p_interest_rate numeric DEFAULT 0, p_loan_date date DEFAULT CURRENT_DATE, p_due_date date DEFAULT NULL::date, p_note text DEFAULT NULL::text) RETURNS public.loans
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
declare
  v_loan public.loans%rowtype;
  v_amount numeric := round(p_amount, 2);
begin
  perform set_config('kosha.trusted_write', 'true', true);
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'Authentication required';
  end if;
  if v_amount is null or v_amount <= 0 then
    raise exception 'Loan amount must be positive';
  end if;
  if p_direction not in ('given', 'taken') then
    raise exception 'Direction must be given or taken';
  end if;
  if p_counterparty is null or btrim(p_counterparty) = '' then
    raise exception 'Counterparty name is required';
  end if;

  select * into v_loan from public.loans
  where id = p_loan_id and user_id = p_user_id
  for update;
  if not found then
    raise exception 'Loan not found or access denied';
  end if;

  if v_amount < v_loan.amount_settled then
    raise exception 'Loan amount cannot be less than the % already repaid', v_loan.amount_settled;
  end if;
  if v_loan.amount_settled > 0 and p_direction <> v_loan.direction then
    raise exception 'Direction cannot change after a repayment has been recorded';
  end if;

  update public.loans
  set direction     = p_direction,
      counterparty  = btrim(p_counterparty),
      amount        = v_amount,
      interest_rate = coalesce(p_interest_rate, 0),
      loan_date     = coalesce(p_loan_date, current_date),
      due_date      = p_due_date,
      note          = nullif(btrim(coalesce(p_note, '')), ''),
      settled       = (v_loan.amount_settled >= v_amount)
  where id = p_loan_id
  returning * into v_loan;

  update public.transactions
  set date        = v_loan.loan_date,
      type        = case v_loan.direction when 'given' then 'expense' else 'income' end,
      description = case v_loan.direction
                      when 'given' then 'Loan given to ' || v_loan.counterparty
                      else              'Loan taken from ' || v_loan.counterparty
                    end,
      amount      = v_loan.amount,
      notes       = v_loan.note
  where linked_loan_id = p_loan_id
    and user_id = p_user_id
    and is_repayment = false;

  return v_loan;
end;
$$;

REVOKE ALL ON FUNCTION public.update_loan(p_loan_id uuid, p_user_id uuid, p_direction text, p_counterparty text, p_amount numeric, p_interest_rate numeric, p_loan_date date, p_due_date date, p_note text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.update_loan(p_loan_id uuid, p_user_id uuid, p_direction text, p_counterparty text, p_amount numeric, p_interest_rate numeric, p_loan_date date, p_due_date date, p_note text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.update_loan(p_loan_id uuid, p_user_id uuid, p_direction text, p_counterparty text, p_amount numeric, p_interest_rate numeric, p_loan_date date, p_due_date date, p_note text) TO authenticated;
GRANT ALL ON FUNCTION public.update_loan(p_loan_id uuid, p_user_id uuid, p_direction text, p_counterparty text, p_amount numeric, p_interest_rate numeric, p_loan_date date, p_due_date date, p_note text) TO service_role;
