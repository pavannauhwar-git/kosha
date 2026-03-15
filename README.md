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

## Phase 2 — In Progress

Phase 2 is currently **not complete**. The features below are planned but not yet implemented. Do not expect them in the current build.

### Planned for Phase 2

- **Multi-user Auth** — Email/password sign-up and Google OAuth via Supabase Auth
- **Row Level Security** — Each user sees only their own data; RLS policies on all tables
- **Shareable invite link** — Generate a `/join/:token` URL so others can create an account and be onboarded
- **Household / shared view** — Opt-in ability for two accounts to see combined data

### Current Auth Status

The app currently supports a **single-user** flow only. Supabase Auth is wired up (login, session management, `AuthGuard`), but:
- There is no self-serve sign-up page; accounts are created manually in the Supabase dashboard
- Row Level Security policies exist in `schema.sql` but assume a single user
- The `/join/:token` route is stubbed in the router but not functional

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
