import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config();

import { importCurriculum } from "../lib/curriculum/importer";
import { getDbClient } from "../db";

async function main() {
  const repoPath = path.resolve(
    process.cwd(),
    process.env.CURRICULUM_LOCAL_PATH || "./upstream/ai-engineering-from-scratch"
  );
  const commitSha =
    process.env.CURRICULUM_PINNED_SHA || "c81651a83aff5f7bf307ffe4392f0d97f3b27ad6";

  console.log("=== AI Engineer OS Curriculum Importer ===");
  console.log(`Source Repo Path: ${repoPath}`);
  console.log(`Target Commit SHA: ${commitSha}`);

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
    const result = await importCurriculum({
      repoPath,
      commitSha,
      versionTag: "pinned-mvp",
    });

    console.log("=== Import Successful ===");
    console.log(`Phases Imported: ${result.phaseCount}`);
    console.log(`Lessons Imported: ${result.lessonCount}`);
    console.log(`Quizzes Ingested: ${result.quizCount}`);
    console.log(`Code Files Cataloged: ${result.codeFilesCount}`);
    console.log(`Idempotent Execution: ${result.isIdempotentRun}`);
    console.log(`Duration: ${result.durationMs}ms`);

    await getDbClient().end();
    process.exit(0);
  } catch (error) {
    console.error("=== Import Failed ===", error);
    await getDbClient().end();
    process.exit(1);
  }
}

main();
