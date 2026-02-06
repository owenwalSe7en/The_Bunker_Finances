// Load environment variables BEFORE any imports
require("dotenv").config({ path: require("path").resolve(process.cwd(), ".env.local") });

import { db } from "../src/lib/db";
import { sql } from "drizzle-orm";

async function verify() {
  console.log("Verifying migration...\n");

  // 1. Verify houses table
  console.log("1. Checking houses table:");
  const housesResult = await db.execute(sql`SELECT * FROM houses ORDER BY id`);
  console.log(`   Found ${housesResult.length} houses:`);
  housesResult.forEach((house: any) => {
    console.log(`   - ID ${house.id}: ${house.owner} ($${house.nightly_rent})`);
  });

  // 2. Verify all game nights have house_id
  console.log("\n2. Checking for NULL house_id in game_nights:");
  const nullCheck = await db.execute(sql`SELECT COUNT(*) as count FROM game_nights WHERE house_id IS NULL`);
  console.log(`   NULL house_ids: ${nullCheck[0].count}`);

  // 3. Verify foreign key constraint
  console.log("\n3. Checking foreign key integrity:");
  const fkCheck = await db.execute(sql`
    SELECT COUNT(*)
    FROM game_nights gn
    LEFT JOIN houses h ON gn.house_id = h.id
    WHERE h.id IS NULL
  `);
  console.log(`   Orphaned game nights: ${fkCheck[0].count}`);

  // 4. Verify index exists
  console.log("\n4. Checking index:");
  const indexCheck = await db.execute(sql`
    SELECT indexname FROM pg_indexes
    WHERE tablename = 'game_nights' AND indexname = 'game_nights_house_id_idx'
  `);
  console.log(`   Index exists: ${indexCheck.length > 0 ? '✓' : '✗'}`);

  // 5. Verify unique constraint on houses
  console.log("\n5. Checking unique constraint on houses.owner:");
  const uniqueCheck = await db.execute(sql`
    SELECT COUNT(*) FROM houses WHERE owner = 'Kam'
  `);
  console.log(`   Kam's houses count (should be 1): ${uniqueCheck[0].count}`);

  console.log("\n✓ Migration verification complete!");
  process.exit(0);
}

verify().catch((error) => {
  console.error("Verification failed:", error);
  process.exit(1);
});
