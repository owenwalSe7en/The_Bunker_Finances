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

// Run migration if called directly
if (require.main === module) {
  up()
    .then(() => {
      console.log("✓ Migration successful");
      process.exit(0);
    })
    .catch((error) => {
      console.error("✗ Migration failed:", error);
      process.exit(1);
    });
}
