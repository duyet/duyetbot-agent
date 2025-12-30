import { config } from "dotenv";
import { migrate } from "drizzle-orm/d1/migrator";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

config({
  path: ".env.local",
});

const runMigrate = async () => {
  // For local development with wrangler, migrations are handled by wrangler d1 migrations apply
  // This file is kept for compatibility but may not be needed in production with D1
  console.log("⏭️  D1 migrations are handled by Wrangler CLI");
  console.log("   Use: bun run db:migrate");
  process.exit(0);
};

runMigrate().catch((err) => {
  console.error("❌ Migration check failed");
  console.error(err);
  process.exit(1);
});
