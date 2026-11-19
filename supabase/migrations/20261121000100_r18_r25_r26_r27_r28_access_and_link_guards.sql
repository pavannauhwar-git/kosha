-- R-18: has_split_group_access, is_split_group_member_or_above and
-- is_split_group_owner run with elevated rights and accepted any user ID, so a
-- signed-in user could test who belongs to which trip. They now only answer
-- for the caller; server code without a signed-in user (service role) can
-- still ask about anyone. split_update_settlement and split_update_expense,
-- which need to know whether another member still has access, check the
-- access table directly instead.
-- R-25: a recurring entry's source_transaction_id must be one of the user's
-- own entries, so a linked partner can't make your generator skip dates.
-- R-26: admin demotions and removals in the same trip take a per-trip lock
-- before counting admins, so two at once can't leave a trip with no admin.
-- R-27: a bill payment's linked_bill_id can't be cleared or changed outside the
-- server functions, so the payment can't be edited or deleted while the bill
-- stays paid.
-- R-28: joining with an invite gives the invite's role; the trip creator is no
-- longer made admin again automatically.

CREATE OR REPLACE FUNCTION public.has_split_group_access(p_group_id uuid, p_user_id uuid DEFAULT auth.uid()) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1
    from split_group_access a
    where a.group_id = p_group_id
      and a.user_id = p_user_id
      and (auth.uid() is null or p_user_id = auth.uid())
  );
$$;

CREATE OR REPLACE FUNCTION public.is_split_group_member_or_above(p_group_id uuid, p_user_id uuid DEFAULT auth.uid()) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1
    from split_group_access a
    where a.group_id = p_group_id
      and a.user_id = p_user_id
      and a.role in ('admin', 'member')
      and (auth.uid() is null or p_user_id = auth.uid())
  );
$$;

CREATE OR REPLACE FUNCTION public.is_split_group_owner(p_group_id uuid, p_user_id uuid DEFAULT auth.uid()) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1
    from split_group_access a
    where a.group_id = p_group_id
      and a.user_id = p_user_id
      and a.role = 'admin'
      and (auth.uid() is null or p_user_id = auth.uid())
  );
$$;

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
       and (v_txn.user_id = v_uid or exists (
         select 1 from public.split_group_access a
         where a.group_id = v_row.group_id and a.user_id = v_txn.user_id
       )) then
      update public.transactions
      set date = v_date,
          amount = v_amount,
          description = 'Settled with ' || coalesce(v_payee_name, 'member'),
          notes = v_note,
          linked_split_settlement_id = p_settlement_id
      where id = v_txn.id;
      v_payer_txn_id := v_txn.id;
    elsif v_txn.type = 'income' and v_payee_uid is not null and v_txn.user_id = v_payee_uid and v_payee_txn_id is null
       and (v_txn.user_id = v_uid or exists (
         select 1 from public.split_group_access a
         where a.group_id = v_row.group_id and a.user_id = v_txn.user_id
       )) then
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

CREATE OR REPLACE FUNCTION public.split_update_expense(p_expense_id uuid, p_paid_by_member_id uuid, p_description text, p_amount numeric, p_expense_date date, p_split_method text, p_notes text, p_splits jsonb, p_sync_transaction boolean DEFAULT true, p_transaction_category text DEFAULT 'other'::text) RETURNS public.split_expenses
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_uid uuid := auth.uid();
  v_expense public.split_expenses%rowtype;
  v_group_id uuid;
  v_linked_txn uuid;
  v_existing_owner uuid;
  v_keep_txn boolean := false;
  v_pays_bill boolean := false;
  v_payer_uid uuid;
  v_old_members uuid[];
  v_sum numeric := 0;
  v_item jsonb;
  v_member_id uuid;
  v_share numeric;
  v_percent numeric;
  v_shares numeric;
begin
  if v_uid is null then
    raise exception using errcode = '28000', message = 'unauthenticated';
  end if;
  if p_expense_id is null then
    raise exception using errcode = '22023', message = 'p_expense_id is required';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Expense amount must be positive';
  end if;
  if p_description is null or btrim(p_description) = '' then
    raise exception 'Expense description is required';
  end if;
  if p_split_method not in ('equal', 'exact', 'percent', 'shares') then
    raise exception 'Invalid split method';
  end if;
  if p_splits is null or jsonb_typeof(p_splits) <> 'array' or jsonb_array_length(p_splits) = 0 then
    raise exception 'At least one split row is required';
  end if;

  -- Lock the expense so concurrent edits / deletes serialise.
  select * into v_expense
  from public.split_expenses
  where id = p_expense_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Split expense not found';
  end if;

  v_group_id := v_expense.group_id;
  v_linked_txn := v_expense.linked_transaction_id;

  -- Authorisation: caller must be a member of the group (or above).
  if not public.is_split_group_member_or_above(v_group_id, v_uid) then
    raise exception using errcode = '42501', message = 'forbidden';
  end if;
  if exists (select 1 from public.split_groups where id = v_group_id and is_archived) then
    raise exception using errcode = '42501', message = 'This group is archived (read-only).';
  end if;

  -- Payer must belong to the group, and still be in it unless they already
  -- paid this expense; capture the app user it maps to (if any).
  select linked_user_id into v_payer_uid
  from public.split_group_members m
  where m.id = p_paid_by_member_id
    and m.group_id = v_group_id;

  if not exists (
    select 1 from public.split_group_members m
    where m.id = p_paid_by_member_id and m.group_id = v_group_id
      and ((m.archived_at is null and m.left_at is null) or m.id = v_expense.paid_by_member_id)
  ) then
    raise exception 'Payer must be a member of the group';
  end if;

  -- The linked ledger row belongs to whoever paid. Decide its fate before the
  -- expense row changes, because the sync trigger on split_expenses rewrites
  -- any row that is still linked. Someone else's row is only kept in sync
  -- while they are still the payer and still in the group, and only its owner
  -- can delete it; otherwise it is unlinked and left in their ledger.
  if v_linked_txn is not null then
    select user_id, linked_bill_id is not null into v_existing_owner, v_pays_bill
    from public.transactions
    where id = v_linked_txn and linked_split_expense_id = p_expense_id;
  end if;

  v_keep_txn := v_existing_owner is not null
    and v_existing_owner = v_payer_uid
    and exists (
      select 1 from public.split_group_access a
      where a.group_id = v_group_id and a.user_id = v_existing_owner
    )
    and (v_existing_owner <> v_uid or coalesce(p_sync_transaction, true));

  -- A row that paid a bill is never deleted or given a new amount here.
  if coalesce(v_pays_bill, false)
     and ((v_keep_txn and round(p_amount, 2) <> round(v_expense.amount, 2))
          or (not v_keep_txn and v_existing_owner = v_uid)) then
    if v_existing_owner = v_uid then
      raise exception 'This expense paid one of your bills. Undo the payment in Bills first.';
    end if;
    v_keep_txn := false;
  end if;

  if v_linked_txn is not null and not v_keep_txn then
    if v_existing_owner = v_uid then
      delete from public.transactions where id = v_linked_txn and linked_split_expense_id = p_expense_id;
    elsif v_existing_owner is not null then
      update public.transactions
      set linked_split_expense_id = null
      where id = v_linked_txn and linked_split_expense_id = p_expense_id;
    end if;
    update public.split_expenses set linked_transaction_id = null where id = p_expense_id;
    v_linked_txn := null;
  end if;

  -- Update the expense row. Preserve the original owner (user_id) and id.
  update public.split_expenses
  set
    paid_by_member_id = p_paid_by_member_id,
    description       = btrim(p_description),
    amount            = p_amount,
    expense_date      = coalesce(p_expense_date, current_date),
    split_method      = p_split_method,
    notes             = nullif(btrim(coalesce(p_notes, '')), '')
  where id = p_expense_id;

  -- Replace the splits. Members already on this expense stay allowed.
  select coalesce(array_agg(member_id), '{}') into v_old_members
  from public.split_expense_splits where expense_id = p_expense_id;

  delete from public.split_expense_splits where expense_id = p_expense_id;

  for v_item in select * from jsonb_array_elements(p_splits)
  loop
    v_member_id := nullif(v_item->>'member_id', '')::uuid;
    v_share := round(coalesce((v_item->>'share')::numeric, 0), 2);
    v_percent := nullif(v_item->>'percent', '')::numeric;
    v_shares := nullif(v_item->>'shares', '')::numeric;

    if v_member_id is null then
      raise exception 'split member_id is required';
    end if;
    if v_share < 0 then
      raise exception 'split share cannot be negative';
    end if;
    if not exists (
      select 1 from public.split_group_members m
      where m.id = v_member_id and m.group_id = v_group_id
        and ((m.archived_at is null and m.left_at is null) or m.id = any(v_old_members))
    ) then
      raise exception 'Split includes a member outside this group';
    end if;

    insert into public.split_expense_splits (
      expense_id, member_id, share, percent, shares, user_id
    ) values (
      p_expense_id, v_member_id, v_share, v_percent, v_shares, v_expense.user_id
    );

    v_sum := v_sum + v_share;
  end loop;

  if v_sum <> round(p_amount, 2) then
    raise exception 'Split total (%) does not match amount (%)', v_sum, p_amount;
  end if;

  if v_keep_txn then
    update public.transactions
    set
      date        = coalesce(p_expense_date, current_date),
      type        = 'expense',
      description = btrim(p_description),
      amount      = p_amount,
      category    = coalesce(p_transaction_category, category, 'other'),
      notes       = nullif(btrim(coalesce(p_notes, '')), ''),
      linked_split_expense_id = p_expense_id
    where id = v_linked_txn;
  elsif coalesce(p_sync_transaction, true) and v_payer_uid = v_uid then
    -- Only ever create a row in the editor's own ledger.
    insert into public.transactions (
      date, type, description, amount, category, user_id, linked_split_expense_id, notes
    ) values (
      coalesce(p_expense_date, current_date),
      'expense',
      btrim(p_description),
      p_amount,
      coalesce(p_transaction_category, 'other'),
      v_uid,
      p_expense_id,
      nullif(btrim(coalesce(p_notes, '')), '')
    ) returning id into v_linked_txn;
    update public.split_expenses set linked_transaction_id = v_linked_txn where id = p_expense_id;
  end if;

  select * into v_expense from public.split_expenses where id = p_expense_id;
  return v_expense;
end;
$$;

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
     and old.linked_bill_id is not null
     and new.linked_bill_id is distinct from old.linked_bill_id then
    raise exception using errcode = '42501',
      message = 'This entry is a bill payment. Change it from Bills.';
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

  if new.source_transaction_id is not null
     and (tg_op = 'INSERT' or new.source_transaction_id is distinct from old.source_transaction_id)
     and not exists (
       select 1 from public.transactions s
       where s.id = new.source_transaction_id and s.user_id = new.user_id
     ) then
    raise exception using errcode = '42501', message = 'Recurring entry does not belong to this user';
  end if;

  return new;
end;
$$;

CREATE OR REPLACE FUNCTION public.guard_split_access_update() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  if current_user in ('authenticated', 'anon')
     and current_setting('kosha.trusted_write', true) is distinct from 'true'
     and (new.group_id is distinct from old.group_id or new.user_id is distinct from old.user_id) then
    raise exception using errcode = '42501',
      message = 'Only a member''s role can be changed.';
  end if;

  if old.role = 'admin' and new.role is distinct from 'admin' then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('kosha.split_admins:' || old.group_id::text, 0));
    if not exists (
      select 1 from public.split_group_access a
      where a.group_id = old.group_id and a.role = 'admin' and a.id <> old.id
    ) then
      raise exception using errcode = '42501', message = 'At least one admin is required';
    end if;
  end if;

  return new;
end;
$$;

CREATE OR REPLACE FUNCTION public.ensure_group_has_admin() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  if old.role = 'admin' then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('kosha.split_admins:' || old.group_id::text, 0));
  end if;
  if old.role = 'admin' and not exists (
    select 1 from public.split_group_access where group_id = old.group_id and role = 'admin'
  ) then
    update public.split_group_access set role = 'admin'
    where id = (
      select id from public.split_group_access
      where group_id = old.group_id
      order by case role when 'member' then 0 else 1 end, created_at
      limit 1
    );
  end if;
  return old;
end;
$$;

CREATE OR REPLACE FUNCTION public.split_consume_group_invite(p_token text) RETURNS public.split_groups
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_invite split_group_invites%rowtype;
  v_group split_groups%rowtype;
  v_account_name text;
  v_existing_member_id uuid;
  v_member_name text;
  v_suffix int;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if p_token is null or btrim(p_token) = '' then
    raise exception 'Invite token is required';
  end if;

  select * into v_invite
  from split_group_invites i
  where i.token = btrim(p_token)
    and i.revoked_at is null
    and i.consumed_by is null
    and (i.expires_at is null or i.expires_at > now())
  for update;

  if not found then
    raise exception 'Invite not found, already used or expired';
  end if;

  select * into v_group
  from split_groups g
  where g.id = v_invite.group_id
  for update;

  if not found then
    raise exception 'Split group not found';
  end if;

  if v_group.is_archived then
    raise exception using errcode = '42501', message = 'This group is archived (read-only).';
  end if;

  insert into split_group_access (
    group_id,
    user_id,
    role
  ) values (
    v_invite.group_id,
    v_uid,
    coalesce(v_invite.role, 'member')
  )
  on conflict (group_id, user_id) do update
    set role = case
      when excluded.role = 'admin' then 'admin'
      else split_group_access.role
    end;

  select nullif(btrim(p.display_name), '') into v_account_name
  from profiles p
  where p.id = v_uid;

  if v_account_name is null then
    select nullif(
      btrim(
        coalesce(
          u.raw_user_meta_data ->> 'full_name',
          split_part(u.email, '@', 1)
        )
      ),
      ''
    )
    into v_account_name
    from auth.users u
    where u.id = v_uid;
  end if;

  v_account_name := coalesce(v_account_name, 'Member');

  -- A removed member keeps their account link; joining again reopens that row.
  select m.id into v_existing_member_id
  from split_group_members m
  where m.group_id = v_invite.group_id
    and m.linked_user_id = v_uid
  for update;

  if v_existing_member_id is null then
    -- Your own row from when you left, else a guest no account was ever linked to.
    select m.id into v_existing_member_id
    from split_group_members m
    where m.group_id = v_invite.group_id
      and m.linked_user_id is null
      and m.archived_at is null
      and (
        (m.left_at is not null and m.user_id = v_uid)
        or (m.left_at is null and lower(m.display_name) = lower(v_account_name))
      )
    order by (m.left_at is not null) desc, m.created_at
    limit 1
    for update;
  end if;

  -- Names are unique among current members; add a number if yours is taken.
  v_member_name := v_account_name;
  v_suffix := 1;
  while exists (
    select 1 from split_group_members o
    where o.group_id = v_invite.group_id
      and o.archived_at is null
      and o.left_at is null
      and o.id is distinct from v_existing_member_id
      and lower(o.display_name) = lower(v_member_name)
  ) loop
    v_suffix := v_suffix + 1;
    if v_suffix > 20 then
      raise exception 'Could not add you to this group: too many members named %', v_account_name;
    end if;
    v_member_name := v_account_name || ' (' || v_suffix || ')';
  end loop;

  if v_existing_member_id is not null then
    update split_group_members
    set display_name = v_member_name,
        user_id = v_uid,
        linked_user_id = v_uid,
        archived_at = null,
        left_at = null
    where id = v_existing_member_id;
  else
    insert into split_group_members (group_id, display_name, is_self, linked_user_id, user_id)
    values (v_invite.group_id, v_member_name, false, v_uid, v_uid);
  end if;

  update split_group_invites
  set consumed_by = v_uid,
      consumed_at = now()
  where id = v_invite.id
    and consumed_by is null;

  return v_group;
end;
$$;
