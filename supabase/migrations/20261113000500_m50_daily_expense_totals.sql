-- M-50: the daily spend charts paged through every expense row (1,000 at a
-- time, up to 50 pages) and added them up in the browser. This returns one
-- row per day instead (at most 366), with exact sums. flexible_total leaves
-- out repayments and the categories the caller passes (fixed monthly
-- outgoings), for the weekly drift card. Row level security still decides
-- whose rows are visible.

CREATE OR REPLACE FUNCTION public.get_daily_expense_totals(p_user_id uuid, p_start_date date, p_end_date date, p_fixed_categories text[] DEFAULT '{}'::text[]) RETURNS TABLE(day date, total numeric, flexible_total numeric)
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
  select
    t.date as day,
    sum(t.amount) as total,
    coalesce(sum(t.amount) filter (
      where not coalesce(t.is_repayment, false)
        and coalesce(t.category, '') <> all (coalesce(p_fixed_categories, '{}'::text[]))
    ), 0) as flexible_total
  from public.transactions t
  where t.user_id = p_user_id
    and t.type = 'expense'
    and t.date >= p_start_date
    and t.date <= least(p_end_date, p_start_date + 365)
  group by t.date
  order by t.date
$$;

REVOKE ALL ON FUNCTION public.get_daily_expense_totals(p_user_id uuid, p_start_date date, p_end_date date, p_fixed_categories text[]) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_daily_expense_totals(p_user_id uuid, p_start_date date, p_end_date date, p_fixed_categories text[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_daily_expense_totals(p_user_id uuid, p_start_date date, p_end_date date, p_fixed_categories text[]) TO authenticated;
GRANT ALL ON FUNCTION public.get_daily_expense_totals(p_user_id uuid, p_start_date date, p_end_date date, p_fixed_categories text[]) TO service_role;
