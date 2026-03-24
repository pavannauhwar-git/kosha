# Kosha

Kosha is a personal finance Progressive Web App (PWA) for tracking transactions, bills, monthly budgets, and financial insights.

## Table of contents

- Overview
- Features
- Tech stack
- Project structure
- Prerequisites
- Quick start
- Environment variables
- Database and Supabase setup
- Available scripts
- End-to-end verification
- Deployment
- Contributing
- Release process
- Bug reporting function (Supabase Edge Function)
- Troubleshooting

## Overview

Kosha is designed as a mobile-first finance app with:

- fast client navigation (React + Vite)
- offline-friendly PWA behavior
- Supabase-backed authentication and storage
- server-truth data model with cache reconciliation for responsive UI updates

## Features

- Transaction tracking: add, edit, delete, filter, and search
- Bills and dues: pending and paid states, recurring support, mark as paid
- Dashboard cards and recent activity
- Monthly and yearly analytics
- Invite and join flow
- In-app bug reporting flow
- Installable PWA for Android and iOS

## Tech stack

- Frontend: React 18, React Router 6, Framer Motion
- Data layer: @tanstack/react-query v5
- Backend: Supabase (Postgres, Auth, Realtime, Edge Functions)
- Styling: Tailwind CSS
- Build tooling: Vite 5, vite-plugin-pwa
- Charts: Recharts

## Project structure

```text
.
├── src/
│   ├── components/
│   ├── context/
│   ├── hooks/
│   ├── lib/
│   └── pages/
├── scripts/
│   ├── load_env.mjs
│   ├── test_join_flow.mjs
│   ├── test_liabilities_realtime.mjs
│   └── test_mutation_stress.mjs
├── supabase/
│   ├── schema.sql
│   └── functions/
│       └── bug-report-notify/
├── index.html
├── package.json
└── vite.config.js
```

## Prerequisites

- Node.js 22+ recommended
- npm 9+
- A Supabase project with access to SQL Editor
- Test users in Supabase Auth for runtime tests

## Quick start

### 1) Clone the repository

```bash
git clone <your-repository-url>
cd kosha
```

### 2) Install dependencies

```bash
npm install
```

### 3) Configure environment variables

Create a local env file:

```bash
cp .env.local.example .env.local
```

If `.env.local.example` does not exist in your clone, create `.env.local` manually and use the template in the Environment variables section below.

### 4) Apply database schema

Open Supabase SQL Editor and run:

- `supabase/schema.sql`

### 5) Run the app

```bash
npm run dev
```

Default local URL:

- `http://localhost:5173`

## Environment variables

Add these values in `.env.local`.

### Required for app runtime

```env
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<supabase-anon-key>
```

### Required for runtime verification scripts

```env
APP_BASE_URL=http://localhost:5173

E2E_CREATOR_EMAIL=<email>
E2E_CREATOR_PASSWORD=<password>

E2E_JOINER_EMAIL=<email>
E2E_JOINER_PASSWORD=<password>

E2E_SESSION_EMAIL=<email>
E2E_SESSION_PASSWORD=<password>
```

Notes:

- `scripts/load_env.mjs` auto-loads `.env` and `.env.local`.
- Keep these values private. Do not commit `.env.local`.

## Database and Supabase setup

1. Create a Supabase project.
2. Run `supabase/schema.sql` in SQL Editor.
3. Confirm required tables and policies are present.
4. Create the E2E users in Supabase Auth used by your local tests.

## Available scripts

From project root:

```bash
npm run dev
npm run build
npm run preview
npm run test:deploy-readiness
npm run test:join-flow
npm run test:liabilities-realtime
npm run test:mutation-stress
```

What each test does:

- `test:join-flow`: validates invite token creation and consumption across accounts
- `test:liabilities-realtime`: validates realtime INSERT delivery across sessions
- `test:mutation-stress`: validates rapid transaction and liability mutation consistency and cleanup
- `test:deploy-readiness`: validates env configuration, required tables/columns, and critical Supabase RPC availability

## End-to-end verification

Run the full verification sequence:

```bash
npm run build
npm run test:deploy-readiness
npm run test:join-flow
npm run test:liabilities-realtime
npm run test:mutation-stress
```

Expected outcome:

- Build succeeds
- All test scripts print `PASS` and exit with code 0

## Deployment

### Vercel

This project is configured for SPA routing via `vercel.json` rewrite:

- all routes rewrite to `index.html`

Deployment checklist:

1. Import project in Vercel.
2. Set production environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Deploy.

## Contributing

1. Create a feature branch from your main integration branch.

```bash
git checkout -b feat/your-change-name
```

2. Implement your change with focused commits.
3. Run quality checks locally:

```bash
npm run build
npm run test:deploy-readiness
npm run test:join-flow
npm run test:liabilities-realtime
npm run test:mutation-stress
```

4. Update documentation when behavior, env vars, setup, or scripts change.
5. Open a pull request with:
   - clear problem statement
   - implementation summary
   - test evidence (commands + outcome)
   - completed checklist from `.github/pull_request_template.md`

Recommended commit style:

- `feat: ...`
- `fix: ...`
- `refactor: ...`
- `docs: ...`
- `test: ...`

## CI policy and branch protection

CI workflow:

- `build`: always runs and must pass
- `deploy-readiness`: runs when readiness secrets exist and validates schema/RPC/env viability
- `runtime-verification`: runs after build and deploy-readiness when full E2E secrets exist

Recommended protected-branch settings (GitHub):

1. Require pull request before merge.
2. Require status checks to pass before merge.
3. Mark these checks as required:
   - `build`
   - `deploy-readiness`
   - `runtime-verification`
4. Require branches to be up to date before merging.
5. Restrict force pushes to protected branches.

Notes:

- If secrets are missing, guarded CI steps are skipped by design.
- For production readiness, configure all required secrets so all three checks execute on every PR.

## Release process

Use this checklist before every release.

1. Pull latest changes and install dependencies.

```bash
git pull
npm install
```

2. Confirm environment variables are present for runtime checks.
3. Run full verification:

```bash
npm run build
npm run test:deploy-readiness
npm run test:join-flow
npm run test:liabilities-realtime
npm run test:mutation-stress
```

4. Update changelog entry in `src/lib/changelog.js`.
5. Tag release commit (if your workflow uses tags).

```bash
git tag -a vX.Y.Z -m "Release vX.Y.Z"
git push origin vX.Y.Z
```

6. Deploy to Vercel and run a quick smoke test:
   - sign in
   - add transaction
   - add bill
   - verify dashboard and list refresh behavior
   - verify bug report submission path (optional but recommended)

Rollback guidance:

- Re-deploy the previous known-good commit from Vercel.
- Keep DB schema backward-compatible where possible to reduce rollback risk.

## Bug reporting function (Supabase Edge Function)

Path:

- `supabase/functions/bug-report-notify`

Required Supabase function secrets:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `BUG_REPORT_WEBHOOK_URL` (Slack or Discord webhook)

Deploy command:

```bash
supabase functions deploy bug-report-notify
```

Behavior:

- If webhook URL is missing, bug submission still succeeds and notification is skipped.

## Troubleshooting

### App cannot connect to Supabase

- Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- Confirm project is active and network allows access.

### Realtime test fails

- Use Node 22+ (or install `ws` package if your runtime does not provide WebSocket).
- Recheck Supabase Realtime configuration and table replication.

### Join flow test fails

- Ensure creator and joiner are different accounts.
- Ensure both users are confirmed and can sign in.

### Mutation stress test fails

- Verify E2E session account has permissions for transactions and liabilities.
- Re-run after cleanup if previous run was interrupted.

## Security notes

- Do not commit secrets to git.
- Use anon key on frontend only.
- Keep service role keys restricted to server-side or Edge Function environments.
