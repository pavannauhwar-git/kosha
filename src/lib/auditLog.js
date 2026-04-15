import { supabase } from './supabase'

export const FINANCIAL_EVENT_ACTIONS = {
  TXN_ADD: 'transaction_added',
  TXN_UPDATE: 'transaction_updated',
  TXN_DELETE: 'transaction_deleted',
  BILL_ADD: 'liability_added',
  BILL_UPDATE: 'liability_updated',
  BILL_MARK_PAID: 'liability_marked_paid',
  BILL_DELETE: 'liability_deleted',
  LOAN_ADD: 'loan_added',
  LOAN_UPDATE: 'loan_updated',
  LOAN_PAYMENT: 'loan_payment_recorded',
  LOAN_DELETE: 'loan_deleted',
  SPLITWISE_GROUP_ADD: 'splitwise_group_added',
  SPLITWISE_GROUP_DELETE: 'splitwise_group_deleted',
  SPLITWISE_MEMBER_ADD: 'splitwise_member_added',
  SPLITWISE_EXPENSE_ADD: 'splitwise_expense_added',
  SPLITWISE_SETTLEMENT_ADD: 'splitwise_settlement_added',
  SPLITWISE_INVITE_CREATE: 'splitwise_invite_created',
  SPLITWISE_INVITE_CONSUME: 'splitwise_invite_consumed',
}

const AUDIT_MAX_RETRIES = 2
const AUDIT_BASE_DELAY_MS = 500

export async function logFinancialEvent({
  userId,
  action,
  entityType,
  entityId,
  metadata = null,
}) {
  if (!userId || !action || !entityType || !entityId) return

  for (let attempt = 0; attempt <= AUDIT_MAX_RETRIES; attempt++) {
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
      return // success
    } catch (error) {
      const message = String(error?.message || '')

      // Safe no-op when migration has not yet been applied on an environment.
      if (message.includes('financial_events')) return

      if (attempt < AUDIT_MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, AUDIT_BASE_DELAY_MS * (attempt + 1)))
        continue
      }

      console.warn('[Kosha] financial event log failed after retries', error)
    }
  }
}
