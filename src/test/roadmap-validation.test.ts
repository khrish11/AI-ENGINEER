import { describe, it, expect } from "vitest";
import { validateRoadmapConfig } from "@/lib/roadmap/validation";
import { lessonMetadata, occurrences, tracks, taxonomy, phaseOrder } from "@/lib/roadmap/config";
import { LessonMetadataFileSchema, TrackSchema, SkillTaxonomySchema } from "@/lib/roadmap/types";

describe("roadmap configuration validation", () => {
  it("validates the shipped configuration with no errors", () => {
    const report = validateRoadmapConfig();
    expect(report.errors).toEqual([]);
    expect(report.ok).toBe(true);
  });

  it("reports complete metadata coverage", () => {
    const report = validateRoadmapConfig();
    expect(report.stats.occurrences).toBe(542);
    expect(report.stats.canonicalLessons).toBe(542);
    expect(report.stats.aliases).toBe(0);
    expect(report.stats.phases).toBe(20);
    expect(report.stats.tracks).toBe(7);
    expect(report.stats.fallbackEstimates).toBe(0);
    expect(report.stats.duplicateCanonicalKeys).toEqual([]);
  });

  it("warns when metadata does not match the active curriculum revision", () => {
    const report = validateRoadmapConfig({
      canonicalSlugs: occurrences
        .filter((entry) => !entry.isAlias)
        .map((entry) => entry.occurrenceId),
      aliasSlugs: occurrences.filter((entry) => entry.isAlias).map((entry) => entry.occurrenceId),
      phaseSlugs: [...phaseOrder],
      activeCommit: "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
    });
    expect(report.ok).toBe(true);
    expect(report.warnings.join(" ")).toContain("npm run roadmap:metadata");
  });

  it("fails when a curriculum lesson is missing from metadata", () => {
    const report = validateRoadmapConfig({
      canonicalSlugs: [
        ...occurrences.filter((entry) => !entry.isAlias).map((entry) => entry.occurrenceId),
        "99-unknown-phase/01-missing-lesson",
      ],
      aliasSlugs: occurrences.filter((entry) => entry.isAlias).map((entry) => entry.occurrenceId),
      phaseSlugs: [...phaseOrder],
      activeCommit: lessonMetadata.generatedFrom.activeCommit,
    });
    expect(report.ok).toBe(false);
    expect(report.errors.join(" ")).toContain("missing from roadmap metadata");
  });
});


describe("configuration schema parsing", () => {
  it("accepts every shipped track file", () => {
    for (const track of tracks) {
      expect(TrackSchema.safeParse(track).success).toBe(true);
    }
  });

  it("accepts the skill taxonomy", () => {
    expect(taxonomy.skills.length).toBeGreaterThanOrEqual(50);
    expect(taxonomy.groups.length).toBeGreaterThanOrEqual(8);
    expect(SkillTaxonomySchema.safeParse(taxonomy).success).toBe(true);
  });

  it("accepts the generated lesson metadata file", () => {
    const result = LessonMetadataFileSchema.safeParse(lessonMetadata);
    expect(result.success).toBe(true);
    expect(result.success && result.data.occurrences).toHaveLength(542);
  });

  it("gives every occurrence an importance for all seven tracks", () => {
    for (const occurrence of occurrences) {
      expect(Object.keys(occurrence.importance).sort()).toEqual(
        ["agent", "general-ai", "llm-app", "ml", "mlops", "rag", "research"].sort()
      );
    }
  });
});
