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

async function signIn(client, email, password) {
  const { data, error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`Session sign-in failed: ${error.message}`)
  if (!data?.user?.id) throw new Error('Session sign-in returned no user id')
  return data.user
}

function isMissingReconciliationTableError(error) {
  const message = String(error?.message || '')
  return (
    message.includes('reconciliation_reviews') &&
    (message.includes('Could not find the table') || message.includes('does not exist'))
  )
}

async function main() {
  loadLocalEnv()

  const url = requireEnv('VITE_SUPABASE_URL')
  const anonKey = requireEnv('VITE_SUPABASE_ANON_KEY')
  const email = requireEnv('E2E_SESSION_EMAIL')
  const password = requireEnv('E2E_SESSION_PASSWORD')

  const client = makeClient(url, anonKey)
  const user = await signIn(client, email, password)

  const tag = `e2e-recon-${Date.now()}`
  const date = new Date().toISOString().slice(0, 10)

  let txnId = null

  try {
    const { data: txn, error: insertTxnError } = await client
      .from('transactions')
      .insert({
        user_id: user.id,
        type: 'expense',
        amount: 431,
        description: `${tag}-txn`,
        category: 'food',
        date,
        payment_mode: 'upi',
        is_repayment: false,
      })
      .select('id')
      .single()

    if (insertTxnError) throw new Error(`Transaction insert failed: ${insertTxnError.message}`)
    txnId = txn.id

    const { error: upsertReviewError } = await client
      .from('reconciliation_reviews')
      .upsert({
        user_id: user.id,
        transaction_id: txnId,
        status: 'linked',
        statement_line: `${date}, BLINKBASKET, 431.00`,
      }, { onConflict: 'user_id,transaction_id' })

    if (upsertReviewError) {
      if (isMissingReconciliationTableError(upsertReviewError)) {
        console.log('SKIP: reconciliation_reviews not available in this environment yet.')
        return
      }
      throw new Error(`Review upsert failed: ${upsertReviewError.message}`)
    }

    const { data: reviewRows, error: selectReviewError } = await client
      .from('reconciliation_reviews')
      .select('transaction_id, status, statement_line')
      .eq('user_id', user.id)
      .eq('transaction_id', txnId)

    if (selectReviewError) throw new Error(`Review read failed: ${selectReviewError.message}`)
    if (!Array.isArray(reviewRows) || reviewRows.length !== 1) {
      throw new Error('Expected exactly one reconciliation review row')
    }
    if (reviewRows[0].status !== 'linked') throw new Error('Expected linked status')
    if (!reviewRows[0].statement_line) throw new Error('Expected statement_line to be saved')

    const { error: clearAliasError } = await client
      .from('reconciliation_reviews')
      .update({ statement_line: null })
      .eq('user_id', user.id)
      .eq('transaction_id', txnId)

    if (clearAliasError) throw new Error(`Alias clear update failed: ${clearAliasError.message}`)

    const { data: afterRows, error: afterError } = await client
      .from('reconciliation_reviews')
      .select('statement_line')
      .eq('user_id', user.id)
      .eq('transaction_id', txnId)
      .single()

    if (afterError) throw new Error(`Post-clear read failed: ${afterError.message}`)
    if (afterRows.statement_line !== null) throw new Error('Expected statement_line to be null after reset')

    console.log('PASS: reconciliation review flow persisted and reset alias memory successfully.')
  } finally {
    if (txnId) {
      await client
        .from('reconciliation_reviews')
        .delete()
        .eq('user_id', user.id)
        .eq('transaction_id', txnId)

      await client
        .from('transactions')
        .delete()
        .eq('user_id', user.id)
        .eq('id', txnId)
    }

    await client.auth.signOut()
  }
}

main().catch((error) => {
  console.error('FAIL: test:reconciliation-flow')
  console.error(error.message)
  process.exit(1)
})
