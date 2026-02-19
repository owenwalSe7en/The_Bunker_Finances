// Load environment variables BEFORE any imports
require("dotenv").config({ path: require("path").resolve(process.cwd(), ".env.local") });

// Now import and run migration
const { up } = require("./migrate-add-houses");

up()
  .then(() => {
    console.log("✓ Migration completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("✗ Migration failed:", error);
    process.exit(1);
  });
