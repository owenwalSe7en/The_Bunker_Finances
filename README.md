# The Bunker Black Book

Private finance tracker for a small-scale, legal home poker game. Built to replace an Excel spreadsheet with a real app — on a $0/month budget.

## The Stack (All Free Tier)

| Service | Role | Cost |
|---------|------|------|
| [Next.js 15](https://nextjs.org) | App framework (App Router + Turbopack) | Free |
| [Supabase](https://supabase.com) | Postgres database + Google OAuth | Free tier |
| [Vercel](https://vercel.com) | Hosting & deployment | Free tier |
| [Drizzle ORM](https://orm.drizzle.team) | Type-safe database queries | Free |
| [shadcn/ui](https://ui.shadcn.com) + Tailwind CSS | UI components | Free |
| [Recharts](https://recharts.org) | Weekly P&L charts | Free |

Total monthly cost: **$0**.

## What It Tracks

- **Game Nights** — date, table count, rake collected, expenses (food, supplies, rent), and net profit per session
- **Weekly P&L** — dashboard with date-range charts (cumulative or weekly view), all-time stats, biggest wins/losses
- **The Books** — ledger for outstanding game debts and free play credits, with paid/unpaid toggle
- **Payroll** — dealer and staff pay tracking
- **Settings** — configurable nightly rent (auto-inserted as an expense each game night)

## Access Control

Single-operator app. An email allowlist in middleware gates all access via Google OAuth — no per-row security needed.

## Setup

1. Clone the repo
2. Copy `.env.local.example` to `.env.local` and fill in your Supabase credentials
3. `npm install`
4. `npx drizzle-kit push` to create tables
5. `npm run dev`

## Commands

```bash
npm run dev          # Start dev server
npx next build       # Production build
npx drizzle-kit push # Push schema to Supabase
```
