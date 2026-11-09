-- L-23: logged-out users can no longer call database functions by default.
-- Two functions still had an explicit anon grant, and the default privileges
-- granted every new function to anon (and, through PUBLIC, to everyone).
-- split_preview_group_invite keeps its explicit anon grant (H-05).

REVOKE ALL ON FUNCTION public.generate_recurring_transactions(p_user_id uuid, p_today date) FROM anon;
REVOKE ALL ON FUNCTION public.record_loan_payment(p_loan_id uuid, p_user_id uuid, p_amount numeric, p_id uuid, p_paid_on date) FROM anon;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
