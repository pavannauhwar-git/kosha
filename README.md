# Kosha

> Your financial sheath — a production-grade personal finance PWA for tracking transactions, bills, loans, and financial health.

## Table of contents

- [Overview](#overview)
- [Features](#features)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Setup](#setup)
- [Environment variables](#environment-variables)
- [Database setup](#database-setup)
- [Running the app](#running-the-app)
- [Scripts](#scripts)
- [Testing](#testing)
- [CI/CD pipeline](#cicd-pipeline)
- [Deployment](#deployment)
- [Release process](#release-process)
- [Contributing](#contributing)
- [Bug reporting Edge Function](#bug-reporting-edge-function)
- [Troubleshooting](#troubleshooting)
- [Security notes](#security-notes)

## Overview

Kosha is a mobile-first Progressive Web App for personal finance. It provides real-time transaction tracking, bill management, loan tracking, monthly/yearly analytics, and statement reconciliation — all backed by Supabase with offline-friendly PWA support.

Key design principles:

- **Server-truth model** — Supabase Postgres is the single source of truth; the client uses React Query for caching and optimistic updates
- **Mobile-first** — designed for phone-sized screens with installable PWA behavior on Android and iOS
- **Realtime sync** — Supabase Realtime delivers instant updates across sessions
- **Audit transparency** — every financial mutation is logged as an immutable audit event

## Features

- **Transactions** — Add, edit, delete, filter, and search with deterministic URL sync and CSV export.
- **Splitwise** — Full P2P group expense management: create groups, invite members, add split expenses, and settle up with automated ledger sync.
- **Bills & Dues** — Track recurring liabilities with due-date alerts, paid/pending states, and one-tap settlement.
- **Loans** — Manage given/taken loans with progress tracking, interest support, and repayment history.
- **Linked Records** — Atomic cross-references between the ledger and source modules (Bills, Loans, Splitwise) to ensure data integrity.
- **Dashboard** — Premium command center with cashflow cards, spending pace, daily heatmap, and weekly digests.
- **Analytics** — Deep-dive monthly/yearly breakdowns, category treemaps, savings rate trends, and cashflow waterfall charts.
- **Performance** — Zero-latency navigation with route-intent prefetching and tailored per-route skeleton loaders to eliminate layout shifts.
- **Mobile UX** — Frictionless data entry with optimized keyboard hints, decimal input modes, and native form submission patterns for rapid tracking.
- **Reconciliation** — Intelligent statement matching engine with confidence scoring, review queues, and alias learning.
- **Design System** — Native-feeling PWA with Material 3 motion, tactile haptic feedback, and optimized gesture-based navigation.
- **Privacy & Sync** — Self-hosted architecture with multi-user "Linked Wallets" sharing and real-time Supabase synchronization.

## Tech stack

| Layer | Technology |
|-------|-----------|
| Framework | React 18, React Router 6 |
| State/Data | @tanstack/react-query v5 |
| Backend | Supabase (Postgres, Auth, Realtime, Edge Functions) |
| Styling | Tailwind CSS 3, Vanilla CSS Design System |
| Animations | Framer Motion 11, CSS Keyframes |
| Haptics | Native Web Vibration API |
| Charts | Recharts 2 |
| Icons | Phosphor Icons |
| Build | Vite 5, vite-plugin-pwa |
| Unit Tests | Vitest 4, React Testing Library |
| Deployment | Vercel |

## Project structure

```
├── index.html                  # App entry point
├── package.json
├── eslint.config.js            # ESLint flat config
├── .nvmrc                      # Node version constraint (22)
├── vite.config.js              # Vite + PWA + Vitest + chunk splitting config
├── tailwind.config.js
├── vercel.json                 # SPA rewrite rules
├── public/
│   ├── fonts/
│   └── icons/                  # PWA icons
├── src/                        # Application source (no test files)
│   ├── main.jsx                # App bootstrap
│   ├── App.jsx                 # Router + auth guard + layout
│   ├── index.css               # Tailwind + custom design tokens
│   ├── components/
│   │   ├── analytics/          # Analytics charts, savings rate
│   │   ├── brand/              # Logo, branding
│   │   ├── cards/              # Reusable card components (dashboard, analytics, monthly)
│   │   ├── categories/         # Category picker, management, budget sheet
│   │   ├── common/             # Toast, empty state, filters, skeletons
│   │   ├── dashboard/          # Heatmap, pace tracker, nudges, recent txns
│   │   ├── dialogs/            # Modal dialogs
│   │   ├── errors/             # Error boundary
│   │   ├── layout/             # Page layout wrappers
│   │   ├── navigation/         # Nav bar, auth guard, profile menu
│   │   ├── obligations/        # Bills and Loans specific components
│   │   ├── reconciliation/     # Statement review panel
│   │   ├── transactions/       # Add/edit sheet, transaction list item
│   │   └── ui/                 # Core design system primitives (Button, Card, Input, Select, Sheet, Switch)
│   ├── context/
│   │   ├── AuthContext.jsx     # Supabase auth state provider
│   │   └── ToastContext.jsx    # Global toast notifications
│   ├── hooks/
│   │   ├── useAuth.js          # Auth actions (sign in/out/refresh)
│   │   ├── useBudgets.js       # Budget queries
│   │   ├── useLiabilities.js   # Bills/liabilities CRUD
│   │   ├── useLoans.js         # Loans CRUD + payments
│   │   ├── useSplitwise.js     # Splitwise group and expense logic
│   │   ├── useTransactions.js  # Transaction CRUD + filters
│   │   └── ...                 # Other app-specific hooks
│   ├── lib/
│   │   ├── supabase.js         # Supabase client init
│   │   ├── queryClient.js      # React Query client config
│   │   ├── mutationGuard.js    # Optimistic update safety
│   │   ├── auditLog.js         # Financial event logging
│   │   ├── paise.js            # BigInt money math (rupees ↔ paise)
│   │   ├── splitwiseMath.js    # Expense splitting engine (equal/exact/percent/shares)
│   │   ├── statementMatching.js # Statement parser + confidence scoring engine
│   │   ├── validateAmount.js   # Client-side amount validation
│   │   ├── reconciliation.js   # Reconciliation flow utilities
│   │   ├── categories.js       # Default category definitions
│   │   ├── changelog.js        # Version history
│   │   └── ...                 # Colors, locale, utils, animations
│   └── pages/
│       ├── Dashboard.jsx
│       ├── Transactions.jsx
│       ├── Bills.jsx
│       ├── Loans.jsx
│       ├── Analytics.jsx
│       ├── Monthly.jsx
│       ├── Reconciliation.jsx
│       ├── Settings.jsx
│       ├── Guide.jsx
│       ├── About.jsx
│       ├── Login.jsx
│       ├── Onboarding.jsx
│       ├── ReportBug.jsx
│       └── NotFound.jsx
├── scripts/
│   ├── load_env.mjs            # Dotenv loader for all scripts
│   ├── generate_app_icons.py   # PWA icon generator
│   ├── ops/                    # Deploy readiness + release checks
│   └── tests/
│       ├── unit/               # Vitest unit + component tests (run in CI via npm run test:unit)
│       │   ├── setup.js        # jest-dom + element-internals-polyfill setup
│       │   ├── lib/            # Pure logic tests (paise, splitwiseMath, validateAmount, statementMatching)
│       │   └── components/     # React component tests (Button, Card, Input, Select, Sheet)
│       └── *.mjs               # Integration + E2E scripts (require live Supabase)
├── supabase/
│   ├── schema.sql              # Full DB schema (idempotent snapshot)
│   └── functions/
│       └── bug-report-notify/  # Slack/Discord webhook function
└── docs/                       # Internal design docs
```

## Prerequisites

- **Node.js** 22+ (recommended; 18+ works but WebSocket polyfill may be needed for integration tests)
- **npm** 9+
- A **Supabase** project (free tier works)

## Setup

### 1. Clone the repository

```bash
git clone https://github.com/<your-org>/kosha.git
cd kosha
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

```bash
cp .env.local.example .env.local
```

Edit `.env.local` and fill in your Supabase project credentials. See [Environment variables](#environment-variables) for the full reference.

### 4. Set up the database

Open the **Supabase SQL Editor** and run the contents of `supabase/schema.sql`. The schema is fully idempotent — safe to re-run on an existing database.

This creates all required tables (`transactions`, `liabilities`, `loans`, `user_categories`, `financial_events`, `invites`, `reconciliation_reviews`), RLS policies, RPCs, and Realtime publication.

### 5. Create test users (optional)

If you plan to run the E2E integration scripts, create these users in **Supabase Auth → Users**:

| Purpose | Env var | Notes |
|---------|---------|-------|
| Creator account | `E2E_CREATOR_EMAIL` | Used by join-flow test |
| Joiner account | `E2E_JOINER_EMAIL` | Must be a different user |
| Session account | `E2E_SESSION_EMAIL` | Used by mutation + realtime tests |

### 6. Start the dev server

```bash
npm run dev
```

The app runs at `http://localhost:5173`. Sign up or sign in with your Supabase auth credentials.

## Environment variables

All variables go in `.env.local` (git-ignored). See `.env.local.example` for the template.

### Required — app runtime

```env
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<supabase-anon-key>
SENTRY_DSN=<sentry-dsn>
SENTRY_AUTH_TOKEN=<sentry-auth-token>
```

### Required — E2E integration scripts

```env
APP_BASE_URL=http://localhost:5173

E2E_CREATOR_EMAIL=<email>
E2E_CREATOR_PASSWORD=<password>

E2E_JOINER_EMAIL=<email>
E2E_JOINER_PASSWORD=<password>

E2E_SESSION_EMAIL=<email>
E2E_SESSION_PASSWORD=<password>
```

> `scripts/load_env.mjs` auto-loads `.env` and `.env.local` for all scripts. Never commit `.env.local`.

## Database setup

1. Create a Supabase project at [supabase.com](https://supabase.com).
2. Open **SQL Editor** and paste the contents of `supabase/schema.sql`. Run it.
3. Verify tables are created: `transactions`, `liabilities`, `loans`, `user_categories`, `financial_events`, `invites`, `reconciliation_reviews`.
4. Confirm **Realtime** is enabled for `transactions`, `liabilities`, `loans`, and `financial_events` (the schema handles this via `ALTER PUBLICATION`).

> **Note:** Supabase SQL Editor does not support psql meta-commands like `\d`. Use `information_schema` or `pg_catalog` queries to inspect the schema.

## Running the app

```bash
# Development
npm run dev

# Production build
npm run build

# Preview production build locally
npm run preview
```

## Scripts

### Development

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Production build |
| `npm run preview` | Serve production build locally |
| `npm run lint` | Run ESLint strict checks |
| `npm run lint:fix` | Auto-fix ESLint issues |

### Verification & release

| Command | Description |
|---------|-------------|
| `npm run release:candidate-check` | Full release verification suite (PASS/FAIL) |
| `npm run test:deploy-readiness` | Validate env, tables, columns, RPCs |
| `npm run test:production-assets` | Verify built asset integrity |

### Unit tests (no network required)

| Command | Description |
|---------|-------------|
| `npm run test:unit` | Run Vitest in watch mode (local dev) |
| `npm run test:unit -- --run` | Run all unit tests once (CI mode) |
| `npm run test:money` | Legacy money math script |
| `npm run test:no-network` | All offline tests (money math + mutation path checks) |

### Integration / E2E tests (require live Supabase)

| Command | Description |
|---------|-------------|
| `npm run test:join-flow` | Invite token creation and consumption |
| `npm run test:liabilities-realtime` | Realtime INSERT delivery across sessions |
| `npm run test:mutation-stress` | Rapid transaction + liability mutation consistency |
| `npm run test:mutation-paths` | CRUD mutation path coverage |
| `npm run test:mutation-integration` | Cross-module mutation integration |
| `npm run test:mutation-rollback` | Optimistic rollback contract verification |
| `npm run test:statement-matching` | Statement parsing and match scoring |
| `npm run test:reconciliation-flow` | Reconciliation persist + alias-reset paths |
| `npm run test:reconciliation-metrics` | Reconciliation telemetry counters |
| `npm run test:reconciliation-schema-live` | Live schema validation for reconciliation tables |
| `npm run test:reconciliation-insights` | Monthly insights generation telemetry |
| `npm run test:wallet-cache-scoping` | Cache scoping and invalidation predicates |
| `npm run test:rls-partner-isolation` | RLS isolation rules between partners |
| `npm run test:splitwise-math` | Splitwise math verification against live data |

## Testing

Kosha has two distinct testing layers.

### Layer 1 — Unit & Component Tests (Vitest)

Fast, offline, run in jsdom. No network access needed.

```bash
npm run test:unit -- --run
```

Tests live in `scripts/tests/unit/` and cover:

| File | What it tests |
|------|---------------|
| `lib/paise.test.js` | BigInt money conversion, symmetric rounding, `divEvenly` |
| `lib/validateAmount.test.js` | Input validation, Indian number format, min/max, zero guards |
| `lib/splitwiseMath.test.js` | Equal, exact, percent, and share splitting; balance computation |
| `lib/statementMatching.test.js` | CSV parsing, date formats, direction inference, confidence scoring, one-to-one matching |
| `components/Button.test.jsx` | Variant rendering, click handling, disabled/loading state |
| `components/Card.test.jsx` | Static vs pressable, keyboard navigation (Enter/Space), button role |
| `components/Input.test.jsx` | Value binding, native event bubbling, error/helper text, disabled |
| `components/Select.test.jsx` | Option rendering, placeholder, change event, error state |
| `components/Sheet.test.jsx` | Open/close, title, close button, ARIA dialog semantics |

### Layer 2 — Integration & E2E Scripts

Require a live Supabase project and valid secrets. Run the full sequence before any production release:

```bash
npm run build
npm run test:deploy-readiness
npm run test:join-flow
npm run test:liabilities-realtime
npm run test:mutation-stress
npm run release:candidate-check
```

All scripts print `PASS`/`FAIL` and exit with code 0 on success.

## CI/CD pipeline

GitHub Actions (`.github/workflows/ci.yml`) runs automatically on every push to `main` and on every Pull Request.

| Job | Triggers | What it does |
|-----|----------|--------------|
| `lint` | Always | ESLint strict pass |
| `unit-tests` | Always | `npm run test:unit -- --run` + `npm run test:no-network` |
| `version-changelog-check` | Always | Asserts `package.json` version exists in `changelog.js` |
| `build` | Always | Full Vite production build |
| `deploy-readiness` | After build (needs secrets) | Live Supabase schema + RPC validation |
| `runtime-verification` | After deploy-readiness (needs secrets) | Live join flow, realtime, mutation stress |

> All jobs run in parallel where possible. The build gate is required before deploy-readiness runs.

## Deployment

### Vercel (recommended)

The project includes `vercel.json` with SPA rewrite rules — all routes fall through to `index.html`.

1. Import the repository in [Vercel](https://vercel.com).
2. Set environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Deploy. Vercel auto-detects Vite and builds with `npm run build`.

### Other platforms

Any static hosting that supports SPA routing works. Build with `npm run build` and serve the `dist/` directory with a fallback to `index.html` for all routes.

## Release process

1. Pull latest and install dependencies:
   ```bash
   git pull && npm install
   ```

2. Run the full local check:
   ```bash
   npm run test:unit -- --run && npm run build && npm run test:deploy-readiness
   ```

3. Update `src/lib/changelog.js` with the new version entry (5 items max per version).

4. Bump `version` in `package.json` to match.

5. Commit and tag:
   ```bash
   git add -A && git commit -m "release: vX.Y.Z"
   git tag -a vX.Y.Z -m "Release vX.Y.Z"
   git push origin main --tags
   ```

6. Deploy to Vercel and smoke test:
   - Sign in → add a transaction → add a bill → verify dashboard refreshes
   - Check PWA install prompt on mobile

**Rollback:** Re-deploy the previous commit from the Vercel dashboard.

## Contributing

1. Branch from `main`:
   ```bash
   git checkout -b feat/your-change
   ```

2. Make focused commits using conventional prefixes: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`

3. Run checks locally:
   ```bash
   npm run test:unit -- --run && npm run build
   ```

4. Open a PR with:
   - Problem statement
   - Implementation summary
   - Test evidence (commands + output)

### Branch protection

Recommended required status checks: `lint`, `unit-tests`, `build`, `deploy-readiness`, `runtime-verification`.

### Adding new tests

Unit tests live in `scripts/tests/unit/`. Follow the existing patterns:
- Logic in `src/lib/` → write a matching `.test.js` in `scripts/tests/unit/lib/`
- Components in `src/components/` → write a matching `.test.jsx` in `scripts/tests/unit/components/`

## Bug reporting Edge Function

**Path:** `supabase/functions/bug-report-notify/`

Sends a webhook notification (Slack/Discord) when a user submits a bug report from the app.

**Required Supabase function secrets:**

```
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
BUG_REPORT_WEBHOOK_URL
```

**Deploy:**

```bash
supabase functions deploy bug-report-notify
```

If the webhook URL is not configured, bug submissions still succeed — the notification is silently skipped.

## Troubleshooting

| Problem | Solution |
|---------|----------|
| App cannot connect to Supabase | Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env.local` |
| Unit tests fail to run | Ensure `node_modules` are installed (`npm install`). Check Node 22+. |
| Realtime test fails | Use Node 22+ (or install `ws` if your runtime lacks WebSocket). Check Supabase Realtime config and table replication. |
| Join flow test fails | Ensure creator and joiner are different accounts, both confirmed in Supabase Auth |
| Mutation stress test fails | Verify the E2E session account has insert/update/delete permissions. Re-run after cleanup if a previous run was interrupted. |
| Build fails with missing env | Ensure `.env.local` exists with both `VITE_SUPABASE_*` variables |
| PWA not updating | Hard-refresh or clear service worker in DevTools → Application → Service Workers |

## Security notes

- Never commit `.env.local` or secrets to git
- Only the Supabase **anon key** is used on the frontend — safe for client exposure
- **Service role keys** must stay server-side (Edge Functions only)
- All database access is gated by Row Level Security (RLS) policies
- Financial mutations are logged to an immutable audit trail
- **Linked Integrity**: Automated transactions (Bills, Loans, Splitwise) are cryptographically linked to their sources and guarded against manual modifications to prevent ledger drift
