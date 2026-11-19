-- F-05: adding an expense with "Split with group" dropped the payment mode
-- and the bill it paid. The payer's ledger entry now keeps the payment mode,
-- and a linked bill is marked paid with that entry, in the same transaction.

DROP FUNCTION IF EXISTS public.split_create_expense(uuid, uuid, text, numeric, date, text, text, jsonb, boolean, text, uuid);

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
    and m.group_id = p_group_id;

  if v_payer_uid is null and not exists (
    select 1
    from split_group_members m
    where m.id = p_paid_by_member_id
      and m.group_id = p_group_id
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

REVOKE ALL ON FUNCTION public.split_create_expense(p_group_id uuid, p_paid_by_member_id uuid, p_description text, p_amount numeric, p_expense_date date, p_split_method text, p_notes text, p_splits jsonb, p_sync_transaction boolean, p_transaction_category text, p_id uuid, p_payment_mode text, p_linked_bill_id uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.split_create_expense(p_group_id uuid, p_paid_by_member_id uuid, p_description text, p_amount numeric, p_expense_date date, p_split_method text, p_notes text, p_splits jsonb, p_sync_transaction boolean, p_transaction_category text, p_id uuid, p_payment_mode text, p_linked_bill_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.split_create_expense(p_group_id uuid, p_paid_by_member_id uuid, p_description text, p_amount numeric, p_expense_date date, p_split_method text, p_notes text, p_splits jsonb, p_sync_transaction boolean, p_transaction_category text, p_id uuid, p_payment_mode text, p_linked_bill_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.split_create_expense(p_group_id uuid, p_paid_by_member_id uuid, p_description text, p_amount numeric, p_expense_date date, p_split_method text, p_notes text, p_splits jsonb, p_sync_transaction boolean, p_transaction_category text, p_id uuid, p_payment_mode text, p_linked_bill_id uuid) TO service_role;
