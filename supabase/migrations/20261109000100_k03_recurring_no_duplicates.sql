BEGIN;

DELETE FROM public.transactions t
USING (
  SELECT id, row_number() OVER (PARTITION BY source_transaction_id, date ORDER BY created_at, id) AS rn
  FROM public.transactions
  WHERE source_transaction_id IS NOT NULL
) d
WHERE t.id = d.id AND d.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_txn_source_date ON public.transactions USING btree (source_transaction_id, date) WHERE (source_transaction_id IS NOT NULL);

CREATE OR REPLACE FUNCTION public.generate_recurring_transactions(p_user_id uuid, p_today date DEFAULT NULL::date) RETURNS integer
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
declare
  v_uid uuid := auth.uid();
  -- Client passes its local date; accept at most one day either side of server UTC.
  v_today date := least(greatest(coalesce(p_today, current_date), current_date - 1), current_date + 1);
  v_step int;
  v_k int;
  v_run_date date;
  v_inserted int := 0;
  v_rowcount int;
  v_guard int;
  rec record;
begin
  if v_uid is null then raise exception 'Authentication required.'; end if;
  if v_uid <> p_user_id then raise exception 'Cannot generate recurring transactions for another user.'; end if;

  perform pg_advisory_xact_lock(hashtext('kosha:recurring:' || p_user_id::text));

  for rec in
    select * from public.transactions
    where user_id = p_user_id and is_recurring = true and recurrence is not null
  loop
    v_step := case rec.recurrence when 'monthly' then 1 when 'quarterly' then 3 when 'yearly' then 12 end;
    continue when v_step is null;

    v_run_date := coalesce(rec.next_run_date, (rec.date + make_interval(months => v_step))::date);
    continue when v_run_date > v_today;

    -- Whole months between the anchor and the next run (self-heals rows that already drifted).
    v_k := ((extract(year from v_run_date) - extract(year from rec.date)) * 12
          + (extract(month from v_run_date) - extract(month from rec.date)))::int;
    v_guard := 0;

    while v_run_date <= v_today and v_guard < 120 loop
      insert into public.transactions (
        date, type, description, amount, category, investment_vehicle, is_repayment,
        payment_mode, notes, is_recurring, recurrence, next_run_date,
        source_transaction_id, is_auto_generated, user_id
      ) values (
        v_run_date, rec.type, rec.description, rec.amount, rec.category, rec.investment_vehicle,
        rec.is_repayment, rec.payment_mode, rec.notes, false, null, null,
        rec.id, true, rec.user_id
      ) on conflict (source_transaction_id, date) where source_transaction_id is not null do nothing;
      get diagnostics v_rowcount = row_count;
      v_inserted := v_inserted + v_rowcount;
      v_guard := v_guard + 1;
      v_k := v_k + v_step;
      v_run_date := (rec.date + make_interval(months => v_k))::date;
    end loop;

    update public.transactions set next_run_date = v_run_date
    where id = rec.id and user_id = p_user_id;
  end loop;

  return v_inserted;
end;
$$;

COMMIT;
