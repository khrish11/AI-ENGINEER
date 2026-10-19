import { describe, it, expect } from "vitest";
import {
  evaluateCompletion,
  monotonicMergeStatus,
  statusRank,
  isHigherStatus,
  lessonStatusLabel,
  type LessonActivityAvailability,
  type LessonRequirements,
} from "@/lib/progress/completion";

describe("completion rules engine", () => {
  describe("statusRank", () => {
    it("ranks not_started lowest", () => {
      expect(statusRank("not_started")).toBe(0);
    });
    it("ranks mastered highest", () => {
      expect(statusRank("mastered")).toBe(3);
    });
    it("ranks in order", () => {
      expect(
        statusRank("not_started") <
          statusRank("in_progress") &&
          statusRank("in_progress") <
            statusRank("completed") &&
          statusRank("completed") < statusRank("mastered")
      ).toBe(true);
    });
  });

  describe("monotonicMergeStatus", () => {
    it("keeps higher status", () => {
      expect(monotonicMergeStatus("in_progress", "completed")).toBe("completed");
      expect(monotonicMergeStatus("completed", "in_progress")).toBe("completed");
      expect(monotonicMergeStatus("not_started", "mastered")).toBe("mastered");
    });
    it("never downgrades", () => {
      expect(monotonicMergeStatus("mastered", "not_started")).toBe("mastered");
      expect(monotonicMergeStatus("completed", "not_started")).toBe("completed");
    });
  });

  describe("isHigherStatus", () => {
    it("correctly compares", () => {
      expect(isHigherStatus("completed", "in_progress")).toBe(true);
      expect(isHigherStatus("in_progress", "completed")).toBe(false);
      expect(isHigherStatus("not_started", "not_started")).toBe(false);
    });
  });

  describe("evaluateCompletion", () => {
    const baseAvailability: LessonActivityAvailability = {
      hasVideo: true,
      hasQuiz: true,
      hasProject: false,
      hasResources: true,
    };

    const baseRequirements: LessonRequirements = {
      readingComplete: true,
      requiredResourcesComplete: true,
      practiceComplete: true,
      projectComplete: false,
    };

    it("marks completed when all requirements met", () => {
      const result = evaluateCompletion(
        "in_progress",
        baseAvailability,
        baseRequirements,
        85,
        false
      );
      expect(result.status).toBe("completed");
      expect(result.canMarkComplete).toBe(true);
      expect(result.progressPercent).toBe(100);
    });

    it("marks mastered when score >= 80 and already completed", () => {
      const result = evaluateCompletion(
        "completed",
        baseAvailability,
        baseRequirements,
        90,
        false
      );
      expect(result.canMarkMastered).toBe(true);
      expect(result.status).toBe("mastered");
    });

    it("does not mark complete merely because a lesson was opened", () => {
      const result = evaluateCompletion(
        "not_started",
        baseAvailability,
        {
          readingComplete: false,
          requiredResourcesComplete: false,
          practiceComplete: false,
          projectComplete: false,
        },
        null,
        false
      );
      expect(result.status).toBe("not_started");
      expect(result.canMarkComplete).toBe(false);
    });

    it("does not mark mastered when score < 80", () => {
      const result = evaluateCompletion(
        "completed",
        baseAvailability,
        baseRequirements,
        75,
        false
      );
      expect(result.canMarkMastered).toBe(false);
    });

    it("marks in_progress when requirements incomplete", () => {
      const result = evaluateCompletion(
        "not_started",
        baseAvailability,
        { ...baseRequirements, readingComplete: false },
        null,
        false
      );
      expect(result.status).toBe("in_progress");
      expect(result.blockingFields).toContain("reading");
    });

    it("handles lesson with no quiz or project", () => {
      const availability: LessonActivityAvailability = {
        hasVideo: false,
        hasQuiz: false,
        hasProject: false,
        hasResources: false,
      };
      const requirements: LessonRequirements = {
        readingComplete: true,
        requiredResourcesComplete: true,
        practiceComplete: true,
        projectComplete: true,
      };
      const result = evaluateCompletion(
        "not_started",
        availability,
        requirements,
        null,
        false
      );
      expect(result.status).toBe("completed");
      expect(result.progressPercent).toBe(100);
    });

    it("calculates progress percent correctly", () => {
      const result = evaluateCompletion(
        "in_progress",
        {
          hasVideo: true,
          hasQuiz: true,
          hasProject: true,
          hasResources: true,
        },
        {
          readingComplete: true,
          requiredResourcesComplete: false,
          practiceComplete: false,
          projectComplete: false,
        },
        null,
        false
      );
      // 1 out of 4 complete = 25%
      expect(result.progressPercent).toBe(25);
    });

    it("labels status correctly", () => {
      expect(lessonStatusLabel("not_started")).toBe("Not Started");
      expect(lessonStatusLabel("in_progress")).toBe("In Progress");
      expect(lessonStatusLabel("completed")).toBe("Completed");
      expect(lessonStatusLabel("mastered")).toBe("Mastered");
    });
  });
});
