-- L-26: remove database objects nothing uses any more. The app calls only
-- the array versions of get_month_summary, get_running_balance and
-- get_year_summary, and the get_transaction_signal_aggregates version that
-- takes the linked loan, bill and split filters. Budgets live in
-- category_budgets; the old budgets table is dropped only if it is empty.

DROP FUNCTION IF EXISTS public.get_month_summary(uuid, text);

DROP FUNCTION IF EXISTS public.get_month_summary(uuid, integer, integer);

DROP FUNCTION IF EXISTS public.get_running_balance(uuid, date);

DROP FUNCTION IF EXISTS public.get_year_summary(uuid, integer);

DROP FUNCTION IF EXISTS public.get_transaction_signal_aggregates(uuid, text, text, text, text, date, date);

DO $do$
BEGIN
  IF to_regclass('public.budgets') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.budgets) THEN
      DROP TABLE public.budgets;
    END IF;
  END IF;
END
$do$;
