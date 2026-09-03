import { useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { buildTransactionSearchOrClause } from './useTransactions'
import { CATEGORIES, PAYMENT_MODES } from '../lib/categories'
import { downloadCsv, toCsv } from '../lib/csv'
import { todayStr } from '../lib/utils'
import { useAppToast } from '../context/ToastContext'

export function useTransactionExporter({
  activeWalletUserId,
  typeFilter,
  catFilter,
  paymentModeFilter,
  debouncedSearch,
  startDate,
  endDate,
}) {
  const { pushToast } = useAppToast()

  const exportCSV = useCallback(async () => {
    try {
      const userId = activeWalletUserId
      let q = supabase
        .from('transactions')
        .select('date, type, description, amount, category, investment_vehicle, payment_mode, notes, is_recurring, recurrence, is_auto_generated, source_transaction_id')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })

      if (typeFilter !== 'all') q = q.eq('type', typeFilter)
      if (catFilter) q = q.eq('category', catFilter)
      if (paymentModeFilter) q = q.eq('payment_mode', paymentModeFilter)
      if (debouncedSearch) {
        const clause = buildTransactionSearchOrClause(debouncedSearch)
        if (clause) {
          q = q.or(clause)
        }
      }
      if (startDate) q = q.gte('date', startDate)
      if (endDate) q = q.lte('date', endDate)

      const { data: exportRows, error } = await q
      if (error) throw error
      if (!exportRows?.length) {
        pushToast('No transactions to export for current filters.', { duration: 3000 })
        return
      }

      const CATEGORY_LABELS = Object.fromEntries(CATEGORIES.map(c => [c.id, c.label]))
      const PAYMENT_MODE_LABELS = Object.fromEntries(PAYMENT_MODES.map((mode) => [mode.id, mode.label]))
      const headers = [
        'Date',
        'Type',
        'Description',
        'Amount',
        'Category',
        'Investment Vehicle',
        'Payment Mode',
        'Notes',
        'Is Recurring',
        'Recurrence',
        'Auto Generated',
        'Source Transaction ID',
      ]
      const rows = exportRows.map(t => [
        t.date,
        t.type,
        t.description || '',
        t.amount,
        CATEGORY_LABELS[t.category] || t.category || '',
        t.investment_vehicle || '',
        t.payment_mode || '',
        t.notes || '',
        t.is_recurring ? 'yes' : 'no',
        t.recurrence || '',
        t.is_auto_generated ? 'yes' : 'no',
        t.source_transaction_id || '',
      ])

      const csv = toCsv(headers, rows)
      const filters = [
        typeFilter !== 'all' ? typeFilter : '',
        catFilter ? (CATEGORY_LABELS[catFilter] || catFilter) : '',
        paymentModeFilter ? (PAYMENT_MODE_LABELS[paymentModeFilter] || paymentModeFilter) : '',
      ].filter(Boolean).join('-')

      const fileName = `kosha-${filters || 'transactions'}-${todayStr()}.csv`
      downloadCsv(fileName, csv)
      pushToast(`Downloaded ${fileName} (${exportRows.length} rows).`)
    } catch (e) {
      pushToast(e.message || 'Could not export transactions.', { duration: 4000 })
    }
  }, [typeFilter, catFilter, paymentModeFilter, debouncedSearch, startDate, endDate, pushToast, activeWalletUserId])

  return { exportCSV }
}
