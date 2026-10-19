import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { canonicalOccurrences, occurrences } from "../lib/roadmap/config";

async function main() {
  const duplicateContentHashes = [...canonicalOccurrences.entries()]
    .filter(([, entries]) => entries.length > 1)
    .map(([canonicalLessonKey, entries]) => ({
      canonicalLessonKey,
      occurrenceIds: entries.map((entry) => entry.occurrenceId),
    }));

  const occurrenceKeys = new Set(occurrences.map((entry) => entry.occurrenceId));
  const missingCanonicalKeys = occurrences
    .filter((entry) => !occurrenceKeys.has(entry.canonicalLessonKey))
    .map((entry) => ({
      occurrenceId: entry.occurrenceId,
      canonicalLessonKey: entry.canonicalLessonKey,
    }));

  const report = {
    generatedAt: new Date().toISOString(),
    source: "roadmaps/metadata/lesson-metadata.json",
    occurrences: occurrences.length,
    canonicalLessons: new Set(occurrences.map((entry) => entry.canonicalLessonKey)).size,
    duplicateCanonicalIdentities: duplicateContentHashes,
    missingCanonicalKeys,
    resolvedSplits: [
      {
        originalCanonicalLessonKey: "07-transformers-deep-dive/09-vision-transformers",
        newCanonicalLessonKey: "04-computer-vision/14-vision-transformers",
        reason: "Distinct curriculum locations share content but represent separate lessons.",
      },
    ],
  };

  await mkdir(path.resolve("reports"), { recursive: true });
  await writeFile(
    path.resolve("reports/curriculum-identity-audit.json"),
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8"
  );
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
