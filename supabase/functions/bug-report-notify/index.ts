// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { reportId } = await req.json()
    if (!reportId) return json({ ok: false, error: 'reportId is required' }, 400)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceRoleKey) {
      return json({ ok: false, error: 'Missing Supabase service credentials in function env' }, 500)
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    })

    const { data: report, error: reportError } = await admin
      .from('bug_reports')
      .select('id, title, description, severity, priority, route, user_id, app_version, created_at, screenshot_path, occurrence_count')
      .eq('id', reportId)
      .single()

    if (reportError) throw reportError

    const webhookUrl = Deno.env.get('BUG_REPORT_WEBHOOK_URL')
    if (!webhookUrl) {
      return json({ ok: true, skipped: true, reason: 'BUG_REPORT_WEBHOOK_URL not configured' })
    }

    let screenshotUrl: string | null = null
    if (report?.screenshot_path) {
      const { data: signed, error: signedError } = await admin.storage
        .from('bug-reports')
        .createSignedUrl(report.screenshot_path, 60 * 60 * 24 * 7)

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

    const webhookRes = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!webhookRes.ok) {
      const body = await webhookRes.text()
      throw new Error(`Webhook request failed (${webhookRes.status}): ${body}`)
    }

    await admin
      .from('bug_reports')
      .update({ notified_at: new Date().toISOString() })
      .eq('id', report.id)

    return json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return json({ ok: false, error: message }, 500)
  }
})
