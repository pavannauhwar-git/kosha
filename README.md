# Kosha

> Your financial sheath — a personal finance PWA for tracking transactions, bills, loans, and financial health.

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

- **Transactions** — add, edit, delete, filter, search, CSV export, recurring engine
- **Bills** — pending/paid states, recurring support, mark-as-paid, due date tracking
- **Loans** — given/taken tracking, settlement progress, record payments, interest rates
- **Dashboard** — cashflow cards, spending pace, daily heatmap, weekly digest, recent activity
- **Analytics** — monthly and yearly breakdowns, category treemaps, savings rate trend, reconciliation confidence
- **Reconciliation** — statement matching, review queue, confidence scoring, alias learning
- **Monthly** — month-over-month comparison, variance analysis, projected close
- **Settings** — shared-wallet invites, locale preferences, reminder configuration
- **Guide** — in-app feature map, getting-started checklist, how-to playbooks
- **Bug reporting** — in-app bug report flow with optional Slack/Discord webhook notification
- **Installable PWA** — service worker with precaching, works offline

## Tech stack

| Layer | Technology |
|-------|-----------|
| Framework | React 18, React Router 6 |
| State/Data | @tanstack/react-query v5 |
| Backend | Supabase (Postgres, Auth, Realtime, Edge Functions) |
| Styling | Tailwind CSS 3 |
| Animations | Framer Motion 11 |
| Charts | Recharts 2 |
| Icons | Lucide React, Phosphor Icons |
| Dialogs | Radix UI |
| Build | Vite 5, vite-plugin-pwa |
| Deployment | Vercel |

## Project structure

```
├── index.html                  # App entry point
├── package.json
├── vite.config.js              # Vite + PWA + chunk splitting config
├── tailwind.config.js
├── vercel.json                 # SPA rewrite rules
├── public/
│   ├── fonts/
│   └── icons/                  # PWA icons
├── src/
│   ├── main.jsx                # App bootstrap
│   ├── App.jsx                 # Router + auth guard + layout
│   ├── index.css               # Tailwind + custom design tokens
│   ├── components/
│   │   ├── analytics/          # Analytics charts, savings rate
│   │   ├── brand/              # Logo, branding
│   │   ├── cards/              # Reusable card components
│   │   ├── categories/         # Category picker, management
│   │   ├── common/             # Toast, empty state, filters, skeletons
│   │   ├── dashboard/          # Heatmap, pace tracker, nudges, recent txns
│   │   ├── dialogs/            # Modal dialogs
│   │   ├── errors/             # Error boundary
│   │   ├── layout/             # Page layout wrappers
│   │   ├── navigation/         # Nav bar, auth guard, route skeleton
│   │   └── transactions/       # Add/edit sheet, transaction list item
│   ├── context/
│   │   └── AuthContext.jsx     # Supabase auth state provider
│   ├── hooks/
│   │   ├── useAuth.js          # Auth actions (sign in/out/refresh)
│   │   ├── useBudgets.js       # Budget queries
│   │   ├── useFinancialEvents.js  # Audit event log
│   │   ├── useLiabilities.js   # Bills/liabilities CRUD
│   │   ├── useLoans.js         # Loans CRUD + payments
│   │   ├── useReconciliationReviews.js
│   │   ├── useScrollDirection.js
│   │   ├── useTransactions.js  # Transaction CRUD + filters
│   │   └── useUserCategories.js
│   ├── lib/
│   │   ├── supabase.js         # Supabase client init
│   │   ├── queryClient.js      # React Query client config
│   │   ├── mutationGuard.js    # Optimistic update safety
│   │   ├── auditLog.js         # Financial event logging
│   │   ├── categories.js       # Default category definitions
│   │   ├── changelog.js        # Version history
│   │   ├── reconciliation.js   # Matching engine
│   │   ├── statementMatching.js # Statement parser + scoring
│   │   ├── csv.js              # CSV export
│   │   ├── invites.js          # Shared-wallet invite logic
│   │   ├── reminders.js        # Notification reminders
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
│   ├── load_env.mjs            # Dotenv loader for scripts
│   ├── ops/                    # Deploy readiness + release checks
│   └── tests/                  # E2E verification scripts
├── supabase/
│   ├── schema.sql              # Full DB schema (idempotent)
│   └── functions/
│       └── bug-report-notify/  # Slack/Discord webhook function
└── docs/                       # Internal design docs
```

## Prerequisites

- **Node.js** 22+ (recommended; 18+ works but WebSocket polyfill may be needed for tests)
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

If you plan to run the E2E verification scripts, create these users in **Supabase Auth → Users**:

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
```

### Required — E2E test scripts

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

### Verification & release

| Command | Description |
|---------|-------------|
| `npm run release:candidate-check` | Full release verification suite (PASS/FAIL) |
| `npm run test:deploy-readiness` | Validate env, tables, columns, RPCs |
| `npm run test:production-assets` | Verify built asset integrity |

### E2E tests

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

## Testing

Run the full verification sequence before any release:

```bash
npm run build
npm run test:deploy-readiness
npm run test:join-flow
npm run test:liabilities-realtime
npm run test:mutation-stress
npm run release:candidate-check
```

All scripts print `PASS`/`FAIL` and exit with code 0 on success.

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

2. Run the release candidate check:
   ```bash
   npm run release:candidate-check
   ```

3. Update `src/lib/changelog.js` with the new version entry (5 items max per version).

4. Commit and tag:
   ```bash
   git add -A && git commit -m "release: vX.Y.Z"
   git tag -a vX.Y.Z -m "Release vX.Y.Z"
   git push origin main --tags
   ```

5. Deploy to Vercel and smoke test:
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
   npm run build && npm run test:deploy-readiness
   ```

4. Open a PR with:
   - Problem statement
   - Implementation summary
   - Test evidence (commands + output)

### Branch protection

Recommended required status checks: `build`, `deploy-readiness`, `runtime-verification`. See `.github/CODEOWNERS` for critical path review ownership.

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
