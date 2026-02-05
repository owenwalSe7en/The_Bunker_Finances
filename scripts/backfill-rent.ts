/**
 * Backfill rent expenses for existing game nights.
 *
 * Idempotent — safe to run multiple times. Only inserts rent expenses
 * for game nights that don't already have one.
 *
 * Usage: npx tsx scripts/backfill-rent.ts
 */
import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { gameNights, expenses } from "../src/lib/db/schema";
import { eq, and, isNull, sql } from "drizzle-orm";

const HISTORICAL_RENT = "330";

async function main() {
  const client = postgres(process.env.DATABASE_URL!, { prepare: false });
  const db = drizzle(client);

  console.log("Starting rent expense backfill...");

  // Find game nights without a rent expense using a left join
  const nightsNeedingRent = await db
    .select({ id: gameNights.id, date: gameNights.date })
    .from(gameNights)
    .leftJoin(
      expenses,
      and(
        eq(expenses.gameNightId, gameNights.id),
        eq(expenses.category, "rent")
      )
    )
    .where(isNull(expenses.id));

  console.log(`Found ${nightsNeedingRent.length} game nights needing rent expense`);

  if (nightsNeedingRent.length === 0) {
    console.log("Nothing to backfill.");
    await client.end();
    return;
  }

  // Insert rent expenses in a single batch
  const values = nightsNeedingRent.map((night) => ({
    gameNightId: night.id,
    category: "rent" as const,
    description: "Nightly rent (Kam) - backfilled",
    amount: HISTORICAL_RENT,
  }));

  await db.insert(expenses).values(values);

  console.log(`Backfill complete: ${values.length} rent expenses created`);

  // Verify: count game nights vs rent expenses
  const [{ count: totalNights }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(gameNights);
  const [{ count: totalRent }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(expenses)
    .where(eq(expenses.category, "rent"));

  console.log(`Verification: ${totalNights} game nights, ${totalRent} rent expenses`);

  if (Number(totalNights) !== Number(totalRent)) {
    console.warn("WARNING: Mismatch between game nights and rent expenses!");
  } else {
    console.log("All game nights have exactly one rent expense.");
  }

  await client.end();
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
