import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queryClient, evictSwCacheEntries } from '../lib/queryClient'
import { getAuthUserId } from '../lib/authStore';
import { getActiveWalletUserId, useActiveWallet } from '../lib/walletStore'
import { todayStr } from '../lib/utils'
import { suppress } from '../lib/mutationGuard'
import { traceQuery } from '../lib/queryTrace'
import { FINANCIAL_EVENT_ACTIONS, logFinancialEvent } from '../lib/auditLog'
import { CATEGORIES, getCategoriesForType } from '../lib/categories'
// ── Query key factories ───────────────────────────────────────────────────
export const txnListKey  = (filters, targetUserId) => ['transactions', filters, targetUserId]
export const txnCountKey = (filters, targetUserId) => ['txnCount', filters, targetUserId]
export const transactionSignalAggregatesKey = (filters, targetUserId) => ['transactionSignalAggregates', filters, targetUserId]
export const yearDailyExpenseTotalsKey = (year, targetUserId) => ['yearDailyExpenseTotals', year, targetUserId]
export const yearYoyKey = (year, targetUserId) => ['yearYoy', year, targetUserId]

/** Shared parser for get_month_summary RPC rows — used by hook and prefetch */
export function parseMonthSummaryRows(rows) {
  const safeRows   = rows || []
  const byCategory = {}
  const byVehicle  = {}
  let earned = 0, repayments = 0, expense = 0, investment = 0

  for (const row of safeRows) {
    const amount = Number(row.total || 0)
    if (row.type === 'income') {
      if (row.is_repayment) repayments += amount
      else earned += amount
    }
    if (row.type === 'expense') {
      expense += amount
      if (row.category) {
        byCategory[row.category] = (byCategory[row.category] || 0) + amount
      }
    }
    if (row.type === 'investment') {
      investment += amount
      const vehicle = row.investment_vehicle || 'Other'
      byVehicle[vehicle] = (byVehicle[vehicle] || 0) + amount
    }
  }

  return {
    earned, repayments, expense, investment,
    byCategory, byVehicle,
    balance: earned + repayments - expense - investment,
    count:   safeRows.length,
  }
}

export const TRANSACTION_INVALIDATION_KEYS = [
  ['transactions'],
  ['transactionsRecent'],
  ['transactionsDigest'],
  ['transactionSignalAggregates'],
  ['dailyExpenseTotals'],
  ['monthExpenseDailyTotals'],
  ['yearDailyExpenseTotals'],
  ['txnCount'],
  ['month'],
  ['year'],
  ['balance'],
  ['todayExpenses'],
  ['transactionYearBounds'],
  ['liabilities'],
]

export const TRANSACTION_LIST_COLUMNS =
  'id, user_id, date, created_at, type, amount, description, category, investment_vehicle, is_repayment, payment_mode, notes, is_recurring, recurrence, next_run_date, source_transaction_id, is_auto_generated, linked_split_expense_id, linked_split_settlement_id, linked_bill_id, linked_loan_id'

export const TRANSACTION_INSIGHTS_COLUMNS =
  'id, user_id, date, created_at, type, amount, description, category, payment_mode, is_repayment, is_recurring, is_auto_generated, source_transaction_id, investment_vehicle, linked_split_expense_id, linked_split_settlement_id, linked_bill_id, linked_loan_id'

const TRANSACTION_MUTATION_COLUMNS =
  'id, date, created_at, type, amount, description, category, investment_vehicle, is_repayment, payment_mode, notes, is_recurring, recurrence, next_run_date, source_transaction_id, is_auto_generated, linked_split_expense_id, linked_split_settlement_id, linked_bill_id, linked_loan_id'

const RECURRING_SYNC_COOLDOWN_MS = 60 * 1000
const RECURRING_SYNC_WAIT_MS = 220
let lastRecurringSyncAt = 0
let recurringSyncPromise = null

function runInBackground(promise, scope) {
  void promise.catch((error) => {
    console.warn(`[Kosha] ${scope} background refresh failed`, error)
  })
}

async function maybeGenerateRecurringTransactions(userId) {
  const now = Date.now()
  if (now - lastRecurringSyncAt < RECURRING_SYNC_COOLDOWN_MS) return false
  lastRecurringSyncAt = now

  try {
    await supabase.rpc('generate_recurring_transactions', { p_user_id: userId })
    return true
  } catch (error) {
    lastRecurringSyncAt = 0
    const message = String(error?.message || '')
    if (message.includes('generate_recurring_transactions')) return false
    console.warn('[Kosha] recurring transaction generation failed', error)
    return false
  }
}

function getRecurringSyncPromise(userId) {
  if (recurringSyncPromise) return recurringSyncPromise

  recurringSyncPromise = (async () => {
    const didRun = await maybeGenerateRecurringTransactions(userId)
    if (!didRun) return false

    // If recurring entries were generated after the initial list query started,
    // refresh only active financial surfaces in the background.
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['transactions'], refetchType: 'active' }),
      queryClient.invalidateQueries({ queryKey: ['transactionsRecent'], refetchType: 'active' }),
      queryClient.invalidateQueries({ queryKey: ['transactionsDigest'], refetchType: 'active' }),
      queryClient.invalidateQueries({ queryKey: ['dailyExpenseTotals'], refetchType: 'active' }),
      queryClient.invalidateQueries({ queryKey: ['month'], refetchType: 'active' }),
      queryClient.invalidateQueries({ queryKey: ['year'], refetchType: 'active' }),
      queryClient.invalidateQueries({ queryKey: ['balance'], refetchType: 'active' }),
      queryClient.invalidateQueries({ queryKey: ['todayExpenses'], refetchType: 'active' }),
    ])

    return true
  })()
    .catch((error) => {
      console.warn('[Kosha] recurring sync orchestration failed', error)
      return false
    })
    .finally(() => {
      recurringSyncPromise = null
    })

  return recurringSyncPromise
}

async function ensureRecurringTransactionsReady(userId) {
  const syncPromise = getRecurringSyncPromise(userId)

  // Keep page loads responsive: wait briefly for sync, then continue fetching.
  await Promise.race([
    syncPromise,
    new Promise((resolve) => setTimeout(resolve, RECURRING_SYNC_WAIT_MS)),
  ])
}

function logQueryError(scope, error) {
  // AbortErrors are expected when React Query cancels in-flight requests on
  // component unmount or during React 18 Strict Mode double-invoke. React Query
  // already handles them silently — no need to surface them as console errors.
  if (error?.name === 'AbortError' || String(error?.message || '').includes('AbortError')) return
  console.error(`[Kosha] ${scope} query failed`, error)
}

const POSTGREST_RESERVED_CHARS_RE = /[,%().:"\\_*]/g

// Lazily built once at first search — categories are static module-level constants
// so there's no need to rebuild this Map on every keystroke.
let _categoryLabelById = null
function getCategoryLabelById() {
  if (_categoryLabelById) return _categoryLabelById

  const map = new Map()
  const categories = [
    ...CATEGORIES,
    ...getCategoriesForType('expense'),
    ...getCategoriesForType('income'),
    ...getCategoriesForType('investment'),
  ]

  for (const category of categories) {
    const id = String(category?.id || '').trim()
    const label = String(category?.label || '').trim().toLowerCase()
    if (!id || !label || map.has(id)) continue
    map.set(id, label)
  }

  _categoryLabelById = map
  return map
}

export function sanitizeTransactionSearchNeedle(search) {
  return String(search || '')
    .trim()
    .replace(POSTGREST_RESERVED_CHARS_RE, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .trim()
}

export function buildTransactionSearchOrClause(search) {
  const needle = sanitizeTransactionSearchNeedle(search)
  if (!needle) return ''
  const categoryLabelById = getCategoryLabelById()

  const ilikePattern = `%${needle}%`
  const conditions = [
    `description.ilike.${ilikePattern}`,
    `notes.ilike.${ilikePattern}`,
  ]

  for (const [categoryId, categoryLabel] of categoryLabelById.entries()) {
    if (!categoryLabel.includes(needle)) continue
    conditions.push(`category.eq.${categoryId}`)
  }

  return conditions.join(',')
}

function applyTransactionSearchFilter(query, search) {
  const clause = buildTransactionSearchOrClause(search)
  if (!clause) return query
  return query.or(clause)
}


let invalidateTimeout = null

export async function invalidateCache() {
  // Suppress the realtime double-fetch that would otherwise fire
  // ~300-500ms later for the same mutation.
  suppress('transactions')
  await evictSwCacheEntries('/transactions')

  if (invalidateTimeout) {
    clearTimeout(invalidateTimeout)
  }

  return new Promise((resolve) => {
    invalidateTimeout = setTimeout(async () => {
      invalidateTimeout = null
      try {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['transactions'], refetchType: 'active' }),
          queryClient.invalidateQueries({ queryKey: ['transactionsRecent'], refetchType: 'active' }),
          queryClient.invalidateQueries({ queryKey: ['transactionsDigest'], refetchType: 'active' }),
          queryClient.invalidateQueries({ queryKey: ['transactionSignalAggregates'], refetchType: 'active' }),
          queryClient.invalidateQueries({ queryKey: ['dailyExpenseTotals'], refetchType: 'active' }),
          queryClient.invalidateQueries({ queryKey: ['txnCount'],        refetchType: 'active' }),
          queryClient.invalidateQueries({ queryKey: ['month'],           refetchType: 'active' }),
          queryClient.invalidateQueries({ queryKey: ['year'],            refetchType: 'active' }),
          queryClient.invalidateQueries({ queryKey: ['yearDailyExpenseTotals'], refetchType: 'active' }),
          queryClient.invalidateQueries({ queryKey: ['balance'],         refetchType: 'active' }),
          queryClient.invalidateQueries({ queryKey: ['todayExpenses'],   refetchType: 'active' }),
          queryClient.invalidateQueries({ queryKey: ['transactionYearBounds'], refetchType: 'active' }),
          queryClient.invalidateQueries({ queryKey: ['monthly_net_changes'], refetchType: 'active' }),
        ])
        resolve()
      } catch (err) {
        resolve()
      }
    }, 80)
  })
}

// ── Debounce hook ─────────────────────────────────────────────────────────

export function useDebounce(value, ms = 300) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(timer)
  }, [value, ms])
  return debounced
}

// ── Query hooks ───────────────────────────────────────────────────────────

export function useTransactions({ type, category, paymentMode, search, limit, startDate, endDate, linkedLoanId, linkedBillId, linkedSplitExpenseId, linkedSplitSettlementId, withCount = false, enabled = true, columns } = {}) {
  const targetUserId = useActiveWallet()
  const selectedColumns = columns || TRANSACTION_LIST_COLUMNS
  const filters = { type, category, paymentMode, search, limit, startDate, endDate, linkedLoanId, linkedBillId, linkedSplitExpenseId, linkedSplitSettlementId, columns: selectedColumns }
  const { data: rows, isLoading, error, refetch } = useQuery({
    queryKey: txnListKey(filters, targetUserId),
    enabled: enabled && !!targetUserId,
    queryFn: ({ signal }) => traceQuery('transactions:list', async () => {
      try {
        const { type, category, paymentMode, search, limit, startDate, endDate, linkedLoanId, linkedBillId, linkedSplitExpenseId, linkedSplitSettlementId } = filters
        const allUserIds = [targetUserId]
        
        // Background sync recurring only if we are viewing OUR OWN wallet
        const authUserId = getAuthUserId()
        if (authUserId === targetUserId) {
          await ensureRecurringTransactionsReady(authUserId)
        }

        let q = supabase
          .from('transactions')
          .select(selectedColumns)
          .in('user_id', allUserIds)
          .order('date',       { ascending: false })
          .order('created_at', { ascending: false })
          .order('id',         { ascending: false })

        if (type)     q = q.eq('type', type)
        if (category) q = q.eq('category', category)
        if (paymentMode) q = q.eq('payment_mode', paymentMode)
        if (linkedLoanId) q = q.eq('linked_loan_id', linkedLoanId)
        if (linkedBillId) q = q.eq('linked_bill_id', linkedBillId)
        if (linkedSplitExpenseId) q = q.eq('linked_split_expense_id', linkedSplitExpenseId)
        if (linkedSplitSettlementId) q = q.eq('linked_split_settlement_id', linkedSplitSettlementId)
        if (startDate) q = q.gte('date', startDate)
        if (endDate)   q = q.lte('date', endDate)
        if (search)   q = applyTransactionSearchFilter(q, search)
        if (limit)    q = q.limit(limit)

        const { data, error: err } = await q.abortSignal(signal)
        if (err) throw err
        return data || []
      } catch (err) {
        logQueryError('transactions list', err)
        throw err
      }
    }),
    // Short gc window keeps old filter-variant queries (e.g. type:'expense',
    // search:'coffee') from piling up in cache. refetchType:'all' above would
    // otherwise re-request every combination the user tried this session.
    gcTime: 5 * 60 * 1000,
    placeholderData: (prev, query) => {
      const currentQueryUserId = query?.queryKey?.[2]
      return (currentQueryUserId === targetUserId) ? prev : undefined
    },
  })

  const safeRows = rows || []
  const numericLimit = Number(limit)
  const hasLimit = Number.isFinite(numericLimit) && numericLimit > 0
  const shouldFetchCount = enabled && withCount && (!hasLimit || safeRows.length >= numericLimit)

  const { data: countData } = useQuery({
    queryKey: txnCountKey({ type, category, paymentMode, search, startDate, endDate, linkedLoanId, linkedBillId, linkedSplitExpenseId, linkedSplitSettlementId }, targetUserId),
    enabled: shouldFetchCount,
    queryFn: () => traceQuery('transactions:count', async () => {
      try {
        const allUserIds = [targetUserId]

        let q = supabase
          .from('transactions')
          .select('id', { count: 'exact', head: true })
          .in('user_id', allUserIds)

        if (type)       q = q.eq('type', type)
        if (category)   q = q.eq('category', category)
        if (paymentMode) q = q.eq('payment_mode', paymentMode)
        if (linkedLoanId) q = q.eq('linked_loan_id', linkedLoanId)
        if (linkedBillId) q = q.eq('linked_bill_id', linkedBillId)
        if (linkedSplitExpenseId) q = q.eq('linked_split_expense_id', linkedSplitExpenseId)
        if (linkedSplitSettlementId) q = q.eq('linked_split_settlement_id', linkedSplitSettlementId)
        if (search)     q = applyTransactionSearchFilter(q, search)
        if (startDate)  q = q.gte('date', startDate)
        if (endDate)    q = q.lte('date', endDate)

        const { count, error: err } = await q
        if (err) throw err
        return count || 0
      } catch (err) {
        logQueryError('transactions count', err)
        return 0
      }
    }),
    placeholderData: (prev, query) => (query?.queryKey?.[2] === targetUserId) ? prev : undefined,
  })

  const total = withCount
    ? (shouldFetchCount ? (countData ?? safeRows.length) : safeRows.length)
    : safeRows.length

  return { data: safeRows, total, loading: isLoading, error, refetch }
}

export function useTransactionSignalAggregates({ type, category, paymentMode, search, startDate, endDate, linkedLoanId, linkedBillId, linkedSplitExpenseId, linkedSplitSettlementId, enabled = true } = {}) {
  const targetUserId = useActiveWallet()
  const filters = { type, category, paymentMode, search, startDate, endDate, linkedLoanId, linkedBillId, linkedSplitExpenseId, linkedSplitSettlementId }
  const { data, isLoading, error } = useQuery({
    queryKey: ['transactionSignalAggregates', filters, targetUserId],
    enabled: enabled && !!targetUserId,
    queryFn: () => traceQuery('transactions:signal-aggregates', async () => {
      const userId = targetUserId

      const { data: result, error: rpcError } = await supabase.rpc(
        'get_transaction_signal_aggregates',
        {
          p_user_id:      userId,
          p_type:         type         || null,
          p_category:     category     || null,
          p_payment_mode: paymentMode  || null,
          p_search:       search       || null,
          p_start_date:   startDate    || null,
          p_end_date:     endDate      || null,
          p_linked_loan_id: linkedLoanId || null,
          p_linked_bill_id: linkedBillId || null,
          p_linked_split_expense_id: linkedSplitExpenseId || null,
          p_linked_split_settlement_id: linkedSplitSettlementId || null,
        }
      )

      if (rpcError) throw rpcError

      return {
        rowCount:              Number(result?.rowCount              || 0),
        activeDays:            Number(result?.activeDays            || 0),
        minDate:               result?.minDate  || null,
        maxDate:               result?.maxDate  || null,
        expenseCount:          Number(result?.expenseCount          || 0),
        paymentModeCounts:     result?.paymentModeCounts            || {},
        expenseCategoryCounts: result?.expenseCategoryCounts        || {},
      }
    }),
    gcTime: 5 * 60 * 1000,
  })

  return { data, loading: isLoading, error }
}

const RECENT_TXN_COLUMNS = 'id, user_id, date, created_at, type, amount, description, category, investment_vehicle, is_repayment, payment_mode, notes, source_transaction_id, linked_split_expense_id, linked_split_settlement_id, linked_bill_id, linked_loan_id'
const DIGEST_TXN_COLUMNS = 'id, date, created_at, type, amount, category, is_repayment'
const DAILY_EXPENSE_TOTAL_COLUMNS = 'date, amount'

export function useRecentTransactions(limit = 5) {
  const safeLimit = Math.max(1, Number(limit) || 5)
  const targetUserId = useActiveWallet()
  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ['transactionsRecent', safeLimit, targetUserId],
    enabled: !!targetUserId,
    queryFn: () => traceQuery('transactions:recent', async () => {
      const { data: rows, error: qError } = await supabase
        .from('transactions')
        .select(RECENT_TXN_COLUMNS)
        .eq('user_id', targetUserId)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(safeLimit)

      if (qError) throw qError
      return rows || []
    }),
    gcTime: 5 * 60 * 1000,
    placeholderData: (prev, query) => (query?.queryKey?.[2] === targetUserId) ? prev : undefined,
  })

  return { data: data || [], loading: isLoading, fetching: isFetching, error }
}

export function useTransactionDigest(days = 14, limit = 200, options = {}) {
  const { enabled = true } = options
  const safeDays = Math.max(1, Number(days) || 14)
  const safeLimit = Math.max(1, Number(limit) || 200)
  const start = new Date()
  start.setDate(start.getDate() - (safeDays - 1))
  const startISO = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`
  const targetUserId = useActiveWallet()

  const { data, isLoading, error } = useQuery({
    queryKey: ['transactionsDigest', safeDays, safeLimit, startISO, targetUserId],
    enabled: enabled && !!targetUserId,
    queryFn: () => traceQuery('transactions:digest', async () => {
      const userId = targetUserId
      const { data: rows, error: qError } = await supabase
        .from('transactions')
        .select(DIGEST_TXN_COLUMNS)
        .eq('user_id', userId)
        .gte('date', startISO)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(safeLimit)

      if (qError) throw qError
      return rows || []
    }),
    gcTime: 5 * 60 * 1000,
  })

  return { data: data || [], loading: isLoading, error }
}

export function useDailyExpenseTotals(days = 42, options = {}) {
  const { enabled = true } = options
  const safeDays = Math.max(1, Number(days) || 42)
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - (safeDays - 1))
  const startISO = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`
  const targetUserId = useActiveWallet()

  const { data, isLoading, error } = useQuery({
    queryKey: ['dailyExpenseTotals', safeDays, startISO, targetUserId],
    enabled: enabled && !!targetUserId,
    queryFn: () => traceQuery('transactions:daily-expense-totals', async () => {
      const userId = targetUserId
      const pageSize = 1000
      const MAX_PAGES = 50
      const totalsByDate = {}

      for (let from = 0, page = 0; page < MAX_PAGES; from += pageSize, page++) {
        const to = from + pageSize - 1

        const { data: rows, error: qError } = await supabase
          .from('transactions')
          .select(DAILY_EXPENSE_TOTAL_COLUMNS)
          .eq('user_id', userId)
          .eq('type', 'expense')
          .gte('date', startISO)
          .order('date', { ascending: false })
          .range(from, to)

        if (qError) throw qError

        const batch = rows || []
        for (const row of batch) {
          const key = String(row?.date || '').slice(0, 10)
          if (!key) continue
          const amount = Number(row?.amount || 0)
          if (!Number.isFinite(amount)) continue
          totalsByDate[key] = (totalsByDate[key] || 0) + amount
        }

        if (batch.length < pageSize) break
      }

      return totalsByDate
    }),
    gcTime: 5 * 60 * 1000,
  })

  return { data: data || {}, loading: isLoading, error }
}

export function useMonthExpenseDailyTotals(year, month, options = {}) {
  const { enabled = true } = options
  const safeYear = Number(year)
  const safeMonth = Number(month)
  const validYear = Number.isFinite(safeYear) ? safeYear : new Date().getFullYear()
  const validMonth = Number.isFinite(safeMonth) && safeMonth >= 1 && safeMonth <= 12
    ? safeMonth
    : (new Date().getMonth() + 1)

  const startISO = `${validYear}-${String(validMonth).padStart(2, '0')}-01`
  const endISO = `${validYear}-${String(validMonth).padStart(2, '0')}-${String(new Date(validYear, validMonth, 0).getDate()).padStart(2, '0')}`
  const targetUserId = useActiveWallet()

  const { data, isLoading, error } = useQuery({
    queryKey: ['monthExpenseDailyTotals', validYear, validMonth, targetUserId],
    enabled: enabled && !!targetUserId,
    queryFn: () => traceQuery('transactions:month-expense-daily-totals', async () => {
      const userId = targetUserId
      const pageSize = 1000
      const MAX_PAGES = 50
      const totalsByDate = {}

      for (let from = 0, page = 0; page < MAX_PAGES; from += pageSize, page++) {
        const to = from + pageSize - 1

        const { data: rows, error: qError } = await supabase
          .from('transactions')
          .select(DAILY_EXPENSE_TOTAL_COLUMNS)
          .eq('user_id', userId)
          .eq('type', 'expense')
          .gte('date', startISO)
          .lte('date', endISO)
          .order('date', { ascending: false })
          .range(from, to)

        if (qError) throw qError

        const batch = rows || []
        for (const row of batch) {
          const key = String(row?.date || '').slice(0, 10)
          if (!key) continue
          const amount = Number(row?.amount || 0)
          if (!Number.isFinite(amount)) continue
          totalsByDate[key] = (totalsByDate[key] || 0) + amount
        }

        if (batch.length < pageSize) break
      }

      return totalsByDate
    }),
    gcTime: 5 * 60 * 1000,
  })

  return { data: data || {}, loading: isLoading, error }
}

export function useYearDailyExpenseTotals(year, options = {}) {
  const { enabled = true } = options
  const targetUserId = useActiveWallet()
  const safeYear = Number(year) || new Date().getFullYear()
  const startISO = `${safeYear}-01-01`
  const endISO = `${safeYear}-12-31`

  const { data, isLoading, error } = useQuery({
    queryKey: ['yearDailyExpenseTotals', safeYear, targetUserId],
    enabled: enabled && !!targetUserId,
    queryFn: () => traceQuery('transactions:year-daily-expense-totals', async () => {
      const userId = targetUserId
      const pageSize = 1000
      const MAX_PAGES = 50
      const totalsByDate = {}

      for (let from = 0, page = 0; page < MAX_PAGES; from += pageSize, page++) {
        const to = from + pageSize - 1

        const { data: rows, error: qError } = await supabase
          .from('transactions')
          .select(DAILY_EXPENSE_TOTAL_COLUMNS)
          .eq('user_id', userId)
          .eq('type', 'expense')
          .gte('date', startISO)
          .lte('date', endISO)
          .order('date', { ascending: false })
          .range(from, to)

        if (qError) throw qError

        const batch = rows || []
        for (const row of batch) {
          const key = String(row?.date || '').slice(0, 10)
          if (!key) continue
          const amount = Number(row?.amount || 0)
          if (!Number.isFinite(amount)) continue
          totalsByDate[key] = (totalsByDate[key] || 0) + amount
        }

        if (batch.length < pageSize) break
      }

      return totalsByDate
    }),
    gcTime: 5 * 60 * 1000,
  })

  return { data: data || {}, loading: isLoading, error }
}

export function useTodayExpenses(options = {}) {
  const { enabled = true } = options
  const today    = new Date()
  const todayISO = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const targetUserId = useActiveWallet()

  const { data, isLoading, error } = useQuery({
    queryKey: ['todayExpenses', todayISO, targetUserId],
    enabled: enabled && !!targetUserId,
    queryFn: () => traceQuery('transactions:today-expenses', async () => {
      try {
        const { data: r, error: qError } = await supabase
          .from('transactions')
          .select('amount')
          .eq('user_id', targetUserId)
          .eq('type', 'expense')
          .eq('date', todayISO)

        if (qError) throw qError
        return (r || []).reduce((sum, row) => sum + Number(row.amount || 0), 0)
      } catch (err) {
        logQueryError('today expenses', err)
        throw err
      }
    }),
  })

  return { todaySpend: data ?? 0, loading: isLoading, error }
}

export function useMonthSummary(year, month, options = {}) {
  const { enabled = true } = options
  const targetUserId = useActiveWallet()
  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ['month', year, month, targetUserId],
    enabled: enabled && !!targetUserId,
    queryFn: async () => {
      try {
        const allUserIds = [targetUserId]

        const { data: rows, error: qError } = await supabase.rpc('get_month_summary', {
          p_user_ids: allUserIds,
          p_year:     Number(year),
          p_month:    Number(month),
        })

        if (qError) throw qError
        return parseMonthSummaryRows(rows)
      } catch (err) {
        logQueryError('month summary', err)
        throw err
      }
    },
    placeholderData: (prev, query) => (query?.queryKey?.[3] === targetUserId) ? prev : undefined,
  })

  return { data, loading: isLoading, fetching: isFetching, error }
}

export function useYearSummary(year, options = {}) {
  const { enabled = true } = options
  const targetUserId = useActiveWallet()
  const { data, isLoading, error } = useQuery({
    queryKey: ['year', year, targetUserId],
    enabled: enabled && !!targetUserId,
    placeholderData: (previousData) => previousData,
    queryFn: async () => {
      try {
        const allUserIds = [targetUserId]

        const { data: result, error: rpcError } = await supabase
          .rpc('get_year_summary', { p_user_ids: allUserIds, p_year: Number(year) })
          .maybeSingle()

        if (rpcError) throw rpcError
        if (!result) {
          return {
            monthly: Array.from({ length: 12 }, (_, i) => ({
              month: i + 1,
              income: 0,
              expense: 0,
              investment: 0,
            })),
            totalIncome: 0,
            totalRepayments: 0,
            totalExpense: 0,
            totalInvestment: 0,
            avgSavings: 0,
            byCategory: {},
            byVehicle: {},
            top5: [],
            count: 0,
          }
        }

        const monthlyRaw = result.monthly_data  || []
        const totals     = result.totals         || {}
        const byCategory = result.category_data  || {}
        const byVehicle  = result.vehicle_data   || {}
        const top5       = result.top5_expenses  || []

        const monthMap = Object.fromEntries(monthlyRaw.map(m => [m.month_num, m]))
        const monthly  = Array.from({ length: 12 }, (_, i) => {
          const m = monthMap[i + 1] || {}
          return {
            month:      i + 1,
            income:     Number(m.income     || 0),
            expense:    Number(m.expense    || 0),
            investment: Number(m.investment || 0),
          }
        })

        const totalIncome     = Number(totals.income     || 0)
        const totalRepayments = Number(totals.repayments || 0)
        const totalExpense    = Number(totals.expense    || 0)
        const totalInvestment = Number(totals.investment || 0)

        const monthsWithIncome = monthly.filter(m => m.income > 0)
        const avgSavings = monthsWithIncome.length
          ? Math.round(
              monthsWithIncome.reduce(
                (sum, m) => sum + ((m.income - m.expense) / m.income) * 100, 0
              ) / monthsWithIncome.length
            )
          : 0

        return {
          monthly, totalIncome, totalRepayments, totalExpense, totalInvestment,
          avgSavings, byCategory, byVehicle, top5,
          count: Number(totals.count || 0),
        }
      } catch (err) {
        logQueryError('year summary', err)
        throw err
      }
    },
  })

  return { data, loading: isLoading, error }
}

export function useTransactionYearBounds(options = {}) {
  const { enabled = true } = options
  const targetUserId = useActiveWallet()
  const { data, isLoading, error } = useQuery({
    queryKey: ['transactionYearBounds', targetUserId],
    enabled: enabled && !!targetUserId,
    queryFn: async () => {
      const userId = targetUserId

      const [{ data: oldestRows, error: oldestError }, { data: newestRows, error: newestError }] = await Promise.all([
        supabase
          .from('transactions')
          .select('date')
          .eq('user_id', userId)
          .order('date', { ascending: true })
          .limit(1),
        supabase
          .from('transactions')
          .select('date')
          .eq('user_id', userId)
          .order('date', { ascending: false })
          .limit(1),
      ])

      if (oldestError) throw oldestError
      if (newestError) throw newestError

      const oldestDate = oldestRows?.[0]?.date
      const newestDate = newestRows?.[0]?.date

      if (!oldestDate || !newestDate) {
        return {
          minYear: null,
          maxYear: null,
        }
      }

      return {
        minYear: Number(String(oldestDate).slice(0, 4)) || null,
        maxYear: Number(String(newestDate).slice(0, 4)) || null,
      }
    },
    staleTime: 5 * 60 * 1000,
  })

  return {
    data,
    loading: isLoading,
    error,
  }
}

export function useRunningBalance(year, month) {
  const targetUserId = useActiveWallet()
  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ['balance', year, month, targetUserId],
    enabled: !!targetUserId,
    queryFn: async () => {
      try {
        const allUserIds = [targetUserId]
        const safeYear = Number(year)
        const safeMonth = Number(month)
        const endDate = `${safeYear}-${String(safeMonth).padStart(2, '0')}-${new Date(safeYear, safeMonth, 0).getDate()}`

        const { data: balance, error: rpcError } = await supabase.rpc(
          'get_running_balance',
          { p_user_ids: allUserIds, p_end_date: endDate }
        )

        if (rpcError) throw rpcError
        return Number(balance || 0)
      } catch (err) {
        logQueryError('running balance', err)
        throw err
      }
    },
    placeholderData: (previousData) => previousData,
  })

  return { balance: data, loading: isLoading, fetching: isFetching, error }
}

// ── Mutations — centralized pipeline ──────────────────────────────────────

export async function addTransaction(payload, mutationUserId = null) {
  const userId = mutationUserId || getActiveWalletUserId()
  if (!userId) throw new Error('No active wallet selected.')

  const { data, error } = await supabase
    .from('transactions')
    .insert({ ...payload, user_id: userId })
    .select(TRANSACTION_MUTATION_COLUMNS)
    .single()

  if (error) throw error

  runInBackground(
    logFinancialEvent({
      userId,
      action: FINANCIAL_EVENT_ACTIONS.TXN_ADD,
      entityType: 'transaction',
      entityId: data.id,
      metadata: {
        description: data.description,
        amount: data.amount,
        type: data.type,
        date: data.date,
        category: data.category,
      },
    }),
    'transactions add audit'
  )

  return data;
}

export async function updateTransaction(id, payload, mutationUserId = null) {
  const userId = mutationUserId || getActiveWalletUserId()
  if (!userId) throw new Error('No active wallet selected.')

  const { data, error } = await supabase
    .from('transactions')
    .update(payload)
    .eq('id', id)
    .eq('user_id', userId)
    .select(TRANSACTION_MUTATION_COLUMNS)
    .single()

  if (error) throw error

  runInBackground(
    logFinancialEvent({
      userId,
      action: FINANCIAL_EVENT_ACTIONS.TXN_UPDATE,
      entityType: 'transaction',
      entityId: data.id,
      metadata: {
        description: data.description,
        amount: data.amount,
        type: data.type,
        category: data.category,
        after: data,
      },
    }),
    'transactions update audit'
  )

  return data;
}

function compareTxnDesc(a, b) {
  const dateCmp = String(b?.date || '').localeCompare(String(a?.date || ''))
  if (dateCmp !== 0) return dateCmp
  return String(b?.created_at || '').localeCompare(String(a?.created_at || ''))
}

function matchesTransactionFilters(txn, filters = {}) {
  if (!txn) return false

  if (filters.type && txn.type !== filters.type) return false
  if (filters.category && txn.category !== filters.category) return false
  if (filters.paymentMode && txn.payment_mode !== filters.paymentMode) return false
  if (filters.startDate && String(txn.date || '') < String(filters.startDate)) return false
  if (filters.endDate && String(txn.date || '') > String(filters.endDate)) return false

  if (filters.search) {
    const needle = sanitizeTransactionSearchNeedle(filters.search)
    if (needle) {
      const description = String(txn.description || '').toLowerCase()
      const notes = String(txn.notes || '').toLowerCase()
      const categoryMap = getCategoryLabelById()
      const categoryLabel = categoryMap.get(String(txn.category || '')) || ''
      const hasMatch =
        description.includes(needle)
        || notes.includes(needle)
        || categoryLabel.includes(needle)
      if (!hasMatch) return false
    }
  }

  return true
}

function applyTxnLimit(rows, limit) {
  const safeLimit = Number(limit)
  if (!Number.isFinite(safeLimit) || safeLimit <= 0) return rows
  return rows.slice(0, safeLimit)
}

function defaultTxnListFilters() {
  return {
    type: undefined,
    category: undefined,
    paymentMode: undefined,
    search: undefined,
    limit: 50,
    startDate: undefined,
    endDate: undefined,
    columns: TRANSACTION_LIST_COLUMNS,
  }
}

function upsertRecentTransactionCaches(txn, targetUserId) {
  if (!targetUserId) return
  const recentEntries = queryClient.getQueriesData({ queryKey: ['transactionsRecent'] })

  if (recentEntries.length === 0) {
    queryClient.setQueryData(['transactionsRecent', 5, targetUserId], applyTxnLimit([txn], 5))
    return
  }

  for (const [key, rows] of recentEntries) {
    const queryTargetId = key?.[2]
    if (queryTargetId && queryTargetId !== targetUserId) continue

    const base = Array.isArray(rows) ? rows : []
    const limit = Number(key?.[1]) || 5
    const next = applyTxnLimit(
      [...base.filter((row) => row?.id !== txn.id), txn].sort(compareTxnDesc),
      limit
    )
    queryClient.setQueryData(key, next)
  }
}

function cloneCacheData(data) {
  if (data === undefined) return undefined
  if (typeof globalThis.structuredClone === 'function') {
    return globalThis.structuredClone(data)
  }
  return JSON.parse(JSON.stringify(data))
}

function snapshotCacheFamilies(queryKeys) {
  const snapshot = []
  for (const queryKey of queryKeys) {
    const entries = queryClient.getQueriesData({ queryKey })
    for (const [key, data] of entries) {
      snapshot.push([key, cloneCacheData(data)])
    }
  }
  return snapshot
}

function restoreCacheSnapshot(snapshot) {
  for (const [key, data] of snapshot) {
    queryClient.setQueryData(key, data)
  }
}

function getTransactionFromCacheById(id) {
  const families = [
    ['transactions'],
    ['transactionsRecent'],
  ]

  for (const family of families) {
    const entries = queryClient.getQueriesData({ queryKey: family })
    for (const [, rows] of entries) {
      if (!Array.isArray(rows)) continue
      const found = rows.find((row) => row?.id === id)
      if (found) return found
    }
  }

  return null
}

export function optimisticallyUpsertTransactionInCache(txn, targetUserId) {
  if (!txn?.id || !targetUserId) return

  const listEntries = queryClient.getQueriesData({ queryKey: ['transactions'] })

  if (listEntries.length === 0) {
    const filters = defaultTxnListFilters()
    const seededRows = matchesTransactionFilters(txn, filters)
      ? applyTxnLimit([txn], filters.limit)
      : []
    queryClient.setQueryData(txnListKey(filters, targetUserId), seededRows)
  }
  for (const [key, rows] of listEntries) {
    const baseRows = Array.isArray(rows) ? rows : []
    const filters = key?.[1] || {}
    const queryTargetId = key?.[2]

    // Ownership Guard: only inject if the query belongs to the active wallet
    if (queryTargetId && queryTargetId !== targetUserId) continue

    const base = baseRows.filter((row) => row?.id !== txn.id)
    const next = matchesTransactionFilters(txn, filters)
      ? applyTxnLimit([...base, txn].sort(compareTxnDesc), filters.limit)
      : base

    queryClient.setQueryData(key, next)
  }

  upsertRecentTransactionCaches(txn, targetUserId)
}

export function optimisticallyDeleteTransactionFromCache(id, targetUserId) {
  if (!id || !targetUserId) return

  const listEntries = queryClient.getQueriesData({ queryKey: ['transactions'] })
  for (const [key, rows] of listEntries) {
    const queryTargetId = key?.[2]
    if (queryTargetId && queryTargetId !== targetUserId) continue

    const baseRows = Array.isArray(rows) ? rows : []
    queryClient.setQueryData(key, baseRows.filter((row) => row?.id !== id))
  }

  const recentEntries = queryClient.getQueriesData({ queryKey: ['transactionsRecent'] })
  for (const [key, rows] of recentEntries) {
    const queryTargetId = key?.[2]
    if (queryTargetId && queryTargetId !== targetUserId) continue

    const baseRows = Array.isArray(rows) ? rows : []
    queryClient.setQueryData(key, baseRows.filter((row) => row?.id !== id))
  }
}

export function optimisticallyDeleteTransactionsByLoanId(loanId, targetUserId) {
  if (!loanId || !targetUserId) return

  const listEntries = queryClient.getQueriesData({ queryKey: ['transactions'] })
  for (const [key, rows] of listEntries) {
    const queryTargetId = key?.[2]
    if (queryTargetId && queryTargetId !== targetUserId) continue

    const baseRows = Array.isArray(rows) ? rows : []
    queryClient.setQueryData(key, baseRows.filter((row) => row?.linked_loan_id !== loanId))
  }

  const recentEntries = queryClient.getQueriesData({ queryKey: ['transactionsRecent'] })
  for (const [key, rows] of recentEntries) {
    const queryTargetId = key?.[2]
    if (queryTargetId && queryTargetId !== targetUserId) continue

    const baseRows = Array.isArray(rows) ? rows : []
    queryClient.setQueryData(key, baseRows.filter((row) => row?.linked_loan_id !== loanId))
  }
}

export function optimisticallyDeleteTransactionsByBillId(billId, targetUserId) {
  if (!billId || !targetUserId) return

  const listEntries = queryClient.getQueriesData({ queryKey: ['transactions'] })
  for (const [key, rows] of listEntries) {
    const queryTargetId = key?.[2]
    if (queryTargetId && queryTargetId !== targetUserId) continue

    const baseRows = Array.isArray(rows) ? rows : []
    queryClient.setQueryData(key, baseRows.filter((row) => row?.linked_bill_id !== billId))
  }

  const recentEntries = queryClient.getQueriesData({ queryKey: ['transactionsRecent'] })
  for (const [key, rows] of recentEntries) {
    const queryTargetId = key?.[2]
    if (queryTargetId && queryTargetId !== targetUserId) continue

    const baseRows = Array.isArray(rows) ? rows : []
    queryClient.setQueryData(key, baseRows.filter((row) => row?.linked_bill_id !== billId))
  }
}

export async function deleteTransaction(id, cachedTxn = null, mutationUserId = null) {
  const userId = mutationUserId || getActiveWalletUserId()
  if (!userId) throw new Error('No active wallet selected.')

  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)

  if (error) throw error

  runInBackground(
    logFinancialEvent({
      userId,
      action: FINANCIAL_EVENT_ACTIONS.TXN_DELETE,
      entityType: 'transaction',
      entityId: id,
      metadata: {
        description: cachedTxn?.description,
        amount: cachedTxn?.amount,
        type: cachedTxn?.type,
        category: cachedTxn?.category,
      },
    }),
    'transactions delete audit'
  )

  return true;
}

function applyOptimisticSaveCache({ id, payload, existingTxn, optimisticId, nowIso, targetUserId }) {
  if (id) {
    const optimisticBase = existingTxn || {
      id,
      created_at: nowIso,
      date: payload?.date || todayStr(),
    }
    optimisticallyUpsertTransactionInCache({
      ...optimisticBase,
      ...payload,
      id,
      __optimistic: true,
    }, targetUserId)
    return
  }

  optimisticallyUpsertTransactionInCache({
    ...payload,
    id: optimisticId,
    created_at: nowIso,
    date: payload?.date || todayStr(),
    __optimistic: true,
  }, targetUserId)
}

function updateTodayExpenseCache({ id, payload, existingTxn }) {
  const todayISO = todayStr()
  const affectsTodayAfter = payload?.type === 'expense' && payload?.date === todayISO
  const affectsTodayBefore = existingTxn?.type === 'expense' && existingTxn?.date === todayISO

  if (!affectsTodayAfter && !affectsTodayBefore) return

  const todayEntries = queryClient.getQueriesData({ queryKey: ['todayExpenses'] })
  for (const [key, currentTotal] of todayEntries) {
    if (typeof currentTotal !== 'number') continue
    if (id) {
      const oldAmt = affectsTodayBefore ? Number(existingTxn?.amount || 0) : 0
      const newAmt = affectsTodayAfter ? Number(payload?.amount || 0) : 0
      queryClient.setQueryData(key, currentTotal - oldAmt + newAmt)
    } else {
      queryClient.setQueryData(key, currentTotal + Number(payload?.amount || 0))
    }
  }
}

function refreshTransactionCachesInBackground(invalidateFn, scope) {
  // Defer past the AnimatePresence exit-animation window (~150ms + buffer).
  // Firing refetches immediately can cause state updates on the exiting
  // page, which interferes with the entering page's render/animation
  // and produces a blank screen on tab switch.
  setTimeout(() => {
    runInBackground(
      (async () => {
        import('./useSplitwise').then(m => m.invalidateSplitwiseCache()).catch(() => {})
        await invalidateFn()
      })(),
      scope
    )
  }, 350)
}

export async function saveTransactionMutation({ id, payload, __testOverrides = null }) {
  const authUserId = getAuthUserId()
  const targetUserId = getActiveWalletUserId()

  if (targetUserId !== authUserId) {
    console.warn('[Kosha] saveTransactionMutation blocked: Shared wallets are view-only.')
    return null
  }

  const snapshot = snapshotCacheFamilies([
    ['transactions'],
    ['transactionsRecent'],
    ['todayExpenses'],
  ])

  suppress('transactions')

  const nowIso = new Date().toISOString()
  const optimisticId = id || `optimistic-txn-${Date.now()}`
  const existingTxn = id ? getTransactionFromCacheById(id) : null

  applyOptimisticSaveCache({ id, payload, existingTxn, optimisticId, nowIso, targetUserId })
  updateTodayExpenseCache({ id, payload, existingTxn })

  try {
    const updateFn = __testOverrides?.updateTransaction || updateTransaction
    const addFn = __testOverrides?.addTransaction || addTransaction
    const invalidateFn = __testOverrides?.invalidateCache || invalidateCache

    const savedTxn = id
      ? await updateFn(id, payload, targetUserId)
      : await addFn(payload, targetUserId)

    await Promise.all([
      queryClient.cancelQueries({ queryKey: ['transactions'] }),
      queryClient.cancelQueries({ queryKey: ['transactionsRecent'] }),
    ])

    if (!id) {
      optimisticallyDeleteTransactionFromCache(optimisticId, targetUserId)
    }
    optimisticallyUpsertTransactionInCache(savedTxn, targetUserId)

    refreshTransactionCachesInBackground(invalidateFn, 'transactions post-mutation refresh')

    return savedTxn
  } catch (error) {
    restoreCacheSnapshot(snapshot)
    throw error
  }
}

export async function removeTransactionMutation(id, __testOverrides = null) {
  const authUserId = getAuthUserId()
  const targetUserId = getActiveWalletUserId()

  if (targetUserId !== authUserId) {
    console.warn('[Kosha] removeTransactionMutation blocked: Shared wallets are view-only.')
    return false
  }

  const cachedTxn = getTransactionFromCacheById(id)
  const snapshot = snapshotCacheFamilies([
    ['transactions'],
    ['transactionsRecent'],
  ])

  suppress('transactions')
  optimisticallyDeleteTransactionFromCache(id, targetUserId)

  try {
    const deleteFn = __testOverrides?.deleteTransaction || deleteTransaction
    const invalidateFn = __testOverrides?.invalidateCache || invalidateCache

    await deleteFn(id, cachedTxn, targetUserId)
    await Promise.all([
      queryClient.cancelQueries({ queryKey: ['transactions'] }),
      queryClient.cancelQueries({ queryKey: ['transactionsRecent'] }),
    ])

    optimisticallyDeleteTransactionFromCache(id, targetUserId)

    refreshTransactionCachesInBackground(invalidateFn, 'transactions post-delete refresh')

    return true
  } catch (error) {
    restoreCacheSnapshot(snapshot)
    throw error
  }
}
