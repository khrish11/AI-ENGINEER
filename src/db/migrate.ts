import { migrate } from "drizzle-orm/postgres-js/migrator";
import { db, getDbClient } from "./index";
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

dotenv.config({ path: ".env.local" });
dotenv.config();

const MIGRATIONS_FOLDER = path.resolve(process.cwd(), "src/db/migrations");
const JOURNAL_PATH = path.resolve(MIGRATIONS_FOLDER, "meta/_journal.json");

async function verifyMigrationConfig(): Promise<void> {
  // Verify migration folder exists and has SQL files
  if (!fs.existsSync(MIGRATIONS_FOLDER)) {
    throw new Error(`Migrations folder not found: ${MIGRATIONS_FOLDER}`);
  }

  // Verify journal exists and is valid
  if (!fs.existsSync(JOURNAL_PATH)) {
    throw new Error(`Migration journal not found: ${JOURNAL_PATH}`);
  }

  const journalContent = fs.readFileSync(JOURNAL_PATH, "utf-8");
  const journal = JSON.parse(journalContent);

  if (!journal.entries || !Array.isArray(journal.entries)) {
    throw new Error("Invalid migration journal: entries array not found");
  }

  // Verify each journal entry has a corresponding SQL file
  for (const entry of journal.entries) {
    const sqlFile = path.resolve(MIGRATIONS_FOLDER, `${entry.tag}.sql`);
    if (!fs.existsSync(sqlFile)) {
      throw new Error(`Migration SQL file not found for journal entry: ${entry.tag}.sql`);
    }
  }

  // Verify no orphan SQL files without journal entries
  const sqlFiles = fs.readdirSync(MIGRATIONS_FOLDER).filter(f => f.endsWith(".sql"));
  const journalTags = new Set(journal.entries.map((e: any) => e.tag));
  const orphanFiles = sqlFiles.filter(f => !journalTags.has(f.replace(".sql", "")));

  if (orphanFiles.length > 0) {
    throw new Error(`Orphan SQL files without journal entries: ${orphanFiles.join(", ")}`);
  }

  console.log(`Migration config verified: ${journal.entries.length} migrations in journal`);
}

async function verifyDatabaseSchema(sql: ReturnType<typeof getDbClient>): Promise<void> {
  // Verify users table exists (core schema requirement)
  const usersExists = await sql`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'users'
    ) AS exists
  `;

  if (!(usersExists[0] as { exists: boolean }).exists) {
    throw new Error(
      "Database schema verification failed: users table does not exist. " +
      "This does not appear to be the AI Engineer OS production database."
    );
  }

  // Verify Drizzle migrations table exists
  const migrationsTableExists = await sql`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'drizzle' AND table_name = '__drizzle_migrations'
    ) AS exists
  `;

  if (!(migrationsTableExists[0] as { exists: boolean }).exists) {
    throw new Error(
      "Database schema verification failed: drizzle.__drizzle_migrations table does not exist. " +
      "This database has not been migrated with Drizzle."
    );
  }

  // Verify at least one prior migration has been applied
  const migrationCount = await sql`
    SELECT COUNT(*)::int AS count FROM drizzle.__drizzle_migrations
  `;

  const count = (migrationCount[0] as { count: number }).count;
  if (count === 0) {
    throw new Error(
      "Database schema verification failed: no prior migrations found in drizzle.__drizzle_migrations. " +
      "This database has not been migrated with Drizzle."
    );
  }

  console.log(`Database schema verified: users table exists, ${count} prior migrations applied`);
}

async function verifyMigrationHistory(sql: ReturnType<typeof getDbClient>): Promise<void> {
  const journal = JSON.parse(fs.readFileSync(JOURNAL_PATH, "utf-8"));
  const journalEntries = journal.entries.map((e: any) => e.tag);

  const appliedMigrations = await sql`
    SELECT hash FROM drizzle.__drizzle_migrations
  `;

  if (appliedMigrations.length === 0) {
    throw new Error("No migrations found in drizzle.__drizzle_migrations");
  }

  // Verify the last applied migration matches the expected journal order
  // Drizzle stores migrations by hash, not tag, so we can't directly verify tags
  // Instead, we verify the count matches (allowing for pending migrations)
  const appliedCount = appliedMigrations.length;
  const journalCount = journalEntries.length;

  if (appliedCount > journalCount) {
    throw new Error(
      `Migration history mismatch: database has ${appliedCount} applied migrations, ` +
      `but journal only has ${journalCount} entries. ` +
      `This indicates schema drift or corruption.`
    );
  }

  if (appliedCount === 0) {
    throw new Error("No migrations applied to database");
  }

  // Verify pending migrations are expected (last journal entry should be pending if not all applied)
  const pendingCount = journalCount - appliedCount;
  console.log(`Migration history verified: ${appliedCount} applied, ${pendingCount} pending`);
}

async function acquireMigrationLock(sql: ReturnType<typeof getDbClient>): Promise<void> {
  // Use PostgreSQL advisory lock to prevent concurrent migrations
  const lockKey = 123456789; // Arbitrary unique key for AI Engineer OS migrations

  const lockResult = await sql`
    SELECT pg_try_advisory_lock(${lockKey}) AS acquired
  `;

  if (!(lockResult[0] as { acquired: boolean }).acquired) {
    throw new Error(
      "Another migration is already running. " +
      "Please wait for it to complete before starting a new migration."
    );
  }

  console.log("Migration lock acquired");

  // Register cleanup to release lock on process exit
  process.on("exit", async () => {
    try {
      await sql`
        SELECT pg_advisory_unlock(${lockKey})
      `;
    } catch (e) {
      // Ignore errors during cleanup
    }
  });
}

async function releaseMigrationLock(sql: ReturnType<typeof getDbClient>): Promise<void> {
  const lockKey = 123456789;
  await sql`
    SELECT pg_advisory_unlock(${lockKey})
  `;
  console.log("Migration lock released");
}

export async function runMigrations() {
  console.log("Running Drizzle migrations against PostgreSQL database...");
  const sql = getDbClient();

  try {
    // Step 1: Verify migration configuration
    await verifyMigrationConfig();

    // Step 2: Acquire migration lock to prevent concurrent execution
    await acquireMigrationLock(sql);

    try {
      // Step 3: Verify database schema and identity
      await verifyDatabaseSchema(sql);

      // Step 4: Verify migration history consistency
      await verifyMigrationHistory(sql);

      // Step 5: Run migrations
      const migrationsFolder = path.resolve(process.cwd(), "src/db/migrations");
      await migrate(db, { migrationsFolder });

      console.log("Migrations applied successfully.");

      // Step 6: Verify post-migration state
      await verifyDatabaseSchema(sql);

      return { success: true };
    } finally {
      // Step 7: Release migration lock
      await releaseMigrationLock(sql);
    }
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
