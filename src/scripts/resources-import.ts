import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config();

import { importCatalog } from "../lib/resources/import";
import { getDbClient } from "../db";

/**
 * Import the declarative catalog into Postgres.
 *
 * Usage:
 *   npm run resources:import
 *   npm run resources:import -- --refresh   # also refresh live provider metadata
 */
async function main() {
  const refresh = process.argv.includes("--refresh");
  console.log("=== Resource Catalog Import ===");
  console.log(`Refresh live metadata: ${refresh}`);

  // Safety gate: verify database ownership before state-changing operations.
  const sql = getDbClient();
  const tableExists = await sql`SELECT to_regclass('public.app_metadata') AS reg`;
  const exists = (tableExists[0] as { reg: string | null }).reg !== null;
  if (!exists) {
    throw new Error(
      "Database ownership marker (app_metadata) not found. Run `npm run db:migrate` first to initialize the AI Engineer OS database."
    );
  }
  const row = await sql`SELECT value FROM app_metadata WHERE key = 'app_name'`;
  const currentApp = (row[0] as { value: string } | undefined)?.value;
  if (currentApp !== "ai-engineer-os") {
    throw new Error(
      `Database ownership mismatch: app_metadata.app_name is "${currentApp ?? "<missing>"}", expected "ai-engineer-os".`
    );
  }

  try {
    const summary = await importCatalog({ refresh });

    console.log("\n=== Import Summary ===");
    console.log(`Resources upserted: ${summary.resources} (${summary.created} created, ${summary.updated} updated)`);
    console.log(`Lesson mappings synced: ${summary.mappings}`);
    console.log(`YouTube metadata: ${summary.youtube}`);
    console.log(`GitHub metadata: ${summary.github}`);
    console.log(`Paper metadata: ${summary.papers}`);

    if (summary.unknownLessonKeys.length > 0) {
      console.warn(`\nUnknown lesson keys (${summary.unknownLessonKeys.length}):`);
      for (const key of summary.unknownLessonKeys) console.warn(`  ${key}`);
    }
    if (summary.warnings.length > 0) {
      console.warn("\nWarnings:");
      for (const warning of summary.warnings) console.warn(`  ${warning}`);
    }
    if (summary.skipped.length > 0) {
      console.warn(`\nSkipped resources: ${summary.skipped.join(", ")}`);
    }

    await getDbClient().end();
    process.exit(0);
  } catch (error) {
    console.error("=== Import Failed ===", error);
    await getDbClient().end();
    process.exit(1);
  }
}

main();
