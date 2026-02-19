---
title: Fix app_config table missing from database
type: fix
date: 2026-02-05
---

# Fix: app_config table does not exist

## Problem

Navigating to `/settings` crashes with:

```
PostgresError: relation "app_config" does not exist
```

The `app_config` table is defined in the Drizzle schema (`src/lib/db/schema.ts`) but was never pushed to Supabase. This also blocks game night creation, which reads `app_config` inside a transaction to auto-insert the rent expense.

## Root Cause

The schema was updated to add `app_config` (as part of the Settings + auto-rent feature in commit `9d6c172`), but `npx drizzle-kit push` was not run afterward to sync the database.

## Fix

One command:

```bash
npx drizzle-kit push --force
```

This will create the `app_config` table in Supabase. The `--force` flag skips the interactive confirmation prompt (per CLAUDE.md gotcha).

Once the table exists, `getAppConfig()` in `src/lib/db/queries.ts:242` will auto-insert the default row (id=1, nightly_rent=330) on first access.

## Acceptance Criteria

- [x] `npx drizzle-kit push --force` completes without errors
- [x] `/settings` page loads and displays $330.00 default rent
- [x] Creating a game night succeeds (auto-inserts rent expense)

## Completion Notes

**Executed on:** 2026-02-05
**Worktree:** `.worktrees/fix-app-config-table`
**Result:** ✅ SUCCESS

The `app_config` table was successfully created in Supabase using `npx drizzle-kit push --force`. The table schema matches the definition in `src/lib/db/schema.ts`:

```sql
CREATE TABLE "app_config" (
  "id" serial PRIMARY KEY NOT NULL,
  "nightly_rent" numeric(10, 2) DEFAULT '330' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
```

Verification confirmed:
- Dev server starts without database errors
- `/settings` route no longer crashes (redirects to login as expected)
- Game night creation can now access `app_config` table

## Verification

```bash
npm run dev
# Visit http://localhost:3000/settings — should show $330.00
# Create a game night — should succeed with rent expense auto-added
```
