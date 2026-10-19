/**
 * `npm run projects:validate`
 *
 * Validates the on-disk project catalog (`projects/catalog/phase/*.json`) against
 * the Phase 6 project schema and cross-reference validation (phase slugs,
 * occurrences, skills, tracks, URL allowlist, secret scan). Contributors use
 * this gate after adding a project JSON file.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { ProjectDefinitionSchema, type ProjectDefinition } from "../lib/projects/schema";
import { validateProject } from "../lib/projects/validation";

const CATALOG_DIR = path.resolve(process.cwd(), "projects", "catalog");

interface ParsedFile {
  file: string;
  raw: unknown;
}

function collectJsonFiles(dir: string, out: string[] = []): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collectJsonFiles(full, out);
    else if (entry.isFile() && entry.name.endsWith(".json")) out.push(full);
  }
  return out;
}

function main() {
  if (!fs.existsSync(CATALOG_DIR)) {
    console.error(`projects/catalog directory not found at ${CATALOG_DIR}`);
    process.exit(1);
  }

  const files = collectJsonFiles(CATALOG_DIR).sort();
  const parsed: ParsedFile[] = [];
  const schemaFailures: string[] = [];
  const seenIds = new Map<string, string>();
  const seenSlugs = new Map<string, string>();
  const duplicateIds: string[] = [];
  const duplicateSlugs: string[] = [];

  for (const file of files) {
    const relative = path.relative(process.cwd(), file);
    let raw: unknown;
    try {
      raw = JSON.parse(fs.readFileSync(file, "utf8"));
    } catch (error) {
      schemaFailures.push(`${relative}: invalid JSON (${error instanceof Error ? error.message : error})`);
      continue;
    }
    const result = ProjectDefinitionSchema.safeParse(raw);
    if (!result.success) {
      const details = result.error.errors
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ");
      schemaFailures.push(`${relative}: ${details}`);
      continue;
    }
    parsed.push({ file: relative, raw: result.data });
  }

  const validationIssues: string[] = [];
  const projects: ProjectDefinition[] = [];
  for (const entry of parsed) {
    const project = entry.raw as ProjectDefinition;
    const previousId = seenIds.get(project.id);
    if (previousId) duplicateIds.push(`${project.id} in ${previousId} and ${entry.file}`);
    seenIds.set(project.id, entry.file);
    const previousSlug = seenSlugs.get(project.slug);
    if (previousSlug) duplicateSlugs.push(`${project.slug} in ${previousSlug} and ${entry.file}`);
    seenSlugs.set(project.slug, entry.file);

    const validation = validateProject(project);
    if (!validation.ok) {
      for (const issue of validation.issues) {
        validationIssues.push(`${entry.file} (${project.id}) → ${issue.field}: ${issue.message}`);
      }
      continue;
    }
    projects.push(project);
  }

  const rubricIssues: string[] = [];
  for (const project of projects) {
    if (project.level !== "beginner" && !project.rubric) rubricIssues.push(`${project.id}: missing rubric`);
    if (project.rubric) {
      const total = project.rubric.categories.reduce((sum, c) => sum + c.weight, 0);
      if (total !== 100) rubricIssues.push(`${project.id}: rubric weights total ${total}, expected 100`);
    }
  }

  console.log("Project catalog validation");
  console.log("--------------------------");
  console.log(`Files scanned:   ${files.length}`);
  console.log(`Valid projects:  ${projects.length}`);
  const byLevel = new Map<string, number>();
  for (const project of projects) {
    byLevel.set(project.level, (byLevel.get(project.level) ?? 0) + 1);
  }
  for (const level of ["beginner", "intermediate", "advanced", "capstone"]) {
    console.log(`  ${level}: ${byLevel.get(level) ?? 0}`);
  }

  const failures = [
    ...schemaFailures.map((f) => ({ kind: "schema", text: f })),
    ...validationIssues.map((t) => ({ kind: "cross-reference", text: t })),
    ...rubricIssues.map((t) => ({ kind: "rubric", text: t })),
    ...duplicateIds.map((t) => ({ kind: "duplicate id", text: t })),
    ...duplicateSlugs.map((t) => ({ kind: "duplicate slug", text: t })),
  ];

  if (failures.length > 0) {
    console.error(`\nErrors (${failures.length}):`);
    for (const failure of failures) console.error(`  ✗ [${failure.kind}] ${failure.text}`);
    console.error("\nprojects:validate failed.");
    process.exit(1);
  }

  console.log("\nprojects:validate passed with no errors.");
}

main();
