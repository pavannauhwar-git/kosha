-- F-01: the two-argument is_linked(target, user) answers for any pair of user
-- ids, so a signed-in user could probe whether two other people are partners.
-- Nothing calls it (every policy uses the one-argument version).
REVOKE ALL ON FUNCTION public.is_linked(target_user_id uuid, p_user_id uuid) FROM PUBLIC, anon, authenticated;
GRANT ALL ON FUNCTION public.is_linked(target_user_id uuid, p_user_id uuid) TO service_role;
