/**
 * `npm run roadmap:validate`
 *
 * Validates roadmap configuration (metadata, tracks, skills, graph) against the
 * active curriculum in PostgreSQL. Fails with a non-zero exit code on errors.
 */
import "dotenv/config";
import { getDbClient } from "../db/index";
import { validateRoadmapConfig, type CurriculumReference } from "../lib/roadmap/validation";

async function loadCurriculumReference(): Promise<CurriculumReference> {
  const sql = getDbClient();
  const phases = await sql<{ default_slug: string }[]>`
    select default_slug from canonical_phases order by phase_number asc
  `;
  const lessons = await sql<{ current_slug: string }[]>`
    select current_slug from canonical_lessons where is_deprecated = false order by current_slug asc
  `;
  const aliases = await sql<{ alias_slug: string }[]>`
    select alias_slug from lesson_aliases order by alias_slug asc
  `;
  const active = await sql<{ commit_sha: string }[]>`
    select commit_sha from curriculum_revisions where is_active = true limit 1
  `;
  await sql.end();

  return {
    canonicalSlugs: lessons.map((row) => row.current_slug),
    aliasSlugs: aliases.map((row) => row.alias_slug),
    phaseSlugs: phases.map((row) => row.default_slug),
    activeCommit: active[0]?.commit_sha ?? null,
  };
}

async function main() {
  let curriculum: CurriculumReference | undefined;
  try {
    curriculum = await loadCurriculumReference();
  } catch (error) {
    console.warn(
      "Could not reach PostgreSQL; validating configuration without curriculum comparison:",
      error instanceof Error ? error.message : error
    );
  }

  const report = validateRoadmapConfig(curriculum);
  const { stats } = report;

  console.log("Roadmap configuration validation");
  console.log("--------------------------------");
  console.log(`Occurrences:        ${stats.occurrences}`);
  console.log(`Canonical lessons:  ${stats.canonicalLessons}`);
  console.log(`Aliases:            ${stats.aliases}`);
  console.log(`Phases:             ${stats.phases}`);
  console.log(`Tracks:             ${stats.tracks}`);
  console.log(`Skills:             ${stats.skills}`);
  console.log(`Fallback estimates: ${stats.fallbackEstimates}`);
  if (stats.duplicateCanonicalKeys.length > 0) {
    console.log(`Shared identities:  ${stats.duplicateCanonicalKeys.join(", ")}`);
  }

  if (report.warnings.length > 0) {
    console.log(`\nWarnings (${report.warnings.length}):`);
    for (const warning of report.warnings) console.log(`  - ${warning}`);
  }

  if (report.errors.length > 0) {
    console.error(`\nErrors (${report.errors.length}):`);
    for (const error of report.errors) console.error(`  ✗ ${error}`);
    console.error("\nroadmap:validate failed.");
    process.exit(1);
  }

  console.log("\nroadmap:validate passed with no errors.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
