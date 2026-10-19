import { describe, it, expect } from "vitest";
import { computeMasteryEvidence } from "@/lib/assessments/mastery";

describe("mastery evidence formula", () => {
  it("combines lessons (0.4), assessments (0.4), projects (0.2) per documented weights", () => {
    // All lessons complete → 0.4; perfect recent average → 0.4; project complete → 0.2 → 100
    const perfect = computeMasteryEvidence(
      "rag",
      { completedLessons: 4, totalLessons: 4 },
      { validAttempts: 2, recentAverage: 100 },
      { completedProjects: 1, totalProjects: 1 }
    );
    expect(perfect.score).toBe(100);
    expect(perfect.band).toBe("strong");
  });

  it("caps each source so no single input can create mastery", () => {
    const lessonsOnly = computeMasteryEvidence(
      "rag",
      { completedLessons: 10, totalLessons: 10 },
      { validAttempts: 0, recentAverage: null },
      { completedProjects: 0, totalProjects: 0 }
    );
    expect(lessonsOnly.score).toBe(40);
    expect(lessonsOnly.band).toBe("developing");

    const assessmentsOnly = computeMasteryEvidence(
      "rag",
      { completedLessons: 0, totalLessons: 5 },
      { validAttempts: 5, recentAverage: 100 },
      { completedProjects: 0, totalProjects: 0 }
    );
    expect(assessmentsOnly.score).toBe(40);

    const projectsOnly = computeMasteryEvidence(
      "rag",
      { completedLessons: 0, totalLessons: 5 },
      { validAttempts: 0, recentAverage: null },
      { completedProjects: 1, totalProjects: 1 }
    );
    expect(projectsOnly.score).toBe(20);
  });

  it("classifies bands at 50 and 75 with documented boundaries", () => {
    const mid = computeMasteryEvidence(
      "rag",
      { completedLessons: 5, totalLessons: 5 },
      { validAttempts: 1, recentAverage: 100 },
      { completedProjects: 0, totalProjects: 0 }
    );
    // lesson 0.4 + assessment 0.4 = 80 → strong
    expect(mid.band).toBe("strong");

    const proficientish = computeMasteryEvidence(
      "rag",
      { completedLessons: 5, totalLessons: 5 },
      { validAttempts: 1, recentAverage: 50 },
      { completedProjects: 0, totalProjects: 0 }
    );
    // 0.4 + 0.2 = 60 → proficient
    expect(proficientish.band).toBe("proficient");
    expect(proficientish.score).toBe(60);
  });

  it("reports human-readable labels per source", () => {
    const result = computeMasteryEvidence(
      "rag",
      { completedLessons: 2, totalLessons: 4 },
      { validAttempts: 3, recentAverage: 66 },
      { completedProjects: 1, totalProjects: 2 }
    );
    expect(result.labels).toEqual([
      "Lessons: 2/4 complete",
      "Assessments: 3 attempt(s), recent avg 66%",
      "Projects: 1/2 complete",
    ]);
  });
});
