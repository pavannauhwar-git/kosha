# Kosha — Your Financial Sheath

A personal finance PWA built with React, Vite, Tailwind CSS, and Supabase. Tracks income, expenses, investments, and bills in a mobile-first interface.

---

## Tech Stack

| Layer      | Choice                                             |
|------------|----------------------------------------------------|
| Frontend   | React 18, Vite 5, Tailwind CSS 3                   |
| Routing    | React Router v6                                    |
| Animation  | Framer Motion                                      |
| Icons      | Phosphor Icons, Lucide React                       |
| Charts     | Recharts                                           |
| Font       | Plus Jakarta Sans (Google Fonts)                   |
| Backend    | Supabase (Postgres + Auth + Row Level Security)    |
| Hosting    | Vercel                                             |
| PWA        | vite-plugin-pwa (Workbox)                          |

---

## Features

- **Dashboard** — Running balance, savings rate, month pace, top spend category, bill alerts, recent transactions
- **Transactions** — Full feed with search, type/category filters, swipe-to-delete, inline edit
- **Monthly** — Month navigator, hero card, budget breakdown (spent / invested / saved), category bars, investment vehicles
- **Analytics** — Year KPIs, monthly cash flow chart, net savings chart, year-over-year table, top 5 expenses, spending by category, investment portfolio
- **Bills** — Pending and paid tabs, mark-as-paid (auto-creates expense transaction), recurring bill support
- **Auth & Onboarding** — Email/password and Google sign-in, profile-first onboarding flow
- **Invite Links** — Token-based `/join/:token` entry flow with invite consumption on onboarding
- **Data Isolation** — Per-user data access through Supabase RLS policies
- **PWA** — Installable on iOS (Safari) and Android, offline caching via Workbox

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `npm install` fails | Make sure Node.js v18+ is installed: `node --version` |
| Vercel deploy fails | Check that both `VITE_` env vars are set in Vercel → Settings → Environment Variables. |
| PWA not installing on iPhone | Must use Safari. Chrome, Firefox, and Edge on iOS cannot install PWAs due to Apple's restrictions. |
| Schema run fails | Make sure you copied the **entire** `schema.sql` file including all CREATE INDEX lines. |
| Supabase API key error (401) | You used the anon key for the migration script. The migration needs the `service_role` / Secret key. |

---

## Project Structure

```
kosha/
├── src/
│   ├── pages/
│   │   ├── Dashboard.jsx       ← Hero balance, savings rate, recent txns
│   │   ├── Transactions.jsx    ← Full feed, search, filters, swipe-delete
│   │   ├── Monthly.jsx         ← Month navigator, category breakdown
│   │   ├── Analytics.jsx       ← Year KPIs, bar chart, portfolio
│   │   └── Bills.jsx           ← Pending bills, mark as paid
│   ├── components/
│   │   ├── CategoryIcon.jsx    ← Phosphor duotone icons per category
│   │   ├── TransactionItem.jsx ← Swipe-to-delete transaction row
│   │   ├── AddTransactionSheet.jsx  ← Quick Add / Edit bottom sheet
│   │   └── DeleteDialog.jsx    ← Accessible confirm delete dialog
│   ├── hooks/
│   │   ├── useTransactions.js  ← Data fetching + CRUD
│   │   ├── useLiabilities.js   ← Bills data + mark paid logic
│   │   └── useScrollDirection.js ← Scroll-aware bottom nav shrink
│   ├── lib/
│   │   ├── supabase.js         ← Supabase client (reads VITE_ env vars)
│   │   ├── utils.js            ← Formatting, date helpers, colour utils
│   │   └── categories.js       ← 21 categories with icons and colours
│   ├── App.jsx                 ← Router + scroll-aware bottom nav
│   └── index.css               ← Kosha design system + Tailwind base
├── supabase/
│   └── schema.sql              ← Run once in Supabase SQL Editor
├── scripts/
│   └── migrate.py              ← Excel → Supabase one-time import
├── public/
│   └── icons/                  ← PWA icons (192, 180, 512)
├── .env.example                ← Template — copy to .env and fill in
├── .gitignore                  ← Excludes .env, node_modules, dist
├── tailwind.config.js          ← Kosha design tokens (Wise green palette)
├── vite.config.js              ← Build config + PWA manifest
└── README.md                   ← This file
```

---

## Setup Checklist

Work through these in order:

- [ ] Node.js v18+ installed (`node --version`)
- [ ] `npm install` completed
- [ ] Supabase project created
- [ ] `supabase/schema.sql` run in SQL Editor
- [ ] At least one auth user can sign in (email/password or Google)
- [ ] `.env` created with all 4 keys
- [ ] `npm run dev` — app loads at localhost:5173
- [ ] Excel files placed in `scripts/` folder
- [ ] `python migrate.py --dry-run` — transactions detected
- [ ] `python migrate.py` — data imported to Supabase
- [ ] Dashboard shows your balance and transactions
- [ ] GitHub repository created, code pushed
- [ ] Vercel project created with `VITE_` env vars
- [ ] Live URL working (kosha-xxx.vercel.app)
- [ ] App installed on phone from live URL

---

## Phase 2 — Complete

Phase 2 is complete and includes:

- **Multi-user Auth** — Email/password sign-in/sign-up and Google OAuth via Supabase Auth
- **Row Level Security** — `profiles`, `transactions`, `liabilities`, and `invites` are protected with per-user RLS policies
- **Shareable invite flow** — `/join/:token` route is active and invite tokens are consumed during onboarding
- **Profile bootstrap** — `handle_new_user` trigger function creates a profile row when a new auth user is created

### Current Scope

- Users can sign in, complete onboarding, and work with isolated personal data.
- Invite tokens can be validated and consumed in onboarding.
- Household/shared multi-account view is **not** part of Phase 2 and remains future roadmap scope.

---

## Database Model (Phase 2)

Public tables in active use:

- `profiles` — user profile metadata (`display_name`, `monthly_income`, `onboarded`, `avatar_url`)
- `transactions` — user-scoped financial entries (`user_id` FK)
- `liabilities` — user-scoped bills/dues (`user_id` FK, optional `linked_transaction_id`)
- `invites` — onboarding token flow (`token`, `created_by`, `used_by`, `used_at`)

Security model:

- RLS enabled on all four public tables.
- CRUD policies enforce `auth.uid()` ownership checks for profile, transactions, and liabilities.
- Invite policies allow authenticated validation, creator-owned insert, and controlled consume update.

Bootstrap behavior:

- `public.handle_new_user` inserts a `profiles` row for each new `auth.users` record.

---

## Design System — Wise Green Palette

As of this version the colour palette follows Wise's green-dominant visual language:

| Token | Value | Usage |
|-------|-------|-------|
| `brand` | `#163300` | Buttons, active states, FAB |
| `brand-container` | `#C8F5A0` | Active nav pill, tonal button bg |
| `income` / `income-text` | `#38A169` / `#276749` | Income amounts, positive indicators |
| `invest` / `invest-text` | `#2B8A68` / `#1A5C45` | Investment amounts and bars |
| `kosha-bg` | `#FFFFFF` | Page background |
| `kosha-surface-2` | `#F2F8EC` | Input fields, inset surfaces |
| `kosha-border` | `#D6ECC4` | Card borders, dividers |
| Font | Plus Jakarta Sans | Closest open-source match to Wise Sans |

---

*Kosha — Track What Matters.*
