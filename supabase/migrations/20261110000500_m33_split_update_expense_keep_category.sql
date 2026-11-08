-- M-33: editing a Splitwise expense no longer resets the payer's category.
-- Members who aren't the payer can't see the payer's ledger row, so the edit
-- form sent 'other' and overwrote the real category. The client now sends
-- null when it doesn't know the category, and this function keeps the
-- existing one. Only the category line in the UPDATE branch changes.

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
  v_effective_owner uuid;
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

  -- Reconcile the linked personal-ledger transaction. The transaction belongs
  -- to the payer's app user. To avoid spawning a transaction into a third
  -- party's ledger (which split_create_expense never does), we only create or
  -- keep a transaction for the payer when the payer is the editor OR a
  -- transaction already exists for that payer (i.e. the payer is unchanged).
  if v_linked_txn is not null then
    select user_id into v_existing_owner from public.transactions where id = v_linked_txn and linked_split_expense_id = p_expense_id;
  end if;

  if coalesce(p_sync_transaction, true)
     and v_payer_uid is not null
     and (v_payer_uid = v_uid or v_payer_uid = v_existing_owner) then
    v_effective_owner := v_payer_uid;
  else
    v_effective_owner := null;
  end if;

  if v_effective_owner is not null then
    if v_linked_txn is not null and v_existing_owner = v_effective_owner then
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
    else
      -- Payer moved to the editor while a txn existed for someone else, or no
      -- txn existed yet: drop the stale one (if any) and create a fresh one.
      if v_linked_txn is not null then
        delete from public.transactions where id = v_linked_txn and linked_split_expense_id = p_expense_id;
      end if;
      insert into public.transactions (
        date, type, description, amount, category, user_id, linked_split_expense_id, notes
      ) values (
        coalesce(p_expense_date, current_date),
        'expense',
        btrim(p_description),
        p_amount,
        coalesce(p_transaction_category, 'other'),
        v_effective_owner,
        p_expense_id,
        nullif(btrim(coalesce(p_notes, '')), '')
      ) returning id into v_linked_txn;
      update public.split_expenses set linked_transaction_id = v_linked_txn where id = p_expense_id;
    end if;
  else
    -- No txn should exist (sync off, external payer, or payer reassigned away
    -- from both the editor and the existing owner): remove any stale txn.
    if v_linked_txn is not null then
      delete from public.transactions where id = v_linked_txn and linked_split_expense_id = p_expense_id;
      update public.split_expenses set linked_transaction_id = null where id = p_expense_id;
    end if;
  end if;

  select * into v_expense from public.split_expenses where id = p_expense_id;
  return v_expense;
end;
$$;
