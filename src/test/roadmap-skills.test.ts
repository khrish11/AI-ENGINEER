import { describe, it, expect } from "vitest";
import { computeSkillProgress, skillsGained } from "@/lib/roadmap/skills";
import { completionSets, canonicalKeyForProgress } from "@/lib/roadmap/progress";
import { getOccurrence } from "@/lib/roadmap/config";

const VT_CANONICAL = "07-transformers-deep-dive/09-vision-transformers";
const VT_ALIAS = "04-computer-vision/14-vision-transformers";

describe("skill progress", () => {
  it("derives skill counts from real lesson completion", () => {
    const empty = computeSkillProgress("rag", []);
    const totalCore = empty.flatMap((group) => group.skills).reduce((sum, skill) => sum + skill.coreTotal, 0);
    expect(totalCore).toBeGreaterThan(0);
    expect(
      empty.flatMap((group) => group.skills).every((skill) => skill.coreCompleted === 0)
    ).toBe(true);
    expect(empty.flatMap((group) => group.skills).every((skill) => skill.percent === 0)).toBe(true);

    const ragSkill = empty
      .flatMap((group) => group.skills)
      .find((skill) => skill.skillId === "rag");
    expect(ragSkill).toBeTruthy();

    const withCompletion = computeSkillProgress("rag", ["11-llm-engineering/06-rag"]);
    const updated = withCompletion.flatMap((group) => group.skills).find((skill) => skill.skillId === "rag");
    expect(updated!.coreCompleted).toBeGreaterThan(ragSkill!.coreCompleted);
    expect(updated!.percent).toBeGreaterThan(0);
    expect(updated!.status).not.toBe("mastered");
  });

  it("keeps mastery distinct from completion", () => {
    const completedOnly = computeSkillProgress("rag", ["11-llm-engineering/06-rag"]);
    const skill = completedOnly
      .flatMap((group) => group.skills)
      .find((entry) => entry.skillId === "rag");
    expect(skill!.masteredCount).toBe(0);

    const mastered = computeSkillProgress(
      "rag",
      ["11-llm-engineering/06-rag"],
      ["11-llm-engineering/06-rag"]
    );
    const masteredSkill = mastered
      .flatMap((group) => group.skills)
      .find((entry) => entry.skillId === "rag");
    expect(masteredSkill!.masteredCount).toBe(1);
    expect(masteredSkill!.status).toBe("mastered");
  });

  it("keeps split lesson progress identities separate", () => {
    const progress = completionSets([
      {
        lessonId: "progress-1",
        lessonHref: `/curriculum/${VT_ALIAS}`,
        status: "completed",
      },
    ]);
    expect(progress.completed.has(VT_ALIAS)).toBe(true);

    const groups = computeSkillProgress("rag", progress.completed);
    const skill = groups
      .flatMap((group) => group.skills)
      .find((entry) => entry.skillId === "transformers");
    if (skill) {
      expect(skill.coreCompleted).toBeLessThanOrEqual(skill.coreTotal);
    }
    // The split identities remain independently addressable.
    const progressViaCanonical = completionSets([
      {
        lessonId: "progress-2",
        lessonHref: `/curriculum/${VT_CANONICAL}`,
        status: "completed",
      },
    ]);
    expect(progressViaCanonical.completed).not.toEqual(progress.completed);
  });

  it("lists skills gained from a week's lessons", () => {
    const gained = skillsGained("rag", ["11-llm-engineering/06-rag", "unknown/lesson"]);
    expect(gained.length).toBeGreaterThan(0);
    expect(gained).toContain("rag");
  });
});

describe("roadmap completion resolution", () => {
  it("resolves progress records by href through canonical identity", () => {
    expect(
      canonicalKeyForProgress({
        lessonId: "x",
        lessonHref: `/curriculum/${VT_ALIAS}`,
        status: "completed",
      })
    ).toBe(VT_ALIAS);
    expect(
      canonicalKeyForProgress({
        lessonId: "x",
        lessonHref: `/curriculum/${VT_CANONICAL}`,
        status: "completed",
      })
    ).toBe(VT_CANONICAL);
    expect(
      canonicalKeyForProgress({ lessonId: "unrelated", lessonHref: "/resources", status: "completed" })
    ).toBeNull();
  });

  it("marks started, completed, mastered, and needs-review sets", () => {
    const sets = completionSets([
      { lessonId: "a", lessonHref: "/curriculum/00-setup-and-tooling/01-dev-environment", status: "in_progress" },
      { lessonId: "b", lessonHref: "/curriculum/00-setup-and-tooling/02-git-and-collaboration", status: "completed" },
      { lessonId: "c", lessonHref: "/curriculum/00-setup-and-tooling/03-gpu-setup-and-cloud", status: "mastered" },
      { lessonId: "d", lessonHref: "/curriculum/00-setup-and-tooling/04-apis-and-keys", status: "not_started", needsReview: true },
      { lessonId: "unknown-record", status: "completed" },
    ]);
    expect(sets.started.size).toBe(3);
    expect(sets.completed.size).toBe(2);
    expect(sets.mastered.size).toBe(1);
    expect(sets.needsReview.size).toBe(1);
    expect(sets.unresolved).toBe(1);
  });

  it("reads both split occurrence metadata independently", () => {
    const alias = getOccurrence(VT_ALIAS);
    const canonical = getOccurrence(VT_CANONICAL);
    expect(alias.canonicalLessonKey).not.toBe(canonical.canonicalLessonKey);
    expect(alias.occurrenceId).not.toBe(canonical.occurrenceId);
    expect(alias.prerequisites).not.toEqual(canonical.prerequisites);
  });
});
