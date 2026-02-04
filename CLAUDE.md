# CLAUDE.md

Project context and conventions for AI-assisted development.

## Project

The Bunker Black Book — private poker finance tracker replacing an Excel spreadsheet. Single operator, handful of users, one poker table.

## Tech Stack

- Next.js 15 (App Router) + TypeScript
- Supabase Postgres + Auth (Google OAuth)
- Drizzle ORM with `postgres` driver
- Tailwind CSS + shadcn/ui
- Zod for validation
- Recharts for charts

## Commands

```bash
npm run dev          # Start dev server (Turbopack)
npx next build       # Production build
npx drizzle-kit push # Push schema changes to Supabase
```

## Architecture

- **No RLS, no user_id on data tables.** Shared data model. Middleware email allowlist is the sole auth gate.
- **Serial integer PKs**, not UUIDs.
- **Server Actions** for all mutations. Plain `<form>` elements with `useActionState`. No react-hook-form.
- **Server-rendered tables** using shadcn/ui Table components. No TanStack Table.
- **Computed fields** (day_of_week, week_number, net_profit) derived in queries, never stored.
- **4 tables**: game_nights, expenses, ledger_entries, payroll_entries.
- **Constants** in `src/lib/constants.ts`, not a database table.
- **All queries** in `src/lib/db/queries.ts`, all validations in `src/lib/validations.ts`.

## Conventions

- Forms use dialog modals (shadcn Dialog) for create/edit.
- Delete actions use `confirm()` before executing.
- Toggle actions (paid/unpaid) are single-click badge buttons.
- Toast notifications via sonner for success/error feedback.
- Currency formatting via `Intl.NumberFormat` throughout.

## Known Mistakes and Gotchas

### Zod v4 breaking change: `required_error` → `message`
The `z.enum()` second argument no longer accepts `{ required_error: "..." }`. Use `{ message: "..." }` instead. This caused a build failure.

### shadcn toast is deprecated — use sonner
`npx shadcn@latest add toast` warns that the toast component is deprecated. Use `npx shadcn@latest add sonner` instead. Import `Toaster` from `@/components/ui/sonner` and `toast` from `sonner`.

### Radix Select does not submit values in FormData
The shadcn/ui `<Select>` (Radix primitive) does not include a hidden `<input>` with the `name` attribute. You must manage the value via `useState` + `onValueChange` and include a separate `<input type="hidden" name="..." value={...} />` in the form for it to appear in FormData.

### Supabase connection pooler may not work on free tier
The pooler URL (`aws-*.pooler.supabase.com:6543`) returned `DbHandler exited` errors. The direct connection (`db.<ref>.supabase.co:5432`) works. Both `DATABASE_URL` and `DIRECT_DATABASE_URL` should use the direct host for free-tier projects.

### Supabase connection string password format
The password in Supabase connection strings must NOT have brackets `[` `]` around it even though the Supabase dashboard displays it as `[YOUR-PASSWORD]`. Those are placeholder indicators, not part of the URL.

### `DIRECT_DATABASE_URL` username differs from pooler username
- Pooler URL username: `postgres.<project-ref>` (e.g. `postgres.qlhpeacejjfzttxsflng`)
- Direct URL username: `postgres` (no project ref suffix)
Getting this wrong causes auth failures.

### `create-next-app` rejects capital letters in project names
npm naming restrictions prevent uppercase project directory names. Work around by creating in a temp directory then copying files.

### `.env.local` formatting — comments must be on their own line
A comment and env var on the same line (e.g. `# comment KEY=value`) causes the var to not be parsed. Each env var must start on its own line.

### Drizzle `count` import unused
Importing `count` from `drizzle-orm` without using it causes an ESLint warning that fails the production build. Only import what you use.

### `drizzle-kit push` requires interactive confirmation
`drizzle-kit push` prompts for yes/no confirmation which doesn't work in non-interactive shells. Use `--force` flag to skip the prompt.
