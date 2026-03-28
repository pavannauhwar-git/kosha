import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queryClient } from '../lib/queryClient'
import { getAuthUserId } from '../lib/authStore'
import { traceQuery } from '../lib/queryTrace'

const EVENT_COLUMNS = 'id, action, entity_type, entity_id, metadata, created_at'

export function optimisticallyUpdateFinancialEvents({ action, entityType, entityId, metadata }) {
  const event = {
    id: `optimistic-evt-${Date.now()}`,
    action,
    entity_type: entityType,
    entity_id: entityId,
    metadata: metadata || null,
    created_at: new Date().toISOString(),
    __optimistic: true,
  }
  const entries = queryClient.getQueriesData({ queryKey: ['financialEvents'] })
  for (const [key, rows] of entries) {
    if (Array.isArray(rows)) continue
    const limit = key[1] || 10
    queryClient.setQueryData(key, [event, ...rows].slice(0, limit))
  }
}

export function invalidateFinancialEvents() {
  queryClient.invalidateQueries({ queryKey: ['financialEvents'], refetchType: 'active' })
}

export function useFinancialEvents(limit = 10, options = {}) {
  const { enabled = true } = options
  const safeLimit = Math.max(1, Number(limit) || 10)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['financialEvents', safeLimit],
    enabled,
    queryFn: () => traceQuery('financial-events:list', async () => {
      const userId = getAuthUserId()
      const { data: rows, error: queryError } = await supabase
        .from('financial_events')
        .select(EVENT_COLUMNS)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(safeLimit)

      if (queryError) {
        const message = String(queryError?.message || '')
        // Safe no-op when migration has not yet been applied on an environment.
        if (message.includes('financial_events')) return []
        throw queryError
      }

      return rows || []
    }),
  })

  return {
    data: data || [],
    loading: isLoading,
    error,
    refetch,
  }
}
