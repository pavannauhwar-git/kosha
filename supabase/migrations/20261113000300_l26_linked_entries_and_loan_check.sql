-- L-26: a loan-repayment or bill-payment entry could be edited or deleted
-- directly, leaving the loan's repaid amount or the bill's paid state out of
-- step with the ledger. Their amount and type can no longer be changed, and
-- they can't be deleted, except through the loan and bill functions. A loan
-- can't record more repaid than it is worth.

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

  if tg_op = 'UPDATE'
     and (old.linked_loan_id is not null or old.linked_bill_id is not null)
     and (new.amount is distinct from old.amount or new.type is distinct from old.type) then
    raise exception using errcode = '42501',
      message = 'This entry is a loan or bill payment. Change it from Loans or Bills.';
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

CREATE OR REPLACE FUNCTION public.guard_linked_transaction_delete() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  if current_user in ('authenticated', 'anon')
     and current_setting('kosha.trusted_write', true) is distinct from 'true'
     and (old.linked_loan_id is not null or old.linked_bill_id is not null) then
    raise exception using errcode = '42501',
      message = 'This entry is a loan or bill payment. Remove it from Loans or Bills.';
  end if;
  return old;
end;
$$;

CREATE OR REPLACE TRIGGER trg_guard_linked_transaction_delete BEFORE DELETE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.guard_linked_transaction_delete();

REVOKE ALL ON FUNCTION public.guard_linked_transaction_delete() FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.guard_linked_transaction_delete() TO authenticated;
GRANT ALL ON FUNCTION public.guard_linked_transaction_delete() TO service_role;

DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.loans'::regclass AND conname = 'loans_amount_settled_le_amount') THEN
    ALTER TABLE ONLY public.loans ADD CONSTRAINT loans_amount_settled_le_amount CHECK ((amount_settled <= amount));
  END IF;
END
$do$;
