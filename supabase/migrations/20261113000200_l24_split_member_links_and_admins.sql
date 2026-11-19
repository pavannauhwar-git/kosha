-- L-24: a trip admin could write any user id into a member row's
-- linked_user_id (and so see that person's name and photo), and a direct
-- UPDATE on split_group_access could move an access row to another user or
-- demote the last admin. Direct writes may now only link a member to the
-- caller's own account; other people join through an invite. Direct access
-- updates may only change the role, and no update may leave a trip without
-- an admin.

CREATE OR REPLACE FUNCTION public.guard_split_member_link() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  if current_user not in ('authenticated', 'anon')
     or current_setting('kosha.trusted_write', true) = 'true' then
    return new;
  end if;

  if new.linked_user_id is not null
     and new.linked_user_id is distinct from auth.uid()
     and (tg_op = 'INSERT' or new.linked_user_id is distinct from old.linked_user_id) then
    raise exception using errcode = '42501',
      message = 'A member can only be linked to your own account. Others join with an invite.';
  end if;

  return new;
end;
$$;

CREATE OR REPLACE FUNCTION public.guard_split_access_update() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  if current_user in ('authenticated', 'anon')
     and current_setting('kosha.trusted_write', true) is distinct from 'true'
     and (new.group_id is distinct from old.group_id or new.user_id is distinct from old.user_id) then
    raise exception using errcode = '42501',
      message = 'Only a member''s role can be changed.';
  end if;

  if old.role = 'admin' and new.role is distinct from 'admin' and not exists (
    select 1 from public.split_group_access a
    where a.group_id = old.group_id and a.role = 'admin' and a.id <> old.id
  ) then
    raise exception using errcode = '42501', message = 'At least one admin is required';
  end if;

  return new;
end;
$$;

CREATE OR REPLACE TRIGGER trg_guard_split_member_link BEFORE INSERT OR UPDATE ON public.split_group_members FOR EACH ROW EXECUTE FUNCTION public.guard_split_member_link();

CREATE OR REPLACE TRIGGER trg_guard_split_access_update BEFORE UPDATE ON public.split_group_access FOR EACH ROW EXECUTE FUNCTION public.guard_split_access_update();

REVOKE ALL ON FUNCTION public.guard_split_member_link() FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.guard_split_member_link() TO authenticated;
GRANT ALL ON FUNCTION public.guard_split_member_link() TO service_role;

REVOKE ALL ON FUNCTION public.guard_split_access_update() FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.guard_split_access_update() TO authenticated;
GRANT ALL ON FUNCTION public.guard_split_access_update() TO service_role;
