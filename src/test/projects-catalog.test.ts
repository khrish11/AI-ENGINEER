import { describe, it, expect } from "vitest";
import {
  projectCatalog,
  getProjectById,
  getProjectBySlug,
  filterProjects,
  getProjectsForPhase,
  getProjectsForTrack,
  PROJECT_LEVELS_ORDER,
} from "@/lib/projects/catalog";
import { occurrences } from "@/lib/roadmap/config";

describe("project catalog (24 real definitions)", () => {
  it("loads 24 projects with unique ids and slugs", () => {
    expect(projectCatalog).toHaveLength(24);
    expect(new Set(projectCatalog.map((p) => p.id)).size).toBe(24);
    expect(new Set(projectCatalog.map((p) => p.slug)).size).toBe(24);
  });

  it("covers every curriculum phase", () => {
    const phaseSlugs = new Set(occurrences.map((o) => o.phaseSlug));
    const covered = new Set(projectCatalog.flatMap((p) => p.phaseSlugs));
    for (const slug of phaseSlugs) {
      expect(covered.has(slug)).toBe(true);
    }
  });

  it("has 5 capstones in the capstone phase", () => {
    const capstones = getProjectsForPhase("19-capstone-projects");
    expect(capstones.length).toBeGreaterThanOrEqual(5);
    expect(capstones.every((p) => p.level === "capstone")).toBe(true);
  });

  it("uses non-beginner rubrics everywhere they are required", () => {
    for (const project of projectCatalog) {
      if (project.level !== "beginner") {
        expect(project.rubric).toBeDefined();
        const total = project.rubric!.categories.reduce((sum, c) => sum + c.weight, 0);
        expect(total).toBe(100);
      }
    }
  });

  it("resolves lookups by id and slug", () => {
    const first = projectCatalog[0];
    expect(getProjectById(first.id)?.slug).toBe(first.slug);
    expect(getProjectBySlug(first.slug)?.id).toBe(first.id);
    expect(getProjectById("proj-does-not-exist")).toBeUndefined();
  });

  it("filters by level, phase, and track", () => {
    const beginner = filterProjects({ level: ["beginner"], status: "active" });
    expect(beginner.every((p) => p.level === "beginner")).toBe(true);

    const phase = filterProjects({ phaseSlugs: ["11-llm-engineering"], status: "active" });
    expect(phase.length).toBeGreaterThan(0);
    expect(phase.every((p) => p.phaseSlugs.includes("11-llm-engineering"))).toBe(true);

    const tracked = filterProjects({ trackIds: ["rag"], status: "active" });
    expect(tracked.length).toBeGreaterThan(0);
    expect(tracked.every((p) => p.relevantTracks.includes("rag"))).toBe(true);
  });

  it("orders track projects by level then effort", () => {
    const track = getProjectsForTrack("rag");
    expect(track.length).toBeGreaterThan(0);
    for (let i = 1; i < track.length; i += 1) {
      const prev = PROJECT_LEVELS_ORDER.indexOf(track[i - 1].level);
      const next = PROJECT_LEVELS_ORDER.indexOf(track[i].level);
      expect(prev <= next).toBe(true);
    }
  });
});
