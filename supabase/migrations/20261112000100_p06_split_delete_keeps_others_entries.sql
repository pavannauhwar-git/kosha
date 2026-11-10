-- P-06: deleting a shared expense, a settlement or a whole trip only deletes
-- the caller's own ledger entries. Everyone else keeps theirs, unlinked from
-- the group, with a note saying who deleted it. Same rule M-03 applied to edits.

CREATE OR REPLACE FUNCTION public.split_actor_name(p_group_id uuid, p_user_id uuid) RETURNS text
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
  select coalesce(
    (select m.display_name from public.split_group_members m
      where m.group_id = p_group_id and m.linked_user_id = p_user_id
      order by m.created_at limit 1),
    (select nullif(btrim(p.display_name), '') from public.profiles p where p.id = p_user_id),
    'a group member'
  );
$$;

REVOKE ALL ON FUNCTION public.split_actor_name(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT ALL ON FUNCTION public.split_actor_name(uuid, uuid) TO service_role;


-- How many ledger entries other people keep if the caller deletes this trip.
CREATE OR REPLACE FUNCTION public.split_group_others_entry_count(p_group_id uuid) RETURNS integer
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select case when public.is_split_group_member_or_above(p_group_id, auth.uid()) then (
    select count(*)::int from public.transactions t
    where t.user_id <> auth.uid()
      and (t.linked_split_expense_id in (select e.id from public.split_expenses e where e.group_id = p_group_id)
        or t.linked_split_settlement_id in (select s.id from public.split_settlements s where s.group_id = p_group_id))
  ) else 0 end;
$$;

REVOKE ALL ON FUNCTION public.split_group_others_entry_count(uuid) FROM PUBLIC, anon;
GRANT ALL ON FUNCTION public.split_group_others_entry_count(uuid) TO authenticated, service_role;


CREATE OR REPLACE FUNCTION public.delete_split_expense_atomic(p_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_uid uuid := auth.uid();
  v_group_id uuid;
  v_group_name text;
  v_note text;
  v_rows integer;
begin
  if v_uid is null then
    raise exception using errcode = '28000', message = 'unauthenticated';
  end if;
  if p_id is null then
    raise exception using errcode = '22023', message = 'p_id is required';
  end if;

  select e.group_id, g.name
    into v_group_id, v_group_name
  from public.split_expenses e
  join public.split_groups g on g.id = e.group_id
  where e.id = p_id
  for update of e;

  if v_group_id is null then return false; end if;

  if not public.is_split_group_member_or_above(v_group_id, v_uid) then
    raise exception using errcode = '42501', message = 'forbidden';
  end if;

  delete from public.transactions
  where linked_split_expense_id = p_id and user_id = v_uid;

  v_note := format('This shared expense was deleted from "%s" by %s. The entry stays in your ledger.',
                   v_group_name, public.split_actor_name(v_group_id, v_uid));
  update public.transactions
  set linked_split_expense_id = null,
      notes = concat_ws(E'\n', nullif(btrim(notes), ''), v_note)
  where linked_split_expense_id = p_id;

  delete from public.split_expenses where id = p_id;
  get diagnostics v_rows = row_count;
  return v_rows > 0;
end;
$$;


CREATE OR REPLACE FUNCTION public.delete_split_settlement_atomic(p_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_uid uuid := auth.uid();
  v_group_id uuid;
  v_group_name text;
  v_payer_txn uuid;
  v_payee_txn uuid;
  v_note text;
  v_rows integer;
begin
  if v_uid is null then
    raise exception using errcode = '28000', message = 'unauthenticated';
  end if;
  if p_id is null then
    raise exception using errcode = '22023', message = 'p_id is required';
  end if;

  select s.group_id, g.name, s.payer_transaction_id, s.payee_transaction_id
    into v_group_id, v_group_name, v_payer_txn, v_payee_txn
  from public.split_settlements s
  join public.split_groups g on g.id = s.group_id
  where s.id = p_id
  for update of s;

  if v_group_id is null then return false; end if;

  if not public.is_split_group_member_or_above(v_group_id, v_uid) then
    raise exception using errcode = '42501', message = 'forbidden';
  end if;

  delete from public.transactions
  where user_id = v_uid
    and (linked_split_settlement_id = p_id or id = v_payer_txn or id = v_payee_txn);

  v_note := format('This settlement was deleted from "%s" by %s. The entry stays in your ledger.',
                   v_group_name, public.split_actor_name(v_group_id, v_uid));
  update public.transactions
  set linked_split_settlement_id = null,
      notes = concat_ws(E'\n', nullif(btrim(notes), ''), v_note)
  where linked_split_settlement_id = p_id or id = v_payer_txn or id = v_payee_txn;

  delete from public.split_settlements where id = p_id;
  get diagnostics v_rows = row_count;
  return v_rows > 0;
end;
$$;


CREATE OR REPLACE FUNCTION public.on_split_group_delete_cleanup() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_uid uuid := auth.uid();
  v_note text;
begin
  if v_uid is not null then
    delete from public.transactions
    where user_id = v_uid
      and (linked_split_expense_id in (select id from public.split_expenses where group_id = old.id)
        or linked_split_settlement_id in (select id from public.split_settlements where group_id = old.id));
  end if;

  v_note := format('The trip "%s" was deleted by %s. The entry stays in your ledger.',
                   old.name, public.split_actor_name(old.id, v_uid));

  update public.transactions
  set linked_split_expense_id = null,
      notes = concat_ws(E'\n', nullif(btrim(notes), ''), v_note)
  where linked_split_expense_id in (select id from public.split_expenses where group_id = old.id);

  update public.transactions
  set linked_split_settlement_id = null,
      notes = concat_ws(E'\n', nullif(btrim(notes), ''), v_note)
  where linked_split_settlement_id in (select id from public.split_settlements where group_id = old.id);

  return old;
end;
$$;
