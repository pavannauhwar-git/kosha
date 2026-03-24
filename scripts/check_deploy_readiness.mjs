import { createClient } from '@supabase/supabase-js'
import { loadLocalEnv } from './load_env.mjs'

function requireEnv(name) {
  const value = process.env[name]
  if (!value) throw new Error(`Missing env var: ${name}`)
  return value
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

async function signIn(client, email, password, label) {
  const { data, error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`${label} sign-in failed: ${error.message}`)
  if (!data?.user?.id) throw new Error(`${label} sign-in returned no user id`)
  return data.user
}

async function runCheck(name, fn) {
  try {
    await fn()
    console.log(`PASS: ${name}`)
    return true
  } catch (error) {
    console.error(`FAIL: ${name}`)
    console.error(`  ${error.message}`)
    return false
  }
}

function assertNoMissingFunctionError(error, functionName) {
  const message = String(error?.message || '')
  if (
    message.includes(functionName) &&
    (message.includes('does not exist') || message.includes('Could not find the function'))
  ) {
    throw new Error(`${functionName} RPC is missing. Apply latest supabase/schema.sql migration.`)
  }
}

async function main() {
  loadLocalEnv()

  const url = requireEnv('VITE_SUPABASE_URL')
  const anonKey = requireEnv('VITE_SUPABASE_ANON_KEY')
  const email = requireEnv('E2E_SESSION_EMAIL')
  const password = requireEnv('E2E_SESSION_PASSWORD')

  const client = makeClient(url, anonKey)
  const user = await signIn(client, email, password, 'Session')

  const checks = []

  checks.push(await runCheck('transactions table + recurring columns accessible', async () => {
    const { error } = await client
      .from('transactions')
      .select('id, user_id, is_recurring, recurrence, next_run_date, source_transaction_id, is_auto_generated', { head: true, count: 'exact' })
      .eq('user_id', user.id)
    if (error) throw error
  }))

  checks.push(await runCheck('liabilities table + recurring columns accessible', async () => {
    const { error } = await client
      .from('liabilities')
      .select('id, user_id, is_recurring, recurrence, paid, linked_transaction_id', { head: true, count: 'exact' })
      .eq('user_id', user.id)
    if (error) throw error
  }))

  checks.push(await runCheck('invites table accessible', async () => {
    const { error } = await client
      .from('invites')
      .select('id', { head: true, count: 'exact' })
      .limit(1)
    if (error) throw error
  }))

  checks.push(await runCheck('financial_events table accessible', async () => {
    const { error } = await client
      .from('financial_events')
      .select('id, action, entity_type, entity_id, metadata, created_at', { head: true, count: 'exact' })
      .eq('user_id', user.id)
    if (error) throw error
  }))

  checks.push(await runCheck('reconciliation_reviews table accessible', async () => {
    const { error } = await client
      .from('reconciliation_reviews')
      .select('id, user_id, transaction_id, status, statement_line, updated_at', { head: true, count: 'exact' })
      .eq('user_id', user.id)
    if (error) throw error
  }))

  checks.push(await runCheck('mark_liability_paid RPC available', async () => {
    const { error } = await client.rpc('mark_liability_paid', {
      p_liability_id: '00000000-0000-0000-0000-000000000000',
      p_user_id: user.id,
    })

    if (!error) return
    assertNoMissingFunctionError(error, 'mark_liability_paid')

    // Expected for readiness probe: invalid liability id or business guard error.
    const msg = String(error.message || '')
    if (!msg) throw error
  }))

  checks.push(await runCheck('generate_recurring_transactions RPC available', async () => {
    const { error } = await client.rpc('generate_recurring_transactions', {
      p_user_id: user.id,
      p_today: '1900-01-01',
    })

    if (!error) return
    assertNoMissingFunctionError(error, 'generate_recurring_transactions')
    throw error
  }))

  await client.auth.signOut()

  if (checks.every(Boolean)) {
    console.log('PASS: deploy readiness checks passed.')
    return
  }

  throw new Error('One or more deploy readiness checks failed.')
}

main().catch((error) => {
  console.error('FAIL: test:deploy-readiness')
  console.error(error.message)
  process.exit(1)
})
