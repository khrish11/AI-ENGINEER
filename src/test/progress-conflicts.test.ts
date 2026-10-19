import { describe, it, expect } from "vitest";
import { conflictResolver } from "@/lib/progress/conflicts";

describe("conflict resolution", () => {
  describe("detectNoteConflict", () => {
    it("detects conflict when both sides changed from same base", () => {
      const result = conflictResolver.detectNoteConflict(
        { content: "local edit", localRevision: 3 },
        { content: "remote edit", localRevision: 3 },
        2
      );
      expect(result).toBe(true);
    });

    it("no conflict when only local changed", () => {
      const result = conflictResolver.detectNoteConflict(
        { content: "local edit", localRevision: 3 },
        { content: "base content", localRevision: 2 },
        2
      );
      expect(result).toBe(false);
    });

    it("no conflict when content is the same", () => {
      const result = conflictResolver.detectNoteConflict(
        { content: "same content", localRevision: 3 },
        { content: "same content", localRevision: 3 },
        2
      );
      expect(result).toBe(false);
    });

    it("no conflict when neither side changed from base", () => {
      const result = conflictResolver.detectNoteConflict(
        { content: "base content", localRevision: 2 },
        { content: "base content", localRevision: 2 },
        2
      );
      expect(result).toBe(false);
    });
  });

  describe("detectLessonProgressConflict", () => {
    it("detects regression attempt", () => {
      const result = conflictResolver.detectLessonProgressConflict(
        "completed",
        "in_progress"
      );
      expect(result.conflict).toBe(true);
      expect(result.mergedStatus).toBe("completed");
    });

    it("no conflict for forward progress", () => {
      const result = conflictResolver.detectLessonProgressConflict(
        "in_progress",
        "completed"
      );
      expect(result.conflict).toBe(false);
      expect(result.mergedStatus).toBe("completed");
    });

    it("no conflict for same status", () => {
      const result = conflictResolver.detectLessonProgressConflict(
        "completed",
        "completed"
      );
      expect(result.conflict).toBe(false);
    });
  });
});
