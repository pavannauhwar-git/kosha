-- L-23 follow-up: these two functions were also granted to PUBLIC (every
-- role, including logged-out users), so revoking anon alone left them
-- callable. Signed-in users keep their own explicit grant.
REVOKE ALL ON FUNCTION public.generate_recurring_transactions(p_user_id uuid, p_today date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_loan_payment(p_loan_id uuid, p_user_id uuid, p_amount numeric, p_id uuid, p_paid_on date) FROM PUBLIC;
