// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

declare const Deno: any;

// Maximum payload size we accept. The endpoint only expects a `reportId`
// (~50 bytes) — 16 KB is generous and protects against accidental floods.
const MAX_BODY_BYTES = 16 * 1024

// CORS — pin allowed origins via the `ALLOWED_ORIGINS` function secret
// (comma-separated list, e.g. "https://app.example.com,https://staging.example.com").
// Falls back to "*" with a warning when not configured, so existing deploys
// don't break the moment this file ships. Pin it in production.
const allowedOriginsEnv = Deno.env.get('ALLOWED_ORIGINS')
const allowedOrigins: string[] | null = allowedOriginsEnv
  ? allowedOriginsEnv.split(',').map((o: string) => o.trim()).filter(Boolean)
  : null

if (!allowedOrigins) {
  console.warn('[bug-report-notify] ALLOWED_ORIGINS not set — falling back to wildcard CORS. Pin this in production.')
}

function resolveCorsOrigin(req: Request): string {
  const origin = req.headers.get('origin') || ''
  if (!allowedOrigins) return '*'
  if (allowedOrigins.includes(origin)) return origin
  // Unknown origin: don't echo it. Returning a non-matching origin makes
  // the browser block the response.
  return allowedOrigins[0]
}

function corsHeaders(req: Request) {
  return {
    'Access-Control-Allow-Origin': resolveCorsOrigin(req),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  }
}

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(req),
      'Content-Type': 'application/json',
    },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req) })
  }

  // Reject anything but POST early — preserves the function's contract and
  // gives us a cheap rate-limit-style cutoff.
  if (req.method !== 'POST') {
    return json(req, { ok: false, error: 'method_not_allowed' }, 405)
  }

  // Body-size guard. We do this BEFORE reading the body so a malicious
  // caller can't stream gigabytes at us.
  const contentLength = Number(req.headers.get('content-length') || 0)
  if (contentLength > MAX_BODY_BYTES) {
    return json(req, { ok: false, error: 'payload_too_large' }, 413)
  }

  try {
    let parsedBody: any
    try {
      parsedBody = await req.json()
    } catch {
      return json(req, { ok: false, error: 'invalid_json' }, 400)
    }

    const reportId = parsedBody?.reportId
    if (!reportId) return json(req, { ok: false, error: 'reportId is required' }, 400)
    if (typeof reportId !== 'string') return json(req, { ok: false, error: 'reportId must be a string' }, 400)

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(reportId)) return json(req, { ok: false, error: 'invalid reportId format' }, 400)

    const authHeader = req.headers.get('authorization')
    if (!authHeader) return json(req, { ok: false, error: 'unauthorized' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      // Don't leak which credentials are missing to the client.
      console.error('[bug-report-notify] missing function env: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY')
      return json(req, { ok: false, error: 'internal' }, 500)
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    })

    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) return json(req, { ok: false, error: 'unauthorized' }, 401)

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    })

    const { data: report, error: reportError } = await admin
      .from('bug_reports')
      .select('id, title, description, severity, priority, route, user_id, app_version, created_at, screenshot_path, occurrence_count, notified_at')
      .eq('id', reportId)
      .single()

    if (reportError) {
      console.error('[bug-report-notify] report lookup failed', reportError)
      return json(req, { ok: false, error: 'internal' }, 500)
    }

    if (report.user_id !== user.id) return json(req, { ok: false, error: 'forbidden' }, 403)

    // Idempotence: if the report has already been notified, don't fire the
    // webhook again. Without this guard, a user could call the endpoint
    // repeatedly for their own report and spam the Slack/Discord channel.
    if (report.notified_at) {
      return json(req, { ok: true, skipped: true, reason: 'already_notified' })
    }

    const webhookUrl = Deno.env.get('BUG_REPORT_WEBHOOK_URL')
    if (!webhookUrl) {
      return json(req, { ok: true, skipped: true, reason: 'no_webhook' })
    }

    let screenshotUrl: string | null = null
    if (report?.screenshot_path) {
      // Shorter signed URL — the previous 7-day TTL outlived the average
      // bug-triage cycle and persisted in Slack/Discord history. 48h is
      // long enough to triage but short enough to age out of public chat
      // logs quickly.
      const { data: signed, error: signedError } = await admin.storage
        .from('bug-reports')
        .createSignedUrl(report.screenshot_path, 60 * 60 * 48)

      if (!signedError && signed?.signedUrl) {
        screenshotUrl = signed.signedUrl
      }
    }

    const textLines = [
      `New bug report (#${report.id})`,
      `Title: ${report.title}`,
      `Severity/Priority: ${report.severity} / ${report.priority}`,
      `Route: ${report.route || 'n/a'}`,
      `Occurrences: ${report.occurrence_count || 1}`,
      `App: ${report.app_version || 'n/a'}`,
      screenshotUrl ? `Screenshot: ${screenshotUrl}` : null,
      `Description: ${report.description}`,
    ].filter(Boolean)

    const text = textLines.join('\n')

    const payload = webhookUrl.includes('discord.com/api/webhooks')
      ? { content: text }
      : {
        text,
        reportId: report.id,
        severity: report.severity,
        priority: report.priority,
        route: report.route,
        screenshotUrl,
      }

    // Claim the report BEFORE sending the webhook. We do this with a
    // conditional update (`notified_at IS NULL`) — if the row count is 0,
    // a concurrent request already claimed it and we should not send
    // another webhook. This is the same pattern Postgres advisory locks
    // would give us, but with a single SQL round-trip.
    const claimedAt = new Date().toISOString()
    const { data: claimed, error: claimError } = await admin
      .from('bug_reports')
      .update({ notified_at: claimedAt })
      .eq('id', report.id)
      .is('notified_at', null)
      .select('id')

    if (claimError) {
      console.error('[bug-report-notify] claim update failed', claimError)
      return json(req, { ok: false, error: 'internal' }, 500)
    }

    if (!claimed || claimed.length === 0) {
      // Another concurrent call won the race. Treat as success.
      return json(req, { ok: true, skipped: true, reason: 'already_notified' })
    }

    const webhookRes = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!webhookRes.ok) {
      // Roll back the claim so a future retry can fire the webhook.
      const body = await webhookRes.text().catch(() => '')
      console.error(`[bug-report-notify] webhook returned ${webhookRes.status}`, body)
      await admin
        .from('bug_reports')
        .update({ notified_at: null })
        .eq('id', report.id)
        .eq('notified_at', claimedAt)
      return json(req, { ok: false, error: 'internal' }, 502)
    }

    return json(req, { ok: true })
  } catch (error) {
    // Never echo raw error messages to the client — they can leak DB
    // constraint names, internal IDs, or upstream webhook response bodies.
    console.error('[bug-report-notify] unhandled error', error)
    return json(req, { ok: false, error: 'internal' }, 500)
  }
})
