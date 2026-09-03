import { useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useActiveWallet } from '../../lib/walletStore'
import { queryClient, evictSwCacheEntries, invalidateQueryFamilies } from '../../lib/queryClient'
import { supabase } from '../../lib/supabase'
import { isSuppressed } from '../../lib/mutationGuard'
import { TRANSACTION_INVALIDATION_KEYS } from '../../hooks/useTransactions'
import { LIABILITY_INVALIDATION_KEYS } from '../../hooks/useLiabilities'
import { LOAN_INVALIDATION_KEYS } from '../../hooks/useLoans'
import { SPLITWISE_INVALIDATION_KEYS } from '../../hooks/useSplitwise'

export const REALTIME_INVALIDATION_POLICIES = [
  { key: 'transactions', table: 'transactions', filterColumn: 'user_id', queryKeys: TRANSACTION_INVALIDATION_KEYS },
  { key: 'liabilities', table: 'liabilities', filterColumn: 'user_id', queryKeys: LIABILITY_INVALIDATION_KEYS },
  { key: 'loans', table: 'loans', filterColumn: 'user_id', queryKeys: LOAN_INVALIDATION_KEYS },
  { key: 'events', table: 'financial_events', filterColumn: 'user_id', queryKeys: [['financialEvents']] },
  { key: 'splitwise', table: 'split_groups', queryKeys: SPLITWISE_INVALIDATION_KEYS },
  { key: 'splitwise', table: 'split_group_access', queryKeys: SPLITWISE_INVALIDATION_KEYS },
  { key: 'splitwise', table: 'split_group_members', queryKeys: SPLITWISE_INVALIDATION_KEYS },
  { key: 'splitwise', table: 'split_group_invites', queryKeys: SPLITWISE_INVALIDATION_KEYS },
  { key: 'splitwise', table: 'split_expenses', queryKeys: SPLITWISE_INVALIDATION_KEYS },
  { key: 'splitwise', table: 'split_expense_splits', queryKeys: SPLITWISE_INVALIDATION_KEYS },
  { key: 'splitwise', table: 'split_settlements', queryKeys: SPLITWISE_INVALIDATION_KEYS },
]

const REALTIME_CONNECT_TIMEOUT_MS = 8000
const REALTIME_FALLBACK_POLL_MS = 30000
const REALTIME_RETRY_DELAYS_MS = [15000, 30000, 60000]

function normalizeRealtimeValue(value) {
  if (value == null) return ''
  return String(value).trim()
}

function hasSplitwiseUserBinding(row, activeUserId) {
  const uid = normalizeRealtimeValue(activeUserId)
  if (!uid || !row || typeof row !== 'object') return false

  const userColumns = [
    row.user_id,
    row.linked_user_id,
    row.created_by_user_id,
    row.accepted_by_user_id,
    row.member_user_id,
  ]

  return userColumns.some((value) => normalizeRealtimeValue(value) === uid)
}

function getKnownSplitwiseGroupIds() {
  const groupIds = new Set()
  const groupQueries = queryClient.getQueriesData({ queryKey: ['splitwise', 'groups'] })
  const accessQueries = queryClient.getQueriesData({ queryKey: ['splitwise', 'group-access'] })

  for (const [, rows] of groupQueries) {
    if (!Array.isArray(rows)) continue
    for (const row of rows) {
      const id = normalizeRealtimeValue(row?.id)
      if (id) groupIds.add(id)
    }
  }

  for (const [, rows] of accessQueries) {
    if (!Array.isArray(rows)) continue
    for (const row of rows) {
      const id = normalizeRealtimeValue(row?.group_id)
      if (id) groupIds.add(id)
    }
  }

  return groupIds
}

function getKnownSplitwiseExpenseGroupMap() {
  const expenseToGroup = new Map()
  const expenseQueries = queryClient.getQueriesData({ queryKey: ['splitwise', 'expenses'] })
  for (const [, rows] of expenseQueries) {
    if (!Array.isArray(rows)) continue
    for (const row of rows) {
      const expenseId = normalizeRealtimeValue(row?.id)
      const groupId = normalizeRealtimeValue(row?.group_id)
      if (!expenseId || !groupId) continue
      expenseToGroup.set(expenseId, groupId)
    }
  }
  return expenseToGroup
}

function isRelevantSplitwiseRealtimeEvent(table, payload, activeUserId) {
  const next = payload?.new || payload?.record || {}
  const prev = payload?.old || {}
  const eventType = normalizeRealtimeValue(payload?.eventType).toUpperCase()

  if (hasSplitwiseUserBinding(next, activeUserId) || hasSplitwiseUserBinding(prev, activeUserId)) {
    return true
  }

  const knownGroupIds = getKnownSplitwiseGroupIds()

  let groupId = ''
  if (table === 'split_groups') {
    groupId = normalizeRealtimeValue(next?.id || prev?.id)
  } else {
    groupId = normalizeRealtimeValue(next?.group_id || prev?.group_id)
  }

  if (!groupId && table === 'split_expense_splits') {
    const expenseId = normalizeRealtimeValue(next?.expense_id || prev?.expense_id)
    if (expenseId) {
      groupId = getKnownSplitwiseExpenseGroupMap().get(expenseId) || ''
    }
  }

  if (groupId && knownGroupIds.has(groupId)) return true

  if (!groupId && eventType === 'DELETE') return true

  if (knownGroupIds.size === 0) return false

  return false
}

export function GlobalRealtimeSync() {
  const { user } = useAuth()
  const activeWalletUserId = useActiveWallet()
  const activeUserId = activeWalletUserId || user?.id

  useEffect(() => {
    if (!activeUserId) return

    const pendingInvalidations = new Map()
    let channel = null
    let connectTimerId = null
    let reconnectTimerId = null
    let fallbackIntervalId = null
    let attempt = 0
    let active = true
    let fallbackMode = false

    function queryKeySignature(queryKey) {
      try {
        return JSON.stringify(queryKey)
      } catch {
        return String(queryKey)
      }
    }

    function enqueuePolicyInvalidation(policy, tablePath = `/${policy.table}`) {
      if (!policy?.key || isSuppressed(policy.key)) return

      let entry = pendingInvalidations.get(policy.key)
      if (!entry) {
        entry = {
          timerId: null,
          tablePaths: new Set(),
          queryKeys: [],
          queryKeySignatures: new Set(),
        }
        pendingInvalidations.set(policy.key, entry)
      }

      if (tablePath) {
        entry.tablePaths.add(tablePath)
      }

      for (const queryKey of policy.queryKeys || []) {
        const signature = queryKeySignature(queryKey)
        if (entry.queryKeySignatures.has(signature)) continue
        entry.queryKeySignatures.add(signature)
        entry.queryKeys.push(queryKey)
      }

      if (entry.timerId) return

      entry.timerId = setTimeout(() => {
        entry.timerId = null
        if (!active || isSuppressed(policy.key)) {
          pendingInvalidations.delete(policy.key)
          return
        }

        const tablePaths = Array.from(entry.tablePaths)
        const queryKeys = [...entry.queryKeys]
        pendingInvalidations.delete(policy.key)

        void Promise.all(tablePaths.map((path) => evictSwCacheEntries(path)))
          .finally(() => {
            if (queryKeys.length > 0) {
              void invalidateQueryFamilies(queryKeys)
            }
          })
      }, 300)
    }

    function clearConnectTimer() {
      if (connectTimerId) {
        clearTimeout(connectTimerId)
        connectTimerId = null
      }
    }

    function clearReconnectTimer() {
      if (reconnectTimerId) {
        clearTimeout(reconnectTimerId)
        reconnectTimerId = null
      }
    }

    function removeActiveChannel() {
      clearConnectTimer()
      const currentChannel = channel
      channel = null
      if (currentChannel) {
        supabase.removeChannel(currentChannel)
      }
    }

    function invalidateFreshness() {
      for (const policy of REALTIME_INVALIDATION_POLICIES) {
        enqueuePolicyInvalidation(policy)
      }
    }

    function startFallbackPolling() {
      if (fallbackIntervalId) return
      invalidateFreshness()
      fallbackIntervalId = setInterval(() => {
        invalidateFreshness()
      }, REALTIME_FALLBACK_POLL_MS)
    }

    function stopFallbackPolling() {
      if (!fallbackIntervalId) return
      clearInterval(fallbackIntervalId)
      fallbackIntervalId = null
    }

    function scheduleReconnect(reason) {
      if (!active || reconnectTimerId) return

      const delay = REALTIME_RETRY_DELAYS_MS[Math.min(attempt, REALTIME_RETRY_DELAYS_MS.length - 1)]
      attempt += 1

      reconnectTimerId = setTimeout(() => {
        reconnectTimerId = null
        if (!active) return

        if (typeof supabase.realtime.connect === 'function') {
          supabase.realtime.connect()
        }

        subscribeToChannel(reason)
      }, delay)
    }

    function enterFallback(reason) {
      if (!active) return

      if (fallbackMode) {
        scheduleReconnect(reason)
        return
      }

      fallbackMode = true

      console.warn(`[Kosha] Realtime unavailable (${reason}). Falling back to periodic refresh.`)
      removeActiveChannel()

      if (typeof supabase.realtime.disconnect === 'function') {
        supabase.realtime.disconnect()
      }

      startFallbackPolling()
      scheduleReconnect(reason)
    }

    function subscribeToChannel(trigger = 'initial') {
      if (!active) return

      removeActiveChannel()

      let subscribed = false
      let nextChannel = supabase.channel(`kosha-sync-${activeUserId}`)

      for (const policy of REALTIME_INVALIDATION_POLICIES) {
        const config = { event: '*', schema: 'public', table: policy.table }
        if (policy.filterColumn) {
          config.filter = `${policy.filterColumn}=eq.${activeUserId}`
        }

        nextChannel = nextChannel.on(
          'postgres_changes',
          config,
          (payload) => {
            if (policy.key === 'splitwise') {
              const relevant = isRelevantSplitwiseRealtimeEvent(policy.table, payload, activeUserId)
              if (!relevant) return
            }
            enqueuePolicyInvalidation(policy)
          }
        )
      }

      channel = nextChannel
      connectTimerId = setTimeout(() => {
        if (!subscribed) {
          enterFallback('connect-timeout')
        }
      }, REALTIME_CONNECT_TIMEOUT_MS)

      channel.subscribe((status) => {
        if (!active || channel !== nextChannel) return

        if (status === 'SUBSCRIBED') {
          subscribed = true
          fallbackMode = false
          attempt = 0
          clearConnectTimer()
          clearReconnectTimer()
          stopFallbackPolling()
          invalidateFreshness()
          if (trigger !== 'initial') {
            console.info('[Kosha] Realtime freshness restored.')
          }
          return
        }

        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          enterFallback(String(status).toLowerCase())
        }
      })
    }

    subscribeToChannel()

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible' && active) {
        invalidateFreshness()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      active = false
      fallbackMode = false
      clearConnectTimer()
      clearReconnectTimer()
      stopFallbackPolling()
      pendingInvalidations.forEach((entry) => {
        if (entry?.timerId) clearTimeout(entry.timerId)
      })
      pendingInvalidations.clear()
      removeActiveChannel()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [activeUserId])

  return null
}
