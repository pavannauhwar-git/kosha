// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.99.1'

declare const Deno: any;

// The only accepted body is {"confirm":"DELETE"}.
const MAX_BODY_BYTES = 1024
const LIST_PAGE = 100
const MAX_PAGES = 50

// CORS — same `ALLOWED_ORIGINS` secret as bug-report-notify
// (comma-separated list of app origins).
const allowedOriginsEnv = Deno.env.get('ALLOWED_ORIGINS')
const allowedOrigins: string[] | null = allowedOriginsEnv
  ? allowedOriginsEnv.split(',').map((o: string) => o.trim()).filter(Boolean)
  : null

if (!allowedOrigins) {
  console.warn('[delete-account] ALLOWED_ORIGINS not set — falling back to wildcard CORS. Pin this in production.')
}

function resolveCorsOrigin(req: Request): string {
  const origin = req.headers.get('origin') || ''
  if (!allowedOrigins) return '*'
  if (allowedOrigins.includes(origin)) return origin
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

// Removes every file under `prefix` in `bucket`. `search` narrows the listing
// to names starting with it (used for avatars, which sit at the bucket root).
async function removeFiles(admin: any, bucket: string, prefix: string, search?: string) {
  for (let page = 0; page < MAX_PAGES; page++) {
    const { data, error } = await admin.storage.from(bucket).list(prefix, { limit: LIST_PAGE, search })
    if (error) throw error
    const paths = (data || [])
      .filter((item: any) => item?.name && item.id)
      .map((item: any) => (prefix ? `${prefix}/${item.name}` : item.name))
    if (paths.length === 0) return
    const { error: removeError } = await admin.storage.from(bucket).remove(paths)
    if (removeError) throw removeError
  }
  throw new Error(`too many files in ${bucket}`)
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req) })
  }

  if (req.method !== 'POST') {
    return json(req, { ok: false, error: 'method_not_allowed' }, 405)
  }

  const contentLength = Number(req.headers.get('content-length') || 0)
  if (contentLength > MAX_BODY_BYTES) {
    return json(req, { ok: false, error: 'payload_too_large' }, 413)
  }

  try {
    let parsedBody: any
    try {
      const bodyText = await req.text()
      if (bodyText.length > MAX_BODY_BYTES) {
        return json(req, { ok: false, error: 'payload_too_large' }, 413)
      }
      parsedBody = JSON.parse(bodyText)
    } catch {
      return json(req, { ok: false, error: 'invalid_json' }, 400)
    }

    if (parsedBody?.confirm !== 'DELETE') {
      return json(req, { ok: false, error: 'confirmation_required' }, 400)
    }

    const authHeader = req.headers.get('authorization')
    if (!authHeader) return json(req, { ok: false, error: 'unauthorized' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      console.error('[delete-account] missing function env: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY')
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

    // Every step can be retried: if one fails, the account is still there and
    // the user can try again.
    await removeFiles(admin, 'avatars', '', `${user.id}-`)
    await removeFiles(admin, 'bug-reports', user.id)

    const { error: dataError } = await admin.rpc('delete_account_data', { p_user_id: user.id })
    if (dataError) {
      console.error('[delete-account] delete_account_data failed', dataError)
      return json(req, { ok: false, error: 'internal' }, 500)
    }

    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id)
    if (deleteError) {
      console.error('[delete-account] auth delete failed', deleteError)
      return json(req, { ok: false, error: 'internal' }, 500)
    }

    return json(req, { ok: true })
  } catch (error) {
    console.error('[delete-account] unhandled error', error)
    return json(req, { ok: false, error: 'internal' }, 500)
  }
})
