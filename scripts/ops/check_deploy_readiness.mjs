import { createClient } from '@supabase/supabase-js'
import { loadLocalEnv } from '../load_env.mjs'

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

  checks.push(await runCheck('split_groups table accessible', async () => {
    const { error } = await client
      .from('split_groups')
      .select('id, user_id, name, updated_at', { head: true, count: 'exact' })
      .eq('user_id', user.id)
    if (error) throw error
  }))

  checks.push(await runCheck('split_group_members table accessible', async () => {
    const { error } = await client
      .from('split_group_members')
      .select('id, group_id, user_id, display_name, is_self', { head: true, count: 'exact' })
      .eq('user_id', user.id)
    if (error) throw error
  }))

  checks.push(await runCheck('split_expenses table accessible', async () => {
    const { error } = await client
      .from('split_expenses')
      .select('id, group_id, user_id, paid_by_member_id, amount, split_method', { head: true, count: 'exact' })
      .eq('user_id', user.id)
    if (error) throw error
  }))

  checks.push(await runCheck('split_expense_splits table accessible', async () => {
    const { error } = await client
      .from('split_expense_splits')
      .select('id, expense_id, member_id, user_id, share', { head: true, count: 'exact' })
      .eq('user_id', user.id)
    if (error) throw error
  }))

  checks.push(await runCheck('split_settlements table accessible', async () => {
    const { error } = await client
      .from('split_settlements')
      .select('id, group_id, user_id, payer_member_id, payee_member_id, amount', { head: true, count: 'exact' })
      .eq('user_id', user.id)
    if (error) throw error
  }))

  checks.push(await runCheck('split_group_access table accessible', async () => {
    const { error } = await client
      .from('split_group_access')
      .select('id, group_id, user_id, role', { head: true, count: 'exact' })
      .eq('user_id', user.id)
    if (error) throw error
  }))

  checks.push(await runCheck('split_group_invites table accessible', async () => {
    const { error } = await client
      .from('split_group_invites')
      .select('id, group_id, token, created_by, consumed_by, revoked_at', { head: true, count: 'exact' })
      .eq('created_by', user.id)
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

  checks.push(await runCheck('split_create_expense RPC available', async () => {
    const { error } = await client.rpc('split_create_expense', {
      p_group_id: '00000000-0000-0000-0000-000000000000',
      p_paid_by_member_id: '00000000-0000-0000-0000-000000000000',
      p_description: 'readiness probe',
      p_amount: 1,
      p_expense_date: '1900-01-01',
      p_split_method: 'equal',
      p_notes: null,
      p_splits: [
        {
          member_id: '00000000-0000-0000-0000-000000000000',
          share: 1,
        },
      ],
    })

    if (!error) return
    assertNoMissingFunctionError(error, 'split_create_expense')
    const msg = String(error.message || '')
    if (
      msg.includes('Split group not found') ||
      msg.includes('Payer must be a member') ||
      msg.includes('Authentication required')
    ) {
      return
    }
    throw error
  }))

  checks.push(await runCheck('split_record_settlement RPC available', async () => {
    const { error } = await client.rpc('split_record_settlement', {
      p_group_id: '00000000-0000-0000-0000-000000000000',
      p_payer_member_id: '00000000-0000-0000-0000-000000000000',
      p_payee_member_id: '00000000-0000-0000-0000-000000000000',
      p_amount: 1,
      p_settled_at: '1900-01-01',
      p_note: 'probe',
    })

    if (!error) return
    assertNoMissingFunctionError(error, 'split_record_settlement')
    const msg = String(error.message || '')
    if (
      msg.includes('Split group not found') ||
      msg.includes('Payer and payee cannot be the same') ||
      msg.includes('Authentication required')
    ) {
      return
    }
    throw error
  }))

  checks.push(await runCheck('split_create_group_invite RPC available', async () => {
    const { error } = await client.rpc('split_create_group_invite', {
      p_group_id: '00000000-0000-0000-0000-000000000000',
      p_role: 'viewer',
    })

    if (!error) return
    assertNoMissingFunctionError(error, 'split_create_group_invite')
    const msg = String(error.message || '')
    if (
      msg.includes('Split group not found') ||
      msg.includes('Authentication required')
    ) {
      return
    }
    throw error
  }))

  checks.push(await runCheck('split_consume_group_invite RPC available', async () => {
    const { error } = await client.rpc('split_consume_group_invite', {
      p_token: 'readiness-probe-token',
    })

    if (!error) return
    assertNoMissingFunctionError(error, 'split_consume_group_invite')
    const msg = String(error.message || '')
    if (
      msg.includes('Invite not found or already used') ||
      msg.includes('Authentication required')
    ) {
      return
    }
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
