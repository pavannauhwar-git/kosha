-- M-04: submit_bug_report caps every field it stores, not just the title and
-- description, and only accepts a screenshot path inside the reporter's own
-- folder (the Edge Function signs that path for the chat webhook).

CREATE OR REPLACE FUNCTION public.submit_bug_report(p_title text, p_description text, p_steps text DEFAULT NULL::text, p_severity text DEFAULT 'medium'::text, p_route text DEFAULT NULL::text, p_app_version text DEFAULT NULL::text, p_diagnostics jsonb DEFAULT NULL::jsonb, p_environment jsonb DEFAULT NULL::jsonb, p_screenshot_path text DEFAULT NULL::text, p_reporter_email text DEFAULT NULL::text, p_fingerprint text DEFAULT NULL::text, p_tags text[] DEFAULT NULL::text[]) RETURNS TABLE(report_id uuid, is_duplicate boolean, occurrence_count integer)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_existing_id uuid;
  v_existing_occ integer;
  v_priority text;
  v_recent_count integer;
  v_tags text[] := coalesce(p_tags, '{}'::text[]);
BEGIN
  -- 1. Identity & Validation
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to submit bug reports.';
  END IF;

  IF p_title IS NULL OR btrim(p_title) = '' THEN
    RAISE EXCEPTION 'Bug title is required.';
  END IF;

  IF p_description IS NULL OR btrim(p_description) = '' THEN
    RAISE EXCEPTION 'Bug description is required.';
  END IF;

  IF char_length(p_title) > 160 THEN
    RAISE EXCEPTION 'Bug title must be 160 characters or fewer.';
  END IF;
  IF char_length(p_description) > 4000 THEN
    RAISE EXCEPTION 'Bug description must be 4000 characters or fewer.';
  END IF;
  IF char_length(coalesce(p_steps, '')) > 4000 THEN
    RAISE EXCEPTION 'Steps must be 4000 characters or fewer.';
  END IF;
  IF char_length(coalesce(p_route, '')) > 500
     OR char_length(coalesce(p_app_version, '')) > 64
     OR char_length(coalesce(p_reporter_email, '')) > 254
     OR char_length(coalesce(p_fingerprint, '')) > 128 THEN
    RAISE EXCEPTION 'Bug report details are too long.';
  END IF;
  IF octet_length(coalesce(p_diagnostics::text, '')) > 4000
     OR octet_length(coalesce(p_environment::text, '')) > 4000 THEN
    RAISE EXCEPTION 'Bug report diagnostics are too large.';
  END IF;
  IF coalesce(array_length(v_tags, 1), 0) > 10
     OR EXISTS (SELECT 1 FROM unnest(v_tags) AS t WHERE char_length(t) > 40) THEN
    RAISE EXCEPTION 'Use at most 10 tags of up to 40 characters each.';
  END IF;
  IF p_screenshot_path IS NOT NULL
     AND (char_length(p_screenshot_path) > 300 OR p_screenshot_path NOT LIKE v_uid::text || '/%') THEN
    RAISE EXCEPTION 'Invalid screenshot path.';
  END IF;

  -- 2. Anti-Spam (Max 5 reports per 2 minutes)
  SELECT count(*) INTO v_recent_count
  FROM public.bug_reports
  WHERE user_id = v_uid
    AND created_at > now() - interval '2 minutes';

  IF v_recent_count >= 5 THEN
    RAISE EXCEPTION 'Too many reports in a short time. Please wait a moment and try again.';
  END IF;

  -- 3. Categorization
  IF p_severity NOT IN ('low', 'medium', 'high') THEN
    p_severity := 'medium';
  END IF;

  IF p_severity = 'high' THEN
    v_priority := 'p1';
  ELSIF p_severity = 'medium' THEN
    v_priority := 'p2';
  ELSE
    v_priority := 'p3';
  END IF;

  -- 4. Duplicate Detection
  SELECT id, bug_reports.occurrence_count
    INTO v_existing_id, v_existing_occ
  FROM public.bug_reports
  WHERE user_id = v_uid
    AND coalesce(fingerprint, '') = coalesce(p_fingerprint, '')
    AND coalesce(route, '') = coalesce(p_route, '')
    AND created_at > now() - interval '7 days'
  ORDER BY created_at DESC
  LIMIT 1;

  -- 5. Update Existing or Insert New
  IF v_existing_id IS NOT NULL AND coalesce(p_fingerprint, '') <> '' THEN
    UPDATE public.bug_reports
    SET
      occurrence_count = coalesce(bug_reports.occurrence_count, 1) + 1,
      last_reported_at = now(),
      updated_at = now(),
      steps = coalesce(nullif(btrim(coalesce(p_steps, '')), ''), bug_reports.steps),
      diagnostics = coalesce(p_diagnostics, bug_reports.diagnostics),
      environment = coalesce(p_environment, bug_reports.environment),
      reporter_email = coalesce(nullif(btrim(coalesce(p_reporter_email, '')), ''), bug_reports.reporter_email),
      screenshot_path = coalesce(nullif(p_screenshot_path, ''), bug_reports.screenshot_path),
      tags = CASE
        WHEN array_length(v_tags, 1) IS NULL THEN bug_reports.tags
        ELSE (
          SELECT array_agg(DISTINCT t)
          FROM unnest(coalesce(bug_reports.tags, '{}'::text[]) || v_tags) AS t
        )
      END
    WHERE id = v_existing_id AND user_id = v_uid;

    RETURN QUERY
      SELECT v_existing_id, true, (coalesce(v_existing_occ, 1) + 1)::integer;
    RETURN;
  END IF;

  -- The fix: Added RETURN QUERY prefix to the INSERT statement
  RETURN QUERY
  INSERT INTO public.bug_reports (
    user_id, title, description, steps, severity, priority, route,
    app_version, diagnostics, environment, screenshot_path,
    reporter_email, fingerprint, tags, occurrence_count,
    last_reported_at, updated_at
  ) VALUES (
    v_uid, p_title, p_description, p_steps, p_severity, v_priority, p_route,
    p_app_version, p_diagnostics, p_environment, p_screenshot_path,
    p_reporter_email, p_fingerprint, v_tags, 1, now(), now()
  )
  RETURNING id, false, 1;
END;
$$;
