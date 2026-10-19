import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config();

import { db, getDbClient } from "../db";
import { resources, resourceVerifications } from "../db/schema";
import { eq, inArray } from "drizzle-orm";
import { loadCatalog } from "../lib/resources/catalog";
import { mapWithRateLimit, probeResource } from "../lib/resources/providers";
import type { ResourceType, VerificationStatus } from "../lib/resources/types";

/**
 * Audit external resource health.
 *
 * Usage:
 *   npm run resources:audit                       # all catalog resources
 *   npm run resources:audit -- --type youtube_video
 *   npm run resources:audit -- --only nano-gpt-video,scikit-learn-docs
 *   npm run resources:audit -- --dry-run           # probe but do not write
 *
 * This is the ONLY place external providers are contacted. The web app reads
 * cached results from `resource_verifications`.
 */
interface AuditRow {
  resourceKey: string;
  type: ResourceType;
  url: string;
  status: VerificationStatus;
  httpStatus?: number;
  note: string;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const typeIndex = args.indexOf("--type");
  const onlyIndex = args.indexOf("--only");
  return {
    type: typeIndex >= 0 ? args[typeIndex + 1] : undefined,
    only:
      onlyIndex >= 0 && args[onlyIndex + 1]
        ? args[onlyIndex + 1].split(",").map((s) => s.trim()).filter(Boolean)
        : undefined,
    dryRun: args.includes("--dry-run"),
  };
}

async function main() {
  const { type, only, dryRun } = parseArgs();
  console.log("=== Resource Audit ===");

  const { resources: loaded, issues } = loadCatalog();
  if (issues.length > 0) {
    console.error(`Catalog has ${issues.length} schema error(s); run resources:validate first.`);
    process.exit(1);
  }

  let targets = loaded;
  if (type) targets = targets.filter((t) => t.resource.type === type);
  if (only) targets = targets.filter((t) => only.includes(t.resource.id));

  console.log(`Resources to audit: ${targets.length}${dryRun ? " (dry run)" : ""}`);

  const dbRows = dryRun
    ? new Map<string, string>()
    : new Map(
        (
          await db
            .select({ id: resources.id, resourceKey: resources.resourceKey })
            .from(resources)
            .where(inArray(resources.resourceKey, targets.map((t) => t.resource.id)))
        ).map((r) => [r.resourceKey, r.id])
      );

  const rows: AuditRow[] = await mapWithRateLimit(
    targets,
    async ({ resource }) => {
      const probe = await probeResource(resource.canonical_url, resource.type);
      return {
        resourceKey: resource.id,
        type: resource.type,
        url: resource.canonical_url,
        status: probe.status,
        httpStatus: probe.httpStatus,
        note: probe.notes,
      };
    },
    3,
    300
  );

  for (const row of rows) {
    const mark =
      row.status === "reachable" || row.status === "verified"
        ? "OK "
        : row.status === "unavailable"
        ? "ERR"
        : "WARN";
    console.log(`[${mark}] ${row.resourceKey} (${row.type}) -> ${row.status}${row.httpStatus ? ` (${row.httpStatus})` : ""}`);
    if (mark !== "OK ") console.log(`      ${row.note}`);
  }

  const counts: Record<string, number> = {};
  for (const row of rows) counts[row.status] = (counts[row.status] ?? 0) + 1;
  console.log("\n=== Summary ===");
  for (const [status, count] of Object.entries(counts)) {
    console.log(`  ${status}: ${count}`);
  }

  if (!dryRun) {
    let written = 0;
    for (const row of rows) {
      const resourceId = dbRows.get(row.resourceKey);
      if (!resourceId) continue;
      await db
        .update(resources)
        .set({
          verificationStatus: row.status,
          verificationNotes: row.note,
          updatedAt: new Date(),
        })
        .where(eq(resources.id, resourceId));
      await db.insert(resourceVerifications).values({
        resourceId,
        checkType: "http_head",
        status: row.status,
        httpStatus: row.httpStatus ?? null,
        details: { source: "resources:audit", resourceKey: row.resourceKey },
      });
      written += 1;
    }
    console.log(`\nVerification rows written: ${written}`);
  }

  await getDbClient().end();
  process.exit(0);
}

main().catch(async (error) => {
  console.error("Audit crashed:", error);
  try {
    await getDbClient().end();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
