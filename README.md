# Kosha — Your Financial Sheath

> Personal finance PWA — income, expenses, investments. Built with React + Vite + Supabase.

---

## What You're Building

A fully installable PWA (Progressive Web App) that works on your iPhone, Android, and laptop — no App Store needed. 5 screens: Dashboard, Transactions, Monthly, Analytics, Bills & Dues. 3 years of historical data imported from Excel.

---

## Prerequisites

Install these once before starting.

| Tool | How to get it |
|------|---------------|
| **Node.js v18+** | [nodejs.org/en/download](https://nodejs.org/en/download) — choose the LTS version |
| **Python 3.8+** | Usually pre-installed on macOS. [python.org](https://python.org) for Windows |
| **Git** | [git-scm.com](https://git-scm.com) — or `brew install git` on macOS |

Verify Node.js is installed:
```bash
node --version   # should print v18.x.x or higher
```

You also need free accounts at:
- **GitHub** — github.com (stores your code)
- **Supabase** — supabase.com (your database)
- **Vercel** — vercel.com (hosting — sign in with GitHub)

---

## Phase 1 — Local Setup

### Step 1 — Download and unzip

Download `kosha.zip` and unzip it:
```bash
unzip kosha.zip
cd kosha
```

### Step 2 — Install dependencies
```bash
npm install
```

You should see `added NNN packages`. Ignore any audit warnings.

### Step 3 — Create your Supabase project

1. Go to [supabase.com](https://supabase.com) → **New project**
2. Name: `kosha`, choose a database password (save it), pick the region closest to you
3. Wait ~2 minutes for provisioning

### Step 4 — Run the schema

1. In Supabase: **SQL Editor** → **New query**
2. Open `supabase/schema.sql` from the kosha folder
3. Copy the entire file contents → paste into the SQL editor → click **Run**
4. You should see `Success. No rows returned`

### Step 5 — Get your API keys

In Supabase: **Settings (gear icon)** → **API Keys**. You need:

| Key | Where to find it | What it's for |
|-----|-----------------|---------------|
| Project URL | Top of the API Keys page | Both app and migration script |
| `anon` / Publishable key | "Publishable" or "anon" section | React frontend |
| `service_role` / Secret key | "Secret" or "service_role" section | Migration script only |

### Step 6 — Create your .env file

```bash
cp .env.example .env
```

Open `.env` in any text editor and fill in all four values:

```bash
# React frontend (Vite requires the VITE_ prefix)
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-or-publishable-key-here

# Migration script (Python reads these directly — no VITE_ prefix)
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_KEY=your-service-role-secret-key-here
```

> **Why 4 keys?** Vite (the React build tool) only exposes variables prefixed with `VITE_` to the browser. The Python migration script reads `.env` directly and doesn't know about the `VITE_` convention — it looks for the plain names. Both sets point to the same Supabase project.

> **Never commit `.env` to Git.** It is already in `.gitignore`.

### Step 7 — Run the dev server
```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser. You should see the Kosha Dashboard.

---

## Phase 2 — Import Your Excel Data

### Step 1 — Install Python dependencies
```bash
pip install openpyxl
```

If `pip` is not found, try `pip3`.

### Step 2 — Place your Excel files

Copy your budget Excel files into the `scripts/` folder. The script looks for:
```
scripts/Pavan_Budget_2023-24.xlsx
scripts/Pavan_Budget_2024-25.xlsx
scripts/Pavan_Budget_2025-26.xlsx
```

If your files have different names, use the `--files` argument (see below).

### Step 3 — Preview first (dry run)
```bash
cd scripts
python migrate.py --dry-run
```

This parses all files and shows a sample of what will be imported — **without uploading anything**. Check that the transaction count looks right and the descriptions make sense.

### Step 4 — Import to Supabase
```bash
python migrate.py
```

You should see:
```
📂 Parsing: Pavan_Budget_2023-24.xlsx
  Sheet: April 2023 (4/2023) → 8 transactions
  Sheet: May 2023 (5/2023) → 7 transactions
  ...
📊 Total: 312 transactions across 3 files
✅ Migration complete — 312 of 312 transactions uploaded
```

Refresh the app — your data should appear in the Dashboard.

### Custom file names
```bash
python migrate.py --files MyBudget2023.xlsx MyBudget2024.xlsx
```

### What the script does

- Reads every monthly sheet (e.g. "April 2023", "May 2024")
- Uses **the 1st of that month** as the date for all transactions (your Excel has no individual row dates — only a month label)
- Detects income in columns C+D, expenses in E+F, investments in G+H
- Auto-categorises by keyword matching (Zomato → food, Zerodha → investment, etc.)
- Flags repayment income (Ajay EMIs, Panda EMIs) separately from salary — so your true savings rate is accurate
- Skips "Leftover" carry-forward rows and Total/Summary rows

---

## Phase 3 — Deploy to Vercel

### Step 1 — Push to GitHub

1. Create a new **private** repository on GitHub (no README, no .gitignore)
2. Copy the repository URL (e.g. `https://github.com/yourname/kosha.git`)
3. In your terminal inside the kosha folder:

```bash
git init
git add .
git commit -m "Initial commit — Kosha"
git remote add origin https://github.com/yourname/kosha.git
git push -u origin main
```

### Step 2 — Deploy on Vercel

1. Go to [vercel.com](https://vercel.com) → **Add New → Project**
2. Import your `kosha` GitHub repository
3. Vercel auto-detects Vite. Leave all settings as defaults.
4. **Before clicking Deploy** — click **Environment Variables** and add:

| Name | Value |
|------|-------|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Your anon / publishable key |

5. Click **Deploy**

In ~60 seconds you'll have a live URL like `kosha-abc.vercel.app`.

> Every `git push` to `main` auto-deploys the new version. No manual steps.

---

## Phase 4 — Install as PWA on Your Phone

### iPhone (must use Safari)
1. Open your Vercel URL in **Safari** (Chrome on iOS cannot install PWAs)
2. Tap the **Share** button (box with arrow pointing up)
3. Tap **Add to Home Screen** → **Add**

### Android (Chrome)
1. Open your Vercel URL in **Chrome**
2. Tap the **three-dot menu** → **Add to Home screen** → **Install**

### Desktop (Chrome or Edge)
1. Open your Vercel URL
2. Look for the **install icon ⊕** in the address bar (right side)
3. Click it → **Install**

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `0 transactions found` in migration | Make sure your Excel files are in `scripts/`. Run `python migrate.py --dry-run` to see what's being parsed. |
| `SUPABASE_URL and SUPABASE_KEY must be set` | Your `.env` is missing the plain (non-VITE_) keys. Check `.env.example` for the exact key names. |
| Dashboard shows zeros | Check `.env` has `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` set correctly. Open browser DevTools (F12) → Console for error messages. |
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
│   │   ├── Analytics.jsx       ← Year KPIs, bar chart, donut, portfolio
│   │   └── Bills.jsx           ← Pending bills, mark as paid
│   ├── components/
│   │   ├── CategoryIcon.jsx    ← Phosphor duotone icons per category
│   │   ├── TransactionItem.jsx ← Swipe-to-delete transaction row
│   │   ├── AddTransactionSheet.jsx  ← Quick Add / Edit bottom sheet
│   │   └── DeleteDialog.jsx    ← Accessible confirm delete dialog
│   ├── hooks/
│   │   ├── useTransactions.js  ← Data fetching + CRUD
│   │   └── useLiabilities.js   ← Bills data + mark paid logic
│   ├── lib/
│   │   ├── supabase.js         ← Supabase client (reads VITE_ env vars)
│   │   ├── utils.js            ← Formatting, date helpers, colour utils
│   │   └── categories.js       ← 21 categories with icons and colours
│   ├── App.jsx                 ← Router + bottom nav with sliding pill
│   └── index.css               ← Kosha design system + Tailwind base
├── supabase/
│   └── schema.sql              ← Run once in Supabase SQL Editor
├── scripts/
│   └── migrate.py              ← Excel → Supabase one-time import
├── public/
│   └── icons/                  ← PWA icons (replace with your own)
├── .env.example                ← Template — copy to .env and fill in
├── .gitignore                  ← Excludes .env, node_modules, dist
├── tailwind.config.js          ← Kosha violet design tokens
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

## What's Coming in Phase 2

- Multi-user support with Supabase Auth (email/password + Google sign-in)
- Row Level Security — each user sees only their own data
- Shareable link — give friends a URL and they sign up themselves

---

*Kosha — Track What Matters.*
