import { supabase } from './supabase'

export const FINANCIAL_EVENT_ACTIONS = {
  TXN_ADD: 'transaction_added',
  TXN_UPDATE: 'transaction_updated',
  TXN_DELETE: 'transaction_deleted',
  BILL_ADD: 'liability_added',
  BILL_MARK_PAID: 'liability_marked_paid',
  BILL_DELETE: 'liability_deleted',
}

export async function logFinancialEvent({
  userId,
  action,
  entityType,
  entityId,
  metadata = null,
}) {
  if (!userId || !action || !entityType || !entityId) return

  try {
    const { error } = await supabase
      .from('financial_events')
      .insert({
        user_id: userId,
        action,
        entity_type: entityType,
        entity_id: entityId,
        metadata,
      })

    if (error) throw error
  } catch (error) {
    const message = String(error?.message || '')

    // Safe no-op when migration has not yet been applied on an environment.
    if (message.includes('financial_events')) return

    console.warn('[Kosha] financial event log failed', error)
  }
}
