-- One-off backfill: for every existing settlement where the payee is a
-- linked user and there is no payee transaction yet, insert one.
do $$
declare
  s record;
  v_payer_name text;
  v_new_txn_id uuid;
begin
  for s in
    select ss.id, ss.amount, ss.settled_at, ss.note, ss.group_id,
           pa.linked_user_id as payer_uid, pa.display_name as payer_name,
           pe.linked_user_id as payee_uid
    from public.split_settlements ss
    join public.split_group_members pa on pa.id = ss.payer_member_id
    join public.split_group_members pe on pe.id = ss.payee_member_id
    where ss.payee_transaction_id is null
      and pe.linked_user_id is not null
  loop
    v_payer_name := coalesce(s.payer_name, 'member');
    insert into public.transactions (
      date, type, description, amount, category, user_id,
      is_repayment, linked_split_settlement_id, notes
    ) values (
      s.settled_at, 'income',
      'Received from ' || v_payer_name,
      s.amount, 'other', s.payee_uid,
      true, s.id, s.note
    ) returning id into v_new_txn_id;

    update public.split_settlements
    set payee_transaction_id = v_new_txn_id
    where id = s.id;
  end loop;
end $$;
