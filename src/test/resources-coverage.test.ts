import { describe, it, expect } from "vitest";
import {
  computeCoverage,
  isVideoResource,
  isPracticalResource,
  isReferenceResource,
  type CoverageLesson,
  type CoverageMapping,
} from "@/lib/resources/coverage";

const lessons: CoverageLesson[] = [
  { lessonId: "l1", phaseSlug: "00-setup", phaseNumber: 0, title: "L1" },
  { lessonId: "l2", phaseSlug: "00-setup", phaseNumber: 0, title: "L2" },
  { lessonId: "l3", phaseSlug: "01-math", phaseNumber: 1, title: "L3" },
];

const mappings: CoverageMapping[] = [
  {
    lessonId: "l1",
    resourceType: "youtube_video",
    resourceRole: "primary",
    verificationStatus: "verified",
    editorialStatus: "verified",
  },
  {
    lessonId: "l1",
    resourceType: "github_repo",
    resourceRole: "practical",
    verificationStatus: "reachable",
    editorialStatus: "pending_review",
  },
  {
    lessonId: "l3",
    resourceType: "official_documentation",
    resourceRole: "reference",
    verificationStatus: "reachable",
    editorialStatus: "verified",
  },
];

describe("Resource coverage", () => {
  it("classifies resource roles and types", () => {
    expect(isVideoResource("youtube_video", "primary")).toBe(true);
    expect(isVideoResource("official_documentation", "reference")).toBe(false);
    expect(isPracticalResource("github_repo", "supplementary")).toBe(true);
    expect(isPracticalResource("official_documentation", "practical")).toBe(true);
    expect(isPracticalResource("official_documentation", "reference")).toBe(false);
    expect(isReferenceResource("research_paper", "supplementary")).toBe(true);
    expect(isReferenceResource("youtube_video", "reference")).toBe(true);
    expect(isReferenceResource("youtube_video", "supplementary")).toBe(false);
  });

  it("computes overall and per-phase coverage", () => {
    const report = computeCoverage(lessons, mappings);

    expect(report.totalLessons).toBe(3);
    expect(report.lessonsWithResources).toBe(2);
    expect(report.lessonsWithoutResources).toBe(1);
    expect(report.coveragePct).toBe(66.7);
    expect(report.totalResources).toBe(3);

    expect(report.lessonsWithoutVideo).toBe(2);
    expect(report.lessonsWithoutPractical).toBe(2);
    expect(report.lessonsWithoutPrimary).toBe(2);
    expect(report.lessonsWithoutReference).toBe(2);

    expect(report.byType).toMatchObject({
      youtube_video: 1,
      github_repo: 1,
      official_documentation: 1,
    });
    expect(report.verification.verified).toBe(1);
    expect(report.verification.reachable).toBe(2);
    expect(report.editorial.verified).toBe(2);
    expect(report.editorial.pending_review).toBe(1);

    const phase00 = report.coverageByPhase.find((p) => p.phaseSlug === "00-setup");
    const phase01 = report.coverageByPhase.find((p) => p.phaseSlug === "01-math");
    expect(phase00?.coveragePct).toBe(50);
    expect(phase01?.coveragePct).toBe(100);

    expect(report.lessonsWithoutResources_list).toEqual([
      { phaseSlug: "00-setup", title: "L2" },
    ]);
  });

  it("handles an empty curriculum without dividing by zero", () => {
    const report = computeCoverage([], []);
    expect(report.totalLessons).toBe(0);
    expect(report.coveragePct).toBe(0);
    expect(report.coverageByPhase).toEqual([]);
  });
});
