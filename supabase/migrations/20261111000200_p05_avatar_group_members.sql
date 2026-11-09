-- P-05: members of the same split group can see each other's profile photo.
-- The group screen already gets every member's photo path from
-- split_group_member_profiles, but the storage read policy only allowed your
-- own photo and your linked partner's, so the signed URL request failed and
-- the screen fell back to an initial.

CREATE OR REPLACE FUNCTION public.shares_split_group_with(p_other uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select exists (
    select 1
    from public.split_group_members m
    join public.split_group_access a on a.group_id = m.group_id
    where m.linked_user_id = p_other
      and a.user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.shares_split_group_with(p_other uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.shares_split_group_with(p_other uuid) TO authenticated;
GRANT ALL ON FUNCTION public.shares_split_group_with(p_other uuid) TO service_role;

drop policy if exists "avatars_storage: read" on storage.objects;

create policy "avatars_storage: read" on storage.objects
for select to authenticated
using (
  bucket_id = 'avatars'
  and (
    name like ((select auth.uid())::text || '-%')
    or (
      length(name) >= 37
      and substring(name from 1 for 36) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      and (
        public.is_linked((substring(name from 1 for 36))::uuid)
        or public.shares_split_group_with((substring(name from 1 for 36))::uuid)
      )
    )
  )
);

-- The older "avatars: ..." policies expect photos inside a per-user folder.
-- The app stores them at the bucket root as <user id>-<timestamp>.<ext>, so
-- drop the old policies once no photo uses a folder path.
DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'avatars' AND name LIKE '%/%') THEN
    DROP POLICY IF EXISTS "avatars: read own" ON storage.objects;
    DROP POLICY IF EXISTS "avatars: upload own" ON storage.objects;
    DROP POLICY IF EXISTS "avatars: update own" ON storage.objects;
    DROP POLICY IF EXISTS "avatars: delete own" ON storage.objects;
  END IF;
END
$do$;
