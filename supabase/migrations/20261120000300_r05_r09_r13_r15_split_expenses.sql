-- R-05: new expenses can't charge, or be paid by, members who left or were
-- removed. R-09: editing an old expense keeps the members it already had,
-- even if they have since left or been removed. R-13: an expense whose
-- ledger entry paid one of your bills can't be deleted, or have its amount
-- changed, until the bill payment is undone; when someone else edits it,
-- the bill payment stays in your ledger, unlinked, and deleting the whole
-- trip keeps it too. R-15: expenses and settlements in an archived trip
-- can't be deleted.

CREATE OR REPLACE FUNCTION public.split_create_expense(p_group_id uuid, p_paid_by_member_id uuid, p_description text, p_amount numeric, p_expense_date date DEFAULT CURRENT_DATE, p_split_method text DEFAULT 'equal'::text, p_notes text DEFAULT NULL::text, p_splits jsonb DEFAULT '[]'::jsonb, p_sync_transaction boolean DEFAULT true, p_transaction_category text DEFAULT 'other'::text, p_id uuid DEFAULT NULL::uuid, p_payment_mode text DEFAULT NULL::text, p_linked_bill_id uuid DEFAULT NULL::uuid) RETURNS public.split_expenses
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_group public.split_groups%rowtype;
  v_expense public.split_expenses%rowtype;
  v_sum numeric := 0;
  v_item jsonb;
  v_member_id uuid;
  v_share numeric;
  v_percent numeric;
  v_shares numeric;
  v_payer_uid uuid;
  v_txn_id uuid;
begin
  perform set_config('kosha.trusted_write', 'true', true);
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if exists (select 1 from public.split_groups where id = p_group_id and is_archived) then
    raise exception using errcode = '42501', message = 'This group is archived (read-only).';
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

  if p_payment_mode is not null
     and p_payment_mode not in ('upi', 'credit_card', 'debit_card', 'cash', 'net_banking', 'wallet', 'other') then
    raise exception 'Unknown payment mode';
  end if;

  select * into v_group
  from public.split_groups
  where id = p_group_id;

  if not found then
    raise exception 'Split group not found';
  end if;

  if not public.is_split_group_member_or_above(p_group_id, v_uid) then
    raise exception 'Split group not found';
  end if;

  select linked_user_id into v_payer_uid
  from split_group_members m
  where m.id = p_paid_by_member_id
    and m.group_id = p_group_id
    and m.archived_at is null
    and m.left_at is null;

  if v_payer_uid is null and not exists (
    select 1
    from split_group_members m
    where m.id = p_paid_by_member_id
      and m.group_id = p_group_id
      and m.archived_at is null
      and m.left_at is null
  ) then
    raise exception 'Payer must be a member of the group';
  end if;

  if p_linked_bill_id is not null and not (p_sync_transaction and v_payer_uid = v_uid) then
    raise exception 'Only the person who paid can link a bill to this expense';
  end if;

  if p_splits is null or jsonb_typeof(p_splits) <> 'array' or jsonb_array_length(p_splits) = 0 then
    raise exception 'At least one split row is required';
  end if;

  p_id := coalesce(p_id, gen_random_uuid());

  insert into split_expenses (
    id,
    group_id,
    paid_by_member_id,
    description,
    amount,
    expense_date,
    split_method,
    notes,
    user_id
  ) values (
    p_id,
    p_group_id,
    p_paid_by_member_id,
    btrim(p_description),
    p_amount,
    coalesce(p_expense_date, current_date),
    p_split_method,
    nullif(btrim(coalesce(p_notes, '')), ''),
    v_uid
  ) on conflict (id) do nothing;

  select * into v_expense from split_expenses where id = p_id;

  -- If splits already exist for this expense ID, it was already created (idempotency hit).
  if exists (select 1 from public.split_expense_splits where expense_id = v_expense.id) then
    return v_expense;
  end if;

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
      select 1
      from split_group_members m
      where m.id = v_member_id
        and m.group_id = p_group_id
        and m.archived_at is null
        and m.left_at is null
    ) then
      raise exception 'Split includes a member outside this group';
    end if;

    insert into public.split_expense_splits (
      expense_id,
      member_id,
      share,
      percent,
      shares,
      user_id
    ) values (
      v_expense.id,
      v_member_id,
      v_share,
      v_percent,
      v_shares,
      v_uid
    );

    v_sum := v_sum + v_share;
  end loop;

  if v_sum <> round(p_amount, 2) then
    raise exception 'Split total (%) does not match amount (%)', v_sum, p_amount;
  end if;

  if p_sync_transaction and v_payer_uid = v_uid then
    insert into public.transactions (
      date, type, description, amount, category, payment_mode, user_id, linked_split_expense_id, notes
    ) values (
      coalesce(p_expense_date, current_date),
      'expense',
      btrim(p_description),
      p_amount,
      coalesce(p_transaction_category, 'other'),
      coalesce(p_payment_mode, 'upi'),
      v_uid,
      v_expense.id,
      nullif(btrim(coalesce(p_notes, '')), '')
    ) returning id into v_txn_id;

    update public.split_expenses set linked_transaction_id = v_txn_id where id = v_expense.id;

    if p_linked_bill_id is not null then
      perform public.mark_liability_paid(p_linked_bill_id, v_uid, coalesce(p_expense_date, current_date), v_txn_id);
    end if;
  end if;

  return v_expense;
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
    and public.has_split_group_access(v_group_id, v_existing_owner)
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

CREATE OR REPLACE FUNCTION public.delete_split_expense_atomic(p_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_uid uuid := auth.uid();
  v_group_id uuid;
  v_group_name text;
  v_archived boolean;
  v_note text;
  v_rows integer;
begin
  if v_uid is null then
    raise exception using errcode = '28000', message = 'unauthenticated';
  end if;
  if p_id is null then
    raise exception using errcode = '22023', message = 'p_id is required';
  end if;

  select e.group_id, g.name, g.is_archived
    into v_group_id, v_group_name, v_archived
  from public.split_expenses e
  join public.split_groups g on g.id = e.group_id
  where e.id = p_id
  for update of e;

  if v_group_id is null then return false; end if;

  if not public.is_split_group_member_or_above(v_group_id, v_uid) then
    raise exception using errcode = '42501', message = 'forbidden';
  end if;
  if v_archived then
    raise exception using errcode = '42501', message = 'This group is archived (read-only).';
  end if;

  if exists (
    select 1 from public.transactions
    where linked_split_expense_id = p_id and user_id = v_uid and linked_bill_id is not null
  ) then
    raise exception 'This expense paid one of your bills. Undo the payment in Bills first.';
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
  v_archived boolean;
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

  select s.group_id, g.name, g.is_archived, s.payer_transaction_id, s.payee_transaction_id
    into v_group_id, v_group_name, v_archived, v_payer_txn, v_payee_txn
  from public.split_settlements s
  join public.split_groups g on g.id = s.group_id
  where s.id = p_id
  for update of s;

  if v_group_id is null then return false; end if;

  if not public.is_split_group_member_or_above(v_group_id, v_uid) then
    raise exception using errcode = '42501', message = 'forbidden';
  end if;
  if v_archived then
    raise exception using errcode = '42501', message = 'This group is archived (read-only).';
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
  -- The person deleting the trip loses their own linked entries, except ones
  -- that paid a bill; everyone else keeps theirs, unlinked, with a note.
  if v_uid is not null then
    delete from public.transactions
    where user_id = v_uid
      and linked_bill_id is null
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
