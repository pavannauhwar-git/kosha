-- P-07: three storage policies were created by hand from dashboard templates.
-- One let any signed-in user upload anywhere (WITH CHECK true); the other two
-- compared the user id with the file's own id and never matched. Each bucket
-- keeps its own policies from schema.sql.
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON storage.objects;
DROP POLICY IF EXISTS "Enable insert for users based on user_id" ON storage.objects;
DROP POLICY IF EXISTS "Enable delete for users based on user_id" ON storage.objects;
