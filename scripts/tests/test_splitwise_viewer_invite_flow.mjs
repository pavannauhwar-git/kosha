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

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function cleanupGroup(client, userId, groupId) {
  if (!groupId) return

  const { error } = await client
    .from('split_groups')
    .delete()
    .eq('id', groupId)
    .eq('user_id', userId)

  if (error) {
    throw new Error(`Splitwise cleanup failed: ${error.message}`)
  }
}

async function main() {
  loadLocalEnv()

  const url = requireEnv('VITE_SUPABASE_URL')
  const anonKey = requireEnv('VITE_SUPABASE_ANON_KEY')
  const creatorEmail = requireEnv('E2E_CREATOR_EMAIL')
  const creatorPassword = requireEnv('E2E_CREATOR_PASSWORD')
  const joinerEmail = requireEnv('E2E_JOINER_EMAIL')
  const joinerPassword = requireEnv('E2E_JOINER_PASSWORD')

  const creatorClient = makeClient(url, anonKey)
  const joinerClient = makeClient(url, anonKey)

  const creator = await signIn(creatorClient, creatorEmail, creatorPassword, 'Creator')
  const joiner = await signIn(joinerClient, joinerEmail, joinerPassword, 'Joiner')

  if (creator.id === joiner.id) {
    throw new Error('Creator and joiner must be different users for splitwise viewer invite test')
  }

  let sharedGroupId = null
  let hiddenGroupId = null
  let creatorMemberId = null
  let seededExpenseId = null

  try {
    const groupName = `e2e-split-share-${Date.now()}`
    const hiddenGroupName = `${groupName}-hidden`

    const { data: group, error: groupError } = await creatorClient.rpc('split_create_group', {
      p_name: groupName,
      p_self_display_name: 'Creator'
    })

    if (groupError) throw new Error(`Create group failed: ${groupError.message}`)
    sharedGroupId = group.id

    const { data: hiddenGroup, error: hiddenGroupError } = await creatorClient.rpc('split_create_group', {
      p_name: hiddenGroupName,
      p_self_display_name: 'Creator'
    })

    if (hiddenGroupError) throw new Error(`Create hidden group failed: ${hiddenGroupError.message}`)
    hiddenGroupId = hiddenGroup.id

    const { data: creatorMember, error: creatorMemberError } = await creatorClient
      .from('split_group_members')
      .select('id')
      .eq('group_id', sharedGroupId)
      .eq('user_id', creator.id)
      .single()

    if (creatorMemberError) throw new Error(`Fetch owner member failed: ${creatorMemberError.message}`)
    creatorMemberId = creatorMember.id

    const { error: expenseError } = await creatorClient.rpc('split_create_expense', {
      p_group_id: sharedGroupId,
      p_paid_by_member_id: creatorMemberId,
      p_description: 'e2e share expense',
      p_amount: 42,
      p_expense_date: '2026-04-13',
      p_split_method: 'equal',
      p_notes: null,
      p_splits: [
        {
          member_id: creatorMemberId,
          share: 42,
        },
      ],
    })

    if (expenseError) throw new Error(`Seed owner expense failed: ${expenseError.message}`)

    const { data: seededExpenses, error: seededExpenseReadError } = await creatorClient
      .from('split_expenses')
      .select('id')
      .eq('group_id', sharedGroupId)
      .limit(1)

    if (seededExpenseReadError) throw new Error(`Read seeded expense failed: ${seededExpenseReadError.message}`)
    seededExpenseId = seededExpenses?.[0]?.id || null
    assert(!!seededExpenseId, 'Seeded expense id was not found')

    const { data: invite, error: inviteError } = await creatorClient.rpc('split_create_group_invite', {
      p_group_id: sharedGroupId,
      p_role: 'viewer',
    })

    if (inviteError) throw new Error(`Create group invite failed: ${inviteError.message}`)
    if (!invite?.token) throw new Error('Create group invite did not return token')

    const { data: consumedGroup, error: consumeError } = await joinerClient.rpc('split_consume_group_invite', {
      p_token: invite.token,
    })

    if (consumeError) throw new Error(`Consume group invite failed: ${consumeError.message}`)
    assert(consumedGroup?.id === sharedGroupId, 'Consumed invite did not return expected group')

    const { data: accessRow, error: accessError } = await joinerClient
      .from('split_group_access')
      .select('group_id, user_id, role')
      .eq('group_id', sharedGroupId)
      .eq('user_id', joiner.id)
      .single()

    if (accessError) throw new Error(`Fetch viewer access row failed: ${accessError.message}`)
    assert(accessRow.role === 'viewer', `Expected viewer role, got ${accessRow.role}`)

    const { data: visibleGroupRows, error: visibleGroupError } = await joinerClient
      .from('split_groups')
      .select('id')

    if (visibleGroupError) throw new Error(`Viewer group visibility query failed: ${visibleGroupError.message}`)
    const visibleGroupIds = new Set((visibleGroupRows || []).map((row) => row.id))
    assert(visibleGroupIds.has(sharedGroupId), 'Viewer could not see invited splitwise group')
    assert(!visibleGroupIds.has(hiddenGroupId), 'Viewer can see an unrelated group without access')

    const { data: visibleExpenses, error: visibleExpensesError } = await joinerClient
      .from('split_expenses')
      .select('id, group_id, amount')
      .eq('group_id', sharedGroupId)

    if (visibleExpensesError) throw new Error(`Viewer expense visibility query failed: ${visibleExpensesError.message}`)
    assert((visibleExpenses || []).length === 1, 'Viewer could not read group expenses')

    const { error: viewerWriteError } = await joinerClient.rpc('split_create_expense', {
      p_group_id: sharedGroupId,
      p_paid_by_member_id: creatorMemberId,
      p_description: 'viewer write attempt',
      p_amount: 1,
      p_expense_date: '2026-04-13',
      p_split_method: 'equal',
      p_notes: null,
      p_splits: [
        {
          member_id: creatorMemberId,
          share: 1,
        },
      ],
    })

    assert(!!viewerWriteError, 'Viewer should not be able to create splitwise expenses')

    const writeMessage = String(viewerWriteError?.message || '')
    assert(
      writeMessage.includes('Split group not found') || writeMessage.includes('row-level security') || writeMessage.includes('permission'),
      `Unexpected viewer write error: ${writeMessage}`
    )

    const { data: promotedAccessRow, error: promoteError } = await creatorClient.rpc('split_set_group_access_role', {
      p_group_id: sharedGroupId,
      p_user_id: joiner.id,
      p_role: 'owner',
    })

    if (promoteError) throw new Error(`Promote member to owner failed: ${promoteError.message}`)
    assert(promotedAccessRow?.role === 'owner', 'Role promotion RPC did not return owner role')

    const { data: promotedAccess, error: promotedAccessError } = await joinerClient
      .from('split_group_access')
      .select('role')
      .eq('group_id', sharedGroupId)
      .eq('user_id', joiner.id)
      .single()

    if (promotedAccessError) throw new Error(`Fetch promoted access row failed: ${promotedAccessError.message}`)
    assert(promotedAccess.role === 'owner', `Expected owner role after promotion, got ${promotedAccess.role}`)

    const { data: coOwnerInvite, error: coOwnerInviteError } = await joinerClient.rpc('split_create_group_invite', {
      p_group_id: sharedGroupId,
      p_role: 'viewer',
    })

    if (coOwnerInviteError) throw new Error(`Co-owner failed to create invite: ${coOwnerInviteError.message}`)
    assert(!!coOwnerInvite?.token, 'Co-owner invite did not return token')

    const { error: coOwnerDeleteError } = await joinerClient
      .from('split_expenses')
      .delete()
      .eq('id', seededExpenseId)

    if (coOwnerDeleteError) throw new Error(`Co-owner failed to delete expense: ${coOwnerDeleteError.message}`)

    console.log('PASS: splitwise invite roles are healthy (viewer read-only + admin promotion + scoped visibility).')
  } finally {
    try {
      await cleanupGroup(creatorClient, creator.id, sharedGroupId)
      await cleanupGroup(creatorClient, creator.id, hiddenGroupId)
    } catch (cleanupError) {
      console.warn(`WARN: splitwise viewer invite cleanup failed: ${cleanupError.message}`)
    }

    await Promise.all([
      creatorClient.auth.signOut(),
      joinerClient.auth.signOut(),
    ])
  }
}

main().catch((error) => {
  console.error('FAIL: test:splitwise-viewer-invite-flow')
  console.error(error.message)
  process.exit(1)
})
