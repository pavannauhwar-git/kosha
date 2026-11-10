-- M-05: data clean-up for account deletion, run by the delete-account Edge
-- Function just before it deletes the auth user (which cascades the rest).
-- Trips nobody else can open are deleted; in shared trips the member row stays
-- so everyone's balances still add up, but the name is removed. Bug reports
-- (which keep the reporter's email) are deleted.
CREATE OR REPLACE FUNCTION public.delete_account_data(p_user_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  if p_user_id is null then
    raise exception using errcode = '22023', message = 'p_user_id is required';
  end if;

  delete from public.split_groups g
  where exists (select 1 from public.split_group_access a where a.group_id = g.id and a.user_id = p_user_id)
    and not exists (select 1 from public.split_group_access a where a.group_id = g.id and a.user_id <> p_user_id);

  update public.split_group_members
  set display_name = 'Former member'
  where linked_user_id = p_user_id;

  delete from public.bug_reports where user_id = p_user_id;
end;
$$;

REVOKE ALL ON FUNCTION public.delete_account_data(uuid) FROM PUBLIC, anon, authenticated;
GRANT ALL ON FUNCTION public.delete_account_data(uuid) TO service_role;
