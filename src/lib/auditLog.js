// ────────────────────────────────────────────────────────────────────────────
// AUDIT LOG — client-side façade
//
// History: prior to Migration 004, the browser was the sole writer of the
//   public.financial_events table. That was unacceptable for a finance app —
//   a malicious or buggy client could skip the audit write or fabricate
//   events. Migration 004 moves the audit log behind SECURITY DEFINER
//   triggers on the underlying tables and REVOKEs INSERT from `authenticated`.
//
// Today: every transaction / liability / loan / split_expense / split_
//   settlement mutation is logged automatically by the database. The
//   `logFinancialEvent` call below is therefore a deliberate no-op. We keep
//   the export (and the action-verb constants) so existing call-sites
//   compile without churn — a future cleanup batch can remove them.
//
// Why no-op vs delete: the alternative — ripping every `runInBackground(
//   logFinancialEvent(...))` call out of useLiabilities / useLoans /
//   useSplitwise / useTransactions / Loans.jsx in this same PR — would have
//   doubled the diff size and made bisecting any regression harder. The
//   server triggers are independent of these calls; either path produces
//   the same audit row.
// ────────────────────────────────────────────────────────────────────────────

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
  SPLITWISE_GROUP_UPDATE: 'splitwise_group_updated',
  SPLITWISE_GROUP_DELETE: 'splitwise_group_deleted',
  SPLITWISE_MEMBER_ADD: 'splitwise_member_added',
  SPLITWISE_EXPENSE_ADD: 'splitwise_expense_added',
  SPLITWISE_SETTLEMENT_ADD: 'splitwise_settlement_added',
  SPLITWISE_INVITE_CREATE: 'splitwise_invite_created',
  SPLITWISE_INVITE_CONSUME: 'splitwise_invite_consumed',
}

/**
 * No-op. The server writes financial_events via SECURITY DEFINER triggers.
 * Kept as an export so existing `runInBackground(logFinancialEvent(...))`
 * call sites continue to compile. The argument shape is preserved for the
 * same reason.
 */
export async function logFinancialEvent(_args = {}) {
  return
}
