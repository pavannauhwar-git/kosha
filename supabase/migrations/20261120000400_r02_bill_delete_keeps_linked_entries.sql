-- R-02: deleting a bill also deleted every entry linked to it, including an
-- expense the user had linked themselves and a Splitwise expense's ledger
-- entry. Only the payment entry the bill created is deleted now, the same
-- rule undo_liability_payment uses; other linked entries stay, unlinked.

CREATE OR REPLACE FUNCTION public.delete_liability_with_txns(p_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_uid uuid := auth.uid();
  v_bill public.liabilities%rowtype;
  v_rows integer;
begin
  if v_uid is null then
    raise exception using errcode = '28000', message = 'unauthenticated';
  end if;
  if p_id is null then
    raise exception using errcode = '22023', message = 'p_id is required';
  end if;

  select * into v_bill from public.liabilities where id = p_id for update;
  if not found then
    return false;
  end if;

  if v_bill.user_id <> v_uid then
    raise exception using errcode = '42501', message = 'forbidden';
  end if;

  delete from public.transactions t
  where t.id = v_bill.linked_transaction_id
    and t.user_id = v_uid
    and t.linked_bill_id = p_id
    and v_bill.payment_txn_created is distinct from false
    and t.linked_split_expense_id is null
    and t.linked_split_settlement_id is null;

  update public.transactions
  set linked_bill_id = null
  where linked_bill_id = p_id;

  delete from public.liabilities where id = p_id and user_id = v_uid;
  get diagnostics v_rows = row_count;
  return v_rows > 0;
end;
$$;

ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_linked_bill_id_fkey;
ALTER TABLE public.transactions
    ADD CONSTRAINT transactions_linked_bill_id_fkey FOREIGN KEY (linked_bill_id) REFERENCES public.liabilities(id) ON DELETE SET NULL;
