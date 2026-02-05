---
title: "feat: Add settings table for rent/Kam's pay and improve week labels"
type: feat
date: 2026-02-05
---

# Add Settings Table for Rent & Improve Week Labels

## Overview

Two changes:
1. **Kam's nightly pay ($330) becomes "Rent"** — stored in a single-row `app_config` DB table with a typed `nightly_rent` column, editable via a Settings page. When a game night is created, a `rent` expense is automatically inserted (within a transaction) using the current setting value. This makes the cost visible as a real line item.
2. **Week labels use date ranges** — Replace ambiguous `W5`, `W6` labels with `Jan 27 – Feb 2` style ranges on the chart and dashboard. Angled labels on narrow screens.

## Problem Statement

- **Kam's pay is invisible.** It's hardcoded as `KAM_NIGHTLY_PAY = 330` in constants and silently deducted in the net profit calculation. There's no UI showing this deduction, and the value can't be changed without editing code.
- **Week labels are meaningless.** `W5` means ISO week 5 — most people can't map that to a date range. The "This Week" dashboard card gives no date context. If the app runs across years, week numbers would be ambiguous.

## Proposed Solution

### Part 1: Single-Row Config Table + Auto Rent Expense

**New table: `app_config`** (single-row, typed columns)

```typescript
export const appConfig = pgTable("app_config", {
  id: serial("id").primaryKey(),          // Always 1
  nightlyRent: numeric("nightly_rent", { precision: 10, scale: 2 })
    .notNull()
    .default("330"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
```

Why single-row instead of key-value: type safety, no string parsing, Drizzle type inference, future settings added as typed columns.

**New expense category: `rent`**

Add `rent` to the expense category enum. When `createGameNight()` runs, automatically insert a rent expense **within the same database transaction**:

```typescript
await db.transaction(async (tx) => {
  const [gameNight] = await tx.insert(gameNights).values({...}).returning();
  const config = await tx.select().from(appConfig).where(eq(appConfig.id, 1));
  await tx.insert(expenses).values({
    gameNightId: gameNight.id,
    category: "rent",
    description: "Nightly rent (Kam)",
    amount: config[0].nightlyRent,
  });
});
```

This ensures atomicity — if the rent expense insert fails, the game night is also rolled back.

**New page: `/settings`**

Simple page showing nightly rent with inline edit via dialog modal (consistent with other forms). Single file with inline server action is sufficient for one setting.

**Remove `KAM_NIGHTLY_PAY` from constants and queries.**

Net profit changes from `rake - expenseTotal - KAM_NIGHTLY_PAY` to `rake - expenseTotal` (rent now included in expenseTotal).

**Update `game-nights/page.tsx`** — remove the "Kam pay: $330/night" display (line 49) since rent is now a visible expense.

### Part 2: Date Range Week Labels

Replace `W${week}` with `Mon DD – Mon DD` format (e.g., `Jan 27 – Feb 2`).

In `getWeeklyPnL()`, compute the ISO week's Monday–Sunday date range and use that as the label. The dashboard "This Week" card gets a subtitle showing the current week's date range.

**Responsive strategy:** Use Recharts `angle={-45}` on XAxis tick props when labels are long. This handles narrow screens natively.

## Acceptance Criteria

### Config Table & Rent Expense
- [x] New `app_config` single-row table with typed `nightly_rent` column — `src/lib/db/schema.ts`
- [x] Seed initial row with `nightly_rent = "330"` (via script or on first access with upsert)
- [x] New query `getAppConfig()` with fallback: if no row exists, insert default and return it — `src/lib/db/queries.ts`
- [x] New query `updateAppConfig(updates)` — `src/lib/db/queries.ts`
- [x] Add `rent` to expense category enum — `src/lib/validations.ts`
- [x] Add `"Rent"` to `CATEGORY_LABELS` map — `src/components/game-nights/game-night-detail.tsx`
- [x] `createGameNight` action wraps game night + rent expense insert in `db.transaction()` — `src/app/(protected)/game-nights/actions.ts`
- [x] If `getAppConfig()` fails during game night creation, fail with clear error message
- [x] Remove `KAM_NIGHTLY_PAY` from `src/lib/constants.ts`
- [x] Remove `KAM_NIGHTLY_PAY` import and deduction from `getGameNights()` net profit calc — `src/lib/db/queries.ts`
- [x] Remove "Kam pay" display from `src/app/(protected)/game-nights/page.tsx`
- [x] New Settings page at `/settings` with edit capability — `src/app/(protected)/settings/page.tsx`
- [x] Settings validation: `nightly_rent` must be numeric >= 0 — `src/lib/validations.ts`
- [x] Add Settings link to nav/sidebar
- [x] Idempotent backfill: insert rent expenses for existing game nights using `WHERE NOT EXISTS` guard
- [x] Backfill uses historical amount `330`, with description "Nightly rent (Kam) - backfilled"
- [x] Verify backfill: after running, every game night must have exactly one rent expense

### Date Range Week Labels
- [ ] New helper `getISOWeekRange(dateStr)` returns `{ start: string, end: string }` — `src/lib/db/queries.ts`
- [ ] New formatter `formatWeekLabel(start, end)` returns e.g., `"Jan 27 – Feb 2"` — `src/lib/db/queries.ts`
- [ ] Week range helpers use `T12:00:00` pattern for timezone safety (matching existing `getISOWeek`)
- [ ] `getWeeklyPnL()` uses date range labels instead of `W${week}` — `src/lib/db/queries.ts`
- [ ] Dashboard "This Week" card shows date range subtitle — `src/app/(protected)/dashboard/page.tsx`
- [ ] Chart x-axis labels angle at -45 degrees for readability — `src/components/dashboard/pnl-chart.tsx`

## Files to Modify

| File | Change |
|------|--------|
| `src/lib/db/schema.ts` | Add `appConfig` table (single-row, typed), export types |
| `src/lib/db/queries.ts` | Add `getAppConfig`, `updateAppConfig`, remove `KAM_NIGHTLY_PAY` from net profit, update `getWeeklyPnL` labels, add week range helpers |
| `src/lib/constants.ts` | Remove `KAM_NIGHTLY_PAY` (keep `RAKE_PER_POT`, `MONTHLY_TOURNAMENT`) |
| `src/lib/validations.ts` | Add `rent` to expense category enum, add `appConfigSchema` |
| `src/app/(protected)/game-nights/actions.ts` | Wrap `createGameNight` in `db.transaction()`, auto-insert rent expense |
| `src/app/(protected)/game-nights/page.tsx` | Remove "Kam pay" display line |
| `src/components/game-nights/game-night-detail.tsx` | Add `rent` to `CATEGORY_LABELS` |
| `src/app/(protected)/settings/page.tsx` | **New** — Settings page with inline server action and edit form |
| `src/app/(protected)/dashboard/page.tsx` | Show date range on "This Week" card |
| `src/components/dashboard/pnl-chart.tsx` | Angle x-axis labels -45 degrees |
| Nav component (layout or sidebar) | Add Settings link |

## Edge Cases

- **Existing game nights have no rent expense.** Idempotent backfill script inserts rent expenses using `WHERE NOT EXISTS (SELECT 1 FROM expenses WHERE game_night_id = gn.id AND category = 'rent')`. Safe to run multiple times.
- **Changing the rent amount.** Only affects future game nights. Past expenses keep their recorded amount (historical accuracy).
- **Deleting a rent expense.** Allowed — same as any other expense. User has full control. Net profit for that night will increase by the rent amount.
- **Config row missing.** `getAppConfig()` auto-inserts the default row (nightly_rent=330) if not found, so the app never crashes from missing config.
- **Week spanning year boundary.** Label shows e.g., `Dec 30 – Jan 5`. Handled naturally by ISO week math.
- **Zero rent.** Allowed — a $0 rent expense will be inserted. Valid for comp nights.
- **Game night creation with DB error.** Transaction ensures both game night and rent expense succeed or both roll back. No orphaned records.

## Implementation Order

1. **Schema**: add `app_config` table + `rent` expense category
2. **Seed**: insert default config row (nightly_rent=330)
3. **Queries**: `getAppConfig`, `updateAppConfig`, week range helpers
4. **Backfill**: idempotent script to insert rent expenses for existing game nights
5. **Verify backfill**: confirm every game night has exactly one rent expense
6. **Actions**: update `createGameNight` with transaction + auto rent insert
7. **Queries**: remove `KAM_NIGHTLY_PAY` from net profit calc (safe after backfill)
8. **Constants**: remove `KAM_NIGHTLY_PAY`
9. **Game nights page**: remove "Kam pay" display
10. **Settings page**: UI to view/edit nightly rent
11. **Week labels**: update `getWeeklyPnL` and dashboard
12. **Nav**: add Settings link
