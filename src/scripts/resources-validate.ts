import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config();

import { buildLessonIndexFromUpstream, detectDuplicates, loadCatalog } from "../lib/resources/catalog";

/**
 * Validate the declarative resource catalog.
 *
 * Checks (no network, no database required):
 *   1. Every file parses and satisfies the catalog schema.
 *   2. No duplicate resource ids.
 *   3. No two resources resolve to the same canonical URL.
 *   4. Every `associated_lessons` key exists in the upstream curriculum.
 *
 * Exits non-zero if any error is found so it can gate CI.
 */
async function main() {
  console.log("=== Resource Catalog Validation ===");
  const { resources, issues, files } = loadCatalog();
  const repoPath = path.resolve(
    process.cwd(),
    process.env.CURRICULUM_LOCAL_PATH || "./upstream/ai-engineering-from-scratch"
  );
  const validLessons = buildLessonIndexFromUpstream(repoPath);

  console.log(`Files scanned: ${files.length}`);
  console.log(`Resources parsed: ${resources.length}`);

  const duplicates = detectDuplicates(resources);

  const unknownLessons: string[] = [];
  if (validLessons.size > 0) {
    for (const { resource } of resources) {
      for (const link of resource.associated_lessons) {
        if (!validLessons.has(link.lesson)) {
          unknownLessons.push(`${resource.id} -> ${link.lesson}`);
        }
      }
    }
  } else {
    console.warn(
      "Warning: upstream curriculum not found; skipping lesson-key existence checks."
    );
  }

  let errors = 0;
  if (issues.length > 0) {
    errors += issues.length;
    console.error(`\nSchema errors (${issues.length}):`);
    for (const issue of issues) {
      console.error(`  ${issue.file} [${issue.path}] ${issue.message}`);
    }
  }
  if (duplicates.duplicateKeys.length > 0) {
    errors += duplicates.duplicateKeys.length;
    console.error(`\nDuplicate resource ids (${duplicates.duplicateKeys.length}):`);
    for (const dup of duplicates.duplicateKeys) {
      console.error(`  ${dup.id} in ${dup.files.join(", ")}`);
    }
  }
  if (duplicates.duplicateUrls.length > 0) {
    errors += duplicates.duplicateUrls.length;
    console.error(`\nDuplicate canonical URLs (${duplicates.duplicateUrls.length}):`);
    for (const dup of duplicates.duplicateUrls) {
      console.error(`  ${dup.ids.join(", ")} (${dup.files.join(", ")})`);
    }
  }
  if (unknownLessons.length > 0) {
    errors += unknownLessons.length;
    console.error(`\nUnknown lesson keys (${unknownLessons.length}):`);
    for (const entry of unknownLessons) console.error(`  ${entry}`);
  }

  if (errors > 0) {
    console.error(`\nValidation FAILED with ${errors} error(s).`);
    process.exit(1);
  }

  const lessonLinks = resources.reduce(
    (sum, r) => sum + r.resource.associated_lessons.length,
    0
  );
  console.log(`Lesson links: ${lessonLinks}`);
  console.log("Validation passed.");
  process.exit(0);
}

main().catch((error) => {
  console.error("Validation crashed:", error);
  process.exit(1);
});
