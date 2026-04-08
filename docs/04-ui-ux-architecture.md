# Chapter 4: UI/UX Architecture and Design System

## 4.1 UX Operating Model

Kosha's UI architecture is not only visual styling. It is an interaction contract: each page must provide quick orientation, a clear next action, and stable trust signals while data is loading or mutating.

Primary product intent and UX constraints are codified in the playbook:

1. Product intent and page purpose map are defined in [docs/PRODUCT_UX_PLAYBOOK.md](docs/PRODUCT_UX_PLAYBOOK.md#L3) and [docs/PRODUCT_UX_PLAYBOOK.md](docs/PRODUCT_UX_PLAYBOOK.md#L10).
2. Card anatomy, spacing rhythm, and status semantics are defined in [docs/PRODUCT_UX_PLAYBOOK.md](docs/PRODUCT_UX_PLAYBOOK.md#L74), [docs/PRODUCT_UX_PLAYBOOK.md](docs/PRODUCT_UX_PLAYBOOK.md#L76), [docs/PRODUCT_UX_PLAYBOOK.md](docs/PRODUCT_UX_PLAYBOOK.md#L83), and [docs/PRODUCT_UX_PLAYBOOK.md](docs/PRODUCT_UX_PLAYBOOK.md#L88).
3. Interaction safety rules are defined in [docs/PRODUCT_UX_PLAYBOOK.md](docs/PRODUCT_UX_PLAYBOOK.md#L94).
4. First-viewport clarity and action linkage are explicit quality gates in [docs/PRODUCT_UX_PLAYBOOK.md](docs/PRODUCT_UX_PLAYBOOK.md#L117).

Architectural implication:

1. UI composition order matters as much as component style.
2. Loading and mutation states are part of trust UX, not implementation detail.
3. Motion must communicate state change, not just decorate transitions.

---

## 4.2 Design Language: Tokens and Semantics

## 4.2.1 Color system and semantic intent

The design system uses semantic color tokens instead of page-local hardcoded colors.

Tailwind semantic palette is defined in [tailwind.config.js](tailwind.config.js#L6):

1. Base surfaces: kosha-bg, kosha-surface, kosha-border.
2. Domain semantics: income, expense, invest, warning.
3. Ink hierarchy: ink, ink-2, ink-3, ink-4.
4. Brand axis: deep charcoal plus warm gold accent.

Runtime CSS variables mirror this semantic model in [src/index.css](src/index.css#L59), including:

1. Brand and accent variables.
2. Status colors for income/expense/warning.
3. Hero-card specific contrast variables.
4. Shared shimmer colors for loading surfaces.

This dual-token strategy means:

1. Utility classes and handcrafted CSS stay visually aligned.
2. Theme refinements can be done centrally without rewriting page JSX.
3. Charts, cards, sheets, and nav surfaces preserve one semantic language.

## 4.2.2 Typography scale and numeric readability

Typography scales are defined in [tailwind.config.js](tailwind.config.js#L71), with explicit tiers:

1. caption and label for metadata.
2. body for dense transactional text.
3. value, display, and hero for financial emphasis.

Key implementation details:

1. Base font family is set globally in [src/index.css](src/index.css#L32).
2. Currency-heavy surfaces use tabular-nums patterns throughout major pages (for example in [src/pages/Dashboard.jsx](src/pages/Dashboard.jsx#L899), [src/pages/Transactions.jsx](src/pages/Transactions.jsx#L374), and [src/pages/Monthly.jsx](src/pages/Monthly.jsx#L356)).
3. Playbook spacing/type rhythm is explicitly documented in [docs/PRODUCT_UX_PLAYBOOK.md](docs/PRODUCT_UX_PLAYBOOK.md#L83).

## 4.2.3 Shape, depth, and tactile hierarchy

Shape and depth are centralized in Tailwind tokens:

1. Radius scale in [tailwind.config.js](tailwind.config.js#L80).
2. Shadow scale in [tailwind.config.js](tailwind.config.js#L88).

Shared component primitives apply those tokens:

1. Primary card primitive in [src/index.css](src/index.css#L145).
2. List card primitive in [src/index.css](src/index.css#L218).
3. Action chips and buttons in [src/index.css](src/index.css#L253), [src/index.css](src/index.css#L311), and [src/index.css](src/index.css#L338).

Practical result:

1. Visual hierarchy is encoded by token tiers rather than ad hoc per-page decisions.
2. Destructive, warning, and neutral actions stay consistently legible.

---

## 4.3 Layout and Composition System

## 4.3.1 Page shell and safe-area contract

The global page shell is safe-area aware and mobile-first:

1. Safe-area and nav-height variables are defined in [src/index.css](src/index.css#L61).
2. Main page wrapper geometry is in [src/index.css](src/index.css#L524).
3. Frosted sticky page header is implemented by [src/components/layout/PageHeader.jsx](src/components/layout/PageHeader.jsx#L3) and [src/index.css](src/index.css#L194).

The same shell scales to desktop with wider max width and altered spacing in [src/index.css](src/index.css#L692).

## 4.3.2 The practical 60/40 ergonomic split

Kosha does not encode a literal CSS ratio named "60/40". Instead, it implements a consistent attention split through composition order:

1. Top-of-viewport surfaces prioritize orientation and action.
2. Lower surfaces expand diagnostics and historical detail.

This is aligned with the first-viewport quality gate in [docs/PRODUCT_UX_PLAYBOOK.md](docs/PRODUCT_UX_PLAYBOOK.md#L118) and visible in page structure:

1. Dashboard first renders greeting, hero, and nudges before deeper analytics in [src/pages/Dashboard.jsx](src/pages/Dashboard.jsx#L809), [src/pages/Dashboard.jsx](src/pages/Dashboard.jsx#L822), and [src/pages/Dashboard.jsx](src/pages/Dashboard.jsx#L839).
2. Monthly first renders hero and month-close summary before deeper breakdown surfaces in [src/pages/Monthly.jsx](src/pages/Monthly.jsx#L327) and [src/pages/Monthly.jsx](src/pages/Monthly.jsx#L349).

So the 60/40 principle is an information hierarchy rule, not a hardcoded grid ratio.

## 4.3.3 Navigation architecture

Desktop and mobile navigation intentionally diverge by ergonomics:

1. Desktop uses a fixed frosted sidebar in [src/App.jsx](src/App.jsx#L383).
2. Mobile uses a floating glass dock in [src/App.jsx](src/App.jsx#L458) and [src/index.css](src/index.css#L378).
3. Mobile nav hides on downward scroll via [src/hooks/useScrollDirection.js](src/hooks/useScrollDirection.js#L13) and [src/App.jsx](src/App.jsx#L476).
4. Nav prefetches route chunks/data on hover, focus, and touch-start through [src/App.jsx](src/App.jsx#L94).

This separation reduces thumb travel on mobile while preserving high information density on desktop.

## 4.3.4 Sheet and dialog system

Overlay primitives use a consistent bottom-sheet model:

1. Shared backdrop/panel geometry in [src/index.css](src/index.css#L479) and [src/index.css](src/index.css#L486).
2. Transaction sheet orchestration in [src/components/transactions/AddTransactionSheet.jsx](src/components/transactions/AddTransactionSheet.jsx#L360).
3. Budget management sheet using Radix dialog portal in [src/components/categories/BudgetSheet.jsx](src/components/categories/BudgetSheet.jsx#L98).
4. Destructive confirmation dialog with the same motion grammar in [src/components/dialogs/DeleteDialog.jsx](src/components/dialogs/DeleteDialog.jsx#L11).

This keeps modal interactions predictable while allowing different semantic intensities (data entry vs destructive confirmation).

---

## 4.4 Motion System (Framer Motion + CSS)

## 4.4.1 Shared motion constants and easing

Core motion constants are centralized in [src/lib/animations.js](src/lib/animations.js#L2):

1. Shared ease curve: [0.22, 1, 0.36, 1].
2. Fade-up and stagger builders in [src/lib/animations.js](src/lib/animations.js#L4) and [src/lib/animations.js](src/lib/animations.js#L18).
3. Spring presets for premium and gentle interactions in [src/lib/animations.js](src/lib/animations.js#L26).

CSS also defines a motion timing scale in [src/index.css](src/index.css#L100).

## 4.4.2 Route transition choreography

Route transitions are explicit and stateful:

1. Page transition object in [src/App.jsx](src/App.jsx#L70).
2. AnimatePresence wait mode for exit-before-enter behavior in [src/App.jsx](src/App.jsx#L810).
3. Route content keyed by pathname in [src/App.jsx](src/App.jsx#L811).

This avoids abrupt route swaps and preserves navigational continuity.

## 4.4.3 In-page reveal and progressive emphasis

Dashboard uses fade-up plus stagger for a progressive reveal sequence:

1. Motion builders imported in [src/pages/Dashboard.jsx](src/pages/Dashboard.jsx#L18).
2. Fade/stagger instances in [src/pages/Dashboard.jsx](src/pages/Dashboard.jsx#L45).
3. Sequential section rendering in [src/pages/Dashboard.jsx](src/pages/Dashboard.jsx#L801).

The same principle appears in filter panels and month-change transitions:

1. Category filter reveal in [src/pages/Transactions.jsx](src/pages/Transactions.jsx#L487).
2. Month switch transition in [src/pages/Monthly.jsx](src/pages/Monthly.jsx#L327).

## 4.4.4 Interaction physics for navigation and overlays

Motion values are chosen to feel dense but controlled:

1. Mobile nav tap spring in [src/App.jsx](src/App.jsx#L489).
2. Active-pill layout animation in [src/App.jsx](src/App.jsx#L493).
3. Sheet enter springs around stiffness 400 with tuned damping in [src/components/transactions/AddTransactionSheet.jsx](src/components/transactions/AddTransactionSheet.jsx#L368), [src/components/categories/BudgetSheet.jsx](src/components/categories/BudgetSheet.jsx#L117), and [src/components/dialogs/DeleteDialog.jsx](src/components/dialogs/DeleteDialog.jsx#L27).

## 4.4.5 Reduced-motion compliance

A global reduced-motion media rule is enforced in [src/index.css](src/index.css#L575), collapsing animation and transition duration for accessibility-sensitive users.

---

## 4.5 Loading-State Architecture and Anti-Flash Strategy

Kosha distinguishes initial blocking load from background freshness updates. This is the most important UX trust pattern in the app.

## 4.5.1 Route and auth loading

Route-level loading has two coordinated layers:

1. Suspense fallback wrapper in [src/App.jsx](src/App.jsx#L62) and [src/App.jsx](src/App.jsx#L64).
2. Auth guard skeleton-by-route while auth/profile resolve in [src/components/navigation/AuthGuard.jsx](src/components/navigation/AuthGuard.jsx#L147) and [src/components/navigation/AuthGuard.jsx](src/components/navigation/AuthGuard.jsx#L176).

This prevents blank-route flashes during auth bootstrap and redirect transitions.

## 4.5.2 Initial load vs background fetch in data hooks

Hooks expose both loading and fetching where needed:

1. Month summary returns both in [src/hooks/useTransactions.js](src/hooks/useTransactions.js#L448) and [src/hooks/useTransactions.js](src/hooks/useTransactions.js#L473).
2. Running balance returns both in [src/hooks/useTransactions.js](src/hooks/useTransactions.js#L608) and [src/hooks/useTransactions.js](src/hooks/useTransactions.js#L631).
3. Recent transactions returns both in [src/hooks/useTransactions.js](src/hooks/useTransactions.js#L265) and [src/hooks/useTransactions.js](src/hooks/useTransactions.js#L285).

Dashboard then composes these states explicitly:

1. Initial hero blocking state in [src/pages/Dashboard.jsx](src/pages/Dashboard.jsx#L318).
2. Non-blocking background sync state in [src/pages/Dashboard.jsx](src/pages/Dashboard.jsx#L319).
3. Lightweight sync hint text without tearing content in [src/pages/Dashboard.jsx](src/pages/Dashboard.jsx#L816).

## 4.5.3 Placeholder continuity (no flash on revalidation)

Hook-level placeholderData keeps previous data visible while fresh data is fetched:

1. Transactions list in [src/hooks/useTransactions.js](src/hooks/useTransactions.js#L219).
2. Month summary and running balance in [src/hooks/useTransactions.js](src/hooks/useTransactions.js#L470) and [src/hooks/useTransactions.js](src/hooks/useTransactions.js#L628).
3. Liabilities and loans in [src/hooks/useLiabilities.js](src/hooks/useLiabilities.js#L56) and [src/hooks/useLoans.js](src/hooks/useLoans.js#L60).
4. Budgets and user categories in [src/hooks/useBudgets.js](src/hooks/useBudgets.js#L26) and [src/hooks/useUserCategories.js](src/hooks/useUserCategories.js#L91).

This is the primary anti-flicker mechanism.

## 4.5.4 Skeleton system and staged heavy rendering

Skeleton architecture is shared and composable:

1. Skeleton primitive component in [src/components/common/SkeletonLayout.jsx](src/components/common/SkeletonLayout.jsx#L1).
2. Shimmer keyframes and class in [src/index.css](src/index.css#L596) and [src/index.css](src/index.css#L605).

Pages then use two-stage loading:

1. Blocking skeleton for first render in [src/pages/Transactions.jsx](src/pages/Transactions.jsx#L546) and [src/pages/Monthly.jsx](src/pages/Monthly.jsx#L319).
2. Deferred heavy surfaces after first paint via heavyReady in [src/pages/Dashboard.jsx](src/pages/Dashboard.jsx#L273), [src/pages/Dashboard.jsx](src/pages/Dashboard.jsx#L280), [src/pages/Monthly.jsx](src/pages/Monthly.jsx#L34), and [src/pages/Monthly.jsx](src/pages/Monthly.jsx#L38).

## 4.5.5 Mutation progress and integrity UX

For write flows, UX is intentionally strict:

1. Add transaction disables all controls immediately on submit in [src/components/transactions/AddTransactionSheet.jsx](src/components/transactions/AddTransactionSheet.jsx#L336).
2. Backdrop and close action are blocked while saving in [src/components/transactions/AddTransactionSheet.jsx](src/components/transactions/AddTransactionSheet.jsx#L363) and [src/components/transactions/AddTransactionSheet.jsx](src/components/transactions/AddTransactionSheet.jsx#L383).
3. Sheet closes only after mutation success in [src/components/transactions/AddTransactionSheet.jsx](src/components/transactions/AddTransactionSheet.jsx#L344).

This implements the playbook rule to keep destructive or critical row-state changes explicit and trustworthy.

## 4.5.6 Realtime freshness without visual churn

Realtime invalidation is intentionally delayed and suppressed to prevent refetch storms:

1. Debounced invalidation scheduler in [src/App.jsx](src/App.jsx#L549) with 300ms delay at [src/App.jsx](src/App.jsx#L555).
2. Mutation suppression guard checks before invalidation in [src/App.jsx](src/App.jsx#L550).

UI implication:

1. Users see stable optimistic state immediately.
2. Realtime catches remote truth shortly after without visible thrash.

---

## 4.6 Responsive and Device Ergonomics

Kosha is mobile-first and thumb-aware, then expands density for desktop.

Core mechanisms:

1. Safe-area variables and nav height in [src/index.css](src/index.css#L61).
2. Mobile-first page spacing and bottom inset in [src/index.css](src/index.css#L524).
3. Small-device compaction at <=390px in [src/index.css](src/index.css#L611).
4. Desktop page expansion at >=768px in [src/index.css](src/index.css#L692).
5. Desktop sheet repositioning around sidebar geometry at [src/index.css](src/index.css#L717).
6. Header safe-top padding in [src/components/layout/PageHeader.jsx](src/components/layout/PageHeader.jsx#L8).

This architecture keeps mobile interaction targets comfortable while preserving desktop information throughput.

---

## 4.7 Implementation Rules for Future UI Work

When adding or revising UI, follow these guardrails:

1. Use semantic tokens first, not page-local raw colors. Start from [tailwind.config.js](tailwind.config.js#L6) and [src/index.css](src/index.css#L59).
2. Keep first viewport action-oriented per quality gates in [docs/PRODUCT_UX_PLAYBOOK.md](docs/PRODUCT_UX_PLAYBOOK.md#L118).
3. Preserve the loading split:
   - isLoading for initial skeleton.
   - isFetching for background freshness indicators.
4. Use placeholderData for data-heavy views where visual continuity matters.
5. Keep sheet/dialog motion within existing spring ranges unless there is a measured UX reason to diverge.
6. Respect reduced-motion behavior in [src/index.css](src/index.css#L575).
7. For destructive or write-critical actions, disable interactive exits until mutation resolves.

If these rules are followed, new surfaces remain consistent with Kosha's current trust-performance UX model.
