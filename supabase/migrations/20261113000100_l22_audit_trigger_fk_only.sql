-- L-22: the audit trigger swallowed every error, so a money write could commit
-- without its audit row. Only a missing user (the account is being deleted in
-- the same statement) is now skipped; anything else fails the write.

CREATE OR REPLACE FUNCTION public.log_financial_event_trg() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_user uuid;
  v_action text;
  v_entity_type text;
  v_entity_id uuid;
  v_metadata jsonb;
begin
  if tg_op = 'DELETE' then
    v_entity_id := old.id;
  else
    v_entity_id := new.id;
  end if;

  -- Determine the user_id to attribute the event to. Owner-keyed tables
  -- (transactions/liabilities/loans) carry user_id directly; split_*
  -- tables are scoped to a group, so we fall back to the calling user.
  if tg_table_name in ('transactions', 'liabilities', 'loans') then
    if tg_op = 'DELETE' then
      v_user := old.user_id;
    else
      v_user := new.user_id;
    end if;
  else
    v_user := auth.uid();
  end if;

  if v_user is null then
    -- Nothing to attribute the event to (e.g. a system migration insert).
    -- Skip the audit write rather than fabricating a user_id.
    return coalesce(new, old);
  end if;

  case tg_table_name
    when 'transactions' then
      v_entity_type := 'transaction';
      v_action := case tg_op
        when 'INSERT' then 'transaction_added'
        when 'UPDATE' then 'transaction_updated'
        when 'DELETE' then 'transaction_deleted'
      end;
    when 'liabilities' then
      v_entity_type := 'liability';
      -- Preserve the "marked paid" distinction the old client emitted —
      -- it's the only update transition worth distinguishing at this
      -- table; everything else collapses to 'liability_updated'.
      v_action := case tg_op
        when 'INSERT' then 'liability_added'
        when 'UPDATE' then case
          when (new.paid is distinct from old.paid) and new.paid then 'liability_marked_paid'
          else 'liability_updated'
        end
        when 'DELETE' then 'liability_deleted'
      end;
    when 'loans' then
      v_entity_type := 'loan';
      v_action := case tg_op
        when 'INSERT' then 'loan_added'
        when 'UPDATE' then 'loan_updated'
        when 'DELETE' then 'loan_deleted'
      end;
    when 'split_expenses' then
      v_entity_type := 'split_expense';
      v_action := case tg_op
        when 'INSERT' then 'splitwise_expense_added'
        when 'UPDATE' then 'splitwise_expense_updated'
        when 'DELETE' then 'splitwise_expense_deleted'
      end;
    when 'split_settlements' then
      v_entity_type := 'split_settlement';
      v_action := case tg_op
        when 'INSERT' then 'splitwise_settlement_added'
        when 'UPDATE' then 'splitwise_settlement_updated'
        when 'DELETE' then 'splitwise_settlement_deleted'
      end;
    else
      return coalesce(new, old);
  end case;

  -- Keep metadata small and stable. On DELETE we capture a row snapshot
  -- so the audit history can be replayed even after the source row is
  -- gone. INSERT/UPDATE rely on the row itself as the source of truth.
  v_metadata := case tg_op
    when 'DELETE' then jsonb_build_object('snapshot', to_jsonb(old))
    else null
  end;

  insert into public.financial_events (user_id, action, entity_type, entity_id, metadata)
  values (v_user, v_action, v_entity_type, v_entity_id, v_metadata);

  return coalesce(new, old);
exception
  when foreign_key_violation then
    -- The user is being deleted in this statement; there is no one to log for.
    raise warning 'log_financial_event_trg skipped for %.%: %', tg_table_name, tg_op, sqlerrm;
    return coalesce(new, old);
end;
$$;
