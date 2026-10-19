import { describe, it, expect, beforeEach } from "vitest";
import {
  exportProgress,
  previewImport,
  previewImportFromObject,
  importProgressFromObject,
  ExportDataSchema,
  SCHEMA_VERSION,
  resetLocalLearningData,
} from "@/lib/progress/export-import";
import { lessonProgressRepo } from "@/lib/progress/repositories/lesson-progress";
import { notesRepo } from "@/lib/progress/repositories/notes";
import { bookmarksRepo } from "@/lib/progress/repositories/bookmarks";
import { db } from "@/lib/progress/db";
import { makeNote, makeLesson, resetProgressDb } from "./progress-test-utils";

describe("export/import", () => {
  beforeEach(async () => {
    await resetProgressDb();
  });

  describe("ExportDataSchema", () => {
    it("validates a well-formed empty export", () => {
      const result = ExportDataSchema.safeParse({
        schemaVersion: 1,
        app: "ai-engineer-os",
        exportedAt: "2026-01-01T00:00:00.000Z",
        data: {},
      });
      expect(result.success).toBe(true);
    });

    it("rejects missing schemaVersion", () => {
      const result = ExportDataSchema.safeParse({
        app: "ai-engineer-os",
        exportedAt: "2026-01-01T00:00:00.000Z",
        data: {},
      });
      expect(result.success).toBe(false);
    });

    it("rejects malformed lesson records", () => {
      const result = ExportDataSchema.safeParse({
        schemaVersion: 1,
        app: "ai-engineer-os",
        exportedAt: "2026-01-01T00:00:00.000Z",
        data: { lessonProgress: [{ id: "1", lessonId: "lesson-1" }] },
      });
      expect(result.success).toBe(false);
    });
  });

  describe("previewImportFromObject", () => {
    it("rejects unsupported schema versions", () => {
      const preview = previewImportFromObject({
        schemaVersion: 99,
        app: "ai-engineer-os",
        exportedAt: "2026-01-01T00:00:00.000Z",
        data: {},
      });
      expect(preview.valid).toBe(false);
      expect(preview.errors[0]).toMatch(/Unsupported schema version/);
    });

    it("counts records per entity", () => {
      const preview = previewImportFromObject({
        schemaVersion: 1,
        app: "ai-engineer-os",
        exportedAt: "2026-01-01T00:00:00.000Z",
        data: { lessonProgress: [makeLesson()], notes: [makeNote()] },
      });
      expect(preview.valid).toBe(true);
      expect(preview.counts.lessonProgress).toBe(1);
      expect(preview.counts.notes).toBe(1);
    });
  });

  describe("previewImport", () => {
    it("returns invalid preview for malformed JSON", async () => {
      const file = new File(["not json"], "bad.json", { type: "application/json" });
      const preview = await previewImport(file);
      expect(preview.valid).toBe(false);
      expect(preview.errors.length).toBeGreaterThan(0);
    });
  });

  describe("SCHEMA_VERSION", () => {
    it("is 1", () => {
      expect(SCHEMA_VERSION).toBe(1);
    });
  });

  describe("export -> reset -> import roundtrip", () => {
    it("restores lessons, notes and bookmarks", async () => {
      await lessonProgressRepo.upsert({
        lessonId: "lesson-rt",
        lessonTitle: "Roundtrip lesson",
        phaseSlug: "00-setup-and-tooling",
        phaseNumber: 0,
        readingComplete: true,
        availability: {
          hasVideo: false,
          hasQuiz: false,
          hasProject: false,
          hasResources: false,
        },
      });
      await notesRepo.upsert({
        lessonId: "lesson-rt",
        resourceId: null,
        projectId: null,
        content: "roundtrip note",
      });
      await bookmarksRepo.upsert({
        lessonId: "lesson-rt",
        resourceId: null,
        projectId: null,
        targetType: "lesson",
        title: "Roundtrip lesson",
        href: "/curriculum/00-setup-and-tooling/01-dev-environment",
      });

      const exported = await exportProgress();
      expect(exported.data.lessonProgress?.length).toBe(1);
      expect(exported.data.notes?.length).toBe(1);
      expect(exported.data.bookmarks?.length).toBe(1);

      await resetLocalLearningData();
      expect(await db.lessonProgress.count()).toBe(0);
      expect(await db.notes.count()).toBe(0);

      const result = await importProgressFromObject(
        JSON.parse(JSON.stringify(exported)),
        "replace"
      );
      expect(result.success).toBe(true);

      const lessons = await db.lessonProgress.toArray();
      expect(lessons).toHaveLength(1);
      expect(lessons[0].status).toBe("completed");
      expect((await db.notes.toArray())[0].content).toBe("roundtrip note");
      expect((await db.bookmarks.toArray())[0].title).toBe("Roundtrip lesson");
    });

    it("merge mode never downgrades an existing completion", async () => {
      await lessonProgressRepo.upsert({
        lessonId: "lesson-merge",
        readingComplete: true,
        availability: {
          hasVideo: false,
          hasQuiz: false,
          hasProject: false,
          hasResources: false,
        },
      });
      const stale = makeLesson({
        id: "stale-lesson-row",
        lessonId: "lesson-merge",
        status: "not_started",
        readingComplete: false,
      });
      const result = await importProgressFromObject(
        {
          schemaVersion: 1,
          app: "ai-engineer-os",
          exportedAt: "2026-10-17T10:00:00.000Z",
          data: { lessonProgress: [stale] },
        },
        "merge"
      );
      expect(result.success).toBe(true);
      const stored = await lessonProgressRepo.getByLesson("lesson-merge");
      expect(stored?.status).toBe("completed");
      expect(stored?.readingComplete).toBe(true);
    });

    it("rejects malformed backup without touching local data", async () => {
      await lessonProgressRepo.upsert({ lessonId: "keep-me", readingComplete: true });
      const result = await importProgressFromObject(
        { schemaVersion: 1, app: "ai-engineer-os", exportedAt: "x", data: { notes: [{}] } },
        "replace"
      );
      expect(result.success).toBe(false);
      expect(await lessonProgressRepo.getByLesson("keep-me")).not.toBeNull();
    });
  });
});
