import * as fs from "fs";
import * as path from "path";
import { validateCatalogFile, type SchemaIssue } from "./schema";
import { hashCanonicalUrl, normalizeCanonicalUrl } from "./canonical";
import type { CatalogResource, LoadedResource } from "./types";

export const CATALOG_ROOT = path.resolve(process.cwd(), "resources", "catalog");

function walkJsonFiles(dir: string, acc: string[] = []): string[] {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkJsonFiles(full, acc);
    } else if (entry.isFile() && (entry.name.endsWith(".json") || entry.name.endsWith(".yaml") || entry.name.endsWith(".yml"))) {
      acc.push(full);
    }
  }
  return acc;
}

function readFileData(file: string): unknown {
  const text = fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");
  const ext = path.extname(file).toLowerCase();
  if (ext === ".yaml" || ext === ".yml") {
    throw new Error(
      `YAML catalog files are not supported yet (${file}). Please use JSON.`
    );
  }
  return JSON.parse(text);
}

export interface CatalogLoadResult {
  resources: LoadedResource[];
  issues: SchemaIssue[];
  files: string[];
}

/** Load and schema-validate every declarative resource file under resources/catalog. */
export function loadCatalog(root: string = CATALOG_ROOT): CatalogLoadResult {
  const files = walkJsonFiles(root).sort();
  const resources: LoadedResource[] = [];
  const issues: SchemaIssue[] = [];

  for (const file of files) {
    let data: unknown;
    try {
      data = readFileData(file);
    } catch (error) {
      issues.push({
        file: path.relative(process.cwd(), file),
        path: "<file>",
        message: error instanceof Error ? error.message : String(error),
      });
      continue;
    }
    const rel = path.relative(process.cwd(), file).replace(/\\/g, "/");
    const result = validateCatalogFile(rel, data);
    issues.push(...result.issues);
    for (const resource of result.resources) {
      resources.push({ resource, sourceFile: rel });
    }
  }

  return { resources, issues, files };
}

export interface DuplicateReport {
  duplicateKeys: { id: string; files: string[] }[];
  duplicateUrls: { canonicalUrl: string; ids: string[]; files: string[] }[];
}

/** Detect duplicate resource ids and duplicate canonical URLs across the catalog. */
export function detectDuplicates(resources: LoadedResource[]): DuplicateReport {
  const byKey = new Map<string, string[]>();
  const byUrl = new Map<
    string,
    { canonicalUrl: string; ids: Set<string>; files: Set<string> }
  >();

  for (const { resource, sourceFile } of resources) {
    byKey.set(resource.id, [...(byKey.get(resource.id) ?? []), sourceFile]);

    let hash: string;
    let canonicalUrl: string;
    try {
      canonicalUrl = normalizeCanonicalUrl(resource.canonical_url);
      hash = hashCanonicalUrl(canonicalUrl);
    } catch {
      continue;
    }
    const bucket =
      byUrl.get(hash) ?? { canonicalUrl, ids: new Set<string>(), files: new Set<string>() };
    bucket.ids.add(resource.id);
    bucket.files.add(sourceFile);
    byUrl.set(hash, bucket);
  }

  const duplicateKeys = [...byKey.entries()]
    .filter(([, files]) => files.length > 1)
    .map(([id, files]) => ({ id, files }));

  const duplicateUrls = [...byUrl.values()]
    .filter((bucket) => bucket.ids.size > 1)
    .map((bucket) => ({
      canonicalUrl: bucket.canonicalUrl,
      ids: [...bucket.ids],
      files: [...bucket.files],
    }));

  return { duplicateKeys, duplicateUrls };
}

/**
 * Build the set of valid lesson keys (`phase-slug/lesson-folder`) from the
 * upstream curriculum on disk. Used by `resources:validate` so contributors can
 * validate without a live database connection.
 */
export function buildLessonIndexFromUpstream(repoPath: string): Set<string> {
  const keys = new Set<string>();
  const phasesDir = path.join(repoPath, "phases");
  if (!fs.existsSync(phasesDir)) return keys;

  for (const phaseEntry of fs.readdirSync(phasesDir, { withFileTypes: true })) {
    if (!phaseEntry.isDirectory()) continue;
    if (!/^\d+-/.test(phaseEntry.name)) continue;
    const phaseDir = path.join(phasesDir, phaseEntry.name);
    for (const lessonEntry of fs.readdirSync(phaseDir, { withFileTypes: true })) {
      if (!lessonEntry.isDirectory()) continue;
      keys.add(`${phaseEntry.name}/${lessonEntry.name}`);
    }
  }
  return keys;
}

export type { CatalogResource, LoadedResource };
