BEGIN;

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
  v_member_name text;
  v_suffix int;
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
      and m.linked_user_id is null
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
      v_member_name := v_account_name;
      v_suffix := 1;
      loop
        begin
          insert into split_group_members (group_id, display_name, is_self, linked_user_id, user_id)
          values (v_invite.group_id, v_member_name, false, v_uid, v_uid);
          exit;
        exception
          when unique_violation then
            v_suffix := v_suffix + 1;
            if v_suffix > 20 then
              raise exception 'Could not add you to this group: too many members named %', v_account_name;
            end if;
            v_member_name := v_account_name || ' (' || v_suffix || ')';
        end;
      end loop;
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

COMMIT;
