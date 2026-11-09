-- M-03: group members can no longer rewrite or delete your personal copy of a
-- shared expense. split_update_expense only deletes a linked ledger row when
-- the editor owns it (otherwise it unlinks it), and stops syncing a row whose
-- owner has left the group. Leaving a group unlinks your expense and
-- settlement rows. A one-off repair unlinks rows of people who already left.

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
  v_payer_uid uuid;
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

  -- Payer must belong to the group; capture the app user it maps to (if any).
  select linked_user_id into v_payer_uid
  from public.split_group_members m
  where m.id = p_paid_by_member_id
    and m.group_id = v_group_id;

  if not exists (
    select 1 from public.split_group_members m
    where m.id = p_paid_by_member_id and m.group_id = v_group_id
  ) then
    raise exception 'Payer must be a member of the group';
  end if;

  -- The linked ledger row belongs to whoever paid. Decide its fate before the
  -- expense row changes, because the sync trigger on split_expenses rewrites
  -- any row that is still linked. Someone else's row is only kept in sync
  -- while they are still the payer and still in the group, and only its owner
  -- can delete it; otherwise it is unlinked and left in their ledger.
  if v_linked_txn is not null then
    select user_id into v_existing_owner
    from public.transactions
    where id = v_linked_txn and linked_split_expense_id = p_expense_id;
  end if;

  v_keep_txn := v_existing_owner is not null
    and v_existing_owner = v_payer_uid
    and public.has_split_group_access(v_group_id, v_existing_owner)
    and (v_existing_owner <> v_uid or coalesce(p_sync_transaction, true));

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

  -- Replace the splits.
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
      where m.id = v_member_id and m.group_id = v_group_id and m.archived_at is null
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


CREATE OR REPLACE FUNCTION public.split_leave_group(p_group_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_owner_count integer := 0;
  v_has_access boolean := false;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select exists (
    select 1
    from split_group_access
    where group_id = p_group_id and user_id = v_uid
  ) into v_has_access;

  if not v_has_access then
    raise exception 'You do not have access to this group';
  end if;

  select count(*)::integer into v_owner_count
  from split_group_access
  where group_id = p_group_id and role = 'admin';

  if v_owner_count = 1 and exists (
    select 1
    from split_group_access
    where group_id = p_group_id and user_id = v_uid and role = 'admin'
  ) then
    raise exception 'You must assign another admin or delete the group first';
  end if;

  delete from split_group_access
  where group_id = p_group_id
    and user_id = v_uid;

  update split_group_members
  set linked_user_id = null
  where group_id = p_group_id
    and linked_user_id = v_uid;

  -- The leaver's own ledger rows stay theirs. Unlink them so later edits or
  -- deletes in the group can't rewrite or remove them.
  update split_expenses e
  set linked_transaction_id = null
  from transactions t
  where e.group_id = p_group_id
    and t.id = e.linked_transaction_id
    and t.user_id = v_uid;

  update transactions t
  set linked_split_expense_id = null
  from split_expenses e
  where e.group_id = p_group_id
    and t.linked_split_expense_id = e.id
    and t.user_id = v_uid;

  update split_settlements s
  set payer_transaction_id = null
  from transactions t
  where s.group_id = p_group_id
    and t.id = s.payer_transaction_id
    and t.user_id = v_uid;

  update split_settlements s
  set payee_transaction_id = null
  from transactions t
  where s.group_id = p_group_id
    and t.id = s.payee_transaction_id
    and t.user_id = v_uid;

  update transactions t
  set linked_split_settlement_id = null
  from split_settlements s
  where s.group_id = p_group_id
    and t.linked_split_settlement_id = s.id
    and t.user_id = v_uid;
end;
$$;


-- One-off: unlink ledger rows of people who already left a group, so the
-- group's next edit can't change or delete them. The audit triggers are paused
-- so this repair doesn't add one event per row.
ALTER TABLE public.transactions DISABLE TRIGGER trg_log_financial_event_transactions;
ALTER TABLE public.split_expenses DISABLE TRIGGER trg_log_financial_event_split_expenses;
ALTER TABLE public.split_settlements DISABLE TRIGGER trg_log_financial_event_split_settlements;

UPDATE public.split_expenses e
SET linked_transaction_id = NULL
FROM public.transactions t
WHERE t.id = e.linked_transaction_id
  AND NOT EXISTS (SELECT 1 FROM public.split_group_access a WHERE a.group_id = e.group_id AND a.user_id = t.user_id);

UPDATE public.transactions t
SET linked_split_expense_id = NULL
FROM public.split_expenses e
WHERE e.id = t.linked_split_expense_id
  AND NOT EXISTS (SELECT 1 FROM public.split_group_access a WHERE a.group_id = e.group_id AND a.user_id = t.user_id);

UPDATE public.split_settlements s
SET payer_transaction_id = NULL
FROM public.transactions t
WHERE t.id = s.payer_transaction_id
  AND NOT EXISTS (SELECT 1 FROM public.split_group_access a WHERE a.group_id = s.group_id AND a.user_id = t.user_id);

UPDATE public.split_settlements s
SET payee_transaction_id = NULL
FROM public.transactions t
WHERE t.id = s.payee_transaction_id
  AND NOT EXISTS (SELECT 1 FROM public.split_group_access a WHERE a.group_id = s.group_id AND a.user_id = t.user_id);

UPDATE public.transactions t
SET linked_split_settlement_id = NULL
FROM public.split_settlements s
WHERE s.id = t.linked_split_settlement_id
  AND NOT EXISTS (SELECT 1 FROM public.split_group_access a WHERE a.group_id = s.group_id AND a.user_id = t.user_id);

ALTER TABLE public.transactions ENABLE TRIGGER trg_log_financial_event_transactions;
ALTER TABLE public.split_expenses ENABLE TRIGGER trg_log_financial_event_split_expenses;
ALTER TABLE public.split_settlements ENABLE TRIGGER trg_log_financial_event_split_settlements;
