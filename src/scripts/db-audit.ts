import "dotenv/config";
import { getDbClient } from "../db";

type Finding = { check: string; count: number; detail: string };

async function main() {
  const sql = getDbClient();
  const queries: Array<{ check: string; detail: string; query: () => Promise<{ count: number }[]> }> = [
    {
      check: "lesson_revisions",
      detail: "records reference unknown canonical lessons",
      query: () =>
        sql`SELECT count(*)::int AS count FROM lesson_revisions r LEFT JOIN canonical_lessons l ON l.id = r.canonical_lesson_id WHERE l.id IS NULL`,
    },
    {
      check: "lesson_resources",
      detail: "records reference unknown lessons or resources",
      query: () =>
        sql`SELECT count(*)::int AS count FROM lesson_resources m LEFT JOIN canonical_lessons l ON l.id = m.lesson_id LEFT JOIN resources r ON r.id = m.resource_id WHERE l.id IS NULL OR r.id IS NULL`,
    },
    {
      check: "lesson_aliases",
      detail: "duplicate alias slugs exist",
      query: () =>
        sql`SELECT count(*)::int AS count FROM (SELECT alias_slug FROM lesson_aliases GROUP BY alias_slug HAVING count(*) > 1) duplicates`,
    },
    {
      check: "user_lesson_progress",
      detail: "records reference unknown canonical lessons",
      query: () =>
        sql`SELECT count(*)::int AS count FROM user_lesson_progress p LEFT JOIN canonical_lessons l ON concat((SELECT default_slug FROM canonical_phases WHERE id = l.canonical_phase_id), '/', l.current_slug) = p.lesson_key WHERE l.id IS NULL`,
    },
    {
      check: "project_progress",
      detail: "records reference unknown projects",
      query: () =>
        sql`SELECT count(*)::int AS count FROM project_progress WHERE project_id IS NULL`,
    },
    {
      check: "project_evidence",
      detail: "records reference unknown project progress",
      query: () =>
        sql`SELECT count(*)::int AS count FROM project_evidence e LEFT JOIN project_progress p ON p.user_id = e.user_id AND p.project_id = e.project_id WHERE p.id IS NULL`,
    },
  ];

  const findings: Finding[] = [];
  for (const item of queries) {
    const rows = await item.query();
    const count = Number(rows[0]?.count ?? 0);
    if (count > 0) findings.push({ check: item.check, count, detail: item.detail });
  }
  await sql.end();

  if (findings.length > 0) {
    for (const finding of findings) {
      console.error(`${finding.check}: ${finding.count} ${finding.detail}`);
    }
    process.exitCode = 1;
    return;
  }
  console.log("Database integrity audit passed with no findings.");
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
