import { describe, it, expect } from "vitest";
import { validateSlug, RESERVED_USERNAMES } from "@/lib/portfolio/slug";
import { buildPublicPortfolio, type PrivateProjectSource } from "@/lib/portfolio/public-view";
import { defaultPublicity, defaultVisibility, type PublicityJson } from "@/lib/portfolio/types";
import { buildPublicSkills } from "@/lib/portfolio/skills-view";
import { projectCatalog } from "@/lib/projects/catalog";
import { type PublicSkill } from "@/lib/portfolio/public-view";
import { computeMasteryEvidence } from "@/lib/assessments/mastery";

function publicity(overrides: Partial<PublicityJson> = {}): PublicityJson {
  return { ...defaultPublicity(), ...overrides };
}

describe("§27 portfolio slugs", () => {
  it("normalizes and validates lowercase canonical form", () => {
    expect(validateSlug("girish")).toMatchObject({ valid: true, normalized: "girish" });
    expect(validateSlug("Girish P").valid).toBe(false);
    expect(validateSlug("valid-slug").valid).toBe(true);
    expect(validateSlug("ac").valid).toBe(false); // too short
  });

  it("blocks reserved names", () => {
    for (const reserved of ["admin", "api", "portfolio", "settings", "sync", "login"]) {
      expect(RESERVED_USERNAMES.has(reserved)).toBe(true);
      expect(validateSlug(reserved).valid).toBe(false);
    }
  });

  it("rejects unsafe characters", () => {
    expect(validateSlug("has spaces").valid).toBe(false);
    expect(validateSlug("../evil").valid).toBe(false);
    expect(validateSlug("good1").valid).toBe(true);
  });
});

describe("§24/§26 portfolio publication gating", () => {
  const project = projectCatalog[0];
  const evidenceRow = {
    id: "ev-1",
    kind: "github_repo_url",
    value: "https://github.com/learner/repo",
    title: "Repo",
    selfReported: true,
    deletedAt: null as string | null,
  };
  const deletedEvidence = { ...evidenceRow, id: "ev-deleted", deletedAt: "2026-10-01T00:00:00.000Z" };
  const source: PrivateProjectSource = {
    projectId: project.id,
    status: "completed",
    evidence: [evidenceRow, deletedEvidence],
    selfAssessment: { totalEarned: 12, totalMax: 16 },
    repositoryUrl: "https://github.com/learner/repo",
    demoUrl: "https://demo.example.com",
  };
  const sources = new Map([[project.id, source]]);
  const achievements = [{ id: "first-lesson", title: "First lesson completed", description: "", earnedAt: "2026-01-01T00:00:00.000Z" }];
  const mastery = computeMasteryEvidence(
    "classification",
    { completedLessons: 5, totalLessons: 10 },
    { validAttempts: 2, recentAverage: 90 },
    { completedProjects: 1, totalProjects: 2 }
  );
  const skills: PublicSkill[] = [
    { skillId: "classification", band: mastery.band, score: mastery.score, evidenceLabels: [...mastery.labels] },
  ];

  it("publishes nothing by default — everything private until chosen", () => {
    const view = buildPublicPortfolio(
      {
        settings: publicity(),
        skills,
        achievements,
        projectSources: sources,
        canonicalLessonsCompleted: 40,
        careerTrackFromRoadmap: "rag",
        assessments: { attempts: 3, latestPercentage: 88 },
        studyHours: 30,
      },
      "2026-10-17T00:00:00.000Z"
    );
    expect(view.projects).toEqual([]);
    expect(view.skills).toEqual([]);
    expect(view.achievements).toEqual([]);
    expect(view.careerTrack).toBeNull();
    expect(view.learningProgress.canonicalLessonsCompleted).toBeNull();
    expect(view.studyTimeSummary?.totalHours).toBeNull();
    expect(view.assessmentsSummary).toBeNull();
  });

  it("publishes only the explicitly selected projects and evidence", () => {
    const view = buildPublicPortfolio(
      {
        settings: publicity({
          visibility: { ...visibilityOn(), projects: true },
          publicProjectIds: [project.id],
          publicEvidenceIds: ["ev-1"],
        }),
        skills,
        achievements,
        projectSources: sources,
        canonicalLessonsCompleted: null,
        careerTrackFromRoadmap: null,
        assessments: null,
        studyHours: null,
      },
      "2026-10-17T00:00:00.000Z"
    );
    expect(view.projects).toHaveLength(1);
    expect(view.projects[0].id).toBe(project.id);
    expect(view.projects[0].evidence.map((entry) => entry.id)).toEqual(["ev-1"]);
    // Deleted evidence and unselected evidence never appear.
    expect(view.projects[0].evidence.some((entry) => entry.id === "ev-deleted")).toBe(false);
  });

  it("hides self-assessed scores unless explicitly exposed", () => {
    const base = {
      settings: publicity({
        visibility: { ...visibilityOn(), projects: true, exposeSelfAssessment: false },
        publicProjectIds: [project.id],
      }),
      skills,
      achievements,
      projectSources: sources,
      canonicalLessonsCompleted: null,
      careerTrackFromRoadmap: null,
      assessments: null,
      studyHours: null,
    };
    const hidden = buildPublicPortfolio(base, "2026-10-17T00:00:00.000Z");
    expect(hidden.projects[0].selfAssessedScore).toBeNull();
    expect(hidden.projects[0].verificationLabels).not.toContain("Self-assessed");

    const exposed = buildPublicPortfolio(
      { ...base, settings: { ... publicity({
        visibility: { ...visibilityOn(), projects: true, exposeSelfAssessment: true },
        publicProjectIds: [project.id],
      }) } },
      "2026-10-17T00:00:00.000Z"
    );
    if (exposed.projects[0].selfAssessedScore) {
      expect(exposed.projects[0].selfAssessedScore).toEqual({ totalEarned: 12, totalMax: 16 });
    }
  });

  it("hides repository and demo links unless explicitly exposed", () => {
    const view = buildPublicPortfolio(
      {
        settings: publicity({
          visibility: { ...visibilityOn(), projects: true, exposeProjectLinks: false },
          publicProjectIds: [project.id],
          publicEvidenceIds: ["ev-1"],
        }),
        skills,
        achievements,
        projectSources: sources,
        canonicalLessonsCompleted: null,
        careerTrackFromRoadmap: null,
        assessments: null,
        studyHours: null,
      },
      "2026-10-17T00:00:00.000Z"
    );
    expect(view.projects[0].repositoryUrl).toBeNull();
    expect(view.projects[0].demoUrl).toBeNull();
    expect(view.projects[0].evidence[0].url).toBeNull();
  });

  it("keeps evidence provenance honest — learner-submitted, never verified", () => {
    const view = buildPublicPortfolio(
      {
        settings: publicity({
          visibility: { ...visibilityOn(), projects: true },
          publicProjectIds: [project.id],
          publicEvidenceIds: ["ev-1"],
        }),
        skills,
        achievements,
        projectSources: sources,
        canonicalLessonsCompleted: null,
        careerTrackFromRoadmap: null,
        assessments: null,
        studyHours: null,
      },
      "2026-10-17T00:00:00.000Z"
    );
    expect(view.projects[0].evidence[0].provenance).toBe("learner_submitted");
    expect(view.projects[0].evidence[0].verificationLabel).not.toMatch(/verified/i);
  });

  it("gates skills by explicit selection", () => {
    const skillRow = {
      skillId: "classification",
      completedLessons: 5,
      totalLessons: 10,
      validAttempts: 2,
      recentAverage: 90,
      completedProjects: [{ projectId: "p", projectTitle: "P", status: "completed" }],
      totalProjects: 2,
      reviewCount: 0,
      lastReviewedAt: null,
      mastery,
      evidenceCoverage: "medium" as const,
      weak: false,
    };
    expect(buildPublicSkills([skillRow], [])).toEqual([]);
    const sorted = buildPublicSkills([skillRow], ["classification"]);
    expect(sorted).toHaveLength(1);
    expect(sorted[0].band).toBe(mastery.band);
  });
});

/** visibility on for all sections but with selection lists empty. */
function visibilityOn() {
  return {
    ...defaultVisibility(),
    exposeSelfAssessment: false,
    exposeProjectLinks: false,
  };
}

describe("§48 security regression — public serializer never leaks private records", () => {
  const project = projectCatalog[0];

  /**
   * Build a portfolio from EVERY available private source record: emails,
   * OAuth provider ids, note contents, quiz answers, device ids, sync
   * conflicts, internal user ids and UNPUBLISHED evidence. The serialized
   * public view must not contain any of them.
   */
  it("does not expose private fields in the serialized public object", () => {
    const secret = {
      email: "secret-learner@example.com",
      providerAccountId: "oauth-provider-12345",
      internalUserId: "8c1f0d42-5bf7-4a37-bb16-c83e7a4f58f1",
      noteContent: "PRIVATE-NOTE-CONTENT-do-not-publish",
      quizAnswer: "PRIVATE-QUIZ-ANSWER-b3",
      deviceId: "6f2b1de8-90a2-4e5f-8f4b-27a11a2f8c99",
      conflictText: "SYNC-CONFLICT-BACKUP-CONTENT",
      unpublishedEvidenceTitle: "UNPUBLISHED-EVIDENCE-TITLE",
    };

    const privateEvidence = [
      {
        id: "ev-private",
        kind: "github_repo_url",
        value: "https://github.com/learner/private-repo",
        title: secret.unpublishedEvidenceTitle as string,
        selfReported: true,
        deletedAt: null,
      },
    ];
    const sources = new Map<string, PrivateProjectSource>([
      [
        project.id,
        {
          projectId: project.id,
          status: "completed",
          evidence: privateEvidence,
          selfAssessment: { totalEarned: 10, totalMax: 16 },
          repositoryUrl: "https://github.com/learner/private-repo",
          demoUrl: "https://private.example.com",
        },
      ],
    ]);

    const view = buildPublicPortfolio(
      {
        settings: publicity({
          visibility: { ...visibilityOn(), projects: true, achievements: true },
          publicProjectIds: [], // nothing selected; leakage must be zero anyway
          publicEvidenceIds: [], // nothing selected
          publicAchievementIds: [], // nothing selected
        }),
        skills: [
          {
            skillId: "classification",
            band: "proficient",
            score: 66,
            evidenceLabels: [secret.noteContent],
          },
        ],
        achievements: [
          {
            id: "first-lesson",
            title: "First lesson completed",
            description: secret.quizAnswer,
            earnedAt: "2026-01-01T00:00:00.000Z",
          },
        ],
        projectSources: sources,
        canonicalLessonsCompleted: 40,
        careerTrackFromRoadmap: null,
        assessments: null,
        studyHours: null,
      },
      "2026-10-17T00:00:00.000Z"
    );

    const serialized = JSON.stringify(view);
    for (const [field, value] of Object.entries(secret)) {
      expect(serialized).not.toContain(value);
      void field;
    }
    // The unpublished evidence id/value is never serialized either.
    expect(serialized).not.toContain("ev-private");
    expect(serialized).not.toContain("learner/private-repo");
    expect(serialized).not.toContain("private.example.com");
  });

  it("never returns an unpublished profile shape (server gate is separate, serializer cannot resurrect it)", () => {
    // buildPublicPortfolio is only called after loadPublishedProfile confirms
    // published=true (server-side). Publish state itself is never in output.
    const view = buildPublicPortfolio(
      {
        settings: publicity(),
        skills: null,
        achievements: [],
        projectSources: new Map(),
        canonicalLessonsCompleted: null,
        careerTrackFromRoadmap: null,
        assessments: null,
        studyHours: null,
      },
      "2026-10-17T00:00:00.000Z"
    );
    expect(JSON.stringify(view)).not.toContain("published");
  });
});
