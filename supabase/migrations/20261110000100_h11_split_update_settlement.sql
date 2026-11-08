-- H-11: edit a Splitwise settlement in place.
-- Editing used to record a brand-new settlement and then delete the old one,
-- which removed the other member's ledger row and could leave a duplicate if
-- the delete failed. This function updates the settlement and both members'
-- ledger rows in one transaction.

CREATE OR REPLACE FUNCTION public.split_update_settlement(p_settlement_id uuid, p_payer_member_id uuid, p_payee_member_id uuid, p_amount numeric, p_settled_at date DEFAULT CURRENT_DATE, p_note text DEFAULT NULL::text) RETURNS public.split_settlements
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_uid uuid := auth.uid();
  v_row public.split_settlements%rowtype;
  v_amount numeric := round(p_amount, 2);
  v_date date := coalesce(p_settled_at, current_date);
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_payer_uid uuid;
  v_payee_uid uuid;
  v_payer_name text;
  v_payee_name text;
  v_payer_txn_id uuid;
  v_payee_txn_id uuid;
  v_txn record;
begin
  perform set_config('kosha.trusted_write', 'true', true);
  if v_uid is null then
    raise exception using errcode = '28000', message = 'unauthenticated';
  end if;
  if p_settlement_id is null then
    raise exception using errcode = '22023', message = 'p_settlement_id is required';
  end if;
  if v_amount is null or v_amount <= 0 then
    raise exception 'Settlement amount must be positive';
  end if;
  if p_payer_member_id is null or p_payee_member_id is null then
    raise exception 'Payer and payee are required';
  end if;
  if p_payer_member_id = p_payee_member_id then
    raise exception 'Payer and payee cannot be the same';
  end if;

  select * into v_row from public.split_settlements where id = p_settlement_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Settlement not found';
  end if;

  if not public.is_split_group_member_or_above(v_row.group_id, v_uid) then
    raise exception using errcode = '42501', message = 'forbidden';
  end if;
  if exists (select 1 from public.split_groups where id = v_row.group_id and is_archived) then
    raise exception using errcode = '42501', message = 'This group is archived (read-only).';
  end if;

  select linked_user_id, display_name into v_payer_uid, v_payer_name
  from public.split_group_members
  where id = p_payer_member_id and group_id = v_row.group_id;
  if not found then
    raise exception 'Payer is not in this group';
  end if;

  select linked_user_id, display_name into v_payee_uid, v_payee_name
  from public.split_group_members
  where id = p_payee_member_id and group_id = v_row.group_id;
  if not found then
    raise exception 'Payee is not in this group';
  end if;

  update public.split_settlements
  set payer_member_id = p_payer_member_id,
      payee_member_id = p_payee_member_id,
      amount          = v_amount,
      settled_at      = v_date,
      note            = v_note
  where id = p_settlement_id;

  -- Keep the payer's expense row and the payee's income row; drop anything
  -- that no longer belongs to the (possibly new) payer or payee.
  for v_txn in
    select id, user_id, type
    from public.transactions
    where linked_split_settlement_id = p_settlement_id
       or id = v_row.payer_transaction_id
       or id = v_row.payee_transaction_id
    for update
  loop
    if v_txn.type = 'expense' and v_payer_uid is not null and v_txn.user_id = v_payer_uid and v_payer_txn_id is null then
      update public.transactions
      set date = v_date,
          amount = v_amount,
          description = 'Settled with ' || coalesce(v_payee_name, 'member'),
          notes = v_note,
          linked_split_settlement_id = p_settlement_id
      where id = v_txn.id;
      v_payer_txn_id := v_txn.id;
    elsif v_txn.type = 'income' and v_payee_uid is not null and v_txn.user_id = v_payee_uid and v_payee_txn_id is null then
      update public.transactions
      set date = v_date,
          amount = v_amount,
          description = 'Received from ' || coalesce(v_payer_name, 'member'),
          notes = v_note,
          linked_split_settlement_id = p_settlement_id
      where id = v_txn.id;
      v_payee_txn_id := v_txn.id;
    else
      delete from public.transactions where id = v_txn.id;
    end if;
  end loop;

  -- Same rule as split_record_settlement: only create a row in the editor's own ledger.
  if v_payer_txn_id is null and v_payer_uid is not null and v_payer_uid = v_uid then
    insert into public.transactions (date, type, description, amount, category, user_id, is_repayment, linked_split_settlement_id, notes)
    values (v_date, 'expense', 'Settled with ' || coalesce(v_payee_name, 'member'), v_amount, 'other', v_uid, true, p_settlement_id, v_note)
    returning id into v_payer_txn_id;
  end if;
  if v_payee_txn_id is null and v_payee_uid is not null and v_payee_uid = v_uid then
    insert into public.transactions (date, type, description, amount, category, user_id, is_repayment, linked_split_settlement_id, notes)
    values (v_date, 'income', 'Received from ' || coalesce(v_payer_name, 'member'), v_amount, 'other', v_uid, true, p_settlement_id, v_note)
    returning id into v_payee_txn_id;
  end if;

  update public.split_settlements
  set payer_transaction_id = v_payer_txn_id,
      payee_transaction_id = v_payee_txn_id
  where id = p_settlement_id
  returning * into v_row;

  return v_row;
end;
$$;

REVOKE ALL ON FUNCTION public.split_update_settlement(p_settlement_id uuid, p_payer_member_id uuid, p_payee_member_id uuid, p_amount numeric, p_settled_at date, p_note text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.split_update_settlement(p_settlement_id uuid, p_payer_member_id uuid, p_payee_member_id uuid, p_amount numeric, p_settled_at date, p_note text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.split_update_settlement(p_settlement_id uuid, p_payer_member_id uuid, p_payee_member_id uuid, p_amount numeric, p_settled_at date, p_note text) TO authenticated;
GRANT ALL ON FUNCTION public.split_update_settlement(p_settlement_id uuid, p_payer_member_id uuid, p_payee_member_id uuid, p_amount numeric, p_settled_at date, p_note text) TO service_role;
