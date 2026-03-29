import { createClient } from '@supabase/supabase-js'
import { loadLocalEnv } from '../load_env.mjs'

function requireEnv(name) {
  const value = process.env[name]
  if (!value) throw new Error(`Missing env var: ${name}`)
  return value
}

function isMissingTableError(error) {
  const message = String(error?.message || '').toLowerCase()
  const details = String(error?.details || '').toLowerCase()
  const code = String(error?.code || '').toUpperCase()
  const status = Number(error?.status || 0)

  return (
    message.includes('reconciliation_reviews') ||
    details.includes('reconciliation_reviews') ||
    code === '42P01' ||
    code === 'PGRST205' ||
    status === 404
  )
}

function makeClient(url, anonKey) {
  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
}

async function main() {
  loadLocalEnv()

  const url = requireEnv('VITE_SUPABASE_URL')
  const anonKey = requireEnv('VITE_SUPABASE_ANON_KEY')
  const email = requireEnv('E2E_SESSION_EMAIL')
  const password = requireEnv('E2E_SESSION_PASSWORD')

  const client = makeClient(url, anonKey)
  const { data: authData, error: authError } = await client.auth.signInWithPassword({ email, password })
  if (authError) throw new Error(`Sign-in failed: ${authError.message}`)
  if (!authData?.user?.id) throw new Error('Sign-in returned no user id')

  try {
    const { error } = await client
      .from('reconciliation_reviews')
      .select('transaction_id', { head: true, count: 'exact' })
      .eq('user_id', authData.user.id)

    if (error) {
      if (isMissingTableError(error)) {
        throw new Error('reconciliation_reviews table is missing in live project schema')
      }
      throw new Error(`Schema check failed: ${error.message}`)
    }

    console.log('[reconciliation-schema-live] PASS')
  } finally {
    await client.auth.signOut()
  }
}

main().catch((error) => {
  console.error('FAIL: test:reconciliation-schema-live')
  console.error(error.message)
  process.exit(1)
})
