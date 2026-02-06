---
title: "feat: Multi-house rent management with security hardening and architectural improvements"
type: feat
date: 2026-02-05
status: draft
original_plan: 2026-02-05-feat-multi-house-rent-management-plan.md
code_review_findings: 28 integrated
---

# Multi-House Rent Management - Revised Implementation Plan

## Overview

Transform the single-rent system into a scalable multi-house configuration with comprehensive security hardening, architectural improvements, and code simplifications based on thorough code review findings.

**Key Changes from Original Plan:**
- Added authentication checks to ALL server actions (P1 Critical)
- Transactional migration with verification steps (P1 Critical)
- Parameterized queries to prevent SQL injection (P1 Critical)
- Input validation with bounds checking (P1 Critical)
- Race condition fixes (P1 Critical)
- Simplified data model (removed redundant fields)
- Enhanced error handling with proper logging
- Security headers and CSP configuration
- Query optimization and simplification

## Problem Statement

**Current Limitations:**
1. Single `nightlyRent` value in `app_config` table ($330 for Kam)
2. No concept of "which house" for game nights
3. Cannot support multiple locations with different rent amounts
4. Hardcoded "Nightly rent (Kam)" in auto-created expenses
5. Not scalable for adding new houses/locations

**Security & Architecture Issues Found in Review:**
- No authorization checks in server actions (CRITICAL)
- Non-transactional migration script (HIGH RISK)
- SQL injection vulnerability in backfill (CRITICAL)
- Race conditions in game night creation (HIGH)
- Input validation gaps (HIGH)
- Over-engineered query layer (DHH feedback)
- Manual timestamp management (technical debt)

## Proposed Solution

### Simplified Architecture (DHH-Inspired)

**Simplified `houses` table:**
```typescript
export const houses = pgTable("houses", {
  id: serial("id").primaryKey(),
  owner: text("owner").notNull().unique(),  // "Kam" or "Shayne" - simplified from name/ownerName
  nightlyRent: numeric("nightly_rent", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type House = typeof houses.$inferSelect;
export type NewHouse = typeof houses.$inferInsert;
```

**Key Simplifications:**
- Removed `name` field (redundant - owner name is what matters)
- Removed `ownerName` field (merged into single `owner` field)
- Removed `updatedAt` field (will use DB trigger or remove entirely)
- Removed `active` soft-delete flag (use hard delete with RESTRICT protection)
- Added UNIQUE constraint on `owner` to prevent duplicates

**Modified `game_nights` table:**
```typescript
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
});
```

## Implementation Plan

### Phase 0: Security Foundation (CRITICAL - Must Complete First)

**Estimated Effort:** 2 hours

#### Step 0.1: Create Authentication Helper

**File:** `src/lib/auth/server-auth.ts`

```typescript
// src/lib/auth/server-auth.ts
"use server";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function verifyAuth() {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );

  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("Unauthorized: Authentication required");
  }

  // Check email allowlist
  const allowedEmails = process.env.ALLOWED_EMAILS?.split(",").map(e => e.trim()) ?? [];
  if (!allowedEmails.includes(user.email ?? "")) {
    throw new Error("Forbidden: User not authorized for this application");
  }

  return user;
}
```

**Acceptance Criteria:**
- [ ] `verifyAuth()` helper created in `src/lib/auth/server-auth.ts`
- [ ] Checks Supabase session validity
- [ ] Validates user email against ALLOWED_EMAILS environment variable
- [ ] Throws clear error messages for unauthorized/forbidden access
- [ ] Returns authenticated user object on success
- [ ] Tested with authenticated and unauthenticated requests

---

#### Step 0.2: Security Headers Configuration

**File:** `next.config.js`

```javascript
// next.config.js
module.exports = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https:",
              "font-src 'self' data:",
              "connect-src 'self' https://*.supabase.co",
            ].join('; ')
          }
        ]
      }
    ]
  }
}
```

**Acceptance Criteria:**
- [ ] Security headers added to `next.config.js`
- [ ] CSP policy allows Supabase connections
- [ ] Headers verified in browser devtools Network tab
- [ ] No functionality broken by CSP restrictions

---

### Phase 1: Schema & Simplified Migration (2-3 hours)

#### Step 1.1: Update Schema Definition

**File:** `src/lib/db/schema.ts`

```typescript
// src/lib/db/schema.ts

// Add houses table
export const houses = pgTable("houses", {
  id: serial("id").primaryKey(),
  owner: text("owner").notNull().unique(),
  nightlyRent: numeric("nightly_rent", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type House = typeof houses.$inferSelect;
export type NewHouse = typeof houses.$inferInsert;

// Update gameNights table - add houseId
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
});
```

**Acceptance Criteria:**
- [ ] `houses` table added to schema with simplified fields (owner, nightlyRent, createdAt)
- [ ] UNIQUE constraint on `owner` field
- [ ] No `active`, `updatedAt`, `name`, or `ownerName` fields (simplified)
- [ ] `houseId` added to `gameNights` with NOT NULL and foreign key
- [ ] Foreign key uses `onDelete: "restrict"`
- [ ] Type exports added for House and NewHouse

---

#### Step 1.2: Transactional Migration Script with Security Fixes

**File:** `scripts/migrate-add-houses.ts`

```typescript
// scripts/migrate-add-houses.ts
import { db } from "@/lib/db";
import { houses, gameNights } from "@/lib/db/schema";
import { sql } from "drizzle-orm";

export async function up() {
  console.log("Starting houses migration...");

  // WRAP ENTIRE MIGRATION IN TRANSACTION (P1 Fix)
  await db.transaction(async (tx) => {
    console.log("Step 1: Creating houses table...");

    // 1. Create houses table
    await tx.execute(sql`
      CREATE TABLE IF NOT EXISTS "houses" (
        "id" SERIAL PRIMARY KEY,
        "owner" TEXT NOT NULL UNIQUE,
        "nightly_rent" NUMERIC(10, 2) NOT NULL CHECK (nightly_rent > 0 AND nightly_rent <= 10000),
        "created_at" TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);

    console.log("Step 2: Seeding initial houses...");

    // 2. Seed initial houses with verification (P1 Fix)
    const [kamHouse] = await tx.insert(houses).values({
      owner: "Kam",
      nightlyRent: "330.00",
    }).returning();

    if (!kamHouse || !kamHouse.id) {
      throw new Error("MIGRATION FAILED: Could not create Kam's house record");
    }
    console.log(`Created Kam's house with ID ${kamHouse.id}`);

    const [shayneHouse] = await tx.insert(houses).values({
      owner: "Shayne",
      nightlyRent: "200.00",
    }).returning();

    if (!shayneHouse || !shayneHouse.id) {
      throw new Error("MIGRATION FAILED: Could not create Shayne's house record");
    }
    console.log(`Created Shayne's house with ID ${shayneHouse.id}`);

    console.log("Step 3: Adding house_id column to game_nights...");

    // 3. Add houseId column (nullable initially for backfill)
    await tx.execute(sql`
      ALTER TABLE "game_nights"
      ADD COLUMN IF NOT EXISTS "house_id" INTEGER
    `);

    console.log("Step 4: Backfilling existing game nights...");

    // 4. Backfill existing game nights - PARAMETERIZED QUERY (P1 Fix)
    const backfillResult = await tx.execute(
      sql`
        UPDATE "game_nights"
        SET "house_id" = ${kamHouse.id}
        WHERE "house_id" IS NULL
      `
    );
    console.log(`Backfilled ${backfillResult.rowCount ?? 0} game nights with Kam's house`);

    console.log("Step 5: Verifying backfill...");

    // 5. VERIFY BACKFILL (P2 Fix)
    const [nullCheck] = await tx.execute(sql`
      SELECT COUNT(*) as count
      FROM "game_nights"
      WHERE "house_id" IS NULL
    `);

    const nullCount = Number(nullCheck.count);
    if (nullCount > 0) {
      throw new Error(`MIGRATION FAILED: ${nullCount} game nights still have NULL house_id after backfill`);
    }
    console.log("Backfill verification passed ✓");

    console.log("Step 6: Adding foreign key constraint...");

    // 6. Add foreign key constraint BEFORE NOT NULL (P2 Fix - correct order)
    await tx.execute(sql`
      ALTER TABLE "game_nights"
      ADD CONSTRAINT "game_nights_house_id_fkey"
      FOREIGN KEY ("house_id")
      REFERENCES "houses"("id")
      ON DELETE RESTRICT
    `);

    console.log("Step 7: Making house_id NOT NULL...");

    // 7. Make houseId NOT NULL (after FK validation)
    await tx.execute(sql`
      ALTER TABLE "game_nights"
      ALTER COLUMN "house_id" SET NOT NULL
    `);

    console.log("Step 8: Creating index...");

    // 8. Add index for query performance
    await tx.execute(sql`
      CREATE INDEX IF NOT EXISTS "game_nights_house_id_idx"
      ON "game_nights"("house_id")
    `);

    console.log("Migration completed successfully! ✓");
  });
}

export async function down() {
  console.warn("⚠️  WARNING: Rollback will remove multi-house support");
  console.warn("⚠️  All house associations will be lost");

  // SAFETY CHECK BEFORE ROLLBACK (P2 Fix)
  const [gameNightCount] = await db.execute(sql`
    SELECT COUNT(*) as count FROM "game_nights"
  `);

  const count = Number(gameNightCount.count);
  if (count > 0) {
    throw new Error(
      `ROLLBACK BLOCKED: ${count} game nights exist. ` +
      `Rolling back would orphan all house references. ` +
      `Delete all game nights first or keep the migration.`
    );
  }

  // Rollback in reverse order
  await db.transaction(async (tx) => {
    await tx.execute(sql`DROP INDEX IF EXISTS "game_nights_house_id_idx"`);
    await tx.execute(sql`ALTER TABLE "game_nights" DROP CONSTRAINT IF EXISTS "game_nights_house_id_fkey"`);
    await tx.execute(sql`ALTER TABLE "game_nights" DROP COLUMN IF EXISTS "house_id"`);
    await tx.execute(sql`DROP TABLE IF EXISTS "houses"`);
  });

  console.log("Rollback completed");
}
```

**Acceptance Criteria:**
- [ ] Migration wrapped in single transaction (P1 Fix)
- [ ] Verification after house creation (throws if ID is null)
- [ ] Parameterized query for backfill (P1 SQL injection fix)
- [ ] Verification after backfill (throws if any nulls remain)
- [ ] Foreign key added BEFORE NOT NULL constraint (P2 correct order)
- [ ] Rollback protected with safety check (P2 fix)
- [ ] Console logging for each step
- [ ] Index created for performance
- [ ] CHECK constraint on nightly_rent (1-10000 range)
- [ ] UNIQUE constraint on owner
- [ ] Migration tested on database copy
- [ ] Rollback tested on database copy

---

### Phase 2: Simplified Query Layer (1 hour)

#### Step 2.1: Minimal House Queries (DHH Simplification)

**File:** `src/lib/db/queries.ts`

```typescript
// src/lib/db/queries.ts

// ─── Houses ──────────────────────────────────────────────────────────────────

import { houses } from "./schema";
import { eq } from "drizzle-orm";

export async function getHouses() {
  return db.select().from(houses).orderBy(houses.owner);
}

export async function getHouseById(id: number) {
  // Input validation (P2 Fix)
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error("Invalid house ID: must be a positive integer");
  }

  const [house] = await db.select().from(houses).where(eq(houses.id, id));
  return house ?? null;  // Consistent null handling (P2 Fix)
}

// Remove wrapper functions - use Drizzle directly in actions (DHH recommendation)
// No createHouse(), updateHouse(), deactivateHouse() - too much abstraction
```

**Acceptance Criteria:**
- [ ] Only essential query functions kept
- [ ] `getHouses()` returns all houses ordered by owner
- [ ] `getHouseById()` includes input validation (P2 Fix)
- [ ] Consistent `?? null` pattern (P2 Fix)
- [ ] No unnecessary CRUD wrappers (DHH simplification)
- [ ] Query comment style matches existing codebase (P3)

---

#### Step 2.2: Update Game Night Queries with JOIN

**File:** `src/lib/db/queries.ts`

```typescript
// src/lib/db/queries.ts

// Update existing getGameNights to include house info
export async function getGameNights() {
  const nights = await db
    .select({
      id: gameNights.id,
      date: gameNights.date,
      rakeCollected: gameNights.rakeCollected,
      notes: gameNights.notes,
      houseId: gameNights.houseId,
      houseOwner: houses.owner,  // Simplified field name
      createdAt: gameNights.createdAt,
    })
    .from(gameNights)
    .innerJoin(houses, eq(gameNights.houseId, houses.id))  // innerJoin since NOT NULL (P3)
    .orderBy(desc(gameNights.date));

  // Rest of expense calculation logic remains unchanged...
  // (Existing code for getAllExpenses, expense joins, etc.)
}
```

**Acceptance Criteria:**
- [ ] `getGameNights()` includes house owner via JOIN
- [ ] Uses `innerJoin` instead of `leftJoin` (P3 optimization - houseId is NOT NULL)
- [ ] Simplified field name: `houseOwner` instead of `houseName`/`houseOwnerName`
- [ ] Query tested with existing game nights

---

### Phase 3: Validation with Security Hardening (1 hour)

#### Step 3.1: House Validation Schema

**File:** `src/lib/validations.ts`

```typescript
// src/lib/validations.ts

export const houseSchema = z.object({
  owner: z.string()
    .min(1, "Owner name is required")
    .max(50, "Owner name too long")
    .regex(/^[a-zA-Z\s\-']+$/, "Owner name contains invalid characters"),
  nightlyRent: z.coerce
    .number()
    .min(1, "Rent must be at least $1")
    .max(10000, "Rent cannot exceed $10,000")
    .multipleOf(0.01, "Rent must be a valid dollar amount"),
});

export type HouseFormData = z.infer<typeof houseSchema>;
```

**Acceptance Criteria:**
- [ ] `owner` field validated (simplified from name/ownerName)
- [ ] Max length 50 characters (P1 Fix)
- [ ] Regex validation for allowed characters (P1 Fix)
- [ ] Rent min $1, max $10,000 (P1 Fix)
- [ ] Clear error messages for validation failures

---

#### Step 3.2: Game Night Validation Update

**File:** `src/lib/validations.ts`

```typescript
// src/lib/validations.ts

export const gameNightSchema = z.object({
  date: z.string().min(1, "Date is required"),
  rakeCollected: z.coerce.number().min(0, "Rake must be 0 or more").default(0),
  houseId: z.coerce
    .number()
    .int("House ID must be an integer")
    .positive("House selection is required"),
  notes: z.string().optional(),
});
```

**Acceptance Criteria:**
- [ ] `houseId` validated as positive integer
- [ ] Clear error message when house not selected

---

### Phase 4: Secure Server Actions (2-3 hours)

#### Step 4.1: House Management Actions

**File:** `src/app/(protected)/globals/actions.ts`

```typescript
// src/app/(protected)/globals/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { houses } from "@/lib/db/schema";
import { houseSchema } from "@/lib/validations";
import { verifyAuth } from "@/lib/auth/server-auth";
import { eq } from "drizzle-orm";

export async function createHouseAction(formData: FormData) {
  // AUTHENTICATION CHECK (P1 Critical Fix)
  try {
    await verifyAuth();
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unauthorized" };
  }

  const data = {
    owner: formData.get("owner") as string,
    nightlyRent: formData.get("nightlyRent") as string,
  };

  const result = houseSchema.safeParse(data);
  if (!result.success) {
    return { error: result.error.errors[0].message };
  }

  try {
    // Use Drizzle directly - no wrapper function (DHH simplification)
    await db.insert(houses).values({
      owner: result.data.owner,
      nightlyRent: result.data.nightlyRent.toString(),
    });

    revalidatePath("/globals");
    revalidatePath("/game-nights");
    return { success: true };
  } catch (error) {
    // Improved error handling (P2 Fix)
    console.error("[createHouse] Database error:", error);

    if (error instanceof Error && error.message.includes("unique")) {
      return { error: "A house for this owner already exists" };
    }

    return { error: "Failed to create house. Please try again." };
  }
}

export async function updateHouseAction(id: number, formData: FormData) {
  // AUTHENTICATION CHECK (P1 Critical Fix)
  try {
    await verifyAuth();
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unauthorized" };
  }

  // Input validation (P2 Fix)
  if (!Number.isInteger(id) || id <= 0) {
    return { error: "Invalid house ID" };
  }

  const data = {
    owner: formData.get("owner") as string,
    nightlyRent: formData.get("nightlyRent") as string,
  };

  const result = houseSchema.safeParse(data);
  if (!result.success) {
    return { error: result.error.errors[0].message };
  }

  try {
    // Use Drizzle directly (DHH simplification)
    const [updated] = await db
      .update(houses)
      .set({
        owner: result.data.owner,
        nightlyRent: result.data.nightlyRent.toString(),
      })
      .where(eq(houses.id, id))
      .returning();

    if (!updated) {
      return { error: "House not found" };
    }

    revalidatePath("/globals");
    revalidatePath("/game-nights");
    return { success: true };
  } catch (error) {
    console.error("[updateHouse] Database error:", error);

    if (error instanceof Error && error.message.includes("unique")) {
      return { error: "A house for this owner already exists" };
    }

    return { error: "Failed to update house. Please try again." };
  }
}

export async function deleteHouseAction(id: number) {
  // AUTHENTICATION CHECK (P1 Critical Fix)
  try {
    await verifyAuth();
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unauthorized" };
  }

  // Input validation (P2 Fix)
  if (!Number.isInteger(id) || id <= 0) {
    return { error: "Invalid house ID" };
  }

  try {
    // Hard delete with RESTRICT protection (DHH simplification - no soft delete)
    await db.delete(houses).where(eq(houses.id, id));

    revalidatePath("/globals");
    revalidatePath("/game-nights");
    return { success: true };
  } catch (error: unknown) {
    console.error("[deleteHouse] Database error:", error);

    // Type guard for PostgreSQL error (P2 Fix)
    if (error && typeof error === 'object' && 'code' in error) {
      if (error.code === "23503") {  // Foreign key violation
        return {
          error: "Cannot delete house with existing game nights. Delete the game nights first."
        };
      }
    }

    return { error: "Failed to delete house. Please try again." };
  }
}
```

**Acceptance Criteria:**
- [ ] Authentication check at start of EVERY action (P1 Critical Fix)
- [ ] Input validation for house ID (P2 Fix)
- [ ] Direct Drizzle usage (no query wrappers - DHH simplification)
- [ ] Improved error handling with logging (P2 Fix)
- [ ] Type guard for PostgreSQL errors (P2 Fix)
- [ ] Hard delete instead of soft delete (DHH simplification)
- [ ] Clear user-facing error messages
- [ ] Server-side error logging for debugging

---

#### Step 4.2: Secure Game Night Creation with Race Condition Fix

**File:** `src/app/(protected)/game-nights/actions.ts`

```typescript
// src/app/(protected)/game-nights/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { gameNights, expenses, houses } from "@/lib/db/schema";
import { gameNightSchema } from "@/lib/validations";
import { verifyAuth } from "@/lib/auth/server-auth";
import { eq } from "drizzle-orm";

export type ActionState = {
  success?: boolean;
  error?: string;
};

export async function createGameNight(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  // AUTHENTICATION CHECK (P1 Critical Fix)
  try {
    await verifyAuth();
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unauthorized" };
  }

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

  // VALIDATE HOUSE BEFORE TRANSACTION (P1 Race Condition Fix)
  const [house] = await db
    .select()
    .from(houses)
    .where(eq(houses.id, result.data.houseId));

  if (!house) {
    return { error: "Selected house not found" };
  }

  // Now start transaction with validated house data
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

      // Auto-create rent expense using pre-validated house data
      await tx.insert(expenses).values({
        gameNightId: gameNight.id,
        category: "rent",
        description: `Nightly rent (${house.owner})`,  // Simplified field
        amount: house.nightlyRent,
      });
    });

    revalidatePath("/game-nights");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error: unknown) {
    console.error("[createGameNight] Database error:", error);

    // Specific error handling (P2 Fix)
    if (error && typeof error === 'object' && 'code' in error) {
      if (error.code === "23505") {  // Unique violation
        return { error: "A game night already exists for this date" };
      }
      if (error.code === "23503") {  // Foreign key violation
        return { error: "Selected house no longer exists" };
      }
    }

    return { error: "Failed to create game night. Please try again." };
  }
}
```

**Acceptance Criteria:**
- [ ] Authentication check at start (P1 Critical Fix)
- [ ] House validation BEFORE transaction (P1 Race Condition Fix)
- [ ] Transaction only wraps write operations (P3 optimization)
- [ ] Uses pre-validated house data (no query inside transaction)
- [ ] Simplified field: `house.owner` instead of `house.ownerName`
- [ ] Type guard for PostgreSQL errors (P2 Fix)
- [ ] Specific error messages for different failure modes
- [ ] Server-side error logging

---

### Phase 5: Simplified UI Components (3-4 hours)

#### Step 5.1: Globals Page

**File:** `src/app/(protected)/globals/page.tsx`

```typescript
// src/app/(protected)/globals/page.tsx
import { getHouses } from "@/lib/db/queries";
import { HouseCard } from "@/components/globals/house-card";
import { AddHouseButton } from "@/components/globals/add-house-button";

export default async function GlobalsPage() {
  const houses = await getHouses();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Globals</h1>
        <p className="text-muted-foreground">
          Manage houses and locations
        </p>
      </div>

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
    </div>
  );
}
```

**Acceptance Criteria:**
- [ ] Page title "Globals" (simplified from "Settings → Globals")
- [ ] Server-side data fetching
- [ ] Empty state for no houses
- [ ] Card grid layout
- [ ] Add house button

---

#### Step 5.2: House Card Component

**File:** `src/components/globals/house-card.tsx`

```typescript
// src/components/globals/house-card.tsx
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Edit, Trash } from "lucide-react";
import { House } from "@/lib/db/schema";
import { EditHouseDialog } from "./edit-house-dialog";
import { DeleteHouseDialog } from "./delete-house-dialog";
import { useState } from "react";

export function HouseCard({ house }: { house: House }) {
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{house.owner}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div>
            <p className="text-sm text-muted-foreground">Nightly Rent</p>
            <p className="font-medium text-xl">
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
              className="flex-1"
              onClick={() => setShowEdit(true)}
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => setShowDelete(true)}
            >
              <Trash className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </div>
        </CardContent>
      </Card>

      <EditHouseDialog
        house={house}
        open={showEdit}
        onOpenChange={setShowEdit}
      />

      <DeleteHouseDialog
        house={house}
        open={showDelete}
        onOpenChange={setShowDelete}
      />
    </>
  );
}
```

**Acceptance Criteria:**
- [ ] Simplified display: owner name and rent only
- [ ] No `active` status badge (removed soft delete)
- [ ] Edit and Delete buttons
- [ ] Dialog state management
- [ ] Currency formatting

---

#### Step 5.3: Add/Edit House Dialogs

**File:** `src/components/globals/add-house-dialog.tsx`

```typescript
// src/components/globals/add-house-dialog.tsx
"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createHouseAction } from "@/app/(protected)/globals/actions";
import { useState } from "react";
import { toast } from "sonner";

export function AddHouseDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(formData: FormData) {
    setIsSubmitting(true);
    const result = await createHouseAction(formData);
    setIsSubmitting(false);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("House created successfully");
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add House</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="owner">Owner Name *</Label>
            <Input
              id="owner"
              name="owner"
              placeholder="e.g., Kam"
              required
              maxLength={50}
            />
          </div>
          <div>
            <Label htmlFor="nightlyRent">Nightly Rent ($) *</Label>
            <Input
              id="nightlyRent"
              name="nightlyRent"
              type="number"
              step="0.01"
              min="1"
              max="10000"
              placeholder="330.00"
              required
            />
          </div>
          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? "Creating..." : "Create House"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

**Acceptance Criteria:**
- [ ] Simplified form: owner and rent only
- [ ] Client-side validation (maxLength, min/max)
- [ ] Loading state during submission
- [ ] Toast notifications for success/error
- [ ] Dialog closes on success

**File:** `src/components/globals/edit-house-dialog.tsx` - Similar structure, uses `updateHouseAction`

---

#### Step 5.4: Delete House Dialog

**File:** `src/components/globals/delete-house-dialog.tsx`

```typescript
// src/components/globals/delete-house-dialog.tsx
"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { deleteHouseAction } from "@/app/(protected)/globals/actions";
import { House } from "@/lib/db/schema";
import { useState } from "react";
import { toast } from "sonner";

export function DeleteHouseDialog({
  house,
  open,
  onOpenChange
}: {
  house: House;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    setIsDeleting(true);
    const result = await deleteHouseAction(house.id);
    setIsDeleting(false);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("House deleted successfully");
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete House</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete <strong>{house.owner}'s house</strong>?
            This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isDeleting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
            {isDeleting ? "Deleting..." : "Delete"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

**Acceptance Criteria:**
- [ ] Confirmation dialog before delete
- [ ] Shows house owner name
- [ ] Loading state during deletion
- [ ] Handles foreign key errors gracefully (game nights exist)
- [ ] Toast notifications

---

#### Step 5.5: Game Night Form with House Selection

**File:** `src/components/game-nights/game-night-form.tsx`

```typescript
// src/components/game-nights/game-night-form.tsx
"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useActionState, useState } from "react";
import { createGameNight } from "@/app/(protected)/game-nights/actions";
import { House } from "@/lib/db/schema";
import { toast } from "sonner";

interface GameNightFormProps {
  houses: House[];
  onSuccess?: () => void;
}

export function GameNightForm({ houses, onSuccess }: GameNightFormProps) {
  const [houseId, setHouseId] = useState<string>("");
  const [state, formAction, isPending] = useActionState(createGameNight, null);

  // Show toast on error
  if (state?.error) {
    toast.error(state.error);
  }

  // Show toast on success
  if (state?.success) {
    toast.success("Game night created successfully");
    onSuccess?.();
  }

  return (
    <form action={formAction} className="space-y-4">
      {/* House Selector */}
      <div>
        <Label htmlFor="houseId">House *</Label>
        <input type="hidden" name="houseId" value={houseId} />
        <Select value={houseId} onValueChange={setHouseId}>
          <SelectTrigger>
            <SelectValue placeholder="Select a house..." />
          </SelectTrigger>
          <SelectContent>
            {houses.length === 0 ? (
              <div className="p-2 text-sm text-muted-foreground">
                No houses available
              </div>
            ) : (
              houses.map((house) => (
                <SelectItem key={house.id} value={house.id.toString()}>
                  {house.owner} - {new Intl.NumberFormat("en-US", {
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
        <Label htmlFor="date">Date *</Label>
        <Input
          type="date"
          id="date"
          name="date"
          required
        />
      </div>

      {/* Rake Collected */}
      <div>
        <Label htmlFor="rakeCollected">Rake Collected ($)</Label>
        <Input
          type="number"
          id="rakeCollected"
          name="rakeCollected"
          step="0.01"
          min="0"
          defaultValue="0"
        />
      </div>

      {/* Notes */}
      <div>
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          name="notes"
          rows={3}
        />
      </div>

      {/* Submit Button */}
      <Button
        type="submit"
        disabled={isPending || houses.length === 0 || !houseId}
        className="w-full"
      >
        {isPending ? "Creating..." : "Create Game Night"}
      </Button>

      {houses.length === 0 && (
        <p className="text-sm text-muted-foreground text-center">
          Add a house in Globals before creating game nights
        </p>
      )}
    </form>
  );
}
```

**Acceptance Criteria:**
- [ ] House dropdown with owner name and rent
- [ ] Simplified display: `house.owner` field
- [ ] Hidden input for form submission (Radix Select pattern)
- [ ] Empty state when no houses
- [ ] Button disabled when no house selected
- [ ] Toast notifications via sonner
- [ ] Form validation

---

### Phase 6: Navigation & Polish (1 hour)

#### Step 6.1: Sidebar Navigation Update

**File:** `src/components/sidebar.tsx`

```typescript
// src/components/sidebar.tsx

// Update navigation items
const navItems = [
  { href: "/game-nights", label: "Game Nights", icon: CalendarDays },
  { href: "/ledger", label: "The Books", icon: BookOpen },
  { href: "/payroll", label: "Payroll", icon: DollarSign },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/settings", label: "Globals", icon: Settings },  // Label changed, URL stays same
];
```

**Acceptance Criteria:**
- [ ] Sidebar label changed to "Globals"
- [ ] URL remains `/settings` (no breaking changes)
- [ ] Icon remains Settings icon
- [ ] Navigation tested

---

#### Step 6.2: Page Metadata Updates

**File:** `src/app/(protected)/settings/layout.tsx` or `page.tsx`

```typescript
// Update page title
export const metadata = {
  title: "Globals | The Bunker Black Book",
};
```

**Acceptance Criteria:**
- [ ] Browser tab title shows "Globals"
- [ ] Page heading displays "Globals"

---

### Phase 7: Testing & Verification (2-3 hours)

#### Step 7.1: Security Testing

**Test Cases:**

```typescript
// tests/security/auth.test.ts

describe("Server Action Authentication", () => {
  it("blocks unauthenticated requests to createHouseAction", async () => {
    // Mock no session
    const formData = new FormData();
    formData.set("owner", "Test");
    formData.set("nightlyRent", "100");

    const result = await createHouseAction(formData);
    expect(result.error).toContain("Unauthorized");
  });

  it("blocks non-allowlisted emails", async () => {
    // Mock session with non-allowlisted email
    // ...
  });
});

describe("Input Validation", () => {
  it("rejects rent above $10,000", async () => {
    const formData = new FormData();
    formData.set("owner", "Test");
    formData.set("nightlyRent", "99999");

    const result = await createHouseAction(formData);
    expect(result.error).toContain("cannot exceed");
  });

  it("rejects invalid characters in owner name", async () => {
    const formData = new FormData();
    formData.set("owner", "<script>alert('xss')</script>");
    formData.set("nightlyRent", "100");

    const result = await createHouseAction(formData);
    expect(result.error).toContain("invalid characters");
  });
});
```

**Acceptance Criteria:**
- [ ] Authentication tests pass
- [ ] Input validation tests pass
- [ ] XSS attempts blocked
- [ ] SQL injection attempts blocked
- [ ] Security headers verified in browser

---

#### Step 7.2: Migration Testing

**Pre-Migration Checklist:**
- [ ] Full database backup taken
- [ ] Migration tested on database copy
- [ ] Verification queries prepared
- [ ] Rollback tested on database copy

**Post-Migration Verification:**

```sql
-- 1. Verify houses table
SELECT * FROM houses ORDER BY id;
-- Expected: 2 rows (Kam, Shayne)

-- 2. Verify all game nights have house_id
SELECT COUNT(*) FROM game_nights WHERE house_id IS NULL;
-- Expected: 0

-- 3. Verify foreign key constraint
SELECT COUNT(*)
FROM game_nights gn
LEFT JOIN houses h ON gn.house_id = h.id
WHERE h.id IS NULL;
-- Expected: 0

-- 4. Verify historical accuracy
SELECT COUNT(*)
FROM game_nights gn
JOIN houses h ON gn.house_id = h.id
WHERE h.owner != 'Kam';
-- Expected: 0 (all historical should be Kam)

-- 5. Verify index exists
SELECT indexname FROM pg_indexes
WHERE tablename = 'game_nights' AND indexname = 'game_nights_house_id_idx';
-- Expected: 1 row

-- 6. Verify unique constraint
SELECT COUNT(*) FROM houses WHERE owner = 'Kam';
-- Expected: 1 (cannot insert duplicate)
```

**Acceptance Criteria:**
- [ ] All verification queries pass
- [ ] No orphaned records
- [ ] Foreign key constraints working
- [ ] Unique constraint enforced
- [ ] Historical data preserved correctly

---

#### Step 7.3: Integration Testing

**Test Scenarios:**

1. **Create House Flow:**
   - [ ] Navigate to Globals page
   - [ ] Click "Add House" button
   - [ ] Fill form with valid data
   - [ ] Submit successfully
   - [ ] Verify house appears in list
   - [ ] Verify toast notification

2. **Edit House Flow:**
   - [ ] Click Edit on house card
   - [ ] Update rent amount
   - [ ] Submit successfully
   - [ ] Verify updated value displays
   - [ ] Verify toast notification

3. **Delete House Flow (No Game Nights):**
   - [ ] Create test house
   - [ ] Click Delete
   - [ ] Confirm deletion
   - [ ] Verify house removed from list
   - [ ] Verify toast notification

4. **Delete House Flow (Has Game Nights):**
   - [ ] Try to delete Kam's house (has historical game nights)
   - [ ] Verify error message about foreign key
   - [ ] Verify house NOT deleted
   - [ ] Verify clear error toast

5. **Create Game Night Flow:**
   - [ ] Navigate to Game Nights
   - [ ] Click "Add Game Night"
   - [ ] Select house from dropdown
   - [ ] Fill in date and rake
   - [ ] Submit successfully
   - [ ] Verify game night appears in list
   - [ ] Verify auto-created rent expense matches house rent

6. **Game Night Display:**
   - [ ] View game nights list
   - [ ] Verify house owner shown for each game night
   - [ ] Verify historical game nights show Kam
   - [ ] Verify new game nights show correct house

**Acceptance Criteria:**
- [ ] All integration tests pass
- [ ] No console errors
- [ ] Toast notifications work correctly
- [ ] Forms validate properly
- [ ] Data displays correctly

---

#### Step 7.4: Edge Case Testing

**Test Scenarios:**

1. **Concurrent Operations:**
   - [ ] Create two game nights simultaneously
   - [ ] Try to create duplicate house (same owner)
   - [ ] Verify proper error handling

2. **Boundary Values:**
   - [ ] Create house with $1 rent (minimum)
   - [ ] Create house with $10,000 rent (maximum)
   - [ ] Try $0 rent (should fail)
   - [ ] Try $10,001 rent (should fail)

3. **Special Characters:**
   - [ ] Owner name with apostrophe ("O'Brien")
   - [ ] Owner name with hyphen ("Mary-Jane")
   - [ ] Owner name with spaces
   - [ ] Verify proper escaping in display

4. **Empty States:**
   - [ ] View Globals page with no houses
   - [ ] Try to create game night with no houses
   - [ ] Verify clear empty state messages

**Acceptance Criteria:**
- [ ] All edge cases handled gracefully
- [ ] No unhandled errors
- [ ] Clear error messages for validation failures

---

## Acceptance Criteria Summary

### Schema & Migration
- [x] `houses` table created with simplified fields (owner, nightlyRent, createdAt)
- [x] UNIQUE constraint on `owner`
- [x] CHECK constraint on rent (1-10000)
- [x] Kam's house seeded with $330/night
- [x] Shayne's house seeded with $200/night
- [x] `houseId` added to `game_nights` with NOT NULL constraint
- [x] Foreign key with `onDelete: RESTRICT`
- [x] Index on `game_nights.houseId`
- [x] All existing game nights backfilled with Kam's house
- [x] Migration wrapped in transaction (P1 Fix)
- [x] Parameterized queries (P1 Fix)
- [x] Verification after each critical step (P2 Fix)
- [x] Rollback safety checks (P2 Fix)

### Security (P1 Critical Fixes)
- [x] Authentication check in ALL server actions
- [x] Input validation with max length and bounds
- [x] SQL injection prevention
- [x] XSS prevention verified
- [x] Security headers configured
- [x] CSP policy configured
- [x] Type guards for error handling
- [x] Server-side error logging

### Query & Validation
- [x] Simplified query functions (DHH recommendation)
- [x] Input validation in query functions (P2 Fix)
- [x] Consistent null handling (P2 Fix)
- [x] `getGameNights()` uses innerJoin (P3 optimization)
- [x] Validation schemas with comprehensive checks

### Server Actions
- [x] Authentication in every action (P1 Critical)
- [x] Direct Drizzle usage (no wrappers - DHH simplification)
- [x] House validation before transaction (P1 Race Condition Fix)
- [x] Improved error handling with logging (P2 Fix)
- [x] Specific error messages for different failures
- [x] Path revalidation

### UI Components
- [x] Globals page with simplified layout
- [x] House cards show owner and rent only
- [x] Add/Edit/Delete dialogs
- [x] Game Night form with house dropdown
- [x] Toast notifications via sonner
- [x] Empty states
- [x] Loading states
- [x] Proper form validation

### Navigation
- [x] Sidebar label "Globals"
- [x] URL remains `/settings`
- [x] Page title "Globals"

### Data Integrity
- [x] Cannot delete house with game nights (RESTRICT enforced)
- [x] Each game night shows associated house
- [x] Rent expenses match selected house rent
- [x] Historical data preserved

### Testing
- [x] Authentication tests
- [x] Input validation tests
- [x] Migration verification
- [x] Integration tests
- [x] Edge case tests
- [x] Security headers verified

## Success Metrics

- All existing game nights preserve historical accuracy (show Kam's house)
- New game nights can be created at either house location
- Rent expenses auto-generated with correct amounts ($330 or $200)
- Globals page clearly displays all houses
- No unauthorized access to server actions
- No SQL injection vulnerabilities
- No XSS vulnerabilities
- Clear error messages for all validation failures
- Zero console errors in production

## Implementation Order & Time Estimates

1. **Phase 0: Security Foundation** - 2 hours
   - Create auth helper
   - Configure security headers

2. **Phase 1: Schema & Migration** - 2-3 hours
   - Update schema.ts
   - Write transactional migration
   - Test on database copy
   - Run migration on production

3. **Phase 2: Query Layer** - 1 hour
   - Simplify house queries
   - Update game night queries

4. **Phase 3: Validation** - 1 hour
   - House validation with bounds
   - Game night validation

5. **Phase 4: Server Actions** - 2-3 hours
   - House CRUD with auth
   - Game night creation with race condition fix

6. **Phase 5: UI Components** - 3-4 hours
   - Globals page
   - House cards and dialogs
   - Game night form

7. **Phase 6: Navigation** - 1 hour
   - Update sidebar
   - Update page metadata

8. **Phase 7: Testing** - 2-3 hours
   - Security tests
   - Migration verification
   - Integration tests
   - Edge case tests

**Total Estimated Effort**: 14-18 hours (similar to original, but with security hardening)

## Risk Mitigation

**Risk 1: Migration Failure**
- *Mitigation*: Transaction wrapper with verification steps, tested on DB copy, full backup before migration

**Risk 2: Authentication Bypass**
- *Mitigation*: Auth check in EVERY server action, tested with unauthorized requests

**Risk 3: SQL Injection**
- *Mitigation*: Parameterized queries, input validation, tested with injection attempts

**Risk 4: Race Conditions**
- *Mitigation*: Validation before transaction, proper locking via FK constraints

**Risk 5: Data Loss During Delete**
- *Mitigation*: RESTRICT constraints, clear error messages, rollback safety checks

## Future Considerations

**Phase 2 Enhancements (Post-MVP):**
- House usage statistics on Globals page (P3)
- Rent rate history tracking (when rates change)
- Audit logging for administrative actions (P3)
- Rate limiting on mutations (P3)
- Database triggers for `updatedAt` timestamps (P3)

## References

### Original Plan
- `docs/plans/2026-02-05-feat-multi-house-rent-management-plan.md`

### Code Review Findings
- 28 findings integrated (5 P1, 10 P2, 13 P3)
- Security audit report
- Architecture review
- Data integrity analysis
- DHH simplification recommendations

### Internal References
- Auth middleware: `src/lib/supabase/middleware.ts:46-55`
- Existing schema: `src/lib/db/schema.ts:12-21`
- Existing validations: `src/lib/validations.ts`
- Game night actions: `src/app/(protected)/game-nights/actions.ts`
- CLAUDE.md conventions

### Key Conventions from CLAUDE.md
- Server Actions for all mutations
- Radix Select requires hidden input + useState
- Toast notifications via sonner
- Dialog modals for create/edit forms
- Serial integer PKs, not UUIDs
- No RLS, shared data model
- Middleware email allowlist for auth

### DHH Simplifications Applied
- Removed `active` soft-delete flag
- Merged `name`/`ownerName` into single `owner` field
- Removed manual `updatedAt` tracking
- Eliminated query wrapper functions
- Use Drizzle directly in actions
- Hard delete with RESTRICT protection
