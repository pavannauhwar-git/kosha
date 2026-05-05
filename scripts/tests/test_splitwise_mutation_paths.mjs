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

function round2(value) {
  const n = Number(value || 0)
  return Math.round((n + Number.EPSILON) * 100) / 100
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function cleanupSplitwiseGroup(client, userId, groupId) {
  if (!groupId) return

  const { error: settlementsError } = await client
    .from('split_settlements')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', userId)
  if (settlementsError) throw new Error(`Splitwise cleanup (settlements) failed: ${settlementsError.message}`)

  const { error: expensesError } = await client
    .from('split_expenses')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', userId)
  if (expensesError) throw new Error(`Splitwise cleanup (expenses) failed: ${expensesError.message}`)

  const { error: membersError } = await client
    .from('split_group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', userId)
  if (membersError) throw new Error(`Splitwise cleanup (members) failed: ${membersError.message}`)

  const { error: groupError } = await client
    .from('split_groups')
    .delete()
    .eq('id', groupId)
    .eq('user_id', userId)
  if (groupError) throw new Error(`Splitwise cleanup (group) failed: ${groupError.message}`)
}

async function main() {
  loadLocalEnv()

  const url = requireEnv('VITE_SUPABASE_URL')
  const anonKey = requireEnv('VITE_SUPABASE_ANON_KEY')
  const email = requireEnv('E2E_SESSION_EMAIL')
  const password = requireEnv('E2E_SESSION_PASSWORD')

  const client = makeClient(url, anonKey)
  const user = await signIn(client, email, password, 'Session')

  const prefix = `e2e-splitwise-${Date.now()}`
  let groupId = null
  let selfMemberId = null
  let friendMemberId = null

  try {
    const { data: groupRow, error: groupError } = await client.rpc('split_create_group', {
      p_name: `${prefix}-group`,
      p_self_display_name: `${prefix}-self`
    })

    if (groupError) throw new Error(`Create split group failed: ${groupError.message}`)
    groupId = groupRow.id

    // The RPC creates the self member automatically, so we need to fetch its ID
    const { data: selfMember, error: selfMemberError } = await client
      .from('split_group_members')
      .select('id')
      .eq('group_id', groupId)
      .eq('user_id', user.id)
      .single()

    if (selfMemberError) throw new Error(`Fetch self member failed: ${selfMemberError.message}`)
    selfMemberId = selfMember.id

    const { data: friendMember, error: friendMemberError } = await client
      .from('split_group_members')
      .insert({
        group_id: groupId,
        display_name: `${prefix}-friend`,
        is_self: false,
        user_id: user.id,
      })
      .select('id')
      .single()

    if (friendMemberError) throw new Error(`Create friend member failed: ${friendMemberError.message}`)
    friendMemberId = friendMember.id

    // Create expense mutation path (same RPC used by addSplitExpenseMutation)
    const { data: expenseRow, error: expenseError } = await client.rpc('split_create_expense', {
      p_group_id: groupId,
      p_paid_by_member_id: selfMemberId,
      p_description: `${prefix}-expense`,
      p_amount: 120,
      p_expense_date: '2026-04-13',
      p_split_method: 'equal',
      p_notes: 'integration test expense',
      p_splits: [
        { member_id: selfMemberId, share: 60 },
        { member_id: friendMemberId, share: 60 },
      ],
    })

    if (expenseError) throw new Error(`split_create_expense failed: ${expenseError.message}`)
    assert(!!expenseRow?.id, 'split_create_expense did not return expense id')

    const { data: splitRows, error: splitRowsError } = await client
      .from('split_expense_splits')
      .select('member_id, share')
      .eq('expense_id', expenseRow.id)
      .eq('user_id', user.id)

    if (splitRowsError) throw new Error(`Fetch split rows failed: ${splitRowsError.message}`)
    assert((splitRows || []).length === 2, 'Expected exactly 2 split rows for expense')

    const splitTotal = round2((splitRows || []).reduce((sum, row) => sum + Number(row.share || 0), 0))
    assert(splitTotal === 120, `Split total mismatch. Expected 120, got ${splitTotal}`)

    const { data: balancesAfterExpense, error: balanceExpenseError } = await client.rpc('split_group_balances', {
      p_group_id: groupId,
      p_user_id: user.id,
    })

    if (balanceExpenseError) throw new Error(`split_group_balances after expense failed: ${balanceExpenseError.message}`)

    const selfAfterExpense = round2((balancesAfterExpense || []).find((row) => row.member_id === selfMemberId)?.net || 0)
    const friendAfterExpense = round2((balancesAfterExpense || []).find((row) => row.member_id === friendMemberId)?.net || 0)
    assert(selfAfterExpense === 60, `Expected self balance +60 after expense, got ${selfAfterExpense}`)
    assert(friendAfterExpense === -60, `Expected friend balance -60 after expense, got ${friendAfterExpense}`)

    // Settlement mutation path (same RPC used by recordSplitSettlementMutation)
    const { data: settlementRow, error: settlementError } = await client.rpc('split_record_settlement', {
      p_group_id: groupId,
      p_payer_member_id: friendMemberId,
      p_payee_member_id: selfMemberId,
      p_amount: 30,
      p_settled_at: '2026-04-13',
      p_note: 'integration test settlement',
    })

    if (settlementError) throw new Error(`split_record_settlement failed: ${settlementError.message}`)
    assert(!!settlementRow?.id, 'split_record_settlement did not return settlement id')

    const { data: balancesAfterSettlement, error: balanceSettlementError } = await client.rpc('split_group_balances', {
      p_group_id: groupId,
      p_user_id: user.id,
    })

    if (balanceSettlementError) throw new Error(`split_group_balances after settlement failed: ${balanceSettlementError.message}`)

    const selfAfterSettlement = round2((balancesAfterSettlement || []).find((row) => row.member_id === selfMemberId)?.net || 0)
    const friendAfterSettlement = round2((balancesAfterSettlement || []).find((row) => row.member_id === friendMemberId)?.net || 0)
    assert(selfAfterSettlement === 30, `Expected self balance +30 after settlement, got ${selfAfterSettlement}`)
    assert(friendAfterSettlement === -30, `Expected friend balance -30 after settlement, got ${friendAfterSettlement}`)

    console.log('PASS: splitwise create-expense and settlement mutation paths are healthy.')
  } finally {
    try {
      await cleanupSplitwiseGroup(client, user.id, groupId)
    } catch (cleanupError) {
      console.warn(`WARN: splitwise cleanup failed: ${cleanupError.message}`)
    }

    await client.auth.signOut()
  }
}

main().catch((error) => {
  console.error('FAIL: test:splitwise-mutation-paths')
  console.error(error.message)
  process.exit(1)
})
