import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config();

import { db, getDbClient } from "../db";
import { canonicalLessons, canonicalPhases, lessonResources, resources } from "../db/schema";
import { eq } from "drizzle-orm";
import {
  computeCoverage,
  type CoverageLesson,
  type CoverageMapping,
} from "../lib/resources/coverage";
import type {
  EditorialStatus,
  ResourceRole,
  ResourceType,
  VerificationStatus,
} from "../lib/resources/types";

/**
 * Compute resource coverage across the curriculum and write machine- and
 * human-readable reports to `reports/`.
 *
 * Usage: npm run resources:coverage
 */
async function main() {
  console.log("=== Resource Coverage Report ===");

  const lessonRows = await db
    .select({
      lessonId: canonicalLessons.id,
      lessonSlug: canonicalLessons.currentSlug,
      phaseSlug: canonicalPhases.defaultSlug,
      phaseNumber: canonicalPhases.phaseNumber,
    })
    .from(canonicalLessons)
    .innerJoin(canonicalPhases, eq(canonicalLessons.canonicalPhaseId, canonicalPhases.id));

  const mappingRows = await db
    .select({
      lessonId: lessonResources.lessonId,
      resourceType: resources.resourceType,
      resourceRole: lessonResources.resourceRole,
      verificationStatus: resources.verificationStatus,
      editorialStatus: resources.editorialStatus,
    })
    .from(lessonResources)
    .innerJoin(resources, eq(lessonResources.resourceId, resources.id));

  const lessons: CoverageLesson[] = lessonRows.map((r) => ({
    lessonId: r.lessonId,
    phaseSlug: r.phaseSlug,
    phaseNumber: r.phaseNumber,
    title: r.lessonSlug,
  }));

  const mappings: CoverageMapping[] = mappingRows.map((r) => ({
    lessonId: r.lessonId,
    resourceType: r.resourceType as ResourceType,
    resourceRole: r.resourceRole as ResourceRole,
    verificationStatus: r.verificationStatus as VerificationStatus,
    editorialStatus: r.editorialStatus as EditorialStatus,
  }));

  const report = computeCoverage(lessons, mappings);

  const reportsDir = path.resolve(process.cwd(), "reports");
  fs.mkdirSync(reportsDir, { recursive: true });
  fs.writeFileSync(
    path.join(reportsDir, "resource-coverage.json"),
    JSON.stringify(report, null, 2),
    "utf8"
  );

  const lines: string[] = [];
  lines.push("# Resource Coverage Report");
  lines.push("");
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push("");
  lines.push(`- Total lessons: ${report.totalLessons}`);
  lines.push(`- Lessons with resources: ${report.lessonsWithResources} (${report.coveragePct}%)`);
  lines.push(`- Lessons without video: ${report.lessonsWithoutVideo}`);
  lines.push(`- Lessons without practical resource: ${report.lessonsWithoutPractical}`);
  lines.push(`- Lessons without primary resource: ${report.lessonsWithoutPrimary}`);
  lines.push(`- Lessons without reference resource: ${report.lessonsWithoutReference}`);
  lines.push(`- Total resource links: ${report.totalResources}`);
  lines.push("");
  lines.push("## By phase");
  lines.push("");
  lines.push("| Phase | Lessons | With resources | Coverage | No video | No practical |");
  lines.push("| ----- | ------: | -------------: | -------: | -------: | -----------: |");
  for (const phase of report.coverageByPhase) {
    lines.push(
      `| ${phase.phaseNumber} ${phase.phaseSlug} | ${phase.totalLessons} | ${phase.lessonsWithResources} | ${phase.coveragePct}% | ${phase.lessonsWithoutVideo} | ${phase.lessonsWithoutPractical} |`
    );
  }
  lines.push("");
  lines.push("## By resource type");
  lines.push("");
  for (const [type, count] of Object.entries(report.byType).sort((a, b) => b[1] - a[1])) {
    lines.push(`- ${type}: ${count}`);
  }
  lines.push("");
  lines.push("## Verification status");
  lines.push("");
  for (const [status, count] of Object.entries(report.verification)) {
    lines.push(`- ${status}: ${count}`);
  }
  lines.push("");
  fs.writeFileSync(path.join(reportsDir, "resource-coverage.md"), lines.join("\n"), "utf8");

  console.log(
    `Coverage: ${report.lessonsWithResources}/${report.totalLessons} lessons (${report.coveragePct}%)`
  );
  console.log(`Reports written to reports/resource-coverage.{json,md}`);

  await getDbClient().end();
  process.exit(0);
}

main().catch(async (error) => {
  console.error("Coverage failed:", error);
  try {
    await getDbClient().end();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
