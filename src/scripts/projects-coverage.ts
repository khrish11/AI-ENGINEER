/**
 * `npm run projects:coverage`
 *
 * Reports Phase 6 project coverage across curriculum phases, levels, skills,
 * and career tracks. Deterministic: reads only the on-disk catalog. Writes a
 * JSON + Markdown report to `reports/` for CI diffing.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { occurrences } from "../lib/roadmap/config";
import { ProjectDefinitionSchema, type ProjectDefinition } from "../lib/projects/schema";
import { validateProject } from "../lib/projects/validation";

const CATALOG_DIR = path.resolve(process.cwd(), "projects", "catalog");
const REPORT_DIR = path.resolve(process.cwd(), "reports");

function collectJsonFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collectJsonFiles(full, out);
    else if (entry.isFile() && entry.name.endsWith(".json")) out.push(full);
  }
  return out;
}

function loadProjects(): ProjectDefinition[] {
  if (!fs.existsSync(CATALOG_DIR)) {
    console.error(`projects/catalog directory not found at ${CATALOG_DIR}`);
    process.exit(1);
  }
  const projects: ProjectDefinition[] = [];
  const failures: string[] = [];
  for (const file of collectJsonFiles(CATALOG_DIR).sort()) {
    const relative = path.relative(process.cwd(), file);
    const result = ProjectDefinitionSchema.safeParse(
      JSON.parse(fs.readFileSync(file, "utf8"))
    );
    if (!result.success) {
      failures.push(`${relative}: schema error`);
      continue;
    }
    const validation = validateProject(result.success ? result.data : ({} as ProjectDefinition));
    if (!validation.ok) {
      failures.push(`${relative}: ${validation.issues.map((i) => i.message).join("; ")}`);
      continue;
    }
    projects.push(result.data);
  }
  if (failures.length > 0) {
    for (const failure of failures) console.error(`✗ ${failure}`);
    console.error("Fix catalog errors before generating coverage.");
    process.exit(1);
  }
  return projects;
}

async function main() {
  const projects = loadProjects();

  const phaseSlugs = [...new Set(occurrences.map((o) => o.phaseSlug))].sort();
  const phasesCovered = new Set<string>();
  for (const project of projects) {
    for (const slug of project.phaseSlugs) phasesCovered.add(slug);
  }
  const byLevel: Record<string, number> = {
    beginner: 0,
    intermediate: 0,
    advanced: 0,
    capstone: 0,
  };
  for (const project of projects) byLevel[project.level] += 1;

  const skillCoverage = new Map<string, number>();
  for (const project of projects) {
    for (const skill of project.skills) {
      skillCoverage.set(skill, (skillCoverage.get(skill) ?? 0) + 1);
    }
  }
  const trackCoverage = new Map<string, number>();
  for (const project of projects) {
    for (const track of project.relevantTracks) {
      trackCoverage.set(track, (trackCoverage.get(track) ?? 0) + 1);
    }
  }

  const uncovered = phaseSlugs.filter((slug) => !phasesCovered.has(slug));

  const capstones = projects
    .filter((project) => project.phaseSlugs.includes("19-capstone-projects"))
    .map((project) => project.id);

  const report = {
    generatedAt: new Date().toISOString(),
    totalProjects: projects.length,
    byLevel,
    phases: {
      total: phaseSlugs.length,
      covered: phasesCovered.size,
      uncovered,
      projectsByPhase: Object.fromEntries(
        phaseSlugs.map((slug) => [
          slug,
          projects.filter((project) => project.phaseSlugs.includes(slug)).map((project) => project.id),
        ])
      ) as Record<string, string[]>,
    },
    skills: {
      total: skillCoverage.size,
      bySkill: Object.fromEntries([...skillCoverage.entries()].sort()) as Record<string, number>,
    },
    tracks: {
      total: trackCoverage.size,
      byTrack: Object.fromEntries([...trackCoverage.entries()].sort()) as Record<string, number>,
    },
    capstones,
  };

  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(REPORT_DIR, "project-coverage.json"),
    `${JSON.stringify(report, null, 2)}\n`
  );

  const lines: string[] = [
    "# Phase 6 project coverage",
    "",
    `Total projects: **${report.totalProjects}**`,
    `By level: beginner ${byLevel.beginner} · intermediate ${byLevel.intermediate} · advanced ${byLevel.advanced} · capstone ${byLevel.capstone}`,
    `Phase coverage: **${report.phases.covered}/${report.phases.total}**`,
    uncovered.length > 0 ? `Uncovered phases: ${uncovered.join(", ")}` : "No uncovered phases.",
    "",
    "| Phase | Projects |",
    "| --- | --- |",
    ...phaseSlugs.map(
      (slug) =>
        `| ${slug} | ${
          (report.phases.projectsByPhase[slug] ?? []).join(", ") || "—"
        } |`
    ),
    "",
    `Skills covered: ${report.skills.total}`,
    `Tracks covered: ${report.tracks.total} (${[...trackCoverage.keys()].sort().join(", ")})`,
    "",
    `Capstones: ${capstones.length ? capstones.join(", ") : "none"}`,
  ];
  fs.writeFileSync(path.join(REPORT_DIR, "project-coverage.md"), `${lines.join("\n")}\n`);

  console.log(`Projects: ${report.totalProjects}`);
  console.log(
    `Levels: beginner ${byLevel.beginner}, intermediate ${byLevel.intermediate}, advanced ${byLevel.advanced}, capstone ${byLevel.capstone}`
  );
  console.log(
    uncovered.length > 0
      ? `Phase coverage: ${report.phases.covered}/${report.phases.total} — UNCOVERED: ${uncovered.join(", ")}`
      : `Phase coverage: ${report.phases.covered}/${report.phases.total} (all phases covered).`
  );
  console.log(`Skills: ${report.skills.total} · Tracks: ${report.tracks.total}`);
  if (uncovered.length > 0) {
    console.error("projects:coverage failed: every curriculum phase needs at least one project.");
    process.exit(1);
  }
  console.log(`Report written to reports/project-coverage.{json,md}.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
