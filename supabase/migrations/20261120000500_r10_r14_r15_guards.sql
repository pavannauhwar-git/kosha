-- R-10: deleting an account renamed every member row to "Former member",
-- which failed on the per-trip unique name index once a trip had two of them.
-- The rows are now also marked as left, and names only need to be unique
-- among current members (migration 1). Rows the user had already left are
-- renamed too. R-14: NaN passes "amount > 0", so money
-- columns now reject it. R-15: settlements, invites, roles and removing
-- members are blocked in archived trips; settlements can no longer name a
-- removed member.

CREATE OR REPLACE FUNCTION public.delete_account_data(p_user_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  if p_user_id is null then
    raise exception using errcode = '22023', message = 'p_user_id is required';
  end if;

  delete from public.split_groups g
  where exists (select 1 from public.split_group_access a where a.group_id = g.id and a.user_id = p_user_id)
    and not exists (select 1 from public.split_group_access a where a.group_id = g.id and a.user_id <> p_user_id);

  update public.split_group_members
  set display_name = 'Former member',
      left_at = coalesce(left_at, now())
  where linked_user_id = p_user_id
     or (linked_user_id is null and left_at is not null and user_id = p_user_id);

  delete from public.bug_reports where user_id = p_user_id;
end;
$$;

CREATE OR REPLACE FUNCTION public.split_archive_member(p_member_id uuid) RETURNS public.split_group_members
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_uid uuid := auth.uid();
  v_member public.split_group_members%rowtype;
  v_balance numeric;
begin
  if v_uid is null then raise exception using errcode = '28000', message = 'unauthenticated'; end if;

  select * into v_member from public.split_group_members where id = p_member_id for update;
  if not found then raise exception 'Member not found'; end if;

  perform 1 from public.split_groups where id = v_member.group_id for update;

  if not public.is_split_group_owner(v_member.group_id, v_uid) then
    raise exception using errcode = '42501', message = 'Only a group admin can remove members.';
  end if;
  if exists (select 1 from public.split_groups where id = v_member.group_id and is_archived) then
    raise exception using errcode = '42501', message = 'This group is archived (read-only).';
  end if;
  if v_member.archived_at is not null then return v_member; end if;
  if v_member.linked_user_id = v_uid then
    raise exception 'Use "Leave group" to remove yourself.';
  end if;

  v_balance := public.split_member_net_balance(p_member_id);
  if v_balance <> 0 then
    raise exception using errcode = 'P0001',
      message = format('This member still has an unsettled balance of %s. Settle up first.', v_balance);
  end if;

  update public.split_group_members set archived_at = now()
  where id = p_member_id
  returning * into v_member;

  if v_member.linked_user_id is not null then
    delete from public.split_group_access
    where group_id = v_member.group_id and user_id = v_member.linked_user_id;
  end if;

  return v_member;
end;
$$;

CREATE OR REPLACE FUNCTION public.split_create_group_invite(p_group_id uuid, p_role text DEFAULT 'member'::text, p_id uuid DEFAULT NULL::uuid) RETURNS public.split_group_invites
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_invite public.split_group_invites%rowtype;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_split_group_owner(p_group_id, v_uid) then
    raise exception 'Split group not found';
  end if;

  if exists (select 1 from public.split_groups where id = p_group_id and is_archived) then
    raise exception using errcode = '42501', message = 'This group is archived (read-only).';
  end if;

  p_id := coalesce(p_id, gen_random_uuid());

  insert into public.split_group_invites (
    id,
    group_id,
    role,
    created_by
  ) values (
    p_id,
    p_group_id,
    p_role,
    v_uid
  ) on conflict (id) do nothing;

  select * into v_invite from public.split_group_invites where id = p_id;

  return v_invite;
end;
$$;

CREATE OR REPLACE FUNCTION public.split_record_settlement(p_group_id uuid, p_payer_member_id uuid, p_payee_member_id uuid, p_amount numeric, p_settled_at date DEFAULT CURRENT_DATE, p_note text DEFAULT NULL::text, p_sync_transaction boolean DEFAULT true, p_id uuid DEFAULT NULL::uuid) RETURNS public.split_settlements
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_row public.split_settlements%rowtype;
  v_payer_uid uuid;
  v_payee_uid uuid;
  v_payer_txn_id uuid;
  v_payee_txn_id uuid;
  v_payer_name text;
  v_payee_name text;
begin
  perform set_config('kosha.trusted_write', 'true', true);
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Settlement amount must be positive';
  end if;

  if p_payer_member_id is null or p_payee_member_id is null then
    raise exception 'Payer and payee are required';
  end if;

  if p_payer_member_id = p_payee_member_id then
    raise exception 'Payer and payee cannot be the same';
  end if;

  if not public.is_split_group_member_or_above(p_group_id, v_uid) then
    raise exception 'Split group not found';
  end if;

  if exists (select 1 from public.split_groups where id = p_group_id and is_archived) then
    raise exception using errcode = '42501', message = 'This group is archived (read-only).';
  end if;

  -- Members who left can still settle what they owe; removed members can't.
  select linked_user_id, display_name into v_payer_uid, v_payer_name
  from split_group_members where id = p_payer_member_id and group_id = p_group_id and archived_at is null;
  if v_payer_uid is null and not exists (
    select 1 from split_group_members m where m.id = p_payer_member_id and m.group_id = p_group_id and m.archived_at is null
  ) then
    raise exception 'Payer is not in this group';
  end if;

  select linked_user_id, display_name into v_payee_uid, v_payee_name
  from split_group_members where id = p_payee_member_id and group_id = p_group_id and archived_at is null;
  if v_payee_uid is null and not exists (
    select 1 from split_group_members m where m.id = p_payee_member_id and m.group_id = p_group_id and m.archived_at is null
  ) then
    raise exception 'Payee is not in this group';
  end if;

  p_id := coalesce(p_id, gen_random_uuid());

  insert into public.split_settlements (
    id,
    group_id,
    payer_member_id,
    payee_member_id,
    amount,
    settled_at,
    note,
    user_id
  ) values (
    p_id,
    p_group_id,
    p_payer_member_id,
    p_payee_member_id,
    p_amount,
    coalesce(p_settled_at, current_date),
    nullif(btrim(coalesce(p_note, '')), ''),
    v_uid
  ) on conflict (id) do nothing;

  select * into v_row from public.split_settlements where id = p_id;

  if not found then
    return v_row;
  end if;

  if p_sync_transaction then
    -- Payer sees: "Settled with [payee name]"
    if v_payer_uid is not null and v_payer_uid = v_uid and not exists (
      select 1 from public.transactions
      where linked_split_settlement_id = v_row.id
        and user_id = v_payer_uid
    ) then
      insert into public.transactions (date, type, description, amount, category, user_id, is_repayment, linked_split_settlement_id, notes)
      values (coalesce(p_settled_at, current_date), 'expense', 'Settled with ' || coalesce(v_payee_name, 'member'), p_amount, 'other', v_uid, true, v_row.id, nullif(btrim(coalesce(p_note, '')), ''))
      returning id into v_payer_txn_id;
    end if;

    -- Payee sees: "Received from [payer name]"
    if v_payee_uid is not null and v_payee_uid = v_uid and not exists (
      select 1 from public.transactions
      where linked_split_settlement_id = v_row.id
        and user_id = v_payee_uid
    ) then
      insert into public.transactions (date, type, description, amount, category, user_id, is_repayment, linked_split_settlement_id, notes)
      values (coalesce(p_settled_at, current_date), 'income', 'Received from ' || coalesce(v_payer_name, 'member'), p_amount, 'other', v_uid, true, v_row.id, nullif(btrim(coalesce(p_note, '')), ''))
      returning id into v_payee_txn_id;
    end if;

    if v_payer_txn_id is not null or v_payee_txn_id is not null then
      update public.split_settlements
      set payer_transaction_id = coalesce(v_payer_txn_id, payer_transaction_id),
          payee_transaction_id = coalesce(v_payee_txn_id, payee_transaction_id)
      where id = v_row.id;
    end if;
  end if;

  return v_row;
end;
$$;

CREATE OR REPLACE FUNCTION public.split_set_group_access_role(p_group_id uuid, p_user_id uuid, p_role text) RETURNS public.split_group_access
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_target split_group_access%rowtype;
  v_admin_count integer := 0;
  v_role text := lower(coalesce(nullif(btrim(p_role), ''), 'member'));
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if v_role not in ('admin', 'member', 'viewer') then
    raise exception 'Role must be admin, member, or viewer';
  end if;

  if not public.is_split_group_owner(p_group_id, v_uid) then
    raise exception 'Split group not found';
  end if;

  if exists (select 1 from public.split_groups where id = p_group_id and is_archived) then
    raise exception using errcode = '42501', message = 'This group is archived (read-only).';
  end if;

  select * into v_target
  from split_group_access a
  where a.group_id = p_group_id
    and a.user_id = p_user_id
  for update;

  if not found then
    raise exception 'Member access not found';
  end if;

  -- Prevent removing the last admin
  if v_target.role = 'admin' and v_role <> 'admin' then
    select count(*)::integer into v_admin_count
    from split_group_access a
    where a.group_id = p_group_id
      and a.role = 'admin';

    if v_admin_count <= 1 then
      raise exception 'At least one admin is required';
    end if;
  end if;

  update split_group_access
  set role = v_role
  where id = v_target.id
  returning * into v_target;

  return v_target;
end;
$$;

DO $do$
DECLARE
  c record;
BEGIN
  FOR c IN SELECT * FROM (VALUES
    ('transactions', 'amount'),
    ('split_expenses', 'amount'),
    ('split_settlements', 'amount'),
    ('split_expense_splits', 'share'),
    ('loans', 'amount'),
    ('loans', 'amount_settled'),
    ('loans', 'interest_rate'),
    ('liabilities', 'amount'),
    ('category_budgets', 'monthly_limit')
  ) AS t(tbl, col)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
                   WHERE conrelid = ('public.' || c.tbl)::regclass AND conname = c.tbl || '_' || c.col || '_not_nan') THEN
      EXECUTE format('ALTER TABLE ONLY public.%I ADD CONSTRAINT %I CHECK ((%I <> %L::numeric))',
                     c.tbl, c.tbl || '_' || c.col || '_not_nan', c.col, 'NaN');
    END IF;
  END LOOP;
END
$do$;
