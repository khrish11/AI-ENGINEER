import { migrate } from "drizzle-orm/postgres-js/migrator";
import { db, getDbClient } from "./index";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: ".env.local" });
dotenv.config();

const APP_NAME = "ai-engineer-os";

async function ensureAppMetadataMarker(sql: ReturnType<typeof getDbClient>): Promise<void> {
  // Check whether the app_metadata ownership table already exists.
  const tableExists = await sql`
    SELECT to_regclass('public.app_metadata') AS reg
  `;
  const exists = (tableExists[0] as { reg: string | null }).reg !== null;

  if (!exists) {
    // Fresh database: create the ownership marker before running migrations.
    await sql`
      CREATE TABLE IF NOT EXISTS app_metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`
      INSERT INTO app_metadata (key, value)
      VALUES ('app_name', ${APP_NAME})
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
    `;
    console.log(`App ownership marker created: app_name = ${APP_NAME}`);
    return;
  }

  // Existing database: verify we are not running against an unrelated database.
  const row = await sql`
    SELECT value FROM app_metadata WHERE key = 'app_name'
  `;
  const currentApp = (row[0] as { value: string } | undefined)?.value;

  if (currentApp !== APP_NAME) {
    const found = currentApp ?? "<missing>";
    throw new Error(
      `Database ownership mismatch: app_metadata.app_name is "${found}", expected "${APP_NAME}". ` +
        `Refusing to run AI Engineer OS migrations against an unrelated database.`
    );
  }
}

export async function runMigrations() {
  console.log("Running Drizzle migrations against PostgreSQL database...");
  const sql = getDbClient();

  // Safety gate: verify database ownership before any state-changing operations.
  await ensureAppMetadataMarker(sql);

  const migrationsFolder = path.resolve(process.cwd(), "src/db/migrations");
  try {
    await migrate(db, { migrationsFolder });
    console.log("Migrations applied successfully.");
    return { success: true };
  } catch (error) {
    console.error("Migration error:", error);
    throw error;
  }
}

if (require.main === module) {
  runMigrations()
    .then(() => {
      console.log("Database schema is ready.");
      getDbClient().end();
      process.exit(0);
    })
    .catch((err) => {
      console.error("Failed to migrate:", err);
      getDbClient().end();
      process.exit(1);
    });
}
