import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { getAuthUserId } from '../lib/authStore'

const REVIEW_COLUMNS = 'transaction_id, status, statement_line, updated_at'

function isMissingTableError(error) {
  const message = String(error?.message || '').toLowerCase()
  const details = String(error?.details || '').toLowerCase()
  const hint = String(error?.hint || '').toLowerCase()
  const code = String(error?.code || '').toUpperCase()
  const status = Number(error?.status || 0)

  return (
    message.includes('reconciliation_reviews') ||
    details.includes('reconciliation_reviews') ||
    hint.includes('reconciliation_reviews') ||
    message.includes('relation') && message.includes('does not exist') ||
    details.includes('relation') && details.includes('does not exist') ||
    code === '42P01' || // PostgreSQL undefined_table
    code === 'PGRST205' || // PostgREST relation not found
    status === 404
  )
}

export function useReconciliationReviews(options = {}) {
  const { enabled = true } = options
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['reconciliationReviews'],
    enabled,
    queryFn: async () => {
      const userId = getAuthUserId()
      const { data: rows, error: queryError } = await supabase
        .from('reconciliation_reviews')
        .select(REVIEW_COLUMNS)
        .eq('user_id', userId)

      if (queryError) {
        if (isMissingTableError(queryError)) {
          return { rows: [], unavailable: true }
        }
        throw queryError
      }

      return { rows: rows || [], unavailable: false }
    },
  })

  const rows = data?.rows || []
  const unavailable = !!data?.unavailable

  const reviewedIdSet = useMemo(() => {
    const next = new Set()
    for (const row of rows) {
      if (row?.transaction_id) next.add(row.transaction_id)
    }
    return next
  }, [rows])

  const linkedIdSet = useMemo(() => {
    const next = new Set()
    for (const row of rows) {
      if (row?.status === 'linked' && row?.transaction_id) next.add(row.transaction_id)
    }
    return next
  }, [rows])

  return {
    rows,
    reviewedIdSet,
    linkedIdSet,
    unavailable,
    loading: isLoading,
    error,
    refetch,
  }
}

export async function upsertReconciliationReview({ transactionId, status = 'reviewed', statementLine = null }) {
  const userId = getAuthUserId()
  const payload = {
    user_id: userId,
    transaction_id: transactionId,
    status,
    statement_line: statementLine,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('reconciliation_reviews')
    .upsert(payload, { onConflict: 'user_id,transaction_id' })
    .select(REVIEW_COLUMNS)
    .single()

  if (error) {
    if (isMissingTableError(error)) return { unavailable: true }
    throw error
  }

  return { unavailable: false, row: data }
}

export async function clearLearnedReconciliationAliases() {
  const userId = getAuthUserId()

  const { error } = await supabase
    .from('reconciliation_reviews')
    .update({ statement_line: null, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('status', 'linked')
    .not('statement_line', 'is', null)

  if (error) {
    if (isMissingTableError(error)) return { unavailable: true }
    throw error
  }

  return { unavailable: false }
}

export async function reportReconciliationFalsePositive({ transactionId, statementLine = null }) {
  const userId = getAuthUserId()
  const payload = {
    user_id: userId,
    transaction_id: transactionId,
    status: 'reviewed',
    statement_line: statementLine ? `REJECTED:${statementLine}` : 'REJECTED:unknown',
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('reconciliation_reviews')
    .upsert(payload, { onConflict: 'user_id,transaction_id' })
    .select(REVIEW_COLUMNS)
    .single()

  if (error) {
    if (isMissingTableError(error)) return { unavailable: true }
    throw error
  }

  return { unavailable: false, row: data }
}