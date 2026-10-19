import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import {
  loadCatalog,
  detectDuplicates,
  buildLessonIndexFromUpstream,
} from "@/lib/resources/catalog";
import type { CatalogResource, LoadedResource } from "@/lib/resources/types";

function resource(overrides: Partial<CatalogResource> = {}): CatalogResource {
  return {
    id: "res-one",
    type: "official_documentation",
    title: "Resource One",
    canonical_url: "https://example.com/one",
    editorial_status: "verified",
    associated_lessons: [],
    ...overrides,
  };
}

function loaded(resource: CatalogResource, sourceFile: string): LoadedResource {
  return { resource, sourceFile };
}

describe("Resource catalog utilities", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "resources-test-"));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("detects duplicate resource ids across files", () => {
    const report = detectDuplicates([
      loaded(resource({ id: "dup" }), "a.json"),
      loaded(resource({ id: "dup", canonical_url: "https://example.com/two" }), "b.json"),
    ]);
    expect(report.duplicateKeys).toHaveLength(1);
    expect(report.duplicateKeys[0].id).toBe("dup");
    expect(report.duplicateKeys[0].files).toEqual(["a.json", "b.json"]);
  });

  it("detects duplicate canonical URLs after normalization", () => {
    const report = detectDuplicates([
      loaded(
        resource({ id: "vid-short", canonical_url: "https://youtu.be/kCc8FmEb1nY" }),
        "a.json"
      ),
      loaded(
        resource({
          id: "vid-long",
          canonical_url: "https://www.youtube.com/watch?v=kCc8FmEb1nY",
        }),
        "b.json"
      ),
    ]);
    expect(report.duplicateUrls).toHaveLength(1);
    expect(report.duplicateUrls[0].ids.sort()).toEqual(["vid-long", "vid-short"]);
  });

  it("reports no duplicates for distinct resources", () => {
    const report = detectDuplicates([
      loaded(resource({ id: "one" }), "a.json"),
      loaded(resource({ id: "two", canonical_url: "https://example.com/two" }), "b.json"),
    ]);
    expect(report.duplicateKeys).toEqual([]);
    expect(report.duplicateUrls).toEqual([]);
  });

  it("builds a lesson-key index from an upstream phases tree", () => {
    const phases = path.join(tempDir, "phases");
    fs.mkdirSync(path.join(phases, "00-setup", "01-dev-env"), { recursive: true });
    fs.mkdirSync(path.join(phases, "07-transformers", "02-attention"), { recursive: true });
    // A loose file in phases/ must be ignored.
    fs.writeFileSync(path.join(phases, "README.md"), "ignore me", "utf8");

    const index = buildLessonIndexFromUpstream(tempDir);
    expect(index.has("00-setup/01-dev-env")).toBe(true);
    expect(index.has("07-transformers/02-attention")).toBe(true);
    expect(index.size).toBe(2);
  });

  it("returns an empty index when no phases directory exists", () => {
    expect(buildLessonIndexFromUpstream(tempDir).size).toBe(0);
  });

  it("loads valid JSON catalog files and reports schema issues", () => {
    const root = path.join(tempDir, "catalog");
    fs.mkdirSync(root, { recursive: true });

    fs.writeFileSync(
      path.join(root, "valid.json"),
      JSON.stringify({
        id: "valid-doc",
        type: "official_documentation",
        title: "Valid Docs",
        canonical_url: "https://example.com/docs",
        editorial_status: "verified",
        associated_lessons: ["00-setup/01-dev-env"],
      }),
      "utf8"
    );

    fs.writeFileSync(
      path.join(root, "bad.json"),
      JSON.stringify({ id: "BAD", type: "official_documentation", title: "x", canonical_url: "nope" }),
      "utf8"
    );

    // YAML is intentionally unsupported and should surface an issue, not throw.
    fs.writeFileSync(path.join(root, "unsupported.yaml"), "id: x", "utf8");

    const result = loadCatalog(root);
    expect(result.resources).toHaveLength(1);
    expect(result.resources[0].resource.id).toBe("valid-doc");
    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.issues.some((i) => i.message.includes("YAML"))).toBe(true);
  });
});
