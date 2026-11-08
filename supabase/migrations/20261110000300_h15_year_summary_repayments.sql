-- H-15: return repayments per month from get_year_summary so Insights can
-- count them as inflow, the same way Monthly and the Dashboard do.
-- Same signature and return type, so CREATE OR REPLACE keeps the grants.

CREATE OR REPLACE FUNCTION public.get_year_summary(p_user_ids uuid[], p_year integer) RETURNS TABLE(monthly_data json, category_data json, vehicle_data json, totals json, top5_expenses json)
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  with year_data as (
    select id, date, type, amount, description, category,
           investment_vehicle, is_repayment
    from transactions
    where user_id = any(p_user_ids)
      and date between make_date(p_year, 1, 1) and make_date(p_year, 12, 31)
  ),
  monthly_agg as (
    select
      extract(month from date)::int as month_num,
      sum(case when type = 'income' and not is_repayment then amount else 0 end) as income,
      sum(case when type = 'income' and is_repayment     then amount else 0 end) as repayments,
      sum(case when type = 'expense'    then amount else 0 end)       as expense,
      sum(case when type = 'investment' then amount else 0 end)       as investment
    from year_data
    group by extract(month from date)
  ),
  category_agg as (
    select coalesce(category, 'other') as category, sum(amount) as cat_total
    from year_data
    where type = 'expense'
    group by coalesce(category, 'other')
  ),
  vehicle_agg as (
    select coalesce(investment_vehicle, 'Other') as vehicle, sum(amount) as veh_total
    from year_data
    where type = 'investment'
    group by coalesce(investment_vehicle, 'Other')
  ),
  totals_agg as (
    select
      coalesce(sum(case when type = 'income' and not is_repayment then amount end), 0) as income,
      coalesce(sum(case when type = 'income' and is_repayment     then amount end), 0) as repayments,
      coalesce(sum(case when type = 'expense'    then amount end), 0) as expense,
      coalesce(sum(case when type = 'investment' then amount end), 0) as investment,
      count(*) as count
    from year_data
  ),
  top5_agg as (
    select id, date, type, amount, description, category
    from year_data
    where type = 'expense'
    order by amount desc
    limit 5
  )
  select
    (select json_agg(row_to_json(m) order by m.month_num) from monthly_agg m),
    (select json_object_agg(category, cat_total) from category_agg),
    (select json_object_agg(vehicle, veh_total) from vehicle_agg),
    (select json_build_object(
      'income',     income,
      'repayments', repayments,
      'expense',    expense,
      'investment', investment,
      'count',      count
    ) from totals_agg),
    (select json_agg(row_to_json(e)) from top5_agg e);
$$;
