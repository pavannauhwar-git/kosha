# Kosha

[![Version 1.0.0](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://semver.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)]()

## ⚡ The Pitch

Kosha is a lightning-fast, offline-capable Progressive Web App (PWA) designed to be your ultimate financial sheath. It provides an intuitive, seamless personal finance tracking experience that helps you manage transactions, monitor bills, and visualize your financial health anywhere, anytime.

## 🌟 Core Features

- **Transactions:** Full feed with search, granular type/category filters, swipe-to-delete, and inline editing.
- **Bill Reminders:** Keep track of pending, recurring, and paid bills, including a quick "mark-as-paid" action that auto-creates expense transactions.
- **Interactive Analytics:** Deep dive into your finances with Year KPIs, monthly cash flow charts, net savings charts, top 5 expenses, and your investment portfolio.
- **PWA Support:** Fully installable to iOS & Android home screens with Workbox-powered offline caching for unmatched speed.

## 🛠 Tech Stack

| Layer | Technology |
| --- | --- |
| **Frontend Framework** | React 18 |
| **Build Tool & PWA**| Vite 5 & `vite-plugin-pwa` |
| **Styling** | Tailwind CSS 3 & Framer Motion |
| **Data Fetching** | React Query (`@tanstack/react-query`) |
| **Backend & Auth** | Supabase (Postgres, Auth, RLS) |
| **Visualization** | Recharts |
| **Icons & UI** | Phosphor Icons, Lucide React, Radix UI |

## 📸 Screenshots

| Mobile Dashboard | Analytics Overview |
| :---: | :---: |
| ![Dashboard View](docs/dashboard.png) | ![Analytics View](docs/analytics.png) |

## 🚀 Local Development Setup

Follow these exact steps to get Kosha running locally on your machine.

**1. Clone the repository**
```bash
git clone https://github.com/your-username/kosha.git
cd kosha
```

**2. Install dependencies**
```bash
npm install
```

**3. Configure environment variables**
Copy the example environment file:
```bash
cp .env.example .env.local
```
Open `.env.local` and add your Supabase credentials:
```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...your-anon-key-here
```

**4. Run the development server**
```bash
npm run dev
```

> 💡 **Tip:** The application will instantly compile and load at `http://localhost:5173`.
