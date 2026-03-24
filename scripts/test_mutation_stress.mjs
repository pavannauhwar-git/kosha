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

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

async function cleanupTransactions(client, prefix, userId) {
  const { error } = await client
    .from('transactions')
    .delete()
    .eq('user_id', userId)
    .ilike('description', `${prefix}%`)

  if (error) throw new Error(`Transaction cleanup failed: ${error.message}`)
}

async function cleanupLiabilities(client, prefix, userId) {
  const { error } = await client
    .from('liabilities')
    .delete()
    .eq('user_id', userId)
    .ilike('description', `${prefix}%`)

  if (error) throw new Error(`Liability cleanup failed: ${error.message}`)
}

async function assertNoTaggedRows(client, prefix, userId) {
  const [{ count: txnCount, error: txnErr }, { count: billCount, error: billErr }] = await Promise.all([
    client
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .ilike('description', `${prefix}%`),
    client
      .from('liabilities')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .ilike('description', `${prefix}%`),
  ])

  if (txnErr) throw new Error(`Transaction verification failed: ${txnErr.message}`)
  if (billErr) throw new Error(`Liability verification failed: ${billErr.message}`)

  if ((txnCount || 0) !== 0 || (billCount || 0) !== 0) {
    throw new Error(`Tagged row leak detected (transactions=${txnCount || 0}, liabilities=${billCount || 0})`)
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

  const prefix = `e2e-stress-${Date.now()}`
  const date = todayISO()

  console.log('Running transaction mutation stress...')

  const insertedTxnIds = []
  const insertedBillIds = []

  try {
    for (let i = 0; i < 8; i += 1) {
      const { data, error } = await client
        .from('transactions')
        .insert({
          user_id: user.id,
          type: i % 2 === 0 ? 'expense' : 'income',
          amount: 100 + i,
          description: `${prefix}-txn-${i}`,
          category: i % 2 === 0 ? 'food' : 'salary',
          date,
          payment_mode: 'upi',
          is_repayment: false,
        })
        .select('id')
        .single()

      if (error) throw new Error(`Insert transaction ${i} failed: ${error.message}`)
      insertedTxnIds.push(data.id)
    }

    for (let i = 0; i < insertedTxnIds.length; i += 1) {
      const id = insertedTxnIds[i]
      const { error } = await client
        .from('transactions')
        .update({ amount: 200 + i, description: `${prefix}-txn-updated-${i}` })
        .eq('id', id)
        .eq('user_id', user.id)

      if (error) throw new Error(`Update transaction ${i} failed: ${error.message}`)
    }

    for (let i = 0; i < insertedTxnIds.length; i += 1) {
      const id = insertedTxnIds[i]
      const { error } = await client
        .from('transactions')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)

      if (error) throw new Error(`Delete transaction ${i} failed: ${error.message}`)
    }

    console.log('Running liabilities mutation stress...')

    for (let i = 0; i < 6; i += 1) {
      const { data, error } = await client
        .from('liabilities')
        .insert({
          user_id: user.id,
          description: `${prefix}-bill-${i}`,
          amount: 300 + i,
          due_date: date,
          is_recurring: false,
          recurrence: null,
          paid: false,
        })
        .select('id')
        .single()

      if (error) throw new Error(`Insert liability ${i} failed: ${error.message}`)
      insertedBillIds.push(data.id)
    }

    for (let i = 0; i < 3; i += 1) {
      const liabilityId = insertedBillIds[i]
      const { error } = await client.rpc('mark_liability_paid', {
        p_liability_id: liabilityId,
        p_user_id: user.id,
      })
      if (error) throw new Error(`Mark paid ${i} failed: ${error.message}`)
    }

    await cleanupLiabilities(client, prefix, user.id)
    await cleanupTransactions(client, prefix, user.id)
    await assertNoTaggedRows(client, prefix, user.id)

    console.log('PASS: mutation stress flow completed with clean final state.')
  } finally {
    try {
      await cleanupTransactions(client, prefix, user.id)
    } catch (e) {
      console.warn('WARN: transaction cleanup in finally failed:', e.message)
    }
    try {
      await cleanupLiabilities(client, prefix, user.id)
    } catch (e) {
      console.warn('WARN: liability cleanup in finally failed:', e.message)
    }
    await client.auth.signOut()
  }
}

main().catch((error) => {
  console.error('FAIL: test:mutation-stress')
  console.error(error.message)
  process.exit(1)
})
