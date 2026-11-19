-- R-01: editing a settlement deleted or rewrote other members' ledger rows.
-- Same rule as M-03 and P-06: another member's row is kept in sync only while
-- they are still the payer or payee and still in the trip; otherwise it is
-- unlinked and left in their ledger with a note. Only the editor's own rows
-- are ever deleted.

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
  v_group_name text;
  v_unlink_note text;
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
  select name into v_group_name from public.split_groups where id = v_row.group_id and not is_archived;
  if not found then
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

  v_unlink_note := format('This settlement was changed in "%s" by %s. The entry stays in your ledger.',
                          v_group_name, public.split_actor_name(v_row.group_id, v_uid));

  -- Keep the payer's expense row and the payee's income row while their
  -- owners are still in the trip. Any other row is the editor's to delete,
  -- or someone else's to keep, unlinked.
  for v_txn in
    select id, user_id, type
    from public.transactions
    where linked_split_settlement_id = p_settlement_id
       or id = v_row.payer_transaction_id
       or id = v_row.payee_transaction_id
    for update
  loop
    if v_txn.type = 'expense' and v_payer_uid is not null and v_txn.user_id = v_payer_uid and v_payer_txn_id is null
       and (v_txn.user_id = v_uid or public.has_split_group_access(v_row.group_id, v_txn.user_id)) then
      update public.transactions
      set date = v_date,
          amount = v_amount,
          description = 'Settled with ' || coalesce(v_payee_name, 'member'),
          notes = v_note,
          linked_split_settlement_id = p_settlement_id
      where id = v_txn.id;
      v_payer_txn_id := v_txn.id;
    elsif v_txn.type = 'income' and v_payee_uid is not null and v_txn.user_id = v_payee_uid and v_payee_txn_id is null
       and (v_txn.user_id = v_uid or public.has_split_group_access(v_row.group_id, v_txn.user_id)) then
      update public.transactions
      set date = v_date,
          amount = v_amount,
          description = 'Received from ' || coalesce(v_payer_name, 'member'),
          notes = v_note,
          linked_split_settlement_id = p_settlement_id
      where id = v_txn.id;
      v_payee_txn_id := v_txn.id;
    elsif v_txn.user_id = v_uid then
      delete from public.transactions where id = v_txn.id;
    else
      update public.transactions
      set linked_split_settlement_id = null,
          notes = concat_ws(E'\n', nullif(btrim(notes), ''), v_unlink_note)
      where id = v_txn.id;
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
