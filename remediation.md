# Kosha remediation plan (handover)

This plan covers the issues found in the September 2026 code review of Kosha, a React + Supabase personal-finance PWA. It's a map of **where to look and what we believe is wrong**. It is not a patch to apply blindly.

Line numbers refer to `main` at commit `4dcf5dc`. Check them again before editing, because they shift as earlier items land.

## How to work through this plan

You are expected to investigate each item yourself and own the fix. For every item:

1. **Read the code at the referenced lines and confirm the problem exists as described.** Trace callers and callees where the item says so. If you can reproduce it (unit test, staging database, browser), do.
2. **Classify it** in the findings log (template at the end):
   - **Confirmed**: the issue exists as described.
   - **Different**: the issue exists but differs from the description.
   - **Not reproduced**: you can't find it; explain why. Don't "fix" it.
3. **Design the fix.**
   - Each item has a **Reference approach**: a worked starting point written against this commit. It has **not been executed**; no database or `node_modules` was available during the review.
   - Treat the snippets as a description of intent. Use them, improve them, or replace them. Any approach that meets the item's **Verify** criteria and the owner decisions below is acceptable.
4. **Look for siblings.** Most issues come from a pattern (for example, "mutation object in a dependency array" or "caller-rights RPC plus a new guard"). Search the whole codebase for other instances, not just the lines listed.
5. **Check the "Verified facts" section** before changing anything in the database. It lists constraints that were checked during the review and that a naive fix would violate. One earlier draft of this plan made exactly that mistake.

Each item is tagged with how its **problem** was established:
- **[code]**: traced statically in this repo's source;
- **[library]**: follows from documented or source behaviour of a dependency (TanStack Query, Postgres, Supabase, the Cache API) rather than from running it;
- **[run]**: reproduced by executing code during the review.

The reference snippets themselves are always unverified.

| Item | Tag | Item | Tag | Item | Tag |
|---|---|---|---|---|---|
| 1.1–1.10 | code | 3.1–3.4 Undo | library (TanStack) | 5.1–5.5, 5.7–5.9 | code |
| 1.11 | code (design decision) | 3.5 invite loop | library (TanStack) | 5.6 matching | code + run (Node, by reviewer) |
| 2.1–2.4 | code | 4.1 offline defaults | library (TanStack) | 6.1 service worker | library (Cache API, Workbox) |
| | | 4.2–4.6 | code | 6.2 realtime | library (Supabase docs) |
| | | | | 6.3–6.5, Phase 7 | code |

For **[library]** items, confirm the claim against the installed package source after `npm ci`. For example, read `node_modules/@tanstack/react-query/build/modern/useMutation.js` and `node_modules/@tanstack/query-core/build/modern/queryClient.js` (`getMutationDefaults`).

## Verified facts (read before changing the database)

These were checked against `supabase/schema.sql` and `src/` during the review. Re-check them against the **live** database (`supabase db dump`) before shipping Phase 1, because the snapshot may have drifted.

**Which server functions run with the caller's rights (no `SECURITY DEFINER`)?** Row-level security applies inside these, and `current_user` is `authenticated`. Any new trigger that blocks `authenticated` writes will also block them unless they opt out (see the `kosha.trusted_write` flag in 1.3).

| Caller's rights (invoker) | Elevated (`SECURITY DEFINER`) |
|---|---|
| `create_loan`, `record_loan_payment`, `mark_liability_paid`, `generate_recurring_transactions`, `split_create_expense`, `split_record_settlement`, `split_create_group_invite`, `split_set_group_access_role`, `submit_bug_report`, `get_*` read functions, `is_linked(uuid)` | `consume_wallet_invite`, `unlink_partner_atomic`, `split_create_group`, `split_consume_group_invite`, `split_update_expense`, `split_leave_group`, `split_preview_group_invite`, `split_group_member_profiles`, `delete_split_expense_atomic`, `delete_split_settlement_atomic`, `delete_loan_with_txns`, `delete_liability_with_txns`, `is_linked(uuid, uuid)`, `has_split_group_access`, `is_split_group_member_or_above`, `is_split_group_owner`, and all existing trigger functions except `touch_split_group_updated_at` and `bug_reports_protect_notified_at`. The new guard triggers proposed in 1.3 and 5.5 are deliberately **invoker**, so that `current_user` shows who made the write. |

**Which functions write which tables** (from the function bodies):

| Table | Written by |
|---|---|
| `transactions` | `create_loan`, `record_loan_payment`, `mark_liability_paid`, `generate_recurring_transactions`, `split_create_expense`, `split_record_settlement`, `split_update_expense`, `delete_split_*_atomic`, `on_split_group_delete_cleanup`, `sync_split_to_transaction`; plus the client directly (`useTransactions.js` insert/update/delete) |
| `split_expenses`, `split_expense_splits` | `split_create_expense` (invoker), `split_update_expense`, `delete_split_expense_atomic`, `sync_transaction_to_split`; **never the client directly** |
| `split_settlements` | `split_record_settlement` (invoker), `delete_split_settlement_atomic`; **never the client directly** |
| `split_groups` | `split_create_group`; the client updates only `name`, `banner_id`, `is_archived`, `updated_at` (`useSplitwise.js` lines 515, 534, 920) and deletes whole groups (line 486) |
| `split_group_members` | `split_create_group`, `split_consume_group_invite`, `split_leave_group`; the client inserts (line 432) and deletes (line 467, only from `deleteSplitMemberMutation`) |
| `invites` | `consume_wallet_invite` (update), `unlink_partner_atomic` (delete); the client inserts only `{ created_by }` (`src/lib/invites.js` line 27) and deletes (line 109) |
| `loans` | `create_loan`, `record_loan_payment`; the client updates editable fields (`useLoans.js` line 198) |
| `bug_reports` | `submit_bug_report` (sets `user_id` from `auth.uid()`); the edge function with the service role; **never the client directly** |

**Postgres, Supabase and PostgREST behaviour this plan relies on:**
- An `UPDATE` policy with no `WITH CHECK` reuses its `USING` expression for the new row. So the `transactions` / `liabilities` update policies without `WITH CHECK` are **not** a hole.
- Foreign-key cascade actions run as the table owner and ignore row-level security, so group deletion cascades still work after client privileges are revoked or guarded.
- Inside a `SECURITY DEFINER` function (and triggers fired by its statements), `current_user` is the function owner, not `authenticated`.
- `date + interval '1 month'` clamps at month end (31 Jan → 28/29 Feb). Adding months repeatedly to the *previous* date therefore drifts; always add N months to the anchor date.
- `set_config('kosha.x', 'true', true)` is transaction-local. PostgREST doesn't expose `pg_catalog`, and runs each request in its own transaction, so a client can't set the flag.
- The `PUBLIC` default grant on functions is global. `ALTER DEFAULT PRIVILEGES ... IN SCHEMA` can't revoke it.
- Supabase Postgres Changes can't filter `DELETE` events, and doesn't apply row-level security to them. The old record holds only the primary key when RLS is on.

**TanStack Query v5 behaviour this plan relies on:**
- `useMutation` returns `{ ...result, mutate, mutateAsync: result.mutate }`, which is a **new object every render**. `mutateAsync` / `mutate` themselves are stable (bound in the `MutationObserver` constructor).
- `getMutationDefaults(key)` matches with `partialMatchKey(key, defaults.mutationKey)`, which compares element by element. `['a']` doesn't match `[['a']]`.
- `placeholderData(prevData, prevQuery)`: the second argument is the **previous** query, so `prevQuery.queryKey[i] === currentUserId` means "the previous data belonged to this user".
- `networkMode`:
  - `'online'` pauses (the mutation stays `isPending`) while offline;
  - `'offlineFirst'` runs once, then pauses retries;
  - `'always'` never pauses.

**Deployment order.** Always deploy the database migration **before** the client that uses it. New server-function parameters (`p_today`, `p_paid_on`) have defaults, so old clients keep working. The reverse isn't true: for example, selecting `archived_at` in `MEMBER_COLUMNS` fails until the column exists.

## Owner decisions (resolved)

These are final. Don't re-open them. If an investigation shows one of them can't be implemented as stated, record that in the findings log and stop on that item.

| # | Question | Decision | Implemented in |
|---|---|---|---|
| D1 | How are Splitwise members removed? | **Archive, don't delete.** Archiving is only allowed at zero balance, archived members are hidden from new splits and pickers, and their history stays. | 1.10, 5.7 |
| D2 | What happens to shared data when someone deletes their account? | **Shared Splitwise history survives** (`ON DELETE SET NULL`, shown as "Deleted user"). **Personal data cascade-deletes** (transactions, loans, bills, budgets, invites, categories). | 2.4 |
| D3 | Can a loan be edited after repayments exist? | **No, for amount and direction.** Only counterparty, note, due date and interest rate stay editable. To fix a wrong amount, delete and recreate the loan. | 5.5 |
| D4 | Who can edit or delete a split expense or settlement? | **Its creator or a group admin.** Any member can still add expenses. A settlement can be recorded by its payer, its payee (their linked users) or an admin. | 1.11 |
| D5 | Should writes be queued while offline? | **No, not for now.** Mutations fail fast with a clear "You're offline" message; reads still work from the persisted cache. Queued offline writes may come back later as a separate, tested feature. | 4.1, 4.4 |

## Rollout order

| Release | Contents | Why this order |
|---|---|---|
| R1 (urgent, this week) | **Phase 1 only** (database security migration), plus the data audit in 1.1 | Anyone can currently read anyone's finances. It's pure SQL, needs no client changes, and is low risk. |
| R2 | **Phase 3** (Undo) and **5.1** (default categories) | The bugs users hit every day; small client-only changes. |
| R3 | **Phases 2 and 4 together** | Client-generated ids and the server-side retry handling depend on each other, so review and test them as one change. |
| R4 | **6.1** (service worker `NetworkFirst`), then the rest of **Phase 5** | Stale-while-revalidate hides whether the other freshness fixes work, so switch it before verifying Phase 5. |
| R5 | Rest of **Phase 6**, then **Phase 7** | Performance, privacy and UX polish. |

Use one PR per release (split R4 and R5 further if a PR gets large). Run `npm run test:no-network` before every commit. Each release must also add its regression tests from the "Required regression tests" section at the end.

## Ground rules for the implementing agent

- **Confirm before you change.** An item whose problem you can't confirm gets a findings-log entry, not a code change.
- **Keep changes scoped to the item.** Don't refactor neighbouring code unless the item's sibling search requires it; note other issues you notice in the findings log instead.
- **Database changes go in a new migration file** under `supabase/migrations/` (the folder doesn't exist yet), and must also be applied to `supabase/schema.sql` so the snapshot stays accurate. Every statement must be safe to re-run (`drop ... if exists`, `create or replace`, `if not exists`).
- **Don't break the static contract tests.** `npm run test:no-network` runs `scripts/tests/test_mutation_paths.mjs` and `scripts/tests/test_mutation_rollback_contract.mjs`. Those require:
  - `saveTransactionMutation`, `removeTransactionMutation`, `addLiabilityMutation`, `markLiabilityPaidMutation` and `deleteLiabilityMutation` to keep their `snapshot*` / `restore*Snapshot(snapshot)` calls inside `try { … } catch (error) { … }`.
  - No `setTimeout(() => { … invalidateCache(` in the listed page files.
- **Never depend on a `useMutation` result object** in `useCallback` / `useEffect` / `useMemo` dependency arrays. TanStack Query v5 returns a new object on every render. Destructure `mutateAsync` (which is stable) or call the underlying `*Mutation` function directly. This single mistake causes several bugs below.
- `node_modules` is not installed in the reviewed checkout. Run `npm ci` first, then `npm run lint`, `npm run test:unit` and `npm run test:no-network` after every phase.

## Phase overview

| Phase | Scope | Risk if skipped |
|---|---|---|
| 1 | Database security holes | Cross-user data read/write, group takeover |
| 2 | Database correctness (dates, rounding, idempotency) | Wrong dates/amounts, stuck loans |
| 3 | Undo-delete and effect-loop bugs (client) | Deletes can't be undone; invite page loops |
| 4 | Idempotency and offline behaviour (client) | Duplicate transactions/payments; stuck sheets offline |
| 5 | Client data-correctness bugs | Miscategorised entries, duplicate recurring rows, truncated export |
| 6 | Caching and realtime | Stale data, previous wallet's data flashing, realtime fan-out |
| 7 | Privacy and UX follow-ups | Lower severity |

---

# Phase 1 — Database security (one migration: `supabase/migrations/20260930_security_hardening.sql`)

Ship all of Phase 1 together. Items 1.1 and 1.3 chain into each other (a forged partner link exposes transaction ids, and 1.3 then lets an attacker edit or delete them).

## 1.1 Forged partner links (critical)

**Problem.** The `invites` insert policy (`schema.sql` line 3554) and update policy (line 3560) only check `created_by`. Any user can run `insert into invites (created_by, used_by) values (auth.uid(), '<victim>')`, and `is_linked()` (lines 1082–1090) then grants read access to all of the victim's rows.

**Reference approach.**

```sql
-- Linking may only happen through consume_wallet_invite (SECURITY DEFINER).
drop policy if exists "invites: insert own" on public.invites;
create policy "invites: insert own" on public.invites
  for insert to authenticated
  with check (
    (select auth.uid()) = created_by
    and used_by is null
    and used_at is null
  );

drop policy if exists "invites: update own" on public.invites;
revoke update on public.invites from authenticated, anon;
revoke insert on public.invites from anon;

-- Column-level insert: clients may only supply created_by (and expires_at if you add expiry UI).
revoke insert on public.invites from authenticated;
grant insert (created_by) on public.invites to authenticated;

-- is_linked(target) must always use the caller, never a caller-supplied id.
create or replace function public.is_linked(target_user_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select target_user_id = auth.uid() or exists (
    select 1 from public.invites
    where (created_by = auth.uid() and used_by = target_user_id)
       or (used_by = auth.uid() and created_by = target_user_id)
  );
$$;

revoke execute on function public.is_linked(uuid, uuid) from public, anon, authenticated;
```

Client impact: none. `src/lib/invites.js` `createInvite` already inserts only `{ created_by }`.

**Data audit (run before and after the migration, and review by hand).** A forged link is just an `invites` row with `used_by` set, so no single query proves forgery. These heuristics catch the likely cases:

```sql
-- 1. consume_wallet_invite always sets used_at = now(). A used invite without used_at
--    was almost certainly written directly.
select * from public.invites where used_by is not null and used_at is null;

-- 2. Created and "used" in the same instant: an insert with both columns set.
select * from public.invites
where used_by is not null and used_at is not null
  and used_at - created_at < interval '2 seconds';

-- 3. Accounts that break the 1:1 partner model.
select u, count(*) from (
  select created_by as u from public.invites where used_by is not null
  union all
  select used_by from public.invites where used_by is not null
) s group by u having count(*) > 1;
```

Also check the Supabase API logs (Dashboard → Logs → API) for `POST` / `PATCH` requests to `/rest/v1/invites` whose body contains `used_by`. The legitimate client never sends that field. For each suspicious row, confirm with both users before deleting it, and notify the affected user if data was exposed.

**Verify.** Extend `scripts/tests/test_rls_partner_isolation.mjs` so that, as user A:
- `insert into invites (created_by, used_by)` with B's id fails;
- `update invites set used_by = B` fails;
- `select * from transactions where user_id = B` returns 0 rows.

## 1.2 `split_create_group` gives admin on any existing group (critical)

**Problem.** Lines 1912–1921: `on conflict (id) do nothing`, then the function unconditionally upserts the caller as `admin` on whatever group has that id. The function is `SECURITY DEFINER`, so this works on any group whose id the caller knows.

**Reference approach.** Replace the block from `p_id := coalesce(...)` down to the access upsert with the following:

```sql
  p_id := coalesce(p_id, gen_random_uuid());

  insert into public.split_groups (id, name, user_id)
  values (p_id, v_name, v_uid)
  on conflict (id) do nothing
  returning * into v_group;

  if v_group.id is null then
    -- Row already existed. Only an idempotent retry by the original creator is
    -- allowed, and it must not touch access or membership.
    select * into v_group from public.split_groups where id = p_id;
    if v_group.user_id is distinct from v_uid then
      raise exception using errcode = '42501', message = 'forbidden';
    end if;
    return v_group;
  end if;

  insert into public.split_group_access (group_id, user_id, role)
  values (v_group.id, v_uid, 'admin')
  on conflict (group_id, user_id) do update set role = 'admin';
  -- (member insert below unchanged)
```

Also stop leaking `group_id` to signed-out callers in `split_preview_group_invite` (lines 2105–2109):

```sql
  return jsonb_build_object(
    'group_id', case when auth.uid() is not null then v_group.id end,
    'group_name', v_group.name,
    'invited_role', coalesce(v_invite.role, 'viewer')
  );
```

`InviteLanding.jsx` only uses `group_name` when signed out, so this is safe. `useSplitwiseLogic.js` reads `preview.group_id` only after sign-in.

**Verify.** As user B (a viewer of group G), `rpc('split_create_group', { p_id: G, p_name: 'x' })` must fail with `forbidden`, and B's role in G must not change.

## 1.3 Split pointer columns allow editing and deleting other users' transactions (critical)

**Problem.**
- The `split_expenses` / `split_settlements` update policies (lines 3660, 3735) let any member set `linked_transaction_id`, `payer_transaction_id` and `payee_transaction_id` to any uuid.
- `delete_split_expense_atomic` (line 364), `delete_split_settlement_atomic` (lines 408–413) and `split_update_expense` (the stale-transaction delete) all delete that transaction with elevated rights.
- `sync_split_to_transaction` (lines 2619–2626) rewrites it.
- In the other direction, `sync_transaction_to_split` (lines 2647–2654) trusts `transactions.linked_split_expense_id`, which the client can set on insert.

**Reference approach, part A: stop clients writing these tables or columns directly.** The client never writes `split_expenses`, `split_settlements` or `split_expense_splits` directly; all writes go through RPCs. Verify with `rg "from\('split_(expenses|settlements|expense_splits)'\)" src` (only `select`s should appear).

> **Pitfall (checked):** a plain `REVOKE INSERT/UPDATE/DELETE` on these tables would break the app. `split_create_expense` and `split_record_settlement` run with the **caller's** rights (no `SECURITY DEFINER`) and write these tables and `transactions` directly. See the table "Which server functions run with the caller's rights" under "Verified facts". Use a guard trigger plus a transaction-local "trusted write" flag instead.

```sql
-- Split tables: only server functions may write. SECURITY DEFINER functions run as the
-- owner (current_user <> 'authenticated'); caller-rights RPCs set kosha.trusted_write.
-- Foreign-key cascades (e.g. deleting a group) also run as the owner, so they pass.
create or replace function public.guard_split_direct_writes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon')
     and current_setting('kosha.trusted_write', true) is distinct from 'true' then
    raise exception using errcode = '42501',
      message = 'Split data can only be changed through the app''s split functions.';
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_guard_split_expenses on public.split_expenses;
create trigger trg_guard_split_expenses
  before insert or update or delete on public.split_expenses
  for each row execute function public.guard_split_direct_writes();

drop trigger if exists trg_guard_split_settlements on public.split_settlements;
create trigger trg_guard_split_settlements
  before insert or update or delete on public.split_settlements
  for each row execute function public.guard_split_direct_writes();

drop trigger if exists trg_guard_split_expense_splits on public.split_expense_splits;
create trigger trg_guard_split_expense_splits
  before insert or update or delete on public.split_expense_splits
  for each row execute function public.guard_split_direct_writes();

-- Transactions: link columns to split rows and loans are server-managed.
create or replace function public.guard_transaction_link_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- SECURITY DEFINER RPCs run as the function owner, so current_user is not
  -- 'authenticated' inside them. Caller-rights RPCs that legitimately write link
  -- columns (create_loan, record_loan_payment) set a transaction-local flag.
  if current_user not in ('authenticated', 'anon')
     or current_setting('kosha.trusted_write', true) = 'true' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.linked_split_expense_id is not null
       or new.linked_split_settlement_id is not null
       or new.linked_loan_id is not null then
      raise exception using errcode = '42501',
        message = 'Linked split and loan columns are managed by the server';
    end if;
  elsif new.linked_split_expense_id    is distinct from old.linked_split_expense_id
     or new.linked_split_settlement_id is distinct from old.linked_split_settlement_id
     or new.linked_loan_id             is distinct from old.linked_loan_id then
    raise exception using errcode = '42501',
      message = 'Linked split and loan columns are managed by the server';
  end if;

  if new.linked_bill_id is not null
     and (tg_op = 'INSERT' or new.linked_bill_id is distinct from old.linked_bill_id)
     and not exists (
       select 1 from public.liabilities l
       where l.id = new.linked_bill_id and l.user_id = new.user_id
     ) then
    raise exception using errcode = '42501', message = 'Bill does not belong to this user';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_transaction_link_columns on public.transactions;
create trigger trg_guard_transaction_link_columns
  before insert or update on public.transactions
  for each row execute function public.guard_transaction_link_columns();
```

**Required in the same migration, or loans and Splitwise break.** Four functions run with the caller's rights (no `SECURITY DEFINER`) and legitimately write guarded data:

| Function | Line | Guarded writes it performs |
|---|---|---|
| `create_loan` | 161 | inserts a transaction with `linked_loan_id` |
| `record_loan_payment` | 1407 | inserts a transaction with `linked_loan_id`; updates `loans.amount_settled` (guarded by 5.5) |
| `split_create_expense` | 1704 | inserts `split_expenses` / `split_expense_splits`; inserts a transaction with `linked_split_expense_id`; updates `split_expenses.linked_transaction_id` |
| `split_record_settlement` | 2137 | inserts `split_settlements`; inserts transactions with `linked_split_settlement_id`; updates the settlement's transaction pointers |

Add this as the first statement of each of these four function bodies (right after `begin`):

```sql
  perform set_config('kosha.trusted_write', 'true', true);  -- transaction-local
```

Clients can't set this flag themselves: `set_config` lives in `pg_catalog`, which PostgREST doesn't expose, and each REST request runs in its own transaction.

These don't need the flag:
- `mark_liability_paid`: `linked_bill_id` is allowed and ownership-checked.
- `generate_recurring_transactions`: it writes no link columns.
- `split_update_expense`, `delete_split_*_atomic`, `split_create_group`, `split_consume_group_invite` and `split_leave_group`: they are `SECURITY DEFINER`.

Before shipping, re-run the "functions that write which tables" check under "Verified facts" against the live database, in case it differs from `schema.sql`.

Client check: `AddTransactionSheet.jsx` sends `linked_bill_id` (allowed, now ownership-checked) and never sends the split or loan link columns. The edit flow sends a full payload, but unchanged values pass the `is distinct from` checks.

**Verify:** after the migration, do each of these in the app. All must still succeed:
- add a loan and record a repayment;
- add a Splitwise expense (with "sync to my transactions" on), edit it, then delete it;
- record a settlement, then delete it;
- delete a whole group.

Then, via REST as a group member, try `update split_expenses set amount = 1`. It must fail.

**Reference approach, part B: defence in depth for rows already tampered with.** Only follow a pointer when the back-reference agrees. Every legitimate linked transaction has `linked_split_expense_id = <expense id>` or `linked_split_settlement_id = <settlement id>`; `split_create_expense`, `split_update_expense` and `split_record_settlement` all set it.

```sql
-- delete_split_expense_atomic: remove the pointer-based delete entirely.
--   delete from public.transactions where id = v_linked_txn;      -- DELETE THIS LINE
-- The existing line below already removes the legitimate linked rows:
--   delete from public.transactions where linked_split_expense_id = p_id;

-- delete_split_settlement_atomic: remove both pointer-based deletes (payer/payee);
-- keep: delete from public.transactions where linked_split_settlement_id = p_id;

-- split_update_expense: scope every access to v_linked_txn.
select user_id into v_existing_owner
from public.transactions
where id = v_linked_txn and linked_split_expense_id = p_expense_id;
-- ...
update public.transactions set ... where id = v_linked_txn and linked_split_expense_id = p_expense_id;
-- ...
delete from public.transactions where id = v_linked_txn and linked_split_expense_id = p_expense_id;

-- sync_split_to_transaction
update public.transactions
   set amount = new.amount, description = new.description, date = new.expense_date
 where id = new.linked_transaction_id
   and linked_split_expense_id = new.id
   and (amount is distinct from new.amount
     or description is distinct from new.description
     or date is distinct from new.expense_date);

-- sync_transaction_to_split
update public.split_expenses
   set amount = new.amount, description = new.description, expense_date = new.date
 where id = new.linked_split_expense_id
   and linked_transaction_id = new.id
   and (amount is distinct from new.amount
     or description is distinct from new.description
     or expense_date is distinct from new.date);
```

**Verify.** As a group member, `update split_expenses set linked_transaction_id = '<other user txn>'` fails (rejected by `guard_split_direct_writes`). `insert into transactions (..., linked_split_expense_id)` via REST fails (rejected by `guard_transaction_link_columns`). The existing `npm run test:splitwise-mutation-paths` and `test:splitwise-viewer-invite-flow` still pass.

## 1.4 Invite acceptance takes over an existing member by display name (high)

**Problem.** `split_consume_group_invite` lines 1630–1642 and the fallback at 1659–1665 match on `lower(display_name)` without requiring the row to be unlinked.

**Reference approach.**

```sql
  if not found then
    select m.id into v_existing_member_id
    from split_group_members m
    where m.group_id = v_invite.group_id
      and m.linked_user_id is null           -- only claim placeholder guests
      and m.is_self = false
      and lower(m.display_name) = lower(v_account_name)
    limit 1
    for update;

    if v_existing_member_id is not null then
      update split_group_members
      set display_name = v_account_name, user_id = v_uid, linked_user_id = v_uid
      where id = v_existing_member_id;
    else
      begin
        insert into split_group_members (group_id, display_name, is_self, linked_user_id, user_id)
        values (v_invite.group_id, v_account_name, false, v_uid, v_uid);
      exception
        when unique_violation then
          -- Name is taken by a linked member: join under a disambiguated name.
          insert into split_group_members (group_id, display_name, is_self, linked_user_id, user_id)
          values (v_invite.group_id,
                  v_account_name || ' (' || left(replace(v_uid::text, '-', ''), 4) || ')',
                  false, v_uid, v_uid);
      end;
    end if;
  end if;
```

While you're in this function, let invite acceptance upgrade a role (for example viewer to member) when the invite grants more. Change the `on conflict ... do update set role` to pick the higher of the existing and invited roles:

```sql
  on conflict (group_id, user_id) do update
    set role = case
      when 'admin'  in (excluded.role, split_group_access.role) then 'admin'
      when 'member' in (excluded.role, split_group_access.role) then 'member'
      else 'viewer'
    end;
```

## 1.5 Group settings editable by any member, and `split_groups.user_id` rewritable (medium)

**Problem.** Policy line 3720 allows `member` to update any column, including `user_id`. That makes the member the creator, so a later invite acceptance grants them admin (line 1591).

**Reference approach.** The client only updates `name`, `banner_id`, `is_archived` and `updated_at` (`useSplitwise.js` lines 515, 534 and 920).

```sql
drop policy if exists "split_groups: update own" on public.split_groups;
create policy "split_groups: update own" on public.split_groups
  for update to authenticated
  using (public.is_split_group_owner(id))
  with check (public.is_split_group_owner(id));

revoke update on public.split_groups from authenticated;
grant update (name, banner_id, is_archived, updated_at) on public.split_groups to authenticated;
```

Also enforce archive as read-only on the server. At the top of `split_create_expense`, `split_update_expense`, `split_record_settlement`, `delete_split_expense_atomic` and `delete_split_settlement_atomic`, after the group id is known:

```sql
  if exists (select 1 from public.split_groups where id = v_group_id and is_archived) then
    raise exception using errcode = '42501', message = 'This group is archived (read-only).';
  end if;
```

## 1.6 Every function is executable by anonymous users (medium)

**Problem.** Line 3794: `ALTER DEFAULT PRIVILEGES ... GRANT ALL ON FUNCTIONS TO "anon"`, never revoked.

**Reference approach.** Put this at the end of the migration, so it also covers functions re-created above:

```sql
-- The PUBLIC grant on functions is a global default. A schema-scoped
-- ALTER DEFAULT PRIVILEGES can't revoke it, so the PUBLIC revoke must omit IN SCHEMA.
alter default privileges for role postgres revoke execute on functions from public;
alter default privileges for role postgres in schema public revoke execute on functions from anon;
revoke execute on all functions in schema public from anon, public;
grant  execute on all functions in schema public to authenticated;

-- Signed-out invite landing page needs this one.
grant execute on function public.split_preview_group_invite(text) to anon;

-- Internal helpers that take a caller-supplied user id.
revoke execute on function public.is_linked(uuid, uuid) from authenticated;
```

Follow-up (optional, low priority): `has_split_group_access`, `is_split_group_member_or_above` and `is_split_group_owner` take `p_user_id default auth.uid()`, which lets a signed-in user test other users' membership. Grep every caller in `schema.sql`. If all of them pass the caller's id, add `and p_user_id = auth.uid()` to each helper's `where` clause.

## 1.7 Two concurrent invite redemptions can link one user to two partners (medium)

**Problem.** `consume_wallet_invite` locks only the invite row. The "already linked" check (lines 130–137) is a plain `exists`.

**Reference approach.** Insert right after the `select ... for update` that loads `v_invite_creator` (line 115), before the `already-linked` check:

```sql
  -- Serialize link changes for both people. Always lock in the same order to avoid deadlocks.
  perform pg_advisory_xact_lock(hashtext('kosha:partner:' || least(v_uid, v_invite_creator)::text));
  perform pg_advisory_xact_lock(hashtext('kosha:partner:' || greatest(v_uid, v_invite_creator)::text));
```

Under `READ COMMITTED`, the `exists` check that follows takes a fresh snapshot after the lock is acquired, so it sees the other transaction's committed link.

## 1.8 Bug reports bypass the rate limit and inject mentions (medium)

**Problem.** Direct `insert` on `bug_reports` (policy line 3509) skips `submit_bug_report`'s rate limit and priority mapping. The notify function posts `title` and `description` to Slack or Discord unescaped (`supabase/functions/bug-report-notify/index.ts` lines 174–196).

**Reference approach, SQL.** `submit_bug_report` is currently `SECURITY INVOKER`, so first make it definer. It already checks `auth.uid()`.

```sql
alter function public.submit_bug_report(text, text, text, text, text, text, jsonb, jsonb, text, text, text, text[])
  security definer;
alter function public.submit_bug_report(text, text, text, text, text, text, jsonb, jsonb, text, text, text, text[])
  set search_path = '';

drop policy if exists "bug_reports: insert own" on public.bug_reports;
drop policy if exists "bug_reports: update own" on public.bug_reports;
revoke insert, update on public.bug_reports from authenticated, anon;

alter table public.bug_reports
  add constraint bug_reports_description_len check (char_length(description) <= 4000) not valid;
```

Inside `submit_bug_report`, reject `p_screenshot_path` values that don't start with `auth.uid()::text || '/'`.

**Reference approach, edge function (`index.ts`).**

```ts
const clip = (s: unknown, n: number) => String(s ?? '').slice(0, n)
const escapeSlack = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const isDiscord = webhookUrl.includes('discord.com/api/webhooks')
const safe = (s: unknown, n: number) => (isDiscord ? clip(s, n) : escapeSlack(clip(s, n)))

// Only sign screenshots that live in the reporter's own folder.
if (report?.screenshot_path && String(report.screenshot_path).startsWith(`${user.id}/`)) { /* sign */ }

const textLines = [
  `New bug report (#${report.id})`,
  `Title: ${safe(report.title, 200)}`,
  `Severity/Priority: ${report.severity} / ${report.priority}`,
  `Route: ${safe(report.route || 'n/a', 200)}`,
  `Occurrences: ${report.occurrence_count || 1}`,
  `App: ${safe(report.app_version || 'n/a', 40)}`,
  screenshotUrl ? `Screenshot: ${screenshotUrl}` : null,
  `Description: ${safe(report.description, 1200)}`,
].filter(Boolean)

const payload = isDiscord
  ? { content: textLines.join('\n').slice(0, 1990), allowed_mentions: { parse: [] } }
  : { text: textLines.join('\n'), /* ...existing fields */ }

let webhookRes: Response | null = null
try {
  webhookRes = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(8000),
  })
} finally {
  if (!webhookRes?.ok) {
    await admin.from('bug_reports').update({ notified_at: null })
      .eq('id', report.id).eq('notified_at', claimedAt)
  }
}
```

Also change the CORS fallback from `*` to rejecting the request when `ALLOWED_ORIGINS` is unset.

## 1.9 Split totals may be off by a paisa (low, same migration)

In `split_create_expense` (line 1841) and `split_update_expense` (line 2436), round each share before summing and require an exact match:

```sql
    v_share := round(coalesce((v_item->>'share')::numeric, 0), 2);
    -- ...
  if v_sum <> round(p_amount, 2) then
    raise exception 'Split total (%) does not match amount (%)', v_sum, p_amount;
  end if;
```

The client already sends exact paise sums (`splitwiseMath.js`), so this doesn't affect normal use.

## 1.10 Member removal deletes their debts (high); replace with archiving (decision D1)

**Problem.** `split_expense_splits_member_id_fkey ... ON DELETE CASCADE` (line 3377). Removing a member silently deletes their shares, but payers keep full credit, so the group's balances no longer add up. Members who paid something can't be removed at all (the payer foreign key is `RESTRICT`), and the user sees a raw foreign-key error.

**Decision.** Members are never hard-deleted. An admin archives them, which is only allowed at zero balance. Archived members:
- keep all their history (expenses, shares, settlements);
- are excluded from new splits, the payer picker and the participant list;
- lose group access if they were a linked user.

**Reference approach, SQL.**

```sql
alter table public.split_group_members add column if not exists archived_at timestamptz;

-- Safety net: shares can never be cascade-deleted again.
alter table public.split_expense_splits drop constraint if exists split_expense_splits_member_id_fkey;
alter table public.split_expense_splits
  add constraint split_expense_splits_member_id_fkey
  foreign key (member_id) references public.split_group_members(id) on delete restrict;

-- Direct deletes are no longer allowed; archiving goes through the RPC below.
drop policy if exists "split_group_members: delete own" on public.split_group_members;
revoke delete on public.split_group_members from authenticated, anon;

-- Same sign convention as src/lib/splitwiseMath.js: positive = the group owes this member.
create or replace function public.split_member_net_balance(p_member_id uuid)
returns numeric
language sql stable
set search_path = ''
as $$
  select
      coalesce((select sum(e.amount) from public.split_expenses e       where e.paid_by_member_id = p_member_id), 0)
    - coalesce((select sum(s.share)  from public.split_expense_splits s where s.member_id        = p_member_id), 0)
    + coalesce((select sum(t.amount) from public.split_settlements t    where t.payer_member_id  = p_member_id), 0)
    - coalesce((select sum(t.amount) from public.split_settlements t    where t.payee_member_id  = p_member_id), 0);
$$;

create or replace function public.split_archive_member(p_member_id uuid)
returns public.split_group_members
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_member public.split_group_members%rowtype;
  v_balance numeric;
begin
  if v_uid is null then raise exception using errcode = '28000', message = 'unauthenticated'; end if;

  select * into v_member from public.split_group_members where id = p_member_id for update;
  if not found then raise exception 'Member not found'; end if;

  -- Serialize against concurrent expense/settlement writes for this group.
  perform 1 from public.split_groups where id = v_member.group_id for update;

  if not public.is_split_group_owner(v_member.group_id, v_uid) then
    raise exception using errcode = '42501', message = 'Only a group admin can remove members.';
  end if;
  if v_member.archived_at is not null then return v_member; end if;
  if v_member.linked_user_id = v_uid then
    raise exception 'Use "Leave group" to remove yourself.';
  end if;

  v_balance := public.split_member_net_balance(p_member_id);
  if v_balance <> 0 then
    raise exception using errcode = 'P0001',
      message = format('This member still has an unsettled balance of %s. Settle up first.', v_balance);
  end if;

  update public.split_group_members set archived_at = now()
  where id = p_member_id
  returning * into v_member;

  if v_member.linked_user_id is not null then
    delete from public.split_group_access
    where group_id = v_member.group_id and user_id = v_member.linked_user_id;
  end if;

  return v_member;
end;
$$;
grant execute on function public.split_archive_member(uuid) to authenticated;
```

In `split_create_expense`, `split_update_expense` and `split_record_settlement`, reject archived members. Add `and m.archived_at is null` to:
- every `exists (select 1 from split_group_members m where m.id = ... and m.group_id = ...)` membership check;
- the payer, payee and split-member lookups.

In `split_consume_group_invite` (1.4), when a returning user re-joins, un-archive their old row instead of inserting a new one:

```sql
  update split_group_members
  set display_name = v_account_name, user_id = v_uid, linked_user_id = v_uid, archived_at = null
  where group_id = v_invite.group_id and linked_user_id = v_uid;
```

**Reference approach, client.**

`src/hooks/useSplitwise.js`:

```js
const MEMBER_COLUMNS = 'id, group_id, display_name, is_self, linked_user_id, user_id, created_at, archived_at'

export async function deleteSplitMemberMutation(memberId) {
  if (getActiveWalletUserId() !== getAuthUserId()) {
    throw new Error('Shared wallets are view-only. You cannot remove members here.')
  }
  if (!memberId) throw new Error('Member is required.')

  const { error } = await supabase.rpc('split_archive_member', { p_member_id: memberId })
  if (error) throw error
  await invalidateSplitwiseCache()
  return true
}
```

Keep the exported name `deleteSplitMemberMutation` (it's registered in `queryClient.js` and used by `useSplitwiseLogic.js`), and change the UI label from "Remove" to "Remove from group".

`src/hooks/useSplitwiseLogic.js`:
- `activeMembers` (line 549) must exclude `member.archived_at`.
- The balance and history views keep using the full `members` list, so archived members still appear in past expenses. Render their name with an "(removed)" suffix.
- Before calling the mutation, check the member's balance from `balances` on the client and show "Settle up with X first" instead of calling the server.

---

## 1.11 Anyone in a group can edit or delete anyone's expense (decision D4)

**Problem.** `delete_split_expense_atomic`, `split_update_expense` and `delete_split_settlement_atomic` only check `is_split_group_member_or_above`. Any member can therefore delete another person's expense, which also deletes that person's linked personal transaction. `split_record_settlement` also lets any member record a settlement between two other people.

**Decision.** An expense or settlement can be edited or deleted only by its creator (`user_id`) or a group admin. A settlement can be recorded by its payer, its payee (their linked users) or an admin.

**Reference approach, SQL.**

```sql
-- delete_split_expense_atomic: load the creator too, then check.
  select group_id, user_id into v_group_id, v_owner
  from public.split_expenses where id = p_id for update;
  if v_group_id is null then return false; end if;
  if v_owner is distinct from v_uid and not public.is_split_group_owner(v_group_id, v_uid) then
    raise exception using errcode = '42501', message = 'Only the person who added this expense or a group admin can delete it.';
  end if;

-- split_update_expense (after `select * into v_expense ... for update`):
  if v_expense.user_id is distinct from v_uid and not public.is_split_group_owner(v_expense.group_id, v_uid) then
    raise exception using errcode = '42501', message = 'Only the person who added this expense or a group admin can edit it.';
  end if;

-- delete_split_settlement_atomic: same pattern with split_settlements.user_id.

-- split_record_settlement, after v_payer_uid / v_payee_uid are resolved:
  if v_uid is distinct from v_payer_uid
     and v_uid is distinct from v_payee_uid
     and not public.is_split_group_owner(p_group_id, v_uid) then
    raise exception using errcode = '42501', message = 'Only the payer, the payee or a group admin can record this settlement.';
  end if;
```

Declare `v_owner uuid;` where needed. Put these checks **before** any delete or update statement in each function.

**Reference approach, client.**

```js
// src/hooks/useSplitwise.js
const EXPENSE_COLUMNS =
  'id, group_id, user_id, paid_by_member_id, description, amount, expense_date, split_method, notes, created_at, split_expense_splits(id, member_id, share, percent, shares), transactions!linked_transaction_id(category)'
const SETTLEMENT_COLUMNS =
  'id, group_id, user_id, payer_member_id, payee_member_id, amount, settled_at, note, created_at'
```

In `ActiveGroupView.jsx` (around line 349) and wherever expense or settlement rows render Edit and Remove, show them only when `row.user_id === authUserId || isAdmin`. Compute `isAdmin` from the `split_group_access` role only (see 5.9).

In the settlement form, when the caller isn't an admin, limit the payer and payee pickers so that one of them is always the caller's own member.

---

# Phase 2 — Database correctness (migration `20260930_correctness.sql`)

## 2.1 Recurring dates drift to the 28th; `p_today` is unbounded; UTC date

**Problem.** In `generate_recurring_transactions` (lines 492–586), `v_run_date + interval '1 month'` accumulates the month-end clamp (31 Jan → 28 Feb → 28 Mar …). `p_today` is client-controlled, and its default `CURRENT_DATE` is the UTC date.

**Reference approach.** Compute each occurrence from the template's original date (`rec.date`) plus N months, clamp `p_today`, and cap iterations. Drop and recreate the function, because the parameter default changes.

```sql
drop function if exists public.generate_recurring_transactions(uuid, date);

create function public.generate_recurring_transactions(p_user_id uuid, p_today date default null)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  -- Client passes its local date; accept at most one day either side of server UTC.
  v_today date := least(greatest(coalesce(p_today, current_date), current_date - 1), current_date + 1);
  v_step int;
  v_k int;
  v_run_date date;
  v_inserted int := 0;
  v_guard int;
  rec record;
begin
  if v_uid is null then raise exception 'Authentication required.'; end if;
  if v_uid <> p_user_id then raise exception 'Cannot generate recurring transactions for another user.'; end if;

  perform pg_advisory_xact_lock(hashtext('kosha:recurring:' || p_user_id::text));

  for rec in
    select * from public.transactions
    where user_id = p_user_id and is_recurring = true and recurrence is not null
  loop
    v_step := case rec.recurrence when 'monthly' then 1 when 'quarterly' then 3 when 'yearly' then 12 end;
    continue when v_step is null;

    v_run_date := coalesce(rec.next_run_date, (rec.date + make_interval(months => v_step))::date);
    continue when v_run_date > v_today;

    -- Whole months between the anchor and the next run (self-heals rows that already drifted).
    v_k := ((extract(year from v_run_date) - extract(year from rec.date)) * 12
          + (extract(month from v_run_date) - extract(month from rec.date)))::int;
    v_guard := 0;

    while v_run_date <= v_today and v_guard < 120 loop
      insert into public.transactions (
        date, type, description, amount, category, investment_vehicle, is_repayment,
        payment_mode, notes, is_recurring, recurrence, next_run_date,
        source_transaction_id, is_auto_generated, user_id
      ) values (
        v_run_date, rec.type, rec.description, rec.amount, rec.category, rec.investment_vehicle,
        rec.is_repayment, rec.payment_mode, rec.notes, false, null, null,
        rec.id, true, rec.user_id
      );
      v_inserted := v_inserted + 1;
      v_guard := v_guard + 1;
      v_k := v_k + v_step;
      v_run_date := (rec.date + make_interval(months => v_k))::date;
    end loop;

    update public.transactions set next_run_date = v_run_date
    where id = rec.id and user_id = p_user_id;
  end loop;

  return v_inserted;
end;
$$;

grant execute on function public.generate_recurring_transactions(uuid, date) to authenticated;
```

**Client (`src/hooks/useTransactions.js`, `maybeGenerateRecurringTransactions`).** Pass the local date, and handle the returned error: `supabase.rpc` never throws, so the current `try/catch` never sees failures.

```js
    const { error } = await supabase.rpc('generate_recurring_transactions', {
      p_user_id: userId,
      p_today: todayStr(),
    })
    if (error) throw error
    return true
```

## 2.2 `mark_liability_paid`: UTC date and month-end drift

**Problem.** Line 1331 inserts `current_date` (UTC), so bills paid between 00:00 and 05:30 IST land on yesterday. Lines 1349–1354 have the same month-end drift as 2.1.

**Reference approach.**

```sql
alter table public.liabilities add column if not exists recurrence_anchor date;
update public.liabilities set recurrence_anchor = due_date
where is_recurring and recurrence_anchor is null;

drop function if exists public.mark_liability_paid(uuid, uuid);
create function public.mark_liability_paid(p_liability_id uuid, p_user_id uuid, p_paid_on date default null)
returns json
language plpgsql
set search_path = 'public'
as $$
declare
  v_liability liabilities%rowtype;
  v_txn_id uuid;
  v_next_due date;
  v_txn_mode text;
  v_paid_on date := least(greatest(coalesce(p_paid_on, current_date), current_date - 1), current_date + 1);
  v_anchor date;
  v_step int;
  v_k int;
begin
  select * into v_liability from liabilities
  where id = p_liability_id and user_id = p_user_id
  for update;
  if not found then raise exception 'Liability not found or access denied'; end if;

  if v_liability.paid then
    -- Idempotent: a retry after a lost response returns the original result.
    return json_build_object(
      'transaction_id', v_liability.linked_transaction_id,
      'liability_id', p_liability_id,
      'next_due_date', null,
      'already_paid', true
    );
  end if;

  -- ... v_txn_mode mapping unchanged ...

  insert into transactions (date, type, description, amount, category, is_repayment, payment_mode, user_id, linked_bill_id)
  values (v_paid_on, 'expense', v_liability.description, v_liability.amount, 'bills', false, v_txn_mode, p_user_id, p_liability_id)
  returning id into v_txn_id;

  update liabilities set paid = true, linked_transaction_id = v_txn_id where id = p_liability_id;

  if v_liability.is_recurring and v_liability.recurrence is not null then
    v_step := case v_liability.recurrence when 'quarterly' then 3 when 'yearly' then 12 else 1 end;
    v_anchor := coalesce(v_liability.recurrence_anchor, v_liability.due_date);
    v_k := ((extract(year from v_liability.due_date) - extract(year from v_anchor)) * 12
          + (extract(month from v_liability.due_date) - extract(month from v_anchor)))::int + v_step;
    v_next_due := (v_anchor + make_interval(months => v_k))::date;

    insert into liabilities (description, amount, due_date, is_recurring, recurrence, paid, payment_mode, user_id, recurrence_anchor)
    values (v_liability.description, v_liability.amount, v_next_due, true, v_liability.recurrence, false,
            v_liability.payment_mode, p_user_id, v_anchor);
  end if;

  return json_build_object('transaction_id', v_txn_id, 'liability_id', p_liability_id, 'next_due_date', v_next_due);
end;
$$;
grant execute on function public.mark_liability_paid(uuid, uuid, date) to authenticated;
```

**Client (`src/hooks/useLiabilities.js` `markPaid`, line 169).**

```js
    .rpc('mark_liability_paid', {
      p_liability_id: liability.id,
      p_user_id: userId,
      p_paid_on: todayStr(),
    })
```

In `markLiabilityPaidMutation`, treat `result?.already_paid` as success: skip the rollback and invalidate.

**Sibling to handle.** `recurrence_anchor` must stay in step with user edits. When the client edits `due_date` on a recurring bill (`useLiabilities.js` `updateLiability`, around line 198; the form is in `Bills.jsx`), also send `recurrence_anchor: newDueDate`. Otherwise the next generated bill keeps the old day of the month. A `BEFORE UPDATE` trigger that sets `new.recurrence_anchor := new.due_date` when `due_date` changes and `paid` hasn't changed also works, and covers every caller. New bills don't need it: `mark_liability_paid` falls back to `due_date` when the anchor is null.

Also fix the optimistic row's payment mode (`useLiabilities.js` line 467) to match the server mapping:

```js
const LIABILITY_TO_TXN_MODE = { card: 'credit_card', bank: 'net_banking', upi: 'upi', cash: 'cash' }
// optimistic row:
payment_mode: LIABILITY_TO_TXN_MODE[liability.payment_mode] || 'other',
```

## 2.3 `record_loan_payment`: idempotency check runs too late; float amounts; UTC date

**Problem.**
- Lines 1435–1441 run the overpayment and `settled` checks **before** the `on conflict (id)` idempotency path. A retry after a successful final payment therefore fails with "already fully settled" instead of returning the original result.
- `p_amount` arrives as a float such as `666.6700000000001`, and the exact `numeric` comparison rejects it.
- `current_date` is the UTC date (line 1456).

**Reference approach.**

```sql
drop function if exists public.record_loan_payment(uuid, uuid, numeric, uuid);
create function public.record_loan_payment(
  p_loan_id uuid, p_user_id uuid, p_amount numeric, p_id uuid default null, p_paid_on date default null
) returns json
language plpgsql
set search_path = 'public'
as $$
declare
  v_loan public.loans%rowtype;
  v_existing public.transactions%rowtype;
  v_new_settled numeric;
  v_fully_settled boolean;
  v_txn_type text;
  v_paid_on date := least(greatest(coalesce(p_paid_on, current_date), current_date - 1), current_date + 1);
begin
  perform set_config('kosha.trusted_write', 'true', true);  -- see 1.3
  p_amount := round(p_amount, 2);
  if p_amount is null or p_amount <= 0 then raise exception 'Payment amount must be positive'; end if;

  select * into v_loan from public.loans
  where id = p_loan_id and user_id = p_user_id
  for update;
  if not found then raise exception 'Loan not found or access denied'; end if;

  -- Idempotency first: a retry with the same id returns the original outcome.
  if p_id is not null then
    select * into v_existing from public.transactions where id = p_id and user_id = p_user_id;
    if found then
      return json_build_object(
        'transaction_id', p_id, 'loan_id', p_loan_id, 'payment_amount', v_existing.amount,
        'new_amount_settled', v_loan.amount_settled, 'fully_settled', v_loan.settled
      );
    end if;
  end if;

  if v_loan.settled then raise exception 'Loan is already fully settled'; end if;

  v_new_settled := v_loan.amount_settled + p_amount;
  if v_new_settled > v_loan.amount then
    raise exception 'Payment exceeds remaining balance (remaining: %)', (v_loan.amount - v_loan.amount_settled);
  end if;
  v_fully_settled := v_new_settled >= v_loan.amount;
  v_txn_type := case v_loan.direction when 'given' then 'income' else 'expense' end;

  insert into transactions (id, date, type, description, amount, category, is_repayment, payment_mode, user_id, linked_loan_id)
  values (coalesce(p_id, gen_random_uuid()), v_paid_on, v_txn_type, 'Loan payment: ' || v_loan.counterparty,
          p_amount, 'loans', true, 'other', p_user_id, p_loan_id)
  returning id into p_id;

  update public.loans set amount_settled = v_new_settled, settled = v_fully_settled where id = p_loan_id;

  return json_build_object('transaction_id', p_id, 'loan_id', p_loan_id, 'payment_amount', p_amount,
                           'new_amount_settled', v_new_settled, 'fully_settled', v_fully_settled);
end;
$$;
grant execute on function public.record_loan_payment(uuid, uuid, numeric, uuid, date) to authenticated;
```

Apply the same pattern to `create_loan` (lines 161–245): raise when `v_loan.id is null` or `v_loan.user_id <> p_user_id` after the `on conflict do nothing`, instead of inserting an orphan transaction. Also add `p_loan_date` validation.

**Client (`useLoans.js` `recordPayment`, line 170).** Add `p_paid_on: todayStr()`. The id change is covered in 4.3.

## 2.4 Account deletion: personal data cascades, shared history survives (decision D2)

**Problem.** Today some foreign keys **block** account deletion outright (no `ON DELETE` action on `invites`, `budgets` and `split_group_invites`). Others **wipe other people's data**:
- a member's own expenses, settlements and shares in shared groups (`CASCADE`);
- every guest they added (`split_group_members.user_id`);
- whole groups they created (`split_groups.user_id`).

**Decision.** Personal data is deleted along with the account. Shared Splitwise rows stay, with the user reference cleared, and the UI shows the stored display name (or "Deleted user" when there isn't one).

**Reference approach.** All the columns set to `SET NULL` below are already nullable in `schema.sql`. The constraint names match `schema.sql` lines 3316–3457; confirm them against the live database first with `select conrelid::regclass, conname from pg_constraint where confrelid = 'auth.users'::regclass;`.

```sql
-- Personal data: delete with the account.
alter table public.budgets drop constraint if exists budgets_user_id_fkey,
  add constraint budgets_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.invites drop constraint if exists invites_created_by_fkey,
  add constraint invites_created_by_fkey foreign key (created_by) references auth.users(id) on delete cascade;
alter table public.invites drop constraint if exists invites_used_by_fkey,
  add constraint invites_used_by_fkey foreign key (used_by) references auth.users(id) on delete cascade;
alter table public.split_group_invites drop constraint if exists split_group_invites_created_by_fkey,
  add constraint split_group_invites_created_by_fkey foreign key (created_by) references auth.users(id) on delete cascade;
alter table public.split_group_invites drop constraint if exists split_group_invites_consumed_by_fkey,
  add constraint split_group_invites_consumed_by_fkey foreign key (consumed_by) references auth.users(id) on delete set null;

-- Shared history: keep the rows, clear the user reference.
alter table public.split_groups drop constraint if exists split_groups_user_id_fkey,
  add constraint split_groups_user_id_fkey foreign key (user_id) references auth.users(id) on delete set null;
alter table public.split_group_members drop constraint if exists split_group_members_user_id_fkey,
  add constraint split_group_members_user_id_fkey foreign key (user_id) references auth.users(id) on delete set null;
alter table public.split_expenses drop constraint if exists split_expenses_user_id_fkey,
  add constraint split_expenses_user_id_fkey foreign key (user_id) references auth.users(id) on delete set null;
alter table public.split_expense_splits drop constraint if exists split_expense_splits_user_id_fkey,
  add constraint split_expense_splits_user_id_fkey foreign key (user_id) references auth.users(id) on delete set null;
alter table public.split_settlements drop constraint if exists split_settlements_user_id_fkey,
  add constraint split_settlements_user_id_fkey foreign key (user_id) references auth.users(id) on delete set null;

-- Unchanged and correct: split_group_access.user_id CASCADE (a deleted user loses access),
-- split_group_members.linked_user_id SET NULL, transactions/loans/liabilities/... CASCADE.
```

A group whose only admin deletes their account must not be left without an admin. `split_leave_group` and `split_set_group_access_role` already block this during normal use, so this trigger only fires on account deletion:

```sql
create or replace function public.ensure_group_has_admin()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if old.role = 'admin' and not exists (
    select 1 from public.split_group_access where group_id = old.group_id and role = 'admin'
  ) then
    update public.split_group_access set role = 'admin'
    where id = (
      select id from public.split_group_access
      where group_id = old.group_id
      order by case role when 'member' then 0 else 1 end, created_at
      limit 1
    );
  end if;
  return old;
end;
$$;

drop trigger if exists trg_ensure_group_has_admin on public.split_group_access;
create trigger trg_ensure_group_has_admin
  after delete on public.split_group_access
  for each row execute function public.ensure_group_has_admin();
```

**Things that follow from this:**
- `split_groups.user_id` can now be null. Everything that uses it as an "owner" shortcut must use the access role instead:
  - the `when v_group.user_id = v_uid then 'admin'` case in `split_consume_group_invite` (line 1591) is harmless and can stay;
  - the client shortcuts are removed in 5.9.
- Expenses and settlements whose creator was deleted (`user_id is null`) can only be edited or deleted by an admin, under 1.11.
- In the member list, render a member with `linked_user_id == null && user_id == null` created before the deletion using the stored `display_name`. Fall back to "Deleted user" when `display_name` is empty.

**Verify.** On staging, create a user who owns a group with one other member, has added one expense and one guest, and has used a wallet invite. Delete that user via the Supabase dashboard. The deletion succeeds; the group, the expense and the guest still exist; and the other member is now admin.

---

# Phase 3 — Undo-delete and effect loops (client)

## 3.1 New shared hook: `src/hooks/useUndoableDelete.js`

**Problem.** Transactions, Dashboard, Loans and Bills each copy a pattern whose "commit on unmount" effect depends on a `useMutation` result object. That object changes every render, so the cleanup commits the delete on the very next render and Undo silently does nothing. The end-to-end tests skip the undo path (`shouldCommitDeleteImmediately`), which is why this wasn't caught.

**Reference approach.** Create one hook with stable identity. It also commits pending deletes when the app is backgrounded or closed; today they're lost if the PWA is swiped away within the undo window.

```js
import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'

// Holds one pending delete at a time. `commit`, `restore` and `onError` may change
// every render; the hook reads the latest versions through a ref.
export function useUndoableDelete({ commit, restore, onError, windowMs = 4200 }) {
  const pendingRef = useRef(null)
  const handlersRef = useRef({ commit, restore, onError })
  useLayoutEffect(() => {
    handlersRef.current = { commit, restore, onError }
  })

  const run = useCallback(async (pending) => {
    if (!pending) return
    clearTimeout(pending.timeoutId)
    try {
      await handlersRef.current.commit(pending.id, pending.snapshot)
    } catch (error) {
      handlersRef.current.restore?.(pending.snapshot)
      handlersRef.current.onError?.(error)
    }
  }, [])

  const flush = useCallback(() => {
    const pending = pendingRef.current
    pendingRef.current = null
    return run(pending)
  }, [run])

  const schedule = useCallback((id, snapshot) => {
    const current = pendingRef.current
    if (current && current.id !== id) void flush()
    else if (current) clearTimeout(current.timeoutId)

    const timeoutId = setTimeout(() => {
      if (pendingRef.current?.id === id) void flush()
    }, windowMs)
    pendingRef.current = { id, snapshot, timeoutId }
  }, [flush, windowMs])

  const undo = useCallback((id) => {
    const pending = pendingRef.current
    if (!pending || pending.id !== id) return false
    clearTimeout(pending.timeoutId)
    pendingRef.current = null
    handlersRef.current.restore?.(pending.snapshot)
    return true
  }, [])

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') void flush()
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', flush)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', flush)
      void flush()
    }
  }, [flush])

  return { schedule, undo, flush }
}
```

## 3.2 `src/hooks/useTransactionDeleter.js`

Replace the file body. Keep the `removeTransactionMutation` import; the contract test requires it in `Transactions.jsx`, which already has it in a comment.

```js
export function useTransactionDeleter(activeWalletUserId, data) {
  const { pushToast } = useAppToast()
  const { mutateAsync: removeNow } = useAppMutation(removeTransactionMutation, { context: 'transactions:delete' })
  const { mutateAsync: commitDelete } = useAppMutation(removeTransactionMutation, { context: 'transactions:deleteCommit' })

  const { schedule, undo } = useUndoableDelete({
    commit: (id) => commitDelete(id),
    restore: ({ txn, walletUserId }) => optimisticallyUpsertTransactionInCache(txn, walletUserId),
    onError: (e) => pushToast(e.message || 'Could not delete transaction.', { duration: 4200 }),
    windowMs: DELETE_UNDO_WINDOW_MS,
  })

  const handleDelete = useCallback(async (id) => {
    if (!id) return false
    const txn = data.find((row) => row?.id === id)

    if (!txn || shouldCommitDeleteImmediately()) {
      try {
        await removeNow(id)
        return true
      } catch (e) {
        pushToast(e.message || 'Could not delete transaction.', { duration: 4200 })
        throw e
      }
    }

    optimisticallyDeleteTransactionFromCache(id, activeWalletUserId)
    schedule(id, { txn: { ...txn }, walletUserId: activeWalletUserId })
    pushToast('Transaction deleted.', {
      action: () => { if (undo(id)) pushToast('Deletion canceled.', { duration: 2200 }) },
      actionLabel: 'Undo',
      duration: DELETE_UNDO_WINDOW_MS,
    })
    return undefined
  }, [data, activeWalletUserId, removeNow, schedule, undo, pushToast])

  return { handleDelete }
}
```

Keep `shouldCommitDeleteImmediately` for end-to-end runs, but add a unit test (Vitest plus React Testing Library, in `scripts/tests/unit/hooks/`) that renders the hook, deletes, forces a re-render and taps Undo. Assert that the mutation was **not** called.

## 3.3 `src/pages/Dashboard.jsx` (lines 488–568)

Delete the local `pendingDeleteRef`, `commitPendingDelete` and unmount effect. Then either:
- reuse `useTransactionDeleter(activeWalletUserId, recent)` (preferred), or
- apply the same `useUndoableDelete` wiring.

**Also:** don't pass `onDelete` / `onDuplicate` to `TransactionItem` when `activeWalletUserId !== user.id` (partner view). Today the row disappears from the cache, `removeTransactionMutation` returns `false`, and the row is never restored.

## 3.4 `src/components/obligations/Loans.jsx` and `Bills.jsx`

Same replacement. The loan version also has to undo the linked-transaction hiding (this fixes the "failed delete leaves item hidden" issue):

```js
const { mutateAsync: deleteLoanAsync } = useAppMutation(deleteLoanMutation, { context: 'loans:delete' })

const { schedule, undo } = useUndoableDelete({
  commit: (id) => deleteLoanAsync(id),
  restore: ({ loan, walletUserId, txnIds }) => {
    setHiddenIds((prev) => { const n = new Set(prev); n.delete(loan.id); return n })
    optimisticallyInsertLoan(loan, walletUserId)
    import('../../hooks/useTransactions').then((m) => {
      for (const txnId of txnIds) m.inFlightDeletedTxnIds.delete(txnId)
      return m.invalidateCache()
    })
  },
  onError: (e) => pushToast(e.message || 'Could not delete loan.', { duration: 4200 }),
})

async function handleDelete(id) {
  const loan = [...given, ...taken, ...settled].find((l) => l.id === id)
  if (!loan) return false
  setHiddenIds((prev) => new Set(prev).add(id))
  optimisticallyDeleteLoan(id, activeWalletUserId)
  const m = await import('../../hooks/useTransactions')
  const txnIds = m.optimisticallyDeleteTransactionsByLoanId(id, activeWalletUserId) || new Set()
  schedule(id, { loan: { ...loan }, walletUserId: activeWalletUserId, txnIds })
  pushToast('Loan deleted.', {
    action: () => { if (undo(id)) pushToast('Deletion canceled.', { duration: 2200 }) },
    actionLabel: 'Undo',
    duration: 4200,
  })
  return true
}
```

Bills does the same with `optimisticallyDeleteTransactionsByBillId`, `setHiddenBillIds` and the existing pending/paid re-insert logic in `restore`. Keep `deleteLiabilityMutation` referenced in `Bills.jsx`, because the contract test requires it.

## 3.5 Splitwise invite preview effect loops (`src/hooks/useSplitwiseLogic.js` lines 587–622)

**Problem.** `previewGroupInvite` (a mutation result object) is in the dependency list. Each `mutateAsync` re-renders, the cleanup sets `cancelled = true`, and the effect fires again, so the result is never applied.

**Reference approach.** Call the plain function, and dedupe by token with a ref. Don't cancel on dependency change; StrictMode would otherwise drop the only request.

```js
const previewAttemptRef = useRef('')

useEffect(() => {
  let inviteToken = inviteTokenFromQuery
  if (!inviteToken) {
    try { inviteToken = String(sessionStorage.getItem('pendingSplitGroupInviteToken') || '').trim() } catch { inviteToken = '' }
  }
  if (!inviteToken || consumingInvite || invitePreview?.token === inviteToken) return
  if (previewAttemptRef.current === inviteToken) return
  previewAttemptRef.current = inviteToken

  previewSplitGroupInviteMutation(inviteToken)
    .then((preview) => {
      if (previewAttemptRef.current !== inviteToken) return
      setInvitePreview({
        token: inviteToken,
        groupId: preview.group_id,
        groupName: preview.group_name,
        invitedRole: preview.invited_role || 'viewer',
      })
    })
    .catch((previewError) => {
      if (previewAttemptRef.current !== inviteToken) return
      pushToast(toToastMessage(previewError, 'Could not open shared group invite.'))
      clearPendingSplitInviteToken()
    })
}, [inviteTokenFromQuery, consumingInvite, invitePreview?.token, clearPendingSplitInviteToken, pushToast])
```

Remove `const previewGroupInvite = useAppMutation(...)` (line 153) if nothing else uses it.

Also `src/pages/InviteLanding.jsx`: after `await consumeSplitGroupInviteMutation(activeToken)` succeeds (line 132), clear the stored token so the Splitwise page doesn't re-preview a used invite:

```js
try { sessionStorage.removeItem('pendingSplitGroupInviteToken') } catch { /* private mode */ }
```

Do the same for `pendingInviteToken` after the wallet invite is consumed.

## 3.6 Memoise the toast context (`src/context/ToastContext.jsx`)

```jsx
import { createContext, useContext, useMemo } from 'react'
// ...
  const value = useMemo(() => ({ pushToast, dismissToast }), [pushToast, dismissToast])
  return (
    <ToastContext.Provider value={value}>
```

This stops every `useAppToast()` consumer (and every `TransactionItem`) re-rendering on each toast.

## 3.7 Sweep for the same pattern

Run `rg -n "\], *\[[^\]]*(Mutation|mutation|save|delete|remove|add|record|settle)[A-Za-z]*\]" src` and review every hit where a `useAppMutation(...)` result is a dependency. Replace each with a destructured `mutateAsync`. Known remaining hits:
- `Loans.jsx` line 681: `handleSettleFull` depends on `settleLoan`.
- `useSplitwiseLogic.js`: handlers that list mutation objects.

---

# Phase 4 — Idempotency and offline behaviour (client)

## 4.1 Turn off queued offline writes; fail fast with a clear message (decision D5)

**Problem.** The "Stage 2" offline queue has never worked:
- `setMutationDefaults([[context]], …)` (`src/lib/queryClient.js` line 120) registers the key `[['transactions:save']]`, but `useAppMutation` uses `['transactions:save']`. TanStack's `partialMatchKey` compares a string with an array and fails, so persisted mutations resume with no `mutationFn`.
- `App.jsx` line 127 resumes paused mutations before sign-in has loaded, so any replay would throw "Session initialising".
- Replaying safely would also need stable ids everywhere (4.2, 4.3) and retry handling in every server function (Phase 2).

Meanwhile the `offlineFirst` / `online` network modes make mutations pause while offline, which leaves forms stuck on "Saving…" (4.4).

**Decision.** Writes require a connection. Mutations fail immediately with a clear message when offline. Reads keep working from the persisted query cache and the service worker.

**Reference approach, `src/lib/offlineError.js` (new).**

```js
export class OfflineError extends Error {
  constructor(message = "You're offline. Connect to the internet and try again.") {
    super(message)
    this.name = 'OfflineError'
    this.code = 'OFFLINE'
  }
}

export function assertOnline() {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new OfflineError()
}
```

**Reference approach, `src/hooks/useAppMutation.js`.** Move `MUTATION_RETRY` into `src/lib/mutationRetry.js` (see 4.4) and import it here.

```js
import { useMutation } from '@tanstack/react-query'
import { MUTATION_RETRY } from '../lib/mutationRetry'
import { assertOnline } from '../lib/offlineError'

export function useAppMutation(mutationFn, { context, meta, mutationKey, ...options } = {}) {
  return useMutation({
    mutationKey: mutationKey || (context ? [context] : undefined),
    // 'always': never pause. Offline is handled explicitly by assertOnline() so the
    // caller gets an error immediately instead of a mutation stuck in isPending.
    networkMode: 'always',
    retry: MUTATION_RETRY,
    mutationFn: async (args) => {
      assertOnline()
      return mutationFn(args)
    },
    ...options,
    meta: { context, ...(meta || {}) },
  })
}
```

Then remove every `networkMode: 'online'` override passed to `useAppMutation`. There are seven, in `Settings.jsx` lines 89–93 and `Onboarding.jsx` lines 264–265. Under `online` mode an offline tap pauses forever.

**Reference approach, `src/lib/errorTaxonomy.js`.** Classify `error.name === 'OfflineError'` (or `error.code === 'OFFLINE'`) as an expected error, so it isn't reported to Sentry and `toToastMessage` shows its message as-is.

**Reference approach, `src/lib/queryClient.js`.**
- Delete the `resumableMutations` map, the `setMutationDefaults` loop (lines 80–121) and the mutation-function imports at the top (lines 4–15).
- This also removes a circular import: `queryClient` → hooks → `queryClient`.

**Reference approach, `src/App.jsx`.**
- Remove the `onSuccess={() => queryClient.resumePausedMutations()…}` prop from `PersistQueryClientProvider`.
- Stop persisting mutations:

```jsx
dehydrateOptions: {
  shouldDehydrateMutation: () => false,
  shouldDehydrateQuery: (query) => { /* unchanged */ },
},
```

**Bump `package.json` `version`.** The persister's `buster` is `VITE_APP_VERSION`, so this discards any paused mutations already sitting in users' IndexedDB.

**Reference approach, `AppBehaviors.jsx` line 479.** Update the offline banner copy, which currently promises syncing:

```jsx
<span className="text-[12px] font-semibold">You're offline. You can browse, but changes need a connection.</span>
```

Also update the "Stage 2" comments in `useAppMutation.js` and `queryClient.js` so nobody assumes offline queuing exists.

**Future work (not now).** If offline writes come back, limit them to `transactions:save` and do it as a separate feature. That needs a stable client id (4.2), `setMutationDefaults([context], …)`, resuming only after `useIsRestoring() === false && user` is ready, and an end-to-end test covering offline → reload → reconnect.

## 4.2 Client-generated ids for new transactions

**Problem.** `addTransaction` does a plain `insert` and mutations retry up to twice. If the server commits but the response is lost, a duplicate row is created.

**Reference approach, `src/hooks/useTransactions.js`.**

```js
export async function addTransaction(payload, mutationUserId = null, clientId = null) {
  const userId = mutationUserId || getActiveWalletUserId()
  if (!userId) throw new Error('No active wallet selected.')

  const row = { ...payload, user_id: userId, ...(clientId ? { id: clientId } : {}) }
  let { data, error } = await supabase.from('transactions').insert(row).select(TRANSACTION_MUTATION_COLUMNS).single()

  if (error?.code === '23505' && clientId) {
    // Retry of an insert that already committed: return the existing row.
    ;({ data, error } = await supabase.from('transactions')
      .select(TRANSACTION_MUTATION_COLUMNS).eq('id', clientId).eq('user_id', userId).single())
  }
  if (error) throw error
  // ...audit log unchanged
  return data
}

export async function saveTransactionMutation({ id, clientId, payload, __testOverrides = null }) {
  // ...
  const optimisticId = id || clientId || `optimistic-txn-${Date.now()}`
  // ...
    const savedTxn = id
      ? await updateFn(id, payload, targetUserId)
      : await addFn(payload, targetUserId, clientId)
```

**Reference approach, `AddTransactionSheet.jsx`.** Keep one id per sheet session so a manual retry after an error reuses it:

```js
const draftIdRef = useRef(null)
if (!draftIdRef.current) draftIdRef.current = crypto.randomUUID()
// ...
await saveTransaction.mutateAsync({
  id: editTxn?.id,
  clientId: editTxn ? undefined : draftIdRef.current,
  payload,
})
// on success (before onClose): draftIdRef.current = null
```

Do the same in `Onboarding.jsx` (line 113), and add an in-flight `useRef` guard to its submit handler to stop Enter double-submits.

## 4.3 Generate RPC ids at the call site (loans and Splitwise)

**Problem.** `crypto.randomUUID()` runs inside the retried function (`useLoans.js` lines 111 and 171; `useSplitwise.js` lines 379, 559, 691 and 848), so each retry gets a new id and the server's `on conflict (id)` protection never applies.

**Reference approach.** Pass `id` in the mutation variables. The server-side functions already accept it. Call sites:

| File | Line | Change |
|---|---|---|
| `Loans.jsx` | 632 | `addLoan.mutateAsync({ ...loanData, id: crypto.randomUUID(), amount_settled: 0, settled: false })`. Confirm `addLoanMutation` forwards `payload.id` to `addLoan`. |
| `Loans.jsx` | 654 | `recordLoanPayment.mutateAsync({ loan: payLoan, paymentAmount, id: crypto.randomUUID() })` |
| `Loans.jsx` | 670 | `settleLoan.mutateAsync({ loan, paymentAmount, id: crypto.randomUUID() })` |
| `useSplitwiseLogic.js` | 646 | `createGroup.mutateAsync({ name, selfDisplayName, id: crypto.randomUUID() })` |
| `useSplitwiseLogic.js` | 663 | `createGroupInvite.mutateAsync({ groupId: activeGroupId, id: crypto.randomUUID() })` |
| `useSplitwiseLogic.js` | 934 | `addExpense.mutateAsync({ ..., id: crypto.randomUUID() })` |
| `useSplitwiseLogic.js` | 1003 | `recordSettlement.mutateAsync({ ..., id: crypto.randomUUID() })` |
| `AddTransactionSheet.jsx` | 770 | `addSplitExpense.mutateAsync({ ..., id: draftIdRef.current })` |

Then make the mutation functions require the id when it's missing, instead of silently generating one:

```js
const rpcId = id ?? crypto.randomUUID() // keep as a fallback for legacy callers, but log:
if (!id) console.warn('[Kosha] addSplitExpenseMutation called without an idempotency id')
```

## 4.4 Offline save locks the sheet; retry policy retries errors that can never succeed

**Problem.** `saveTransactionMutation` throws "You're offline…". `MUTATION_RETRY` retries it, and under `offlineFirst` the retry pauses until the device reconnects. `isPending` stays true, so the Add Transaction sheet can't be closed. The retry policy also retries validation, constraint and permission errors, which will never succeed.

**Reference approach.** 4.1 removes the pausing. This item makes the retry policy stop on errors that are final.

```js
// src/lib/mutationRetry.js (new; imported by useAppMutation.js)
export const MUTATION_RETRY = (failureCount, error) => {
  if (failureCount >= 2) return false
  if (error?.name === 'OfflineError' || error?.code === 'OFFLINE') return false
  const status = error?.status || error?.code
  if (status === 401 || status === 403 || status === 404) return false
  if (String(error?.message || '').includes('Not signed in')) return false
  // Postgres data/constraint/permission/raise errors are final.
  if (error?.code && /^(22|23|42|P0)/.test(String(error.code))) return false
  return true
}
```

Network failures (`TypeError`, Safari "Load failed", 5xx) are still retried up to twice. This is why the stable ids in 4.2 and 4.3 are still required.

**Verify.** In DevTools, go offline, open Add Transaction and tap Save. The sheet shows "You're offline. Connect to the internet and try again." immediately, stays editable and can be closed. Nothing is sent after reconnecting.

## 4.5 Debounced invalidation drops earlier promises

**Problem.** `invalidateCache` (`useTransactions.js` lines 230–267) and `invalidateSplitwiseCache` (`useSplitwise.js` lines 161–193) cancel the previous timer without resolving its promise. Anything awaiting the earlier call hangs forever; in Splitwise, `actionGuard` then stays true and every later action is blocked.

**Reference approach (same shape for both).**

```js
let invalidateTimeout = null
let pendingResolvers = []

export async function invalidateCache() {
  suppress('transactions')
  await evictSwCacheEntries('/transactions')

  if (invalidateTimeout) clearTimeout(invalidateTimeout)

  return new Promise((resolve) => {
    pendingResolvers.push(resolve)
    invalidateTimeout = setTimeout(async () => {
      invalidateTimeout = null
      const resolvers = pendingResolvers
      pendingResolvers = []
      try {
        await Promise.all([/* ...existing invalidateQueries calls... */])
      } finally {
        for (const r of resolvers) r()
      }
    }, 80)
  })
}
```

## 4.6 Rollback wipes other in-flight changes

**Problem.** `saveTransactionMutation` and `removeTransactionMutation` restore a snapshot of whole cache families on failure, which erases any optimistic change another mutation made in the meantime. `cancelQueries` also runs **after** the network call, so an in-flight refetch can overwrite the optimistic row. The loan and liability hooks have the same pattern (`useLoans.js` lines 244–294, `useLiabilities.js` lines 248–297).

**Reference approach (keeps the contract-test tokens).**

1. **Add** `cancelQueries` calls for `['transactions']` and `['transactionsRecent']` just before `applyOptimisticSaveCache(...)` / `optimisticallyDeleteTransactionFromCache(...)`. **Keep** the existing ones after the server call too: those stop a refetch that started during the request from overwriting the confirmed row.
2. After `restoreCacheSnapshot(snapshot)` in the `catch (error)` block, schedule a server re-sync so concurrent optimistic rows are rebuilt from server truth:

```js
  } catch (error) {
    restoreCacheSnapshot(snapshot)
    runInBackground(invalidateCache(), 'transactions rollback resync')
    throw error
  }
```

3. In `snapshotCacheFamilies`, skip entries whose data is `undefined`. In the loan snapshot helpers, stop writing `|| []` into never-fetched keys, because that makes them look fresh and empty for 5 minutes.

---

# Phase 5 — Client data-correctness bugs

## 5.1 Smart default categories don't exist (`AddTransactionSheet.jsx` lines 274–279)

```js
  if (date <= 3) {
    defaultExpenseCat = 'bills'
  } else if ((hour >= 6 && hour <= 10) || (hour >= 12 && hour <= 14)) {
    defaultExpenseCat = 'food'
  }
```

Add a unit test asserting that every default category id exists in `getCategoriesForType('expense')`.

## 5.2 Editing a recurring template recreates months of duplicates (line 747)

**Problem.** Every save recomputes `next_run_date` from the template's original date, so the server regenerates every month since then.

**Reference approach.** Replace `nextRecurringDate` with anchor-based helpers, and only send `next_run_date` when the recurrence actually changed:

```js
const STEP_MONTHS = { monthly: 1, quarterly: 3, yearly: 12 }

function addMonthsClamped(dateStr, months) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const target = new Date(y, m - 1 + months, 1)
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  target.setDate(Math.min(d, lastDay))
  return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(target.getDate()).padStart(2, '0')}`
}

// First occurrence strictly after `floor`, counted from the anchor date.
function nextRunAfter(anchor, recurrence, floor) {
  const step = STEP_MONTHS[recurrence]
  if (!anchor || !step) return null
  let k = step
  let next = addMonthsClamped(anchor, k)
  while (next <= floor) { k += step; next = addMonthsClamped(anchor, k) }
  return next
}

// in handleSave():
const nextRecurrence = isRecurring ? recurrence : null
const recurrenceChanged = !editTxn
  || editTxn.date !== date
  || (editTxn.recurrence || null) !== nextRecurrence
  || !!editTxn.is_recurring !== isRecurring

const payload = {
  // ...
  is_recurring: isRecurring,
  recurrence: nextRecurrence,
  ...(recurrenceChanged
    ? { next_run_date: isRecurring ? nextRunAfter(date, recurrence, editTxn ? todayStr() : date) : null }
    : {}),
  // ...
}
```

New templates still back-fill past months (`floor = date`), which is the current intended behaviour. Edits never back-fill (`floor = today`).

Also check `optimisticallyUpsertTransactionInCache`: when `next_run_date` is omitted, the existing cached value must be kept. It is, because `{ ...existingTxn, ...payload }` is used.

## 5.3 Duplicating a repayment drops the flag (line 744)

```js
      is_repayment: editTxn ? !!editTxn.is_repayment : !!state.isRepayment,
```

Check the reducer field name. The review saw `isRepayment: !!duplicateTxn.is_repayment` at line 260.

## 5.4 CSV export capped at 1,000 rows and ignores link filters (`src/hooks/useTransactionExporter.js`)

```js
const PAGE_SIZE = 1000

function buildExportQuery({ userId, typeFilter, catFilter, paymentModeFilter, debouncedSearch, startDate, endDate,
                            linkedLoanId, linkedBillId, linkedSplitExpenseId, linkedSplitSettlementId }) {
  let q = supabase
    .from('transactions')
    .select('date, type, description, amount, category, investment_vehicle, payment_mode, notes, is_recurring, recurrence, is_auto_generated, source_transaction_id')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
  if (typeFilter !== 'all') q = q.eq('type', typeFilter)
  if (catFilter) q = q.eq('category', catFilter)
  if (paymentModeFilter) q = q.eq('payment_mode', paymentModeFilter)
  if (linkedLoanId) q = q.eq('linked_loan_id', linkedLoanId)
  if (linkedBillId) q = q.eq('linked_bill_id', linkedBillId)
  if (linkedSplitExpenseId) q = q.eq('linked_split_expense_id', linkedSplitExpenseId)
  if (linkedSplitSettlementId) q = q.eq('linked_split_settlement_id', linkedSplitSettlementId)
  if (debouncedSearch) {
    const clause = buildTransactionSearchOrClause(debouncedSearch)
    if (clause) q = q.or(clause)
  }
  if (startDate) q = q.gte('date', startDate)
  if (endDate) q = q.lte('date', endDate)
  return q
}

// in exportCSV:
const exportRows = []
for (let from = 0; ; from += PAGE_SIZE) {
  const { data, error } = await buildExportQuery(filters).range(from, from + PAGE_SIZE - 1)
  if (error) throw error
  exportRows.push(...(data || []))
  if (!data || data.length < PAGE_SIZE) break
}
```

Pass the four `linked*` values from `Transactions.jsx` (lines 796–804) into the exporter.

Also `src/lib/csv.js`: append the anchor to `document.body` before `click()`, remove it afterwards, and revoke the object URL in `setTimeout(() => URL.revokeObjectURL(url), 1000)`. That keeps downloads working on iOS Safari and in the installed PWA.

## 5.5 Loan maths in paise (`Loans.jsx` lines 641–682 and the "Full" chip around 1202)

```js
import { fromRupees, toRupees } from '../../lib/paise'
import { validateAmount } from '../../lib/validateAmount'

function remainingPaise(loan) {
  return fromRupees(loan.amount) - fromRupees(loan.amount_settled)
}

async function handleRecordPayment() {
  // ...
  const check = validateAmount(payAmount, { allowZero: false })
  if (!check.ok) { setPayErr(check.error); actionGuard.current = false; return }
  const amtPaise = BigInt(check.paise)
  const remPaise = remainingPaise(payLoan)
  if (remPaise <= 0n) { setPayErr('This loan is already fully settled.'); actionGuard.current = false; return }
  if (amtPaise > remPaise) { setPayErr(`Max payment is ${fmt(toRupees(remPaise))}`); actionGuard.current = false; return }
  await recordLoanPayment.mutateAsync({ loan: payLoan, paymentAmount: toRupees(amtPaise), id: crypto.randomUUID() })
}

// handleSettleFull:
const remPaise = remainingPaise(loan)
if (remPaise <= 0n) { actionGuard.current = false; return }
await settleLoan.mutateAsync({ loan, paymentAmount: toRupees(remPaise), id: crypto.randomUUID() })

// "Full" chip:
setPayAmount(toRupees(remainingPaise(loan)).toFixed(2))
```

Check the exact return shape of `validateAmount` (the review saw `{ ok, paise, error }`). Use the same validation in `handleAdd` and in `Bills.jsx` line 507 instead of `+form.amount`.

**Editing a loan (decision D3).** `useLoans.js` `updateLoan` and `Loans.jsx` lines 620–623 let the user change `amount`, `direction` and `loan_date`, but the original disbursement transaction keeps the old values, so the running balance and repayment direction become wrong.

Decision: once a loan has any repayment, `amount`, `direction` and `loan_date` are locked. `counterparty`, `note`, `due_date` and `interest_rate` stay editable. To fix a wrong amount, the user deletes and recreates the loan; `delete_loan_with_txns` already removes its transactions.

While a loan has **no** repayments, edits to `amount`, `direction` or `loan_date` must also update the disbursement transaction. Do both in one trigger so the client can't get it half right:

```sql
create or replace function public.guard_loan_edit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.amount is distinct from old.amount
      or new.direction is distinct from old.direction
      or new.loan_date is distinct from old.loan_date) then
    if exists (
      select 1 from public.transactions
      where linked_loan_id = old.id and is_repayment = true
    ) then
      raise exception using errcode = '42501',
        message = 'Amount, direction and date can''t change after a repayment. Delete and recreate the loan instead.';
    end if;

    -- Keep the disbursement transaction in step (no repayments exist yet).
    update public.transactions
       set amount = new.amount,
           date   = new.loan_date,
           type   = case new.direction when 'given' then 'expense' else 'income' end
     where linked_loan_id = old.id and is_repayment = false;
  end if;

  -- Same wording as create_loan (lines 190–198).
  if new.direction is distinct from old.direction or new.counterparty is distinct from old.counterparty then
    update public.transactions
       set description = case new.direction
             when 'given' then 'Loan given to ' || btrim(new.counterparty)
             else              'Loan taken from ' || btrim(new.counterparty) end,
           notes = case new.direction
             when 'given' then 'Money lent to ' || btrim(new.counterparty)
             else              'Money borrowed from ' || btrim(new.counterparty) end
     where linked_loan_id = old.id and is_repayment = false;
  end if;

  -- Server-managed fields are never client-editable. record_loan_payment sets the
  -- trusted_write flag (see 1.3) before updating them.
  if current_user in ('authenticated', 'anon')
     and current_setting('kosha.trusted_write', true) is distinct from 'true'
     and (new.amount_settled is distinct from old.amount_settled or new.settled is distinct from old.settled) then
    raise exception using errcode = '42501', message = 'Settlement fields are managed by the server.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_loan_edit on public.loans;
create trigger trg_guard_loan_edit
  before update on public.loans
  for each row execute function public.guard_loan_edit();
```

The `type` mapping matches `create_loan` line 188: `given` is money out (`expense`), `taken` is money in (`income`).

Client, `Loans.jsx`:
- When `editLoan && Number(editLoan.amount_settled) > 0`, render the amount, direction and loan-date fields `disabled`, with helper text: "Locked after the first repayment. Delete and recreate the loan to change these."
- Build the update payload with only the editable fields in that case, so the trigger never fires on an untouched value:

```js
const hasRepayments = Number(editLoan?.amount_settled || 0) > 0
const updates = hasRepayments
  ? { counterparty: loanData.counterparty, note: loanData.note, due_date: loanData.due_date, interest_rate: loanData.interest_rate }
  : loanData
await updateLoan.mutateAsync({ id: editLoan.id, updates })
```

Put `guard_loan_edit` in the Phase 2 migration.

## 5.6 Statement matching prefers old transactions (`src/lib/statementMatching.js`)

**Sign bug (line 247).**

```js
  const signedDays = dateDistanceDays(entry.date, candidate.txn?.date)
  if (!Number.isFinite(signedDays)) return null
  const days = Math.abs(signedDays)
  if (days > 7) return null
```

Anything that sorts by `days` then uses the absolute value.

**Parser (lines 103–150).** Detect the delimiter first, and collapse Indian/Western digit grouping only for comma-delimited lines:

```js
// Western grouping must come first: with the Indian pattern first, "12,345,678"
// matches only "12,345". Indian grouping ("1,00,000") fails the Western branch and falls through.
const GROUPED_NUMBER_RE = /(?<![\d/.-])(\d{1,3}(?:,\d{3})+|\d{1,3}(?:,\d{2})*,\d{3})(\.\d{1,2})?(?!\d)/g
const DATE_TOKEN_RE = /\d{1,4}[-/.]\d{1,2}[-/.]\d{2,4}/g

function parseCsvLine(line) {
  if (line.includes('\t')) return line.split('\t').map((p) => p.trim()).filter(Boolean)
  if (line.includes('|')) return line.split('|').map((p) => p.trim()).filter(Boolean)
  const normalized = line.replace(GROUPED_NUMBER_RE, (m) => m.replace(/,/g, ''))
  // ...existing quote-aware comma split over `normalized`...
}

// In parseStatementLines, for single-field lines take the LAST number outside any date:
const amountSource = parts.length > 1 ? parts[parts.length - 1] : line.replace(DATE_TOKEN_RE, ' ')
```

Change `parseAmount` to use the **last** numeric match (`[...cleaned.matchAll(/[-+]?\d+(?:\.\d{1,2})?/g)].pop()`).

Add these cases to `scripts/tests/unit/lib/statementMatching.test.js`:

| Input | Expected |
|---|---|
| `24/03/2026, Rent, 1,00,000.00` | amount 100000 |
| `2026-03-22 \| Uber \| 1,250` | amount 1250 |
| `21-03-2026\tSalary\t50,000` | amount 50000 |
| `24/03/2026 Swiggy 542` | amount 542 |
| Same-day ₹542 vs a ₹542 transaction 70 days older | the same-day one wins |

**Greedy matching (lines 299–319).** Score every (line, transaction) pair, sort by score descending, then assign each line and transaction at most once. Skip transactions already in the linked set.

## 5.7 Splitwise charges members who left

**`useSplitwiseLogic.js` line 822.**

```js
    const selectedMemberIds = activeMembers
      .filter((member) => splitInputs[member.id]?.enabled)
      .map((member) => member.id)
```

Add `activeMembers` to that function's dependencies if it is memoised. Also fix `activeMembers` (lines 549–561):
- exclude `member.archived_at` (decision D1, see 1.10);
- guests (`linked_user_id == null`) must never be marked `'left'` just because the person who added them left.

Apply the same change in `ActiveGroupView.jsx` lines 113–117. Initialise `splitInputs` (lines 411–436) only for `activeMembers`, so archived or left members are never pre-ticked.

**`AddTransactionSheet.jsx` quick split (lines 756–767)** splits across all members. Filter to active ones:

```js
const [{ data: members, error: memErr }, { data: access, error: accErr }] = await Promise.all([
  supabase.from('split_group_members').select('id, is_self, linked_user_id').eq('group_id', splitGroupId),
  supabase.from('split_group_access').select('user_id').eq('group_id', splitGroupId),
])
if (memErr) throw memErr
if (accErr) throw accErr
const accessIds = new Set((access || []).map((a) => a.user_id))
const activeMembers = members.filter((m) => !m.linked_user_id || accessIds.has(m.linked_user_id))
// ...use getAuthUserId() instead of supabase.auth.getUser() (saves a network round-trip)
const splits = buildEqualSplits(activeMembers.map((m) => m.id), splitAmount)
```

Also: if `isSplitwise` is on but no group is picked, show an error instead of silently saving a normal transaction.

## 5.8 Editing a settlement is two separate calls (`useSplitwiseLogic.js` lines 1003–1014)

Add a `split_update_settlement(p_settlement_id, p_payer_member_id, p_payee_member_id, p_amount, p_settled_at, p_note)` RPC. Model it on `split_update_expense`: lock the row, update in place, and re-sync the linked transactions scoped by `linked_split_settlement_id`. Call it from the edit path.

Until that RPC exists, if `deleteSettlement` fails after `recordSettlement` succeeded, delete the new settlement and show the error.

## 5.9 Splitwise group leave and delete don't roll back (`useSplitwise.js` line 483, `useSplitwiseLogic.js` lines 728 and 789)

```js
export async function deleteSplitGroupMutation(groupId) {
  // ...
  const snapshot = queryClient.getQueryData(splitGroupsKey(userId))
  optimisticallyDeleteSplitGroup(groupId, userId)
  const { error, count } = await supabase.from('split_groups').delete({ count: 'exact' }).eq('id', groupId)
  if (error || count === 0) {
    queryClient.setQueryData(splitGroupsKey(userId), snapshot)
    throw error || new Error('Only a group admin can delete this group.')
  }
```

Apply the same snapshot-and-restore to `leaveSplitGroupMutation`.

**UI changes:**
- Add a confirmation before "Delete Trip Forever" (`Splitwise.jsx` line 671), and warn there if balances are unsettled.
- Work out admin status only from the `split_group_access` role. Drop `|| activeGroup.user_id === authUserId` and `group.user_id === authUserId ? 'admin'` (`useSplitwise.js` line 326, `useSplitwiseLogic.js` line 567, `GroupList.jsx` line 59).

## 5.10 Splitwise undo timers can double-fire (`useSplitwiseLogic.js` lines 1072–1179)

When re-deleting the same id, always clear the existing timer before scheduling a new one. Better still, move both expense and settlement undo onto `useUndoableDelete` from 3.1.

## 5.11 Other correctness items

| Item | File | Change |
|---|---|---|
| "Spendable today" subtracts bills due months away | `Dashboard.jsx` lines 205–212 | Only subtract pending bills with `due_date <= end of current month`. |
| Month-close projection false alarms | `Monthly.jsx` lines 316–321 | Project variable expenses only (exclude `is_recurring`, `is_auto_generated`, `investment`); suppress before day 7. |
| Weekly drift wording and partial-week bias | `src/lib/weeklyDrift.js` lines 44–47, 77–101; `Dashboard.jsx` line 133 | Branch the text on the drift's sign, scale the current week by elapsed days, and fetch 56 days of data. |
| Analytics counts future months | `AnalyticsCharts.jsx` lines 236–243; `YearOverYearCards.jsx` | Filter out months after the current month; compare year-to-date with the same period last year. |
| Date picker allows future dates; "Today" goes stale | `PixelDatePicker.jsx` lines 75–78, 245–252 | Add a `max` prop (default `todayStr()`); recompute `today` when the picker opens. |
| Amount input rejects "1,250.00" | `AddTransactionSheet.jsx` lines 862–867 | Strip grouping commas in `onChange` before the regex. |
| Interest ignores repayment timing | `useLoans.js` lines 633–642 | Accrue per repayment interval using the repayment transaction dates, or relabel as "interest on current balance". |
| `isMissingTableError` too broad | `useReconciliationReviews.js` lines 16–24 | Match only `42P01` / `PGRST205`. |
| Reconciliation loads only 250 transactions | `Reconciliation.jsx` lines 94–98 | Load the statement's date range ±7 days instead. |
| Recreating an archived category changes its type | `useUserCategories.js` lines 182–193 | On conflict with an archived row of another type, generate a new slug suffix. |
| Non-Latin category names rejected | `useUserCategories.js` lines 62–69 | Fall back to `custom_<random>` when the slug is empty. |
| Reminders fail on Android | `src/lib/reminders.js` line 70 | Use `navigator.serviceWorker.ready.then((r) => r.showNotification(...))`. |
| Settled loans show "Late 365d" | `Loans.jsx` lines 1094–1108 | Measure lateness against the settlement date, not today. |
| Inconsistent metric definitions | `Transactions.jsx` 54–57 and 326–340, `DashboardRecentTransactions.jsx` 73–77, `utils.savingsRate`, `Analytics.jsx` 120 | Put `netFlow` and `savingsRate` in one module in `src/lib/` and use it everywhere. |

---

# Phase 6 — Caching and realtime

## 6.1 Service worker serves stale data to refetches (`vite.config.js` lines 137–156)

**Problem.** Supabase REST GETs use `StaleWhileRevalidate`, so every React Query refetch (focus, reconnect, invalidate) gets the **previous** response back. The `#kosha-uid=` fragment doesn't isolate users, because the Cache API ignores URL fragments when matching. Only the purge on auth boundaries (`useAuth.js` `purgeAllUserScopedState`) protects against cross-user leaks.

**Reference approach.**

```js
            {
              urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/.*/i,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'supabase-data',
                networkTimeoutSeconds: 5,
                expiration: { maxEntries: 100, maxAgeSeconds: 12 * 60 * 60 },
                cacheableResponse: { statuses: [200] },
              },
            },
```

Remove the `cacheKeyWillBeUsed` plugin and correct the comments in `vite.config.js` and `src/lib/supabase.js` (`withUserHash`). Say plainly that isolation depends on the purge. `withUserHash` can stay (harmless) or be removed; if removed, drop the matching `scrubUrl` hash note in `errorReporting.js`.

With `NetworkFirst`, the `evictSwCacheEntries` calls before invalidations become optional. Keep them for now.

## 6.2 Realtime DELETE fan-out (`src/components/app/GlobalRealtimeSync.jsx` lines 89–121)

**Problem.** Supabase can't filter `DELETE` events by column and doesn't apply row-level security to them; the old record contains only the primary key. `if (!groupId && eventType === 'DELETE') return true` makes every client refetch Splitwise whenever **anyone** deletes a Splitwise row. The `transactions` / `loans` / `liabilities` subscriptions with `filter: user_id=eq.X` also receive every user's DELETE events.

**Reference approach.** For DELETE events, check the deleted row's id against ids already in the cache:

```js
const ROW_CACHE_FAMILIES = {
  split_groups: [['splitwise', 'groups']],
  split_group_members: [['splitwise', 'members']],
  split_expenses: [['splitwise', 'expenses']],
  split_settlements: [['splitwise', 'settlements']],
  transactions: [['transactions'], ['transactionsRecent']],
  loans: [['loans']],
  liabilities: [['liabilities']],
}

function isKnownRowId(table, id) {
  if (!id) return false
  for (const family of ROW_CACHE_FAMILIES[table] || []) {
    for (const [, rows] of queryClient.getQueriesData({ queryKey: family })) {
      if (Array.isArray(rows) && rows.some((r) => normalizeRealtimeValue(r?.id) === id)) return true
    }
  }
  return false
}

// in isRelevantSplitwiseRealtimeEvent, replace `if (!groupId && eventType === 'DELETE') return true` with:
if (!groupId && eventType === 'DELETE') return isKnownRowId(table, normalizeRealtimeValue(prev?.id))

// in the channel handler, for non-splitwise tables:
(payload) => {
  const eventType = String(payload?.eventType || '').toUpperCase()
  if (policy.key === 'splitwise') {
    if (!isRelevantSplitwiseRealtimeEvent(policy.table, payload, activeUserId)) return
  } else if (eventType === 'DELETE' && !isKnownRowId(policy.table, normalizeRealtimeValue(payload?.old?.id))) {
    return
  }
  enqueuePolicyInvalidation(policy)
}
```

`split_expense_splits` and `split_group_access` DELETEs can be ignored. In practice they come with a parent INSERT or UPDATE (to the expense, or to the member row when archiving) that already triggers invalidation.

**Trade-off to accept consciously.** With this filter, a delete made **on another device** of a row that isn't loaded in this client's cache won't refresh this client's aggregates (month totals, balance) right away. That's acceptable because:
- the `visibilitychange` handler (`invalidateFreshness()`) refreshes everything whenever the app comes back to the foreground, and switching devices always involves that;
- deletes made on this device are applied optimistically anyway.

**Keep the `visibilitychange` listener** for that reason; it also evicts the service worker cache first. To avoid the duplicate refresh, set `refetchOnWindowFocus: false` in `src/lib/queryClient.js`.

**Better long-term option.** Move to Supabase Realtime *Broadcast from Database*: a trigger calls `realtime.broadcast_changes()` to a private per-user topic, protected by row-level security on `realtime.messages`. Each client then only receives its own events, including deletes. This is a larger change; treat it as a separate project.

## 6.3 Previous wallet's or group's data shown during loads

Add a helper next to `useActiveWallet` in `src/lib/walletStore.js`:

```js
// placeholderData that only reuses the previous result when it belonged to the same user.
export const keepPreviousForUser = (userId, keyIndex) => (prev, prevQuery) =>
  prevQuery?.queryKey?.[keyIndex] === userId ? prev : undefined
```

| Hook | Line | Change |
|---|---|---|
| `useYearSummary` | `useTransactions.js` line 779 | `placeholderData: keepPreviousForUser(targetUserId, 2)` |
| `useRunningBalance` | `useTransactions.js` line 932 | `placeholderData: keepPreviousForUser(targetUserId, 3)` |
| `useBudgets` | `useBudgets.js` line 30 | Use the index of the user id in its `queryKey` (check). |
| `useUserCategories` | `useUserCategories.js` line 108 | Same. Also don't call `registerCustomCategories` with placeholder data (`if (!isPlaceholderData)`). |
| Splitwise per-group queries | `useSplitwise.js` lines 281–302 | Remove `placeholderData` for `members` / `expenses` / `settlements` / `group-member-access`. Use `isLoading` to show a skeleton and disable actions. |

## 6.4 Daily totals: unstable pagination and client-side aggregation (`useTransactions.js` lines 551–710)

**Problem.** `.order('date')` with `.range()` offset paging isn't a deterministic order when many rows share a date, so rows can be skipped or counted twice. The client also downloads up to 50,000 rows just to sum them.

**Reference approach.** Add one RPC and use it for all three hooks:

```sql
create or replace function public.get_daily_expense_totals(p_user_id uuid, p_start date, p_end date)
returns table(day date, total numeric)
language sql stable
set search_path = ''
as $$
  select date as day, sum(amount) as total
  from public.transactions
  where user_id = p_user_id and type = 'expense' and date between p_start and p_end
  group by date
$$;
grant execute on function public.get_daily_expense_totals(uuid, date, date) to authenticated;
```

```js
const { data: rows, error } = await supabase.rpc('get_daily_expense_totals', {
  p_user_id: targetUserId, p_start: startISO, p_end: endISO ?? todayStr(),
})
if (error) throw error
return Object.fromEntries((rows || []).map((r) => [r.day, Number(r.total) || 0]))
```

It runs as the caller, so row-level security (`is_linked`) still applies. If you keep client paging anywhere, add `.order('id')` as a tiebreaker.

## 6.5 Optimistic month summary goes stale (`useTransactions.js` lines 294–332)

`adjustAggregatesForTransaction` updates `expense` / `earned` / `investment` but not `balance` or `byCategory`. Recompute `nextMonth.balance = earned + repayments - expense - investment` and adjust `byCategory[txn.category]` for expenses.

---

# Phase 7 — Privacy and UX follow-ups

| Item | File | Change |
|---|---|---|
| Bug reports leak route query strings | `ReportBug.jsx` line 167; `ProfileMenu.jsx` line 334 | Send `location.pathname` only (no `search`), and send `p_environment` only when `includeDiagnostics` is on. |
| Escape in the date picker closes the parent sheet; Tab gets stuck | `useOverlayFocusTrap.js` lines 96–139 | Keep a module-level stack of open traps; only the top trap handles `keydown`. |
| Enter hijacked in the date picker | `PixelDatePicker.jsx` lines 86–138 | Handle keys only when `document.activeElement` is a day button inside the grid. |
| Sheet closes on a drag ending over the backdrop | `Sheet.jsx` lines 159–165, 189–194 | Track `pointerdown` target; close only if both down and up hit the backdrop; drop the duplicate `onPointerUp` handler. |
| Hidden swipe actions are keyboard-focusable | `TransactionItem.jsx` lines 368–400 | `tabIndex={-1}` (or `inert`) while hidden. |
| `?focus=` link shrinks the list and cancels the scroll | `Transactions.jsx` lines 528–581, 652–689 | Set `internalUrlUpdateRef.current = true` before deleting `focus`; keep the highlight timer in a ref cleared only on unmount. |
| Page jumps to top when the keyboard closes | `useKeyboardInset.js` lines 54–58 | Only call `scrollTo(0,0)` when `hasFixedOverlay()`. |
| Settings "Remove & Unlink" has no confirm or refresh | `Settings.jsx` lines 309–321 | Reuse `handleUnlinkPartner`: confirm, reset the active wallet to self, then `reloadLinkedData()`. |
| "Add new" category in the filter does nothing | `Transactions.jsx` line 79 | Render `CreateCategorySheet` or remove the button. |
| Report Bug double-submit on Enter | `ReportBug.jsx` lines 147–196 | Add an in-flight `useRef` guard. |
| CSP allows inline scripts | `vercel.json` | Remove `'unsafe-inline'` from `script-src` once you've confirmed no inline scripts remain in `index.html` (use a hash if one does). |
| Redundant duplicate indexes | `schema.sql` lines 3101, 3113/3128, 3146, 3191 | Drop them in a later migration. |
| `schema.sql` not re-runnable | whole file | Regenerate it from the live DB after migrations (`supabase db dump`) instead of hand-editing. |

---

# Verification checklist (run after each phase)

```bash
npm ci
npm run lint
npm run test:unit
npm run test:no-network
# with a staging Supabase project + .env:
npm run test:rls-partner-isolation
npm run test:splitwise-viewer-invite-flow
npm run test:splitwise-mutation-paths
npm run test:join-flow
npm run test:reconciliation-flow
```

Manual checks:

1. **Phase 1:**
   - With two accounts (A and B), A can't forge a link: `insert` / `update` on `invites` fails.
   - A can't become admin of B's group through `split_create_group`.
   - A group member can't edit `linked_transaction_id`.
   - Adding a loan and recording a repayment still work (the trusted-write flag).
   - An admin can remove a settled member, who then disappears from new splits but still shows in old expenses. Removing a member with a balance is refused with "Settle up first".
   - A non-admin can't delete someone else's expense, and the button is hidden.
2. **Phase 2:**
   - Create a monthly recurring expense dated 31 Jan (for example with a fake `p_today`). The generated dates are 28/29 Feb, 31 Mar, 30 Apr.
   - Mark a bill paid at 00:30 IST. Its transaction is dated today.
   - Settle a loan of 1000 after paying 333.33. It closes.
   - On a loan with a repayment, amount, direction and date are locked. On one without, editing the amount also updates its disbursement transaction.
   - Deleting a staging user who owns a shared group succeeds, the group survives, and another member becomes admin.
3. **Phase 3:**
   - Delete a transaction, a loan and a bill; tap Undo within 4 seconds; refresh. Each item still exists.
   - Delete and wait; refresh. The item is gone.
   - Delete, then background the app immediately. The delete is committed.
4. **Phase 4:**
   - Go offline and try to save a transaction, pay a bill and add a split expense. Each shows the offline message immediately, the form stays usable, and nothing is sent after reconnecting.
   - With DevTools set to drop the response after the request is sent, save a transaction. No duplicate appears after the retry.
5. **Phase 5:**
   - Add an expense at 08:00. The category is Food & Dining.
   - Edit an old recurring template's description. No new rows appear.
   - Export more than 1,000 rows. The CSV row count matches.
6. **Phase 6:**
   - Switch to the partner wallet. There's no flash of your own year summary or balance.
   - Delete a Splitwise expense in account A. Account B, in another group, makes no network requests.

# Required regression tests

Each of these covers a class of bug the current suite missed. Add each one in the release that fixes the related bug.

1. **Undo on delete (R2)**, in `scripts/tests/unit/hooks/useUndoableDelete.test.js` (Vitest plus React Testing Library):
   - render a component using `useTransactionDeleter` with a mocked `removeTransactionMutation`;
   - call `handleDelete(id)`, force two re-renders (for example by updating a prop), then call the toast's Undo action;
   - assert the mutation was **never** called and `optimisticallyUpsertTransactionInCache` was called with the snapshot;
   - a second case lets the timer run out (`vi.advanceTimersByTime(4300)`) and asserts exactly one call.
2. **Two-user security (R1)**: extend `scripts/tests/test_rls_partner_isolation.mjs` against staging. Signed in as A, each of these must be rejected, and must leave nothing behind:
   - `insert into invites (created_by, used_by)` with B's id;
   - `update invites set used_by`;
   - `rpc('split_create_group', { p_id: <B's group> })`;
   - `update split_expenses set linked_transaction_id`;
   - `insert into transactions (linked_split_expense_id)`;
   - deleting B's expense in a shared group as a non-admin member.
3. **Recurring dates (R3)**, in `scripts/tests/unit/lib/recurrence.test.js`: test `addMonthsClamped` / `nextRunAfter` from 5.2. From 31 Jan, next dates are 28 Feb (29 in a leap year), 31 Mar, 30 Apr and 31 May. From 29 Feb 2028 yearly, the next dates are 28 Feb 2029, 28 Feb 2030, 28 Feb 2031 and 29 Feb 2032, each counted from the anchor, so 2032 returns to the 29th. Also add a staging test calling `generate_recurring_transactions` with a template dated 31 Jan and `p_today` = 31 May, and assert the four generated dates.

# Longer-term follow-ups

- **Migrations become the source of truth.** After R1, stop hand-editing `schema.sql`. Regenerate it from the live database (`supabase db dump --schema public > supabase/schema.sql`) after each migration, and add a CI check that fails if it's out of date.
- **Lint rule against mutation objects in dependency arrays.** Add a small custom ESLint rule, or a `no-restricted-syntax` selector, that flags any identifier assigned from `useAppMutation(...)` / `useMutation(...)` appearing in a hook dependency array. Allow destructured `mutateAsync` / `mutate`. This one pattern caused three separate bugs.
- **Money maths only in paise.** Route every user-entered amount through `validateAmount` and every calculation through `paise.js`. Add an ESLint `no-restricted-syntax` rule for unary `+` on identifiers named `amount` / `*Amount` in `src/components` and `src/pages`.
- **Offline writes (if wanted later):** see the "Future work" note at the end of 4.1.

# Findings log (fill in as you go; commit as `docs/remediation-findings.md`)

Add one entry per plan item, in the order you work on them. The owner reviews this file before each release is merged.

```markdown
## <item number> <short title>
- Status: Confirmed | Different | Not reproduced | Blocked by decision
- Evidence: <what you read or ran; file:line, test name, or staging query and result>
- Siblings found: <other places with the same pattern, or "none">
- Fix: <what you changed and why, especially where you departed from the reference approach>
- Verified by: <tests added or run, and manual checks from the item's Verify section>
- Follow-ups: <anything noticed but deliberately left out of scope>
```

Log anything in the plan that turns out to be wrong as a separate entry headed `Plan correction`. That covers a wrong line number, a wrong assumption, or a reference snippet that doesn't work.
