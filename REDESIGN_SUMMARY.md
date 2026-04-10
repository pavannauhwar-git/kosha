# Kosha UI/UX Redesign — "Vibrant Clarity"

> Design direction: **Vibrant Clarity** — Brand blue `#007FFF` + Sunny yellow `#FFFF99`, Material 3 Expressive  
> Constraints: All hooks, Supabase queries, mutations, and data layer are UNTOUCHED.

---

## 1. Design System

### Created Files
| File | Purpose |
|------|---------|
| `src/design-system/tokens.js` | Color, typography, spacing, radius, shadows, animation tokens |
| `src/design-system/components.js` | Component API specifications for all 12 primitives |
| `src/design-system/index.css` | CSS custom properties (`:root` + `.dark` overrides), base resets, focus ring, scrollbar, selection styles |

### Token Architecture
- All colors flow from `--ds-*` CSS variables
- Light → Dark mode via `.dark` class on `<html>` (Tailwind `darkMode: 'class'`)
- Legacy `--c-*` variables in `index.css` alias `--ds-*` for backward compat
- `tailwind.config.js` fully rewritten: colors use `var(--ds-*)`, keyframes extended

---

## 2. Component Library — `src/components/ui/`

| Component | Key Features |
|-----------|-------------|
| `Button` | 5 variants (primary/secondary/ghost/danger/tonal), 3 sizes, loading spinner, icon slots, forwardRef |
| `Input` | Label, validation with `aria-invalid`/`aria-describedby`, icon slots, auto-generated IDs |
| `AmountInput` | Currency-aware ₹, type-colored focus ring, blur formatting |
| `Badge` | 8 semantic variants, sm/md sizes |
| `Card` | 3 surface variants (elevated/filled/outlined), pressable mode with role/type |
| `BottomSheet` | Radix Dialog + gesture drag-to-dismiss, desktop centered modal, drag handle |
| `Skeleton` | 5 variants (text/circle/rect/card/row), shimmer animation |
| `EmptyState` | Icon with bounce animation, title/description, primary + secondary CTAs |
| `MonthStepper` | Prev/next navigation, blocks future months |
| `CategoryPicker` | 4-column grid, single select with ring highlight, memoized |
| `TransactionRow` | Category icon, recurring/repayment badges, formatted amount, memoized |
| `AmountDisplay` | Animated count-up (600ms), type-colored, tabular-nums |
| `index.js` | Barrel export |

### Utility: `src/utils/dates.js`
- `clampToMonthEnd()` — handles Feb 28/29, 30-day months
- `getNextRecurrenceDate()` — monthly/quarterly/yearly with clamp

---

## 3. Color Migration

### Before → After
| Old Token | New Token |
|-----------|-----------|
| `#1A1A2E` (charcoal) | `#007FFF` (brand blue) / `#111318` (neutral ink) |
| `#C4384A` (old red) | `#E8453C` (new expense red) |
| `#2D8B6F` (old green) | `#0F9D58` (income green) |
| `#8B7230` (old gold) | `#F9A825` (warning yellow) |
| `rgba(26,26,46,*)` | `rgba(17,19,24,*)` or `var(--ds-border)` |
| `rgba(245,243,238,*)` | `var(--ds-surface-container)` |
| `rgba(107,107,128,*)` | `var(--ds-text-3)` (tertiary text) |
| `#FF4757` (UI usage) | `C.expense` via `colors.js` |
| `#FFFFFF` (tooltip bg) | `var(--ds-surface)` |
| `#1D355F` (tooltip text) | `var(--ds-text-1)` |
| `#5E6D8F` (tooltip muted) | `var(--ds-text-3)` |

### Colors.js Extension
- Added `C.brandMuted` = `rgba(0,127,255,0.22)`
- Added `C.warningMuted` = `rgba(249,168,37,0.60)`

### Files Modified (Color Migration)
- `Dashboard.jsx` — 3 tooltip borders, bubble fills, all chart colors
- `SpendingPaceTracker.jsx` — tooltip, gradient, grid, ticks
- `ProfileMenu.jsx` — 2 avatar borders
- `PortfolioMixDonut.jsx` — conic gradient fallback
- `BudgetSheet.jsx` — SVG gauge colors
- `CategorySpendingChart.jsx` — full BAR_PALETTE replacement
- `FinancialHealthRadar.jsx` — radar ring + axis stroke
- `AnnualSummaryCard.jsx` — flow bar background
- `BreakdownCard.jsx` — stacked bar track
- `DailySpendTrend.jsx` — full chart replacement
- `YoYCards.jsx` — trendRows, both chart sections
- `SavingsRateTrend.jsx` — tooltip, grid, ticks, reference line
- `Analytics.jsx` — Pareto chart grid + ticks
- `Reconciliation.jsx` — funnel fills, LabelList, bar
- `AnalyticsCharts.jsx` — 65 total color replacements (rgba + hex)
- `DeleteDialog.jsx` — trash icon color
- `index.css` — 8 remaining legacy references

---

## 4. App Shell

### Desktop Sidebar (`App.jsx`)
- Width: 220px → 240px
- Background: `rgba(244,246,248,0.92)` with backdrop blur
- Borders: `var(--ds-border)`
- Active state: `var(--ds-primary-container)` bg, `C.brand` text
- Added `aria-label="Main navigation"`, `aria-current="page"`
- Touch targets: `min-h-[44px]`

### Content Wrapper
- Margin: `md:ml-[220px]` → `md:ml-[240px]`

---

## 5. Primitive Adoption

### Pages Updated
| Page | Changes |
|------|---------|
| `Login.jsx` | 3 `<input>` → `<Input>`, Google button → `<Button variant="secondary">`, submit → `<Button variant="primary" loading>` |
| `Onboarding.jsx` | 5 `<input>` → `<Input>`, 5 `<button>` → `<Button>` across 3 steps |
| `Dashboard.jsx` | 2 `btn-secondary` → `<Button variant="secondary">` |
| `Transactions.jsx` | "Add transaction" + "Export CSV" → `<Button>`, "Show more" → `<Button variant="ghost">` |
| `Bills.jsx` | "Export CSV" → `<Button>`, "Add Bill" sheet submit → `<Button variant="primary" loading>` |
| `Loans.jsx` | "Export CSV" → `<Button>`, "Record Payment" + "Add Loan" → `<Button loading>` |
| `Monthly.jsx` | "Log investment" + "Manage budgets" → `<Button variant="secondary">` |
| `About.jsx` | "Open product guide" → `<Button variant="primary">` |
| `ReportBug.jsx` | "Done"/"Go to dashboard" → `<Button>`, "Submit report" → `<Button loading>`, "Sign in" → `<Button icon>` |

### Dialogs Updated
| Dialog | Changes |
|--------|---------|
| `DeleteDialog.jsx` | Cancel → `<Button variant="ghost">`, Delete → `<Button variant="danger">` |
| `EditProfileNameDialog.jsx` | `<input>` → `<Input error>`, Cancel → `<Button variant="ghost">`, Save → `<Button loading>` |

### Sheets Updated
| Sheet | Changes |
|-------|---------|
| `AddTransactionSheet.jsx` | Save button → `<Button variant="primary" loading>` (eliminates 15 lines of SVG spinner) |

### EmptyState
- `common/EmptyState.jsx` updated to use design tokens + `<Button>` primitives
- All pages keep existing `common/EmptyState` import (API preserved)

---

## 6. Accessibility

- All 4 FABs: `aria-label` added (Dashboard, Transactions, Bills, Loans)
- All `<Input>` components: `aria-invalid`, `aria-describedby` for errors
- All `<Button>` loading states: `<span role="status" aria-label="Loading">`
- Desktop sidebar: `aria-label="Main navigation"`, `aria-current="page"` on active link
- Touch targets: `min-h-[44px]` on all interactive elements

---

## 7. Dark Mode

### Implementation
- CSS custom properties with `.dark` class overrides in `design-system/index.css`
- Tailwind `darkMode: 'class'` configuration
- Theme restored from `localStorage('kosha-theme')` in `main.jsx`
- Falls back to `prefers-color-scheme: dark` OS preference
- Toggle added to Settings page (Appearance section)

### Dark Palette (key values)
| Token | Light | Dark |
|-------|-------|------|
| `--ds-surface` | `#FFFFFF` | `#111318` |
| `--ds-surface-container` | `#EEF1F4` | `#1D2024` |
| `--ds-text` | `#111318` | `#E2E6EA` |
| `--ds-border` | `rgba(17,19,24,0.08)` | `rgba(255,255,255,0.08)` |
| `--ds-primary` | `#007FFF` | `#4DA6FF` |
| `--ds-income` | `#0F9D58` | `#66D49A` |
| `--ds-expense` | `#E8453C` | `#FF7B73` |

---

## 8. Files Created (New)

| Path | Purpose |
|------|---------|
| `src/design-system/tokens.js` | Design token definitions |
| `src/design-system/components.js` | Component API specification |
| `src/design-system/index.css` | CSS custom properties + dark mode |
| `src/components/ui/Button.jsx` | Button primitive |
| `src/components/ui/Input.jsx` | Input primitive |
| `src/components/ui/AmountInput.jsx` | Currency input primitive |
| `src/components/ui/Badge.jsx` | Badge primitive |
| `src/components/ui/Card.jsx` | Card primitive |
| `src/components/ui/BottomSheet.jsx` | Bottom sheet primitive |
| `src/components/ui/Skeleton.jsx` | Skeleton loader primitive |
| `src/components/ui/EmptyState.jsx` | Empty state primitive |
| `src/components/ui/MonthStepper.jsx` | Month navigation primitive |
| `src/components/ui/CategoryPicker.jsx` | Category picker primitive |
| `src/components/ui/TransactionRow.jsx` | Transaction row primitive |
| `src/components/ui/AmountDisplay.jsx` | Amount display primitive |
| `src/components/ui/index.js` | Barrel export |
| `src/utils/dates.js` | Date utility functions |
| `REDESIGN_SUMMARY.md` | This document |

---

## 9. What Was NOT Changed

- **Hooks**: All 9 hooks untouched (`useTransactions`, `useLiabilities`, `useLoans`, `useBudgets`, `useFinancialEvents`, `useReconciliationReviews`, `useScrollDirection`, `useAuth`, `useUserCategories`)
- **Supabase queries**: No RPC/table/filter changes
- **Mutations**: All mutation functions preserved exactly
- **Data layer**: `queryClient.js`, `supabase.js`, `authStore.js`, `mutationGuard.js` untouched
- **`is_repayment` field**: Preserved everywhere
- **Export names**: All existing exports maintained
- **Event handlers**: All `onClick`, `onSubmit`, `onChange` logic preserved
- **Filter chips / Tab buttons**: Kept as custom elements (specialized toggle/radio behavior)
- **Category colors in `categories.js`**: Data-level category colors preserved (e.g., `#FF4757` for Medical)

---

## 10. Remaining Opportunities

| Priority | Item | Notes |
|----------|------|-------|
| Medium | Migrate sub-pickers in `AddTransactionSheet` to `<BottomSheet>` | CategoryPicker, ModePicker, VehiclePicker each duplicate sheet boilerplate |
| Medium | Adopt `<AmountDisplay>` in hero cards and stat summaries | Adds consistent formatting + animated count-up |
| Medium | Adopt `<Card variant="filled">` for stat grid cells | Currently `<div className="rounded-card bg-kosha-surface-2 p-2.5">` |
| Low | Adopt `<Input>` for form fields in Bills/Loans add sheets | Currently raw `<input className="input">` |
| Low | Replace filter chip buttons with a `ChipGroup` primitive | Would reduce className logic duplication |
| Low | Visual dark mode audit | CSS variables are wired; visual pass recommended |

---

## 11. Second Focused Pass — Information Architecture

### Mobile-First Shell
- Removed the fixed desktop sidebar from `src/App.jsx`
- Kept **bottom tab navigation only** for one consistent experience
- Enforced **single-column layout** via `src/index.css`
  - `.page` max width: **430px**
  - removed desktop-width expansion and sidebar offsets
- Updated floating toasts and shell spacing to align to the centered mobile canvas

### Dashboard → Daily Driver
`src/pages/Dashboard.jsx` was simplified from a chart-heavy page into a fast daily decision surface.

**Removed from Dashboard**
- `Cash Risk Radar`
- `Due pipeline conversion`
- `What changed this week`
- `DailySpendBubbleMap`
- `SpendingPaceTracker`

**Added / Kept on Dashboard**
- Greeting + hero balance card
- **Spendable today** calculation
- **Burn rate** indicator vs expected month pace
- Compact **upcoming bills** list (next 3)
- Due-soon bill alert
- Recent transactions
- New-user zero state
- Pull-to-refresh interaction
- Undo action in toast after deleting a recent transaction

### Monthly → Weekly Review
`src/pages/Monthly.jsx` now carries the short-horizon review patterns.

**Kept**
- Month hero
- Month-close summary
- Breakdown card
- Daily spend trend
- Category spending chart
- Monthly heatmap
- Merchant intel
- Month-close checklist

**Moved into Monthly**
- `SpendingPaceTracker`
- `DailySpendBubbleMap`
- Month swipe gesture for quick period review

**Removed from Monthly**
- Portfolio snapshot block (better suited for yearly analytics)

### Analytics → Long-Term Patterns
`src/pages/Analytics.jsx` already matched the long-term role and was retained as the rich insight surface for:
- yearly totals
- YoY comparisons
- cash flow composition
- savings rate trends
- Pareto category analysis
- portfolio/investment consistency
- what-if planning

### Build Verification
- Verified with `npx vite build`
- Result: **build succeeds** (`✓ built in ~4.28s`)
