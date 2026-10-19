/**
 * `npm run assessments:validate`
 *
 * Validates the on-disk assessment catalog (`assessments/catalog/*.json`)
 * against the Phase 6 assessment schema and cross-reference validation
 * (phase slugs, occurrences, skills, per-type answer keys). Fails with a
 * non-zero exit code on errors.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { AssessmentSchema, type Assessment } from "../lib/assessments/schema";
import { validateAssessment } from "../lib/assessments/validation";

const CATALOG_DIR = path.resolve(process.cwd(), "assessments", "catalog");

function main() {
  if (!fs.existsSync(CATALOG_DIR)) {
    console.error(`assessments/catalog directory not found at ${CATALOG_DIR}`);
    process.exit(1);
  }

  const files = fs
    .readdirSync(CATALOG_DIR)
    .filter((name) => name.endsWith(".json"))
    .sort();

  const schemaFailures: string[] = [];
  const validationIssues: string[] = [];
  const assessments: Assessment[] = [];
  const seenIds = new Map<string, string>();
  const duplicates: string[] = [];
  const questionsByType: Record<string, number> = {
    single_choice: 0,
    multiple_choice: 0,
    true_false: 0,
    ordering: 0,
    short_answer: 0,
  };

  for (const name of files) {
    const relative = path.join("assessments", "catalog", name);
    let raw: unknown;
    try {
      raw = JSON.parse(fs.readFileSync(path.join(CATALOG_DIR, name), "utf8"));
    } catch (error) {
      schemaFailures.push(`${relative}: invalid JSON (${error instanceof Error ? error.message : error})`);
      continue;
    }
    const parse = AssessmentSchema.safeParse(raw);
    if (!parse.success) {
      const details = parse.error.errors
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ");
      schemaFailures.push(`${relative}: ${details}`);
      continue;
    }
    const previous = seenIds.get(parse.data.id);
    if (previous) duplicates.push(`${parse.data.id} in ${previous} and ${relative}`);
    seenIds.set(parse.data.id, relative);

    const validation = validateAssessment(parse.data);
    if (!validation.ok) {
      for (const issue of validation.issues) {
        validationIssues.push(`${relative} (${parse.data.id}) → ${issue.field}: ${issue.message}`);
      }
      continue;
    }
    for (const question of parse.data.questions) {
      questionsByType[question.type] += 1;
    }
    assessments.push(parse.data);
  }

  console.log("Assessment catalog validation");
  console.log("----------------------------");
  console.log(`Files scanned:      ${files.length}`);
  console.log(`Valid assessments:  ${assessments.length}`);
  console.log(`Total questions:    ${Object.values(questionsByType).reduce((a, b) => a + b, 0)}`);
  for (const [type, count] of Object.entries(questionsByType)) {
    console.log(`  ${type}: ${count}`);
  }

  const failures = [
    ...schemaFailures.map((text) => ({ kind: "schema", text })),
    ...validationIssues.map((text) => ({ kind: "cross-reference", text })),
    ...duplicates.map((text) => ({ kind: "duplicate id", text })),
  ];

  if (failures.length > 0) {
    console.error(`\nErrors (${failures.length}):`);
    for (const failure of failures) console.error(`  ✗ [${failure.kind}] ${failure.text}`);
    console.error("\nassessments:validate failed.");
    process.exit(1);
  }

  console.log("\nassessments:validate passed with no errors.");
}

main();
