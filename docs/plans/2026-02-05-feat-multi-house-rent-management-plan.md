---
title: "feat: Multi-house rent management with scalable house configuration"
type: feat
date: 2026-02-05
---

# Multi-House Rent Management with Scalable House Configuration

## Overview

Transform the single-rent system into a scalable multi-house configuration where each game night can be associated with a specific house (Kam's or Shayne's), each having its own nightly rent amount. Rename "Settings" to "Globals" to better reflect the expanded configuration scope.

## Problem Statement

**Current Limitations:**
1. Single `nightlyRent` value in `app_config` table ($330 for Kam)
2. No concept of "which house" for game nights
3. Cannot support multiple locations with different rent amounts
4. Hardcoded "Nightly rent (Kam)" in auto-created expenses
5. Not scalable for adding new houses/locations

**User Report:**
- User mentioned unable to delete entries (minimum 4 restriction) — **Investigation found NO such restriction exists**. System already allows zero entries on all tabs.
- User wants to add Shayne's house with $200/night rent
- User wants dropdown to select house when creating game nights
- User wants system to be scalable for future houses

## Proposed Solution

### High-Level Architecture

**New `houses` table** with:
- id, name, ownerName, nightlyRent, active status
- Seed with Kam ($330) and Shayne ($200)

**Modified `game_nights` table** with:
- New `houseId` foreign key to houses
- Required field (NOT NULL)
- RESTRICT on delete (prevent deletion of houses with associated game nights)

**Updated auto-rent logic**:
- Use selected house's `nightlyRent` value
- Include house owner in expense description

**Renamed Settings → Globals**:
- Update navigation label
- Add house management UI
- Keep existing rent configuration alongside houses

## Technical Approach

### Database Schema Changes

#### New `houses` Table

```typescript
// src/lib/db/schema.ts
export const houses = pgTable("houses", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  ownerName: text("owner_name").notNull(),
  nightlyRent: numeric("nightly_rent", { precision: 10, scale: 2 }).notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type House = typeof houses.$inferSelect;
export type NewHouse = typeof houses.$inferInsert;
```

**Design Decisions:**
- `name`: Display name for the house (e.g., "Main Location", "Backup Spot")
- `ownerName`: Person's name for rent description (e.g., "Kam", "Shayne")
- `active`: Soft delete flag — inactive houses hidden from dropdown but preserved in history
- No unique constraints — allows flexibility for multiple houses per owner

#### Modified `game_nights` Table

```typescript
// src/lib/db/schema.ts
export const gameNights = pgTable("game_nights", {
  id: serial("id").primaryKey(),
  date: date("date").notNull().unique(),
  rakeCollected: numeric("rake_collected", { precision: 10, scale: 2 })
    .notNull()
    .default("0"),
  houseId: integer("house_id")
    .notNull()
    .references(() => houses.id, { onDelete: "restrict" }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
```

**Constraint Rationale:**
- `NOT NULL`: Every game night must have an associated house
- `onDelete: "restrict"`: Prevents accidental deletion of houses with game nights
- Forces operator to reassign or delete game nights before removing a house

### Migration Strategy

#### Migration Script: `scripts/migrate-add-houses.ts`

```typescript
import { db } from "@/lib/db";
import { houses, gameNights } from "@/lib/db/schema";
import { sql } from "drizzle-orm";

export async function up() {
  // 1. Create houses table
  await db.execute(sql`
    CREATE TABLE "houses" (
      "id" SERIAL PRIMARY KEY,
      "name" TEXT NOT NULL,
      "owner_name" TEXT NOT NULL,
      "nightly_rent" NUMERIC(10, 2) NOT NULL,
      "active" BOOLEAN NOT NULL DEFAULT true,
      "created_at" TIMESTAMP DEFAULT NOW() NOT NULL,
      "updated_at" TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `);

  // 2. Seed initial houses
  const [kamHouse] = await db.insert(houses).values({
    name: "Kam's House",
    ownerName: "Kam",
    nightlyRent: "330",
  }).returning();

  await db.insert(houses).values({
    name: "Shayne's House",
    ownerName: "Shayne",
    nightlyRent: "200",
  }).returning();

  // 3. Add houseId column to game_nights (nullable first for backfill)
  await db.execute(sql`
    ALTER TABLE "game_nights"
    ADD COLUMN "house_id" INTEGER
  `);

  // 4. Backfill existing game nights with Kam's house (historical default)
  await db.execute(sql`
    UPDATE "game_nights"
    SET "house_id" = ${kamHouse.id}
    WHERE "house_id" IS NULL
  `);

  // 5. Make houseId NOT NULL and add foreign key
  await db.execute(sql`
    ALTER TABLE "game_nights"
    ALTER COLUMN "house_id" SET NOT NULL
  `);

  await db.execute(sql`
    ALTER TABLE "game_nights"
    ADD CONSTRAINT "game_nights_house_id_fkey"
    FOREIGN KEY ("house_id")
    REFERENCES "houses"("id")
    ON DELETE RESTRICT
  `);

  // 6. Add index for query performance
  await db.execute(sql`
    CREATE INDEX "game_nights_house_id_idx"
    ON "game_nights"("house_id")
  `);
}

export async function down() {
  // Rollback in reverse order
  await db.execute(sql`DROP INDEX IF EXISTS "game_nights_house_id_idx"`);
  await db.execute(sql`ALTER TABLE "game_nights" DROP CONSTRAINT IF EXISTS "game_nights_house_id_fkey"`);
  await db.execute(sql`ALTER TABLE "game_nights" DROP COLUMN IF EXISTS "house_id"`);
  await db.execute(sql`DROP TABLE IF EXISTS "houses"`);
}
```

**Backfill Rationale:**
- Default all existing game nights to Kam's house (ID 1)
- Current `app_config.nightlyRent` is $330, matching Kam's rate
- All historical auto-rent expenses are $330
- Preserves data consistency and historical accuracy

### Query Layer Updates

#### New House Queries (`src/lib/db/queries.ts`)

```typescript
import { houses } from "./schema";
import { eq, desc } from "drizzle-orm";

export async function getHouses() {
  return db.select().from(houses).orderBy(houses.ownerName);
}

export async function getActiveHouses() {
  return db
    .select()
    .from(houses)
    .where(eq(houses.active, true))
    .orderBy(houses.ownerName);
}

export async function getHouseById(id: number) {
  const [house] = await db.select().from(houses).where(eq(houses.id, id));
  return house;
}

export async function createHouse(data: NewHouse) {
  const [house] = await db.insert(houses).values(data).returning();
  return house;
}

export async function updateHouse(id: number, data: Partial<NewHouse>) {
  const [house] = await db
    .update(houses)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(houses.id, id))
    .returning();
  return house;
}

export async function deactivateHouse(id: number) {
  const [house] = await db
    .update(houses)
    .set({ active: false, updatedAt: new Date() })
    .where(eq(houses.id, id))
    .returning();
  return house;
}
```

#### Updated Game Night Queries

```typescript
// Modify getGameNights to include house info
export async function getGameNights() {
  const nights = await db
    .select({
      id: gameNights.id,
      date: gameNights.date,
      rakeCollected: gameNights.rakeCollected,
      notes: gameNights.notes,
      houseId: gameNights.houseId,
      houseName: houses.name,
      houseOwner: houses.ownerName,
      createdAt: gameNights.createdAt,
    })
    .from(gameNights)
    .leftJoin(houses, eq(gameNights.houseId, houses.id))
    .orderBy(desc(gameNights.date));

  // Rest of expense calculation logic...
}
```

### Validation Schema Updates

#### House Validation (`src/lib/validations.ts`)

```typescript
export const houseSchema = z.object({
  name: z.string().min(1, "House name is required"),
  ownerName: z.string().min(1, "Owner name is required"),
  nightlyRent: z.coerce
    .number()
    .positive("Rent must be greater than 0")
    .multipleOf(0.01, "Rent must be a valid dollar amount"),
});

export type HouseFormData = z.infer<typeof houseSchema>;
```

#### Game Night Validation Update

```typescript
export const gameNightSchema = z.object({
  date: z.string().min(1, "Date is required"),
  rakeCollected: z.coerce.number().min(0, "Rake must be 0 or more").default(0),
  houseId: z.coerce.number().int().positive("House selection is required"),
  notes: z.string().optional(),
});
```

### Server Actions

#### House Actions (`src/app/(protected)/globals/actions.ts`)

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { createHouse, updateHouse, deactivateHouse } from "@/lib/db/queries";
import { houseSchema } from "@/lib/validations";

export async function createHouseAction(formData: FormData) {
  const data = {
    name: formData.get("name") as string,
    ownerName: formData.get("ownerName") as string,
    nightlyRent: formData.get("nightlyRent") as string,
  };

  const result = houseSchema.safeParse(data);
  if (!result.success) {
    return { error: result.error.errors[0].message };
  }

  try {
    await createHouse(result.data);
    revalidatePath("/globals");
    revalidatePath("/game-nights");
    return { success: true };
  } catch (error) {
    return { error: "Failed to create house" };
  }
}

export async function updateHouseAction(id: number, formData: FormData) {
  const data = {
    name: formData.get("name") as string,
    ownerName: formData.get("ownerName") as string,
    nightlyRent: formData.get("nightlyRent") as string,
  };

  const result = houseSchema.safeParse(data);
  if (!result.success) {
    return { error: result.error.errors[0].message };
  }

  try {
    await updateHouse(id, result.data);
    revalidatePath("/globals");
    revalidatePath("/game-nights");
    return { success: true };
  } catch (error) {
    return { error: "Failed to update house" };
  }
}

export async function deactivateHouseAction(id: number) {
  try {
    await deactivateHouse(id);
    revalidatePath("/globals");
    revalidatePath("/game-nights");
    return { success: true };
  } catch (error) {
    // Handle foreign key constraint violation
    if (error.code === "23503") {
      return { error: "Cannot deactivate house with existing game nights" };
    }
    return { error: "Failed to deactivate house" };
  }
}
```

#### Updated Game Night Action

```typescript
// src/app/(protected)/game-nights/actions.ts
export async function createGameNight(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const data = {
    date: formData.get("date") as string,
    rakeCollected: formData.get("rakeCollected") as string,
    houseId: formData.get("houseId") as string,
    notes: formData.get("notes") as string,
  };

  const result = gameNightSchema.safeParse(data);
  if (!result.success) {
    return { error: result.error.errors[0].message };
  }

  try {
    await db.transaction(async (tx) => {
      // Create game night
      const [gameNight] = await tx
        .insert(gameNights)
        .values({
          date: result.data.date,
          rakeCollected: result.data.rakeCollected.toString(),
          houseId: result.data.houseId,
          notes: result.data.notes || null,
        })
        .returning();

      // Get house details for rent expense
      const [house] = await tx
        .select()
        .from(houses)
        .where(eq(houses.id, result.data.houseId));

      if (!house) {
        throw new Error("Selected house not found");
      }

      // Auto-create rent expense using house's rent
      await tx.insert(expenses).values({
        gameNightId: gameNight.id,
        category: "rent",
        description: `Nightly rent (${house.ownerName})`,
        amount: house.nightlyRent,
      });
    });

    revalidatePath("/game-nights");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    if (error.code === "23505") {
      return { error: "A game night already exists for this date" };
    }
    return { error: "Failed to create game night" };
  }
}
```

### UI Components

#### Globals Page (`src/app/(protected)/globals/page.tsx`)

```typescript
import { getHouses, getAppConfig } from "@/lib/db/queries";
import { HouseCard } from "@/components/globals/house-card";
import { AddHouseButton } from "@/components/globals/add-house-button";
import { SettingsForm } from "@/components/settings/settings-form";

export default async function GlobalsPage() {
  const houses = await getHouses();
  const config = await getAppConfig();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Globals</h1>
        <p className="text-muted-foreground">
          Manage houses and global configuration
        </p>
      </div>

      {/* Houses Section */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-semibold">Houses</h2>
          <AddHouseButton />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {houses.map((house) => (
            <HouseCard key={house.id} house={house} />
          ))}
          {houses.length === 0 && (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              No houses configured. Add your first house to get started.
            </div>
          )}
        </div>
      </section>

      {/* Legacy App Config (optional - could be removed) */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">Legacy Config</h2>
        <SettingsForm config={config} />
      </section>
    </div>
  );
}
```

#### House Card Component (`src/components/globals/house-card.tsx`)

```typescript
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Archive } from "lucide-react";
import { House } from "@/lib/db/schema";
import { EditHouseDialog } from "./edit-house-dialog";
import { useState } from "react";

export function HouseCard({ house }: { house: House }) {
  const [showEdit, setShowEdit] = useState(false);

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <CardTitle className="text-lg">{house.name}</CardTitle>
          {!house.active && (
            <Badge variant="secondary">Inactive</Badge>
          )}
        </CardHeader>
        <CardContent className="space-y-2">
          <div>
            <p className="text-sm text-muted-foreground">Owner</p>
            <p className="font-medium">{house.ownerName}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Nightly Rent</p>
            <p className="font-medium">
              {new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: "USD",
              }).format(Number(house.nightlyRent))}
            </p>
          </div>
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => setShowEdit(true)}
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </div>
        </CardContent>
      </Card>

      <EditHouseDialog
        house={house}
        open={showEdit}
        onOpenChange={setShowEdit}
      />
    </>
  );
}
```

#### Game Night Form Update (`src/components/game-nights/game-night-form.tsx`)

```typescript
"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useActionState, useState } from "react";
import { House } from "@/lib/db/schema";

interface GameNightFormProps {
  houses: House[];
  onSuccess?: () => void;
}

export function GameNightForm({ houses, onSuccess }: GameNightFormProps) {
  const [houseId, setHouseId] = useState<string>("");
  const [state, formAction, isPending] = useActionState(createGameNight, null);

  const activeHouses = houses.filter(h => h.active);

  return (
    <form action={formAction} className="space-y-4">
      {/* House Selector */}
      <div>
        <label className="text-sm font-medium">House *</label>
        <input type="hidden" name="houseId" value={houseId} />
        <Select value={houseId} onValueChange={setHouseId}>
          <SelectTrigger>
            <SelectValue placeholder="Select a house..." />
          </SelectTrigger>
          <SelectContent>
            {activeHouses.length === 0 ? (
              <div className="p-2 text-sm text-muted-foreground">
                No active houses available
              </div>
            ) : (
              activeHouses.map((house) => (
                <SelectItem key={house.id} value={house.id.toString()}>
                  {house.ownerName} - {new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency: "USD",
                  }).format(Number(house.nightlyRent))}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Date */}
      <div>
        <label className="text-sm font-medium">Date *</label>
        <input
          type="date"
          name="date"
          required
          className="w-full px-3 py-2 border rounded-md"
        />
      </div>

      {/* Rake Collected */}
      <div>
        <label className="text-sm font-medium">Rake Collected</label>
        <input
          type="number"
          name="rakeCollected"
          step="0.01"
          min="0"
          defaultValue="0"
          className="w-full px-3 py-2 border rounded-md"
        />
      </div>

      {/* Notes */}
      <div>
        <label className="text-sm font-medium">Notes</label>
        <textarea
          name="notes"
          rows={3}
          className="w-full px-3 py-2 border rounded-md"
        />
      </div>

      {/* Error Display */}
      {state?.error && (
        <div className="text-sm text-red-500">{state.error}</div>
      )}

      {/* Submit Button */}
      <Button
        type="submit"
        disabled={isPending || activeHouses.length === 0}
        className="w-full"
      >
        {isPending ? "Creating..." : "Create Game Night"}
      </Button>

      {activeHouses.length === 0 && (
        <p className="text-sm text-muted-foreground text-center">
          Add a house in Globals before creating game nights
        </p>
      )}
    </form>
  );
}
```

### Navigation Updates

#### Sidebar Changes (`src/components/sidebar.tsx`)

```typescript
// Update navigation items
const navItems = [
  { href: "/game-nights", label: "Game Nights", icon: CalendarDays },
  { href: "/ledger", label: "The Books", icon: BookOpen },
  { href: "/payroll", label: "Payroll", icon: DollarSign },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/settings", label: "Globals", icon: Settings }, // Changed label
];
```

**Decision:** Keep URL as `/settings` to avoid breaking bookmarks. Only change the display label.

## Acceptance Criteria

### Schema & Migration
- [ ] `houses` table created with all required fields
- [ ] Kam's house seeded with $330/night rent
- [ ] Shayne's house seeded with $200/night rent
- [ ] `game_nights.houseId` column added with NOT NULL constraint
- [ ] Foreign key constraint with `onDelete: RESTRICT` applied
- [ ] Index created on `game_nights.houseId`
- [ ] All existing game nights backfilled with Kam's house ID
- [ ] Migration runs without errors on production database
- [ ] Rollback script tested and works correctly

### Query & Validation
- [ ] `getHouses()` returns all houses ordered by owner name
- [ ] `getActiveHouses()` returns only active houses
- [ ] `getGameNights()` includes house name and owner via JOIN
- [ ] `houseSchema` validates name, owner, and rent amount
- [ ] `gameNightSchema` validates required `houseId` field
- [ ] Error message "House selection is required" when houseId missing

### Server Actions
- [ ] `createHouseAction` validates and creates house
- [ ] `updateHouseAction` validates and updates house
- [ ] `deactivateHouseAction` sets `active = false`
- [ ] Deactivate fails with clear error if foreign key constraint violated
- [ ] `createGameNight` validates selected house exists
- [ ] `createGameNight` auto-creates rent expense with house's rent amount
- [ ] Rent expense description includes house owner name
- [ ] All actions revalidate paths correctly

### UI Components
- [ ] Globals page displays all houses in card grid
- [ ] House cards show name, owner, rent, and active status
- [ ] "Add House" button opens dialog modal
- [ ] Edit button on each house card opens edit dialog
- [ ] Game Night form includes house dropdown
- [ ] Dropdown shows format: "Owner - $Amount" (e.g., "Kam - $330.00")
- [ ] Dropdown only shows active houses
- [ ] Dropdown placeholder: "Select a house..."
- [ ] Empty state shown when no houses configured
- [ ] "Create Game Night" button disabled when no active houses
- [ ] Error message shown when house selection missing on submit

### Navigation
- [ ] Sidebar label changed from "Settings" to "Globals"
- [ ] URL remains `/settings` (no breaking changes)
- [ ] Page title displays "Globals"
- [ ] Browser tab title updated

### Data Integrity
- [ ] Cannot delete house with existing game nights (RESTRICT enforced)
- [ ] Inactive houses hidden from create dropdown but visible in history
- [ ] Each game night shows associated house in display/detail view
- [ ] Rent expenses accurately reflect selected house's rent amount
- [ ] Editing game night does NOT allow changing house (dropdown disabled)

### Edge Cases
- [ ] Creating game night with inactive house fails validation
- [ ] Viewing old game night shows house name even if now inactive
- [ ] Zero active houses: clear message + disabled create button
- [ ] Concurrent rent updates don't cause race conditions (transaction safety)

## Success Metrics

- All existing game nights preserve historical accuracy (all show Kam's house)
- New game nights can be created at either house location
- Rent expenses auto-generated with correct amounts ($330 or $200)
- Globals page clearly displays all house configurations
- No broken foreign key references or orphaned records

## Dependencies & Risks

### Dependencies
- Drizzle ORM schema changes require `drizzle-kit push`
- Migration must run before deploying code changes
- Existing `app_config` table remains for backwards compatibility (optional cleanup later)

### Risks

**Risk 1: Migration Failure**
*Severity*: High
*Mitigation*: Test migration on copy of production database. Write and test rollback script. Take database backup before migration.

**Risk 2: Foreign Key Constraint Violations**
*Severity*: Medium
*Mitigation*: `onDelete: RESTRICT` prevents accidental deletions. Use soft delete (`active = false`) for house removal.

**Risk 3: User Confusion During Transition**
*Severity*: Low
*Mitigation*: Single-operator system. Provide clear empty states and validation messages.

**Risk 4: Historical Data Misattribution**
*Severity*: Low
*Mitigation*: Backfill defaults all existing nights to Kam (matches current $330 rent). Historical accuracy preserved.

## Implementation Order

1. **Schema & Migration** (Est. 2-3 hours)
   - Write migration script
   - Test on database copy
   - Write rollback script
   - Run migration on production

2. **Backend Foundation** (Est. 2-3 hours)
   - Update schema.ts
   - Add house queries
   - Update game night queries for JOIN
   - Add validation schemas

3. **Server Actions** (Est. 2 hours)
   - Create house CRUD actions
   - Update game night creation action
   - Update auto-rent expense logic

4. **Globals Page** (Est. 3-4 hours)
   - Rename route/page
   - Build house card component
   - Build add/edit house dialogs
   - Add empty states

5. **Game Night Form** (Est. 2 hours)
   - Add house dropdown
   - Update form validation
   - Handle empty states

6. **Navigation & Polish** (Est. 1 hour)
   - Update sidebar label
   - Update page titles
   - Test all flows

7. **Testing & Verification** (Est. 2 hours)
   - Test create/edit houses
   - Test game night creation with each house
   - Verify rent expense amounts
   - Test edge cases

**Total Estimated Effort**: 14-17 hours

## Open Questions

### Critical (Need Answers Before Implementation)

**Q1**: When editing an existing game night, should the house dropdown be editable or read-only?
**Recommendation**: Make it **read-only/disabled** to prevent confusion about rent expense handling. Operator must delete and recreate if house was wrong.

**Q2**: Should we remove the legacy `app_config.nightlyRent` field after migration?
**Recommendation**: **Keep it** for now as a fallback/reference. Can be removed in future cleanup.

**Q3**: What happens if operator tries to deactivate a house that has game nights?
**Recommendation**: **Allow deactivation** (soft delete). Foreign key RESTRICT only prevents hard deletion. Display "X game nights reference this house" warning in confirmation dialog.

## Future Considerations

**Phase 2 Enhancements:**
- House-specific expense categories
- Historical rent rate tracking (if rent changes over time)
- Multiple rent rates per house (weekday vs. weekend)
- House location/address metadata
- Reporting by house location

## References

### Internal References
- Schema: `src/lib/db/schema.ts:12-21` (gameNights table)
- Schema: `src/lib/db/schema.ts:58-65` (appConfig table)
- Auto-rent logic: `src/app/(protected)/game-nights/actions.ts:36-51`
- Settings page: `src/app/(protected)/settings/page.tsx`
- Sidebar nav: `src/components/sidebar.tsx:26-32`
- Validations: `src/lib/validations.ts`
- Queries: `src/lib/db/queries.ts`

### Key Conventions (from CLAUDE.md)
- Server Actions for all mutations
- Radix Select requires hidden input + useState
- Toast notifications via sonner
- Dialog modals for create/edit forms
- `revalidatePath()` after mutations
- Serial integer PKs, not UUIDs

### Research Agents
- Repo Research: Agent a1c5f7b
- Spec Flow Analysis: Agent a2f836b
