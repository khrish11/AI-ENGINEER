import { describe, it, expect } from "vitest";
import { recommendPlacement, phaseSkillRequirements } from "@/lib/roadmap/placement";
import type { LearnerProfile } from "@/lib/roadmap/types";

const base: LearnerProfile = {
  background: "self-taught",
  programming: {
    python: "none",
    javascript: "none",
    git: "none",
    linux: "none",
    sql: "none",
    docker: "none",
  },
  math: { "linear-algebra": "weak", calculus: "weak", probability: "weak", statistics: "weak" },
  ai: {
    "classical-ml": "none",
    "neural-networks": "none",
    pytorch: "none",
    transformers: "none",
    "llm-applications": "none",
    rag: "none",
    agents: "none",
    deployment: "none",
  },
  knownTopicSkillIds: [],
  goalTrackId: "rag",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const phaseIndex = (slug: string) =>
  ["00-setup-and-tooling", "01-math-foundations", "02-ml-fundamentals", "03-deep-learning-core",
   "05-nlp-foundations-to-advanced", "07-transformers-deep-dive", "11-llm-engineering",
   "13-tools-and-protocols", "14-agent-engineering"].indexOf(slug);

describe("placement assessment", () => {
  it("starts a beginner at the beginning with review topics", () => {
    const result = recommendPlacement(base);
    expect(result.recommendedStartPhaseSlug).toBe("00-setup-and-tooling");
    expect(result.reviewSkillIds.length).toBeGreaterThan(0);
    expect(result.reviewTopics.length).toBeGreaterThan(0);
    expect(result.source).toBe("self-assessment");
    expect(result.summary).toContain("Recommended starting point");
  });

  it("moves an intermediate learner past the setup and math phases", () => {
    const intermediate: LearnerProfile = {
      ...base,
      background: "ml-data",
      programming: {
        python: "comfortable",
        javascript: "basic",
        git: "comfortable",
        linux: "basic",
        sql: "basic",
        docker: "none",
      },
      math: {
        "linear-algebra": "comfortable",
        calculus: "okay",
        probability: "comfortable",
        statistics: "okay",
      },
      ai: {
        "classical-ml": "comfortable",
        "neural-networks": "comfortable",
        pytorch: "basic",
        transformers: "none",
        "llm-applications": "basic",
        rag: "none",
        agents: "none",
        deployment: "none",
      },
    };
    const result = recommendPlacement(intermediate);
    expect(phaseIndex(result.recommendedStartPhaseSlug)).toBeGreaterThanOrEqual(3);
  });

  it("places an experienced learner much further in", () => {
    const experienced: LearnerProfile = {
      ...base,
      background: "researcher",
      programming: {
        python: "strong",
        javascript: "strong",
        git: "strong",
        linux: "strong",
        sql: "strong",
        docker: "strong",
      },
      math: {
        "linear-algebra": "strong",
        calculus: "strong",
        probability: "strong",
        statistics: "strong",
      },
      ai: {
        "classical-ml": "strong",
        "neural-networks": "strong",
        pytorch: "strong",
        transformers: "strong",
        "llm-applications": "strong",
        rag: "comfortable",
        agents: "comfortable",
        deployment: "strong",
      },
      knownTopicSkillIds: phaseSkillRequirements("00-setup-and-tooling"),
    };
    const result = recommendPlacement(experienced);
    expect(phaseIndex(result.recommendedStartPhaseSlug)).toBeGreaterThan(3);
    expect(phaseIndex(result.recommendedStartPhaseSlug)).toBeGreaterThanOrEqual(
      phaseIndex(recommendPlacement(base).recommendedStartPhaseSlug)
    );
  });

  it("recommends skimming lessons whose skills are already known", () => {
    const known: LearnerProfile = {
      ...base,
      knownTopicSkillIds: ["python", "git", "linux", "docker", "sql", "cloud-gpu", "jupyter", "apis"],
    };
    const result = recommendPlacement(known);
    expect(result.skimOccurrenceIds.length).toBeGreaterThan(0);
    expect(result.estimatedMinutesSaved).toBeGreaterThan(0);
  });

  it("never marks lessons complete — placement only recommends", () => {
    const result = recommendPlacement(base);
    expect(result).not.toHaveProperty("completedLessons");
    expect(Object.keys(result)).toEqual([
      "recommendedStartPhaseSlug",
      "recommendedStartPhaseTitle",
      "reviewSkillIds",
      "reviewTopics",
      "skimOccurrenceIds",
      "estimatedMinutesSaved",
      "summary",
      "source",
    ]);
  });

  it("uses quiz signals to add review skills and keep the start earlier", () => {
    const experienced = recommendPlacement({
      ...base,
      programming: {
        python: "strong",
        javascript: "strong",
        git: "strong",
        linux: "strong",
        sql: "strong",
        docker: "strong",
      },
      math: {
        "linear-algebra": "strong",
        calculus: "strong",
        probability: "strong",
        statistics: "strong",
      },
      ai: {
        "classical-ml": "strong",
        "neural-networks": "strong",
        pytorch: "strong",
        transformers: "strong",
        "llm-applications": "strong",
        rag: "strong",
        agents: "strong",
        deployment: "strong",
      },
    });

    const withFailedQuiz = recommendPlacement(
      {
        ...base,
        programming: {
          python: "strong",
          javascript: "strong",
          git: "strong",
          linux: "strong",
          sql: "strong",
          docker: "strong",
        },
        math: experienced.recommendedStartPhaseSlug.includes("foundation")
          ? base.math
          : {
              "linear-algebra": "strong",
              calculus: "strong",
              probability: "strong",
              statistics: "strong",
            },
        ai: {
          "classical-ml": "strong",
          "neural-networks": "strong",
          pytorch: "strong",
          transformers: "strong",
          "llm-applications": "strong",
          rag: "strong",
          agents: "strong",
          deployment: "strong",
        },
      },
      { correct: 1, total: 6, weakSkillIds: ["pytorch"] }
    );

    expect(withFailedQuiz.source).toBe("combined");
    expect(withFailedQuiz.reviewSkillIds).toContain("pytorch");
    expect(phaseIndex(withFailedQuiz.recommendedStartPhaseSlug)).toBeLessThanOrEqual(
      phaseIndex(experienced.recommendedStartPhaseSlug)
    );
  });
});
