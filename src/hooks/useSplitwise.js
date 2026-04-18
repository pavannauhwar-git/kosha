import { useMemo, useEffect } from 'react'
import { useQueries } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queryClient, evictSwCacheEntries } from '../lib/queryClient'
import { getAuthUserId } from '../lib/authStore'
import { suppress } from '../lib/mutationGuard'
import { traceQuery } from '../lib/queryTrace'
import { FINANCIAL_EVENT_ACTIONS, logFinancialEvent } from '../lib/auditLog'
import {
  round2,
  buildEqualSplits,
  buildExactSplits,
  buildPercentSplits,
  buildShareSplits,
  buildSimplifiedTransfers,
  computeMemberBalances,
} from '../lib/splitwiseMath'

export {
  round2,
  buildEqualSplits,
  buildExactSplits,
  buildPercentSplits,
  buildShareSplits,
  buildSimplifiedTransfers,
}

export const SPLITWISE_INVALIDATION_KEYS = [['splitwise']]

const splitGroupsKey = (userId) => ['splitwise', 'groups', userId || 'anon']
const splitGroupAccessKey = (userId) => ['splitwise', 'group-access', userId || 'anon']
const splitGroupMembersAccessKey = (groupId) => ['splitwise', 'group-member-access', groupId || 'none']
const splitMembersKey = (groupId) => ['splitwise', 'members', groupId || 'none']
const splitExpensesKey = (groupId) => ['splitwise', 'expenses', groupId || 'none']
const splitSettlementsKey = (groupId) => ['splitwise', 'settlements', groupId || 'none']

const GROUP_COLUMNS = 'id, name, created_at, updated_at, user_id, is_archived, banner_id'
const ACCESS_COLUMNS = 'group_id, role'
const GROUP_ACCESS_COLUMNS = 'id, group_id, user_id, role'
const MEMBER_COLUMNS = 'id, group_id, display_name, is_self, linked_user_id, created_at'
const EXPENSE_COLUMNS =
  'id, group_id, paid_by_member_id, description, amount, expense_date, split_method, notes, created_at, split_expense_splits(id, member_id, share, percent, shares)'
const SETTLEMENT_COLUMNS =
  'id, group_id, payer_member_id, payee_member_id, amount, settled_at, note, created_at'
const EMPTY_ROWS = []

function runInBackground(promise, scope) {
  void promise.catch((error) => {
    console.warn(`[Kosha] ${scope} background refresh failed`, error)
  })
}

async function resolveMutationUserId() {
  let storeUserId = null
  try {
    storeUserId = getAuthUserId()
  } catch {
    storeUserId = null
  }

  const { data, error } = await supabase.auth.getUser()
  const liveUserId = data?.user?.id || null

  if (liveUserId) return liveUserId
  if (storeUserId) return storeUserId
  if (error) throw error
  throw new Error('Not signed in')
}

async function fetchGroups() {
  return traceQuery('splitwise:groups', async () => {
    const { data, error } = await supabase
      .from('split_groups')
      .select(GROUP_COLUMNS)
      .order('updated_at', { ascending: false })

    if (error) throw error
    return data || []
  })
}

async function fetchGroupAccess() {
  const userId = getAuthUserId()
  if (!userId) return []

  return traceQuery('splitwise:group-access', async () => {
    const { data, error } = await supabase
      .from('split_group_access')
      .select(ACCESS_COLUMNS)
      .eq('user_id', userId)

    if (error) throw error
    return data || []
  })
}

async function fetchGroupMemberAccess(groupId) {
  if (!groupId) return []

  return traceQuery('splitwise:group-member-access', async () => {
    const { data, error } = await supabase
      .from('split_group_access')
      .select(GROUP_ACCESS_COLUMNS)
      .eq('group_id', groupId)

    if (error) throw error
    return data || []
  })
}

async function fetchMembers(groupId) {
  if (!groupId) return []
  return traceQuery('splitwise:members', async () => {
    const { data, error } = await supabase
      .from('split_group_members')
      .select(MEMBER_COLUMNS)
      .eq('group_id', groupId)
      .order('created_at', { ascending: true })

    if (error) throw error
    return data || []
  })
}

async function fetchExpenses(groupId) {
  if (!groupId) return []
  return traceQuery('splitwise:expenses', async () => {
    const { data, error } = await supabase
      .from('split_expenses')
      .select(EXPENSE_COLUMNS)
      .eq('group_id', groupId)
      .order('expense_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  })
}

async function fetchSettlements(groupId) {
  if (!groupId) return []
  return traceQuery('splitwise:settlements', async () => {
    const { data, error } = await supabase
      .from('split_settlements')
      .select(SETTLEMENT_COLUMNS)
      .eq('group_id', groupId)
      .order('settled_at', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  })
}

export async function invalidateSplitwiseCache() {
  suppress('splitwise')
  await Promise.all([
    evictSwCacheEntries('/split_groups'),
    evictSwCacheEntries('/split_group_access'),
    evictSwCacheEntries('/split_group_members'),
    evictSwCacheEntries('/split_group_invites'),
    evictSwCacheEntries('/split_expenses'),
    evictSwCacheEntries('/split_expense_splits'),
    evictSwCacheEntries('/split_settlements'),
  ])
  await queryClient.invalidateQueries({ queryKey: ['splitwise'], refetchType: 'active' })
  import('./useTransactions').then(m => m.invalidateCache()).catch(() => {})
}

export function useSplitwise({ groupId, enabled = true } = {}) {
  const userId = getAuthUserId()

  const [groupsQuery, accessQuery, groupAccessQuery, membersQuery, expensesQuery, settlementsQuery] = useQueries({
    queries: [
      {
        queryKey: splitGroupsKey(userId),
        queryFn: fetchGroups,
        enabled: enabled && !!userId,
        placeholderData: (prev) => prev,
      },
      {
        queryKey: splitGroupAccessKey(userId),
        queryFn: fetchGroupAccess,
        enabled: enabled && !!userId,
        placeholderData: (prev) => prev,
      },
      {
        queryKey: splitGroupMembersAccessKey(groupId),
        queryFn: () => fetchGroupMemberAccess(groupId),
        enabled: enabled && !!groupId,
        placeholderData: (prev) => prev,
      },
      {
        queryKey: splitMembersKey(groupId),
        queryFn: () => fetchMembers(groupId),
        enabled: enabled && !!groupId,
        placeholderData: (prev) => prev,
      },
      {
        queryKey: splitExpensesKey(groupId),
        queryFn: () => fetchExpenses(groupId),
        enabled: enabled && !!groupId,
        placeholderData: (prev) => prev,
      },
      {
        queryKey: splitSettlementsKey(groupId),
        queryFn: () => fetchSettlements(groupId),
        enabled: enabled && !!groupId,
        placeholderData: (prev) => prev,
      },
    ],
  })

  const rawGroups = groupsQuery.data ?? EMPTY_ROWS
  const accessRows = accessQuery.data ?? EMPTY_ROWS
  const accessByGroupId = useMemo(
    () => new Map((accessRows || []).map((row) => [row.group_id, row.role])),
    [accessRows]
  )

  const groups = useMemo(
    () => (rawGroups || []).map((group) => {
      const role = accessByGroupId.get(group.id)
      return {
        ...group,
        my_role: role || (group.user_id === userId ? 'admin' : null),
      }
    }),
    [rawGroups, accessByGroupId, userId]
  )

  const members = membersQuery.data ?? EMPTY_ROWS
  const groupAccessRows = groupAccessQuery.data ?? EMPTY_ROWS
  const expenses = expensesQuery.data ?? EMPTY_ROWS
  const settlements = settlementsQuery.data ?? EMPTY_ROWS

  const balances = useMemo(() => {
    const memberMap = new Map((members || []).map((member) => [member.id, member]))
    const balanceMap = computeMemberBalances(members, expenses, settlements)

    return [...balanceMap.entries()]
      .map(([memberId, net]) => ({
        member: memberMap.get(memberId) || null,
        net: round2(net),
      }))
      .sort((a, b) => Number(b.net) - Number(a.net))
  }, [members, expenses, settlements])

  const suggestedTransfers = useMemo(() => buildSimplifiedTransfers(balances), [balances])

  return {
    groups,
    members,
    groupAccessRows,
    expenses,
    settlements,
    balances,
    suggestedTransfers,
    loading: groupsQuery.isLoading || accessQuery.isLoading || groupAccessQuery.isLoading || membersQuery.isLoading || expensesQuery.isLoading || settlementsQuery.isLoading,
    groupsLoading: groupsQuery.isLoading,
    accessLoading: accessQuery.isLoading,
    groupAccessLoading: groupAccessQuery.isLoading,
    membersLoading: membersQuery.isLoading,
    expensesLoading: expensesQuery.isLoading,
    settlementsLoading: settlementsQuery.isLoading,
    error: groupsQuery.error || accessQuery.error || groupAccessQuery.error || membersQuery.error || expensesQuery.error || settlementsQuery.error || null,
  }
}

export async function createSplitGroupMutation({ name, selfDisplayName = 'You' }) {
  const userId = await resolveMutationUserId()
  const cleanName = String(name || '').trim()
  const cleanSelfName = String(selfDisplayName || '').trim() || 'You'
  if (!cleanName) throw new Error('Group name is required.')

  const { data: rpcGroup, error: rpcError } = await supabase.rpc('split_create_group', {
    p_name: cleanName,
    p_self_display_name: cleanSelfName,
  })

  if (!rpcError && rpcGroup?.id) {
    runInBackground(
      logFinancialEvent({
        userId,
        action: FINANCIAL_EVENT_ACTIONS.SPLITWISE_GROUP_ADD,
        entityType: 'split_group',
        entityId: rpcGroup.id,
        metadata: { name: cleanName },
      }),
      'splitwise group audit'
    )

    await invalidateSplitwiseCache()
    return rpcGroup
  }

  const rpcMessage = String(rpcError?.message || '').toLowerCase()
  const rpcMissing =
    rpcMessage.includes('could not find the function public.split_create_group') ||
    rpcMessage.includes('function public.split_create_group')

  if (rpcMissing) {
    throw new Error('Splitwise schema is outdated. Run latest supabase/schema.sql so split_create_group is available, then retry.')
  }

  if (rpcError) {
    if (rpcMessage.includes('row-level security') || rpcMessage.includes('permission policy')) {
      throw new Error('Could not create group due to permission policy. Please sign out/in once and ensure latest splitwise schema is applied in Supabase.')
    }
    throw rpcError
  }

  throw new Error('Could not create group. Please ensure latest splitwise schema is applied in Supabase and retry.')
}

export async function addSplitMemberMutation({ groupId, displayName, linkedUserId = null, isSelf = false }) {
  const userId = getAuthUserId()
  const cleanName = String(displayName || '').trim()
  if (!groupId) throw new Error('Group is required.')
  if (!cleanName) throw new Error('Member name is required.')

  const { data, error } = await supabase
    .from('split_group_members')
    .insert({
      group_id: groupId,
      display_name: cleanName,
      linked_user_id: linkedUserId,
      is_self: !!isSelf,
      user_id: userId,
    })
    .select(MEMBER_COLUMNS)
    .single()

  if (error) throw error

  runInBackground(
    logFinancialEvent({
      userId,
      action: FINANCIAL_EVENT_ACTIONS.SPLITWISE_MEMBER_ADD,
      entityType: 'split_group_member',
      entityId: data.id,
      metadata: { group_id: groupId, display_name: cleanName },
    }),
    'splitwise member audit'
  )

  await invalidateSplitwiseCache()
  return data
}

export async function deleteSplitMemberMutation(memberId) {
  if (!memberId) throw new Error('Member is required.')

  const { error } = await supabase
    .from('split_group_members')
    .delete()
    .eq('id', memberId)

  if (error) throw error
  await invalidateSplitwiseCache()
  return true
}

export async function deleteSplitGroupMutation(groupId) {
  const userId = getAuthUserId()
  if (!groupId) throw new Error('Group is required.')

  const { error } = await supabase
    .from('split_groups')
    .delete()
    .eq('id', groupId)

  if (error) throw error

  runInBackground(
    logFinancialEvent({
      userId,
      action: FINANCIAL_EVENT_ACTIONS.SPLITWISE_GROUP_DELETE,
      entityType: 'split_group',
      entityId: groupId,
      metadata: null,
    }),
    'splitwise group delete audit'
  )

  await invalidateSplitwiseCache()
  return true
}

export async function updateSplitGroupBannerMutation(groupId, bannerId) {
  if (!groupId) throw new Error('Group is required.')
  if (!bannerId) throw new Error('Banner selection is required.')

  const { error } = await supabase
    .from('split_groups')
    .update({ banner_id: bannerId, updated_at: new Date().toISOString() })
    .eq('id', groupId)

  if (error) throw error
  await invalidateSplitwiseCache()
  return true
}

export async function updateSplitGroupMutation({ groupId, name }) {
  const userId = getAuthUserId()
  if (!groupId) throw new Error('Group is required.')
  const cleanName = String(name || '').trim()
  if (!cleanName) throw new Error('Name is required.')

  const { error } = await supabase
    .from('split_groups')
    .update({ name: cleanName, updated_at: new Date().toISOString() })
    .eq('id', groupId)

  if (error) throw error

  runInBackground(
    logFinancialEvent({
      userId,
      action: FINANCIAL_EVENT_ACTIONS.SPLITWISE_GROUP_ADD,
      entityType: 'split_group',
      entityId: groupId,
      metadata: { action: 'rename', name: cleanName },
    }),
    'splitwise group update audit'
  )

  await invalidateSplitwiseCache()
  return true
}

export async function createSplitGroupInviteMutation({ groupId } = {}) {
  const userId = getAuthUserId()
  if (!groupId) throw new Error('Group is required.')

  const { data, error } = await supabase.rpc('split_create_group_invite', {
    p_group_id: groupId,
    p_role: 'member',
  })

  if (error) throw error

  runInBackground(
    logFinancialEvent({
      userId,
      action: FINANCIAL_EVENT_ACTIONS.SPLITWISE_INVITE_CREATE,
      entityType: 'split_group_invite',
      entityId: data?.id || 'rpc',
      metadata: {
        group_id: groupId,
        role: 'owner',
      },
    }),
    'splitwise invite audit'
  )

  await invalidateSplitwiseCache()
  return data
}

export async function previewSplitGroupInviteMutation(inviteToken) {
  const token = String(inviteToken || '').trim()
  if (!token) throw new Error('Invite token is required.')

  const { data, error } = await supabase.rpc('split_preview_group_invite', {
    p_token: token,
  })

  if (error) throw error

  const preview = Array.isArray(data) ? data[0] : data
  if (!preview?.group_id) {
    throw new Error('Invite preview unavailable.')
  }

  return preview
}

export async function consumeSplitGroupInviteMutation(inviteToken) {
  const userId = getAuthUserId()
  const token = String(inviteToken || '').trim()
  if (!token) throw new Error('Invite token is required.')

  const { data, error } = await supabase.rpc('split_consume_group_invite', {
    p_token: token,
  })

  if (error) throw error

  runInBackground(
    logFinancialEvent({
      userId,
      action: FINANCIAL_EVENT_ACTIONS.SPLITWISE_INVITE_CONSUME,
      entityType: 'split_group_invite',
      entityId: token,
      metadata: {
        group_id: data?.id || null,
      },
    }),
    'splitwise invite consume audit'
  )

  await invalidateSplitwiseCache()
  return data
}

export async function setSplitGroupAccessRoleMutation({ groupId, memberUserId, role }) {
  if (!groupId) throw new Error('Group is required.')
  if (!memberUserId) throw new Error('Member account is required.')
  if (role !== 'admin' && role !== 'member' && role !== 'viewer') {
    throw new Error('Role must be admin, member, or viewer.')
  }

  const { data, error } = await supabase.rpc('split_set_group_access_role', {
    p_group_id: groupId,
    p_user_id: memberUserId,
    p_role: role,
  })

  if (error) throw error

  await invalidateSplitwiseCache()
  return data
}

export async function addSplitExpenseMutation({
  groupId,
  paidByMemberId,
  description,
  amount,
  expenseDate,
  splitMethod,
  notes,
  splits,
  transactionCategory,
}) {
  const userId = getAuthUserId()
  const safeAmount = round2(amount)
  if (!groupId) throw new Error('Group is required.')
  if (!paidByMemberId) throw new Error('Payer is required.')
  if (!String(description || '').trim()) throw new Error('Description is required.')
  if (!Number.isFinite(safeAmount) || safeAmount <= 0) throw new Error('Amount must be positive.')
  if (!Array.isArray(splits) || !splits.length) throw new Error('At least one split row is required.')

  const payloadSplits = splits.map((row) => ({
    member_id: row.member_id,
    share: round2(row.share),
    percent: row.percent == null ? null : Number(row.percent),
    shares: row.shares == null ? null : Number(row.shares),
  }))

  const { data, error } = await supabase.rpc('split_create_expense', {
    p_group_id: groupId,
    p_paid_by_member_id: paidByMemberId,
    p_description: String(description).trim(),
    p_amount: safeAmount,
    p_expense_date: expenseDate || null,
    p_split_method: splitMethod || 'equal',
    p_notes: notes || null,
    p_splits: payloadSplits,
    p_transaction_category: transactionCategory || 'other',
  })

  if (error) throw error

  runInBackground(
    logFinancialEvent({
      userId,
      action: FINANCIAL_EVENT_ACTIONS.SPLITWISE_EXPENSE_ADD,
      entityType: 'split_expense',
      entityId: data?.id || 'rpc',
      metadata: {
        group_id: groupId,
        paid_by_member_id: paidByMemberId,
        amount: safeAmount,
        split_method: splitMethod,
      },
    }),
    'splitwise expense audit'
  )

  await invalidateSplitwiseCache()
  return data
}

export async function deleteSplitExpenseMutation(expenseId) {
  if (!expenseId) throw new Error('Expense is required.')

  const { error } = await supabase
    .from('split_expenses')
    .delete()
    .eq('id', expenseId)

  if (error) throw error
  await invalidateSplitwiseCache()
  return true
}

export async function recordSplitSettlementMutation({ groupId, payerMemberId, payeeMemberId, amount, settledAt, note }) {
  const userId = getAuthUserId()
  const safeAmount = round2(amount)

  if (!groupId) throw new Error('Group is required.')
  if (!payerMemberId || !payeeMemberId) throw new Error('Both members are required.')
  if (!Number.isFinite(safeAmount) || safeAmount <= 0) throw new Error('Settlement amount must be positive.')

  const { data, error } = await supabase.rpc('split_record_settlement', {
    p_group_id: groupId,
    p_payer_member_id: payerMemberId,
    p_payee_member_id: payeeMemberId,
    p_amount: safeAmount,
    p_settled_at: settledAt || null,
    p_note: note || null,
  })

  if (error) throw error

  runInBackground(
    logFinancialEvent({
      userId,
      action: FINANCIAL_EVENT_ACTIONS.SPLITWISE_SETTLEMENT_ADD,
      entityType: 'split_settlement',
      entityId: data?.id || 'rpc',
      metadata: {
        group_id: groupId,
        payer_member_id: payerMemberId,
        payee_member_id: payeeMemberId,
        amount: safeAmount,
      },
    }),
    'splitwise settlement audit'
  )

  await invalidateSplitwiseCache()
  return data
}

export async function deleteSplitSettlementMutation(settlementId) {
  if (!settlementId) throw new Error('Settlement is required.')

  const { error } = await supabase
    .from('split_settlements')
    .delete()
    .eq('id', settlementId)

  if (error) throw error
  await invalidateSplitwiseCache()
  return true
}

export async function leaveSplitGroupMutation(groupId) {
  if (!groupId) throw new Error('Group ID is required.')

  const { error } = await supabase.rpc('split_leave_group', { p_group_id: groupId })
  if (error) throw error

  await invalidateSplitwiseCache()
  return true
}

export async function toggleArchiveSplitGroupMutation(groupId, isArchived) {
  if (!groupId) throw new Error('Group ID is required.')

  const { error } = await supabase
    .from('split_groups')
    .update({ is_archived: isArchived })
    .eq('id', groupId)

  if (error) throw error
  await invalidateSplitwiseCache()
  return true
}

export function useSplitwiseRealtime() {
  useEffect(() => {
    const isReady = typeof document !== 'undefined'
    if (!isReady) return

    const channel = supabase
      .channel('splitwise-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'split_groups' },
        () => { void invalidateSplitwiseCache() }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'split_group_members' },
        () => { void invalidateSplitwiseCache() }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'split_expenses' },
        () => { void invalidateSplitwiseCache() }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'split_expense_splits' },
        () => { void invalidateSplitwiseCache() }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'split_settlements' },
        () => { void invalidateSplitwiseCache() }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [])
}
