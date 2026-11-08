BEGIN;

ALTER TABLE public.invites ALTER COLUMN expires_at SET DEFAULT (now() + '7 days'::interval);
UPDATE public.invites SET expires_at = now() + interval '7 days' WHERE used_by IS NULL AND expires_at IS NULL;

ALTER TABLE public.split_group_invites ADD COLUMN IF NOT EXISTS expires_at timestamp with time zone;
ALTER TABLE public.split_group_invites ALTER COLUMN expires_at SET DEFAULT (now() + '7 days'::interval);
UPDATE public.split_group_invites SET expires_at = now() + interval '7 days'
WHERE consumed_by IS NULL AND revoked_at IS NULL AND expires_at IS NULL;

CREATE OR REPLACE FUNCTION public.split_consume_group_invite(p_token text) RETURNS public.split_groups
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_invite split_group_invites%rowtype;
  v_group split_groups%rowtype;
  v_account_name text;
  v_existing_member_id uuid;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if p_token is null or btrim(p_token) = '' then
    raise exception 'Invite token is required';
  end if;

  select * into v_invite
  from split_group_invites i
  where i.token = btrim(p_token)
    and i.revoked_at is null
    and i.consumed_by is null
    and (i.expires_at is null or i.expires_at > now())
  for update;

  if not found then
    raise exception 'Invite not found, already used or expired';
  end if;

  select * into v_group
  from split_groups g
  where g.id = v_invite.group_id
  for update;

  if not found then
    raise exception 'Split group not found';
  end if;

  insert into split_group_access (
    group_id,
    user_id,
    role
  ) values (
    v_invite.group_id,
    v_uid,
    case
      when v_group.user_id = v_uid then 'admin'
      else coalesce(v_invite.role, 'member')
    end
  )
  on conflict (group_id, user_id) do update
    set role = case
      when excluded.role = 'admin' then 'admin'
      else split_group_access.role
    end;

  select nullif(btrim(p.display_name), '') into v_account_name
  from profiles p
  where p.id = v_uid;

  if v_account_name is null then
    select nullif(
      btrim(
        coalesce(
          u.raw_user_meta_data ->> 'full_name',
          split_part(u.email, '@', 1)
        )
      ),
      ''
    )
    into v_account_name
    from auth.users u
    where u.id = v_uid;
  end if;

  v_account_name := coalesce(v_account_name, 'Member');

  update split_group_members
  set display_name = v_account_name,
      user_id = v_uid,
      linked_user_id = v_uid
  where group_id = v_invite.group_id
    and linked_user_id = v_uid;

  if not found then
    select m.id into v_existing_member_id
    from split_group_members m
    where m.group_id = v_invite.group_id
      and lower(m.display_name) = lower(v_account_name)
    limit 1
    for update;

    if v_existing_member_id is not null then
      update split_group_members
      set display_name = v_account_name,
          user_id = v_uid,
          linked_user_id = v_uid
      where id = v_existing_member_id;
    else
      begin
        insert into split_group_members (
          group_id,
          display_name,
          is_self,
          linked_user_id,
          user_id
        ) values (
          v_invite.group_id,
          v_account_name,
          false,
          v_uid,
          v_uid
        );
      exception
        when unique_violation then
          -- Fallback if RLS or concurrency hid the row during select
          update split_group_members
          set user_id = v_uid,
              linked_user_id = v_uid
          where group_id = v_invite.group_id
            and lower(display_name) = lower(v_account_name);
      end;
    end if;
  end if;

  update split_group_invites
  set consumed_by = v_uid,
      consumed_at = now()
  where id = v_invite.id
    and consumed_by is null;

  return v_group;
end;
$$;

CREATE OR REPLACE FUNCTION public.split_preview_group_invite(p_token text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_invite public.split_group_invites%rowtype;
  v_group public.split_groups%rowtype;
begin
  select * into v_invite from public.split_group_invites
  where token = btrim(p_token)
    and revoked_at is null
    and consumed_by is null
    and (expires_at is null or expires_at > now());
  if not found then
    raise exception 'Invite not found, already used or expired';
  end if;

  select * into v_group from public.split_groups where id = v_invite.group_id;
  if not found then
    raise exception 'Group not found';
  end if;

  return jsonb_build_object(
    'group_id', case when auth.uid() is not null then v_group.id end,
    'group_name', v_group.name,
    'invited_role', coalesce(v_invite.role, 'viewer')
  );
end;
$$;

COMMIT;
