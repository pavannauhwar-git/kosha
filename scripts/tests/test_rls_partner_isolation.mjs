import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { loadLocalEnv } from '../load_env.mjs'

function requireEnv(name) {
  const value = process.env[name]
  if (!value) throw new Error(`Missing env var: ${name}`)
  return value
}

function makeClient(url, anonKey) {
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

async function signIn(client, email, password, label) {
  const { data, error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`${label} sign-in failed: ${error.message}`)
  if (!data?.user?.id) throw new Error(`${label} sign-in returned no user id`)
  return data.user
}

async function linkWallets(creatorClient, joinerClient, creatorUser, _joinerUser) {
  const inviteToken = `rls-${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`
  
  // 1. Create invite
  const { error: createError } = await creatorClient
    .from('invites')
    .insert({ token: inviteToken, created_by: creatorUser.id })
  
  if (createError) throw new Error(`Invite insert failed: ${createError.message}`)
  
  // 2. Consume invite
  const { data, error: consumeError } = await joinerClient.rpc('consume_wallet_invite', {
    p_token: inviteToken
  })
  
  if (consumeError) throw new Error(`Invite consume failed: ${consumeError.message}`)
  if (!data?.consumed) throw new Error(`Invite consume returned false: ${JSON.stringify(data)}`)

  return inviteToken
}

async function main() {
  loadLocalEnv()

  const url = requireEnv('VITE_SUPABASE_URL')
  const anonKey = requireEnv('VITE_SUPABASE_ANON_KEY')
  
  const creatorEmail = requireEnv('E2E_CREATOR_EMAIL')
  const creatorPassword = requireEnv('E2E_CREATOR_PASSWORD')
  const joinerEmail = requireEnv('E2E_JOINER_EMAIL')
  const joinerPassword = requireEnv('E2E_JOINER_PASSWORD')
  const strangerEmail = requireEnv('E2E_SESSION_EMAIL')
  const strangerPassword = requireEnv('E2E_SESSION_PASSWORD')

  const ownerClient = makeClient(url, anonKey)
  const partnerClient = makeClient(url, anonKey)
  const strangerClient = makeClient(url, anonKey)

  console.log('Signing in Owner...')
  const ownerUser = await signIn(ownerClient, creatorEmail, creatorPassword, 'Owner')
  console.log('Signing in Partner...')
  const partnerUser = await signIn(partnerClient, joinerEmail, joinerPassword, 'Partner')
  console.log('Signing in Stranger...')
  const strangerUser = await signIn(strangerClient, strangerEmail, strangerPassword, 'Stranger')

  if (new Set([ownerUser.id, partnerUser.id, strangerUser.id]).size !== 3) {
    throw new Error('E2E_CREATOR_EMAIL, E2E_JOINER_EMAIL and E2E_SESSION_EMAIL must be three different accounts')
  }

  const testTxnId = crypto.randomUUID()
  const testDesc = `RLS Test ${testTxnId}`
  const testLiabilityId = crypto.randomUUID()
  const testLoanId = crypto.randomUUID()
  let inviteToken = null

  try {
    console.log('\nEnsuring Owner and Partner are linked...')
    inviteToken = await linkWallets(ownerClient, partnerClient, ownerUser, partnerUser)

    // 1. Owner writes data
    console.log('\n[TEST] Owner inserts transaction...')
    const { error: insertErr } = await ownerClient.from('transactions').insert({
      id: testTxnId,
      user_id: ownerUser.id,
      amount: 99.99,
      type: 'expense',
      date: new Date().toISOString().split('T')[0],
      description: testDesc,
    })
    if (insertErr) throw new Error(`Owner insert failed: ${insertErr.message}`)
    console.log('  ✓ Success')

    // 2. Partner reads data
    console.log('[TEST] Partner attempts to read Owner\'s transaction...')
    const { data: partnerRead, error: partnerReadErr } = await partnerClient
      .from('transactions')
      .select('id, amount')
      .eq('id', testTxnId)
    if (partnerReadErr) throw new Error(`Partner read failed: ${partnerReadErr.message}`)
    if (partnerRead?.length !== 1) throw new Error('Partner could not read the transaction!')
    console.log('  ✓ Success (Partner read allowed)')

    // 3. Stranger reads data
    console.log('[TEST] Stranger attempts to read Owner\'s transaction...')
    const { data: strangerRead, error: strangerReadErr } = await strangerClient
      .from('transactions')
      .select('id, amount')
      .eq('id', testTxnId)
    if (strangerReadErr) throw new Error(`Stranger read failed: ${strangerReadErr.message}`)
    if (strangerRead?.length > 0) throw new Error('SECURITY FAILURE: Stranger was able to read Owner data!')
    console.log('  ✓ Success (Stranger read blocked)')

    // 3b. Partner attempts INSERT into Owner's wallet
    console.log('[TEST] Partner attempts to insert a transaction into Owner\'s wallet...')
    const partnerInsertId = crypto.randomUUID()
    const { error: partnerInsertErr } = await partnerClient.from('transactions').insert({
      id: partnerInsertId,
      user_id: ownerUser.id,
      amount: 1,
      type: 'expense',
      date: new Date().toISOString().split('T')[0],
      description: `${testDesc} partner insert`,
    })
    if (!partnerInsertErr) {
      await ownerClient.from('transactions').delete().eq('id', partnerInsertId)
      throw new Error('SECURITY FAILURE: Partner was able to insert into Owner\'s wallet!')
    }
    console.log('  ✓ Success (Partner insert blocked)')

    // 3c. Stranger calls the payment RPCs on Owner's bill and loan
    const today = new Date().toISOString().split('T')[0]
    const { error: liabilityErr } = await ownerClient.from('liabilities').insert({
      id: testLiabilityId, user_id: ownerUser.id, description: `${testDesc} bill`, amount: 10, due_date: today,
    })
    if (liabilityErr) throw new Error(`Owner liability insert failed: ${liabilityErr.message}`)
    const { error: loanErr } = await ownerClient.from('loans').insert({
      id: testLoanId, user_id: ownerUser.id, direction: 'given', counterparty: `${testDesc} loan`, amount: 10,
    })
    if (loanErr) throw new Error(`Owner loan insert failed: ${loanErr.message}`)

    console.log('[TEST] Stranger attempts mark_liability_paid on Owner\'s bill...')
    const { error: strangerPayErr } = await strangerClient.rpc('mark_liability_paid', {
      p_liability_id: testLiabilityId, p_user_id: ownerUser.id,
    })
    if (!strangerPayErr) throw new Error('SECURITY FAILURE: Stranger was able to mark Owner\'s bill paid!')
    console.log('  ✓ Success (mark_liability_paid blocked)')

    console.log('[TEST] Stranger attempts record_loan_payment on Owner\'s loan...')
    const { error: strangerLoanErr } = await strangerClient.rpc('record_loan_payment', {
      p_loan_id: testLoanId, p_user_id: ownerUser.id, p_amount: 5,
    })
    if (!strangerLoanErr) throw new Error('SECURITY FAILURE: Stranger was able to record a payment on Owner\'s loan!')
    console.log('  ✓ Success (record_loan_payment blocked)')

    const { data: billAfter } = await ownerClient.from('liabilities').select('paid').eq('id', testLiabilityId).single()
    const { data: loanAfter } = await ownerClient.from('loans').select('amount_settled').eq('id', testLoanId).single()
    if (billAfter?.paid !== false) throw new Error('SECURITY FAILURE: Owner\'s bill changed after stranger RPC call!')
    if (Number(loanAfter?.amount_settled) !== 0) throw new Error('SECURITY FAILURE: Owner\'s loan changed after stranger RPC call!')

    // 4. Partner attempts UPDATE
    console.log('[TEST] Partner attempts to update Owner\'s transaction...')
    const { data: partnerUpdate, error: partnerUpdateErr } = await partnerClient
      .from('transactions')
      .update({ amount: 100.00 })
      .eq('id', testTxnId)
      .select()
    if (partnerUpdateErr) throw new Error(`Partner update error: ${partnerUpdateErr.message}`)
    if (partnerUpdate?.length > 0) throw new Error('SECURITY FAILURE: Partner was able to update Owner data!')
    console.log('  ✓ Success (Partner update blocked)')

    // 5. Partner attempts DELETE
    console.log('[TEST] Partner attempts to delete Owner\'s transaction...')
    const { data: partnerDelete, error: partnerDeleteErr } = await partnerClient
      .from('transactions')
      .delete()
      .eq('id', testTxnId)
      .select()
    if (partnerDeleteErr) throw new Error(`Partner delete error: ${partnerDeleteErr.message}`)
    if (partnerDelete?.length > 0) throw new Error('SECURITY FAILURE: Partner was able to delete Owner data!')
    console.log('  ✓ Success (Partner delete blocked)')

  } finally {
    // 6. Owner cleans up
    console.log('\n[CLEANUP] Owner deletes transaction...')
    await ownerClient.from('transactions').delete().eq('id', testTxnId)
    await ownerClient.from('liabilities').delete().eq('id', testLiabilityId)
    await ownerClient.from('loans').delete().eq('id', testLoanId)
    console.log('  ✓ Done')

    if (inviteToken) {
      console.log('[CLEANUP] Owner unlinks partner...')
      await ownerClient.from('invites').delete().eq('token', inviteToken)
      console.log('  ✓ Done')
    }
  }

  console.log('\nPASS: RLS partner isolation test complete. Data is fully isolated and secure.')
}

main().catch((error) => {
  console.error('\nFAIL: test:rls-partner-isolation')
  console.error(error.message)
  process.exit(1)
})
