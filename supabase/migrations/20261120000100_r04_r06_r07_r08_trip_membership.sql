-- R-04, R-06, R-07, R-08: leaving a trip is recorded on the member row
-- (left_at), so a guest whose creator left no longer looks like they left.
-- You can't leave while your balance in the trip isn't settled. Joining again
-- reopens your own removed or left row, and the name match only claims a guest
-- no account was ever linked to. Joining an archived trip is refused (R-15).
-- left_at and archived_at can only be changed by the server. Member names only
-- need to be unique among current members, so leaving, removal and account
-- deletion free the name (R-10).

ALTER TABLE public.split_group_members
    ADD COLUMN IF NOT EXISTS left_at timestamp with time zone;

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

  if (tg_op = 'INSERT' and (new.left_at is not null or new.archived_at is not null))
     or (tg_op = 'UPDATE' and (new.left_at is distinct from old.left_at
                               or new.archived_at is distinct from old.archived_at)) then
    raise exception using errcode = '42501',
      message = 'Leaving and removing members are managed by the server';
  end if;

  return new;
end;
$$;

CREATE OR REPLACE FUNCTION public.split_leave_group(p_group_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_owner_count integer := 0;
  v_has_access boolean := false;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select exists (
    select 1
    from split_group_access
    where group_id = p_group_id and user_id = v_uid
  ) into v_has_access;

  if not v_has_access then
    raise exception 'You do not have access to this group';
  end if;

  select count(*)::integer into v_owner_count
  from split_group_access
  where group_id = p_group_id and role = 'admin';

  if v_owner_count = 1 and exists (
    select 1
    from split_group_access
    where group_id = p_group_id and user_id = v_uid and role = 'admin'
  ) then
    raise exception 'You must assign another admin or delete the group first';
  end if;

  if exists (
    select 1
    from split_group_members m
    where m.group_id = p_group_id
      and m.linked_user_id = v_uid
      and public.split_member_net_balance(m.id) <> 0
  ) then
    raise exception 'Settle your balance in this trip before leaving.';
  end if;

  delete from split_group_access
  where group_id = p_group_id
    and user_id = v_uid;

  update split_group_members
  set linked_user_id = null,
      left_at = now()
  where group_id = p_group_id
    and linked_user_id = v_uid;

  -- The leaver's own ledger rows stay theirs. Unlink them so later edits or
  -- deletes in the group can't rewrite or remove them.
  update split_expenses e
  set linked_transaction_id = null
  from transactions t
  where e.group_id = p_group_id
    and t.id = e.linked_transaction_id
    and t.user_id = v_uid;

  update transactions t
  set linked_split_expense_id = null
  from split_expenses e
  where e.group_id = p_group_id
    and t.linked_split_expense_id = e.id
    and t.user_id = v_uid;

  update split_settlements s
  set payer_transaction_id = null
  from transactions t
  where s.group_id = p_group_id
    and t.id = s.payer_transaction_id
    and t.user_id = v_uid;

  update split_settlements s
  set payee_transaction_id = null
  from transactions t
  where s.group_id = p_group_id
    and t.id = s.payee_transaction_id
    and t.user_id = v_uid;

  update transactions t
  set linked_split_settlement_id = null
  from split_settlements s
  where s.group_id = p_group_id
    and t.linked_split_settlement_id = s.id
    and t.user_id = v_uid;
end;
$$;

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

  if v_group.is_archived then
    raise exception using errcode = '42501', message = 'This group is archived (read-only).';
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

  -- A removed member keeps their account link; joining again reopens that row.
  select m.id into v_existing_member_id
  from split_group_members m
  where m.group_id = v_invite.group_id
    and m.linked_user_id = v_uid
  for update;

  if v_existing_member_id is null then
    -- Your own row from when you left, else a guest no account was ever linked to.
    select m.id into v_existing_member_id
    from split_group_members m
    where m.group_id = v_invite.group_id
      and m.linked_user_id is null
      and m.archived_at is null
      and (
        (m.left_at is not null and m.user_id = v_uid)
        or (m.left_at is null and lower(m.display_name) = lower(v_account_name))
      )
    order by (m.left_at is not null) desc, m.created_at
    limit 1
    for update;
  end if;

  -- Names are unique among current members; add a number if yours is taken.
  v_member_name := v_account_name;
  v_suffix := 1;
  while exists (
    select 1 from split_group_members o
    where o.group_id = v_invite.group_id
      and o.archived_at is null
      and o.left_at is null
      and o.id is distinct from v_existing_member_id
      and lower(o.display_name) = lower(v_member_name)
  ) loop
    v_suffix := v_suffix + 1;
    if v_suffix > 20 then
      raise exception 'Could not add you to this group: too many members named %', v_account_name;
    end if;
    v_member_name := v_account_name || ' (' || v_suffix || ')';
  end loop;

  if v_existing_member_id is not null then
    update split_group_members
    set display_name = v_member_name,
        user_id = v_uid,
        linked_user_id = v_uid,
        archived_at = null,
        left_at = null
    where id = v_existing_member_id;
  else
    insert into split_group_members (group_id, display_name, is_self, linked_user_id, user_id)
    values (v_invite.group_id, v_member_name, false, v_uid, v_uid);
  end if;

  update split_group_invites
  set consumed_by = v_uid,
      consumed_at = now()
  where id = v_invite.id
    and consumed_by is null;

  return v_group;
end;
$$;

-- One-off: mark the rows of people who already left. Leaving cleared the
-- account link but kept user_id, and so do guests the leaver had added, so
-- the leaver's own row is taken to be the earliest row with their user_id in
-- that trip (they joined before they could add anyone).
UPDATE public.split_group_members m
SET left_at = now()
WHERE m.left_at IS NULL
  AND m.linked_user_id IS NULL
  AND m.archived_at IS NULL
  AND m.user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.split_group_access a
    WHERE a.group_id = m.group_id AND a.user_id = m.user_id
  )
  AND m.id = (
    SELECT m2.id FROM public.split_group_members m2
    WHERE m2.group_id = m.group_id AND m2.user_id = m.user_id
    ORDER BY m2.created_at, m2.id
    LIMIT 1
  );

-- Members whose account was deleted.
UPDATE public.split_group_members
SET left_at = now()
WHERE left_at IS NULL
  AND linked_user_id IS NULL
  AND user_id IS NULL
  AND display_name ILIKE 'Former member%';

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_index i
             WHERE i.indexrelid = pg_catalog.to_regclass('public.idx_split_group_members_group_name_unique')
               AND i.indpred IS NULL) THEN
    DROP INDEX public.idx_split_group_members_group_name_unique;
  END IF;
END
$do$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_split_group_members_group_name_unique ON public.split_group_members USING btree (group_id, lower(display_name)) WHERE ((archived_at IS NULL) AND (left_at IS NULL));
