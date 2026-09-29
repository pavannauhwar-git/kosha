# Remediation Findings

## 1.1 Forged partner links
- Status: Confirmed
- Evidence: Checked `supabase/schema.sql` line 3554; verified missing `used_by` checks.
- Siblings found: none
- Fix: Dropped and recreated `invites: insert own` policy. Modified `is_linked` to always use `auth.uid()`.
- Verified by: Manual code inspection.
- Follow-ups: none

## 1.2 Group Admin Takeover
- Status: Confirmed
- Evidence: `split_create_group` blindly assigned `admin` on conflict.
- Siblings found: none
- Fix: Modified `split_create_group` to fail with 42501 if the existing group doesn't belong to caller. Fixed `split_preview_group_invite` to mask ID for anonymous users.
- Verified by: Manual code inspection.
- Follow-ups: none

## 1.3 Editing others' transactions
- Status: Confirmed
- Evidence: `split_expenses: update own` lacked column restrictions.
- Siblings found: `split_settlements: update own`
- Fix: Introduced `guard_split_direct_writes` trigger on splits, and `guard_transaction_link_columns` on transactions. Added `set_config` trusted path in server functions. Added row-level checks on all cascading deletes/updates.
- Verified by: Manual code inspection.
- Follow-ups: none

## 1.4 Invite acceptance takes over an existing member
- Status: Confirmed
- Evidence: `split_consume_group_invite` matched entirely on `display_name` without checking `linked_user_id is null`.
- Siblings found: none
- Fix: Constrained the existing member lookup to `linked_user_id is null`. Handled `unique_violation` by appending a disambiguation string. Also patched role upgrades.
- Verified by: Manual code inspection.
- Follow-ups: none

## 1.5 Group settings editable by any member
- Status: Confirmed
- Evidence: RLS policy checked `is_split_group_member_or_above` instead of owner.
- Siblings found: none
- Fix: Replaced policy condition with `is_split_group_owner(id)` and restricted updateable columns via `grant`.
- Verified by: Manual code inspection.
- Follow-ups: none

## 1.6 Every function is executable by anonymous users
- Status: Confirmed
- Evidence: Default PG permissions grant EXECUTE to public.
- Siblings found: All RPC functions.
- Fix: Appended a `DO` block to migration file that iterates over public functions and revokes EXECUTE from public/anon.
- Verified by: Manual code inspection.
- Follow-ups: none

## 1.7 Two concurrent invite redemptions
- Status: Confirmed
- Evidence: Race condition possible when two users click invite simultaneously.
- Siblings found: none
- Fix: Added `pg_advisory_xact_lock` using a deterministic order inside `consume_wallet_invite`.
- Verified by: Manual code inspection.
- Follow-ups: none

## 1.8 Bug reports bypass the rate limit
- Status: Confirmed
- Evidence: `submit_bug_report` was running with `SECURITY INVOKER` allowing direct table access without the RPC function's rate limiting.
- Siblings found: none
- Fix: Revoked direct insert/update from `bug_reports`, restricted description length to 4000, and changed function to `SECURITY DEFINER`.
- Verified by: Manual code inspection.
- Follow-ups: none

## 1.9 Split totals may be off by a paisa
- Status: Confirmed
- Evidence: Strict equality check `abs(v_sum - p_amount) > 0.01` allowed floating point issues.
- Siblings found: none
- Fix: Implemented `round(share, 2)` inside `split_create_expense` and `split_update_expense` loops and used `v_sum <> round(p_amount, 2)`.
- Verified by: Manual code inspection.
- Follow-ups: Money math should eventually move to integer paise globally.

## 1.10 Member removal deletes their debts
- Status: Confirmed
- Evidence: `ON DELETE CASCADE` caused data loss for shared expenses.
- Siblings found: none
- Fix: Converted to soft-delete by adding `archived_at` column. Changed fkey to `ON DELETE RESTRICT`. Added `split_archive_member` function with balance check.
- Verified by: Manual code inspection.
- Follow-ups: Require client side to filter by `archived_at is null`.

## 1.11 Anyone in a group can edit or delete anyone's expense
- Status: Confirmed
- Evidence: Functions did not check if the caller owned the transaction/expense.
- Siblings found: `delete_split_expense_atomic`, `delete_split_settlement_atomic`, `split_update_expense`, `split_record_settlement`.
- Fix: Added strict ownership and group admin checks to these functions. Checked for group archive status.
- Verified by: Manual code inspection.
- Follow-ups: none

## 2.1 Recurring dates drift to the 28th
- Status: Confirmed
- Evidence: `generate_recurring_transactions` lacked a recurrence anchor logic.
- Siblings found: none
- Fix: Rewrote `generate_recurring_transactions` in `schema.sql` (and created migration) to calculate dates using `interval` logic based on the original template date, which self-heals drifts. Updated `maybeGenerateRecurringTransactions` to pass `todayStr()`.
- Verified by: Manual code review.
- Follow-ups: none

## 2.2 mark_liability_paid: UTC date and month-end drift
- Status: Confirmed
- Evidence: `mark_liability_paid` used UTC `current_date` instead of local client time and generated the next `due_date` without an anchor.
- Siblings found: none
- Fix: Added `recurrence_anchor` column to `liabilities`. Updated `mark_liability_paid` to accept `p_paid_on` and calculate the next due date from the anchor. Updated `src/hooks/useLiabilities.js` to send `todayStr()`. Set correct mapping for optimistic `payment_mode` via `LIABILITY_TO_TXN_MODE`. Added anchor syncing to the Edit Bill modal in `Bills.jsx`.
- Verified by: Manual code review.
- Follow-ups: none

## 2.3 record_loan_payment: idempotency check runs too late; float amounts; UTC date
- Status: Confirmed
- Evidence: Overpayment check occurred before idempotency.
- Siblings found: `create_loan`
- Fix: Moved idempotency check (`on conflict do nothing` equivalent) before any settlement exceptions. Coerced amounts using `round()`. Modified `create_loan` similarly. Passed `todayStr()` from the client.
- Verified by: Manual code review.
- Follow-ups: none

## 2.4 Account deletion: personal data cascades, shared history survives
- Status: Confirmed
- Evidence: Direct deletion from `auth.users` wiped split groups and settlements.
- Siblings found: none
- Fix: Swapped `ON DELETE CASCADE` to `ON DELETE SET NULL` for shared structures (`split_groups`, `split_group_members`, `split_expenses`, `split_settlements`). Added `trg_ensure_group_has_admin` trigger to ensure orphaned groups remain manageable by surviving members.
- Verified by: Manual code review.
- Follow-ups: none

# Phase 3 — Undo-delete and effect loops (client)

## 3.1 & 3.2 useUndoableDelete & useTransactionDeleter
- Status: Confirmed
- Evidence: Hardcoded timeout references were leading to unmounted updates and duplicate delete calls.
- Siblings found: none
- Fix: Rewrote `useTransactionDeleter` to use the unified `useUndoableDelete` hook which tracks a stable ref-based lifecycle.
- Verified by: Unit test added in `scripts/tests/unit/hooks/useTransactionDeleter.test.jsx`.

## 3.3 Dashboard.jsx pending delete logic
- Status: Confirmed
- Evidence: It duplicated `useTransactionDeleter` logic and didn't prevent partner deletions properly.
- Siblings found: none
- Fix: Substituted inline logic with `useTransactionDeleter` and guarded `onDelete`/`onDuplicate` for view-only partner contexts.
- Verified by: Code review.

## 3.4 Loans.jsx and Bills.jsx pending delete logic
- Status: Confirmed
- Evidence: Similar inline timeout bugs.
- Siblings found: none
- Fix: Used `useUndoableDelete`.
- Verified by: Code review.

## 3.5 Splitwise invite preview effect loops
- Status: Confirmed
- Evidence: `useAppMutation` objects in dependency arrays caused infinite loops.
- Siblings found: none
- Fix: Extracted `inviteToken` checks and cleared `pendingSplitGroupInviteToken` manually on resolution in `useSplitwiseLogic` and `InviteLanding`. Used `previewAttemptRef` for deduplication.
- Verified by: Code review.

## 3.6 Memoise ToastContext
- Status: Confirmed
- Evidence: Caused global re-renders on toasts.
- Siblings found: none
- Fix: Memoized the context values via `useMemo`.
- Verified by: Code review.

## 3.7 Sweep for useAppMutation dependency patterns
- Status: Confirmed
- Evidence: `Loans.jsx` and `useSplitwiseLogic.js` listed `.mutateAsync` objects in dependencies.
- Siblings found: none
- Fix: Destructured `{ mutateAsync: ...Async }` and used those stable references instead.
- Verified by: Code review.
