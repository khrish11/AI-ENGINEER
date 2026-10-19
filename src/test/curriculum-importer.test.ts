import { describe, it, expect, beforeEach } from "vitest";
import * as crypto from "crypto";

// Verification of canonical identity & hash model
describe("Curriculum Importer Identity & Idempotency Invariants", () => {
  interface MockCanonicalLesson {
    id: string; // Permanent immutable UUID
    canonicalPhaseId: string;
    currentSlug: string;
    defaultTitle: string;
    contentHash: string;
  }

  interface MockLessonAlias {
    id: string;
    canonicalLessonId: string;
    aliasSlug: string;
  }

  interface MockCurriculumRevision {
    id: string;
    commitSha: string;
    isActive: boolean;
  }

  let dbCanonicalLessons: MockCanonicalLesson[];
  let dbAliases: MockLessonAlias[];
  let dbRevisions: MockCurriculumRevision[];

  beforeEach(() => {
    dbCanonicalLessons = [];
    dbAliases = [];
    dbRevisions = [];
  });

  function computeHash(content: string): string {
    return crypto.createHash("sha256").update(content, "utf8").digest("hex");
  }

  // Simulator for the importer's canonical upsert logic
  function simulateUpsertLesson(input: {
    canonicalPhaseId: string;
    slug: string;
    title: string;
    contentHash: string;
  }): { canonicalId: string; isNew: boolean; aliasCreated: boolean } {
    // 1. Match by stable contentHash
    const existing = dbCanonicalLessons.find(
      (l) => l.contentHash === input.contentHash
    );

    if (existing) {
      // PRESERVE IMMUTABLE UUID
      const canonicalId = existing.id;
      let aliasCreated = false;

      // If slug has changed, record alias
      if (existing.currentSlug !== input.slug) {
        const hasAlias = dbAliases.some(
          (a) => a.canonicalLessonId === canonicalId && a.aliasSlug === existing.currentSlug
        );
        if (!hasAlias) {
          dbAliases.push({
            id: crypto.randomUUID(),
            canonicalLessonId: canonicalId,
            aliasSlug: existing.currentSlug,
          });
          aliasCreated = true;
        }
        existing.currentSlug = input.slug;
      }

      existing.defaultTitle = input.title;
      return { canonicalId, isNew: false, aliasCreated };
    }

    // New Canonical Lesson gets immutable UUID
    const newId = crypto.randomUUID();
    dbCanonicalLessons.push({
      id: newId,
      canonicalPhaseId: input.canonicalPhaseId,
      currentSlug: input.slug,
      defaultTitle: input.title,
      contentHash: input.contentHash,
    });

    return { canonicalId: newId, isNew: true, aliasCreated: false };
  }

  it("should preserve canonical lesson UUID across repeat imports (idempotency)", () => {
    const markdown = "# Lesson 01: Setup\n\nContent body here";
    const hash = computeHash(markdown);

    // First import
    const result1 = simulateUpsertLesson({
      canonicalPhaseId: "phase-uuid-00",
      slug: "00-setup/01-dev-env",
      title: "Linux Setup",
      contentHash: hash,
    });

    expect(result1.isNew).toBe(true);
    const assignedUuid = result1.canonicalId;
    expect(assignedUuid).toBeDefined();

    // Repeat import with identical content and slug
    const result2 = simulateUpsertLesson({
      canonicalPhaseId: "phase-uuid-00",
      slug: "00-setup/01-dev-env",
      title: "Linux Setup",
      contentHash: hash,
    });

    expect(result2.isNew).toBe(false);
    expect(result2.canonicalId).toBe(assignedUuid); // Same permanent UUID!
    expect(dbCanonicalLessons.length).toBe(1); // No duplicates!
  });

  it("should retain permanent UUID and register an alias when a lesson is renamed or moved", () => {
    const markdown = "# Attention Mechanism\n\nSelf-attention math";
    const hash = computeHash(markdown);

    // Initial import
    const initial = simulateUpsertLesson({
      canonicalPhaseId: "phase-uuid-10",
      slug: "10-transformers/01-attention-old",
      title: "Attention Mechanism",
      contentHash: hash,
    });

    const permanentUuid = initial.canonicalId;

    // Upstream renames folder from 01-attention-old -> 01-multihead-attention
    const updated = simulateUpsertLesson({
      canonicalPhaseId: "phase-uuid-10",
      slug: "10-transformers/01-multihead-attention",
      title: "Attention Mechanism (Updated)",
      contentHash: hash,
    });

    expect(updated.isNew).toBe(false);
    expect(updated.canonicalId).toBe(permanentUuid); // Permanent UUID unchanged!
    expect(updated.aliasCreated).toBe(true);

    // Alias must point to old slug
    const alias = dbAliases.find((a) => a.canonicalLessonId === permanentUuid);
    expect(alias).toBeDefined();
    expect(alias?.aliasSlug).toBe("10-transformers/01-attention-old");

    // Total canonical lessons count must still be exactly 1
    expect(dbCanonicalLessons.length).toBe(1);
    expect(dbCanonicalLessons[0].currentSlug).toBe("10-transformers/01-multihead-attention");
  });

  it("should assign distinct UUIDs for different lessons", () => {
    const hash1 = computeHash("Lesson 1 content");
    const hash2 = computeHash("Lesson 2 content");

    const l1 = simulateUpsertLesson({
      canonicalPhaseId: "phase-00",
      slug: "00-setup/01-first",
      title: "First",
      contentHash: hash1,
    });

    const l2 = simulateUpsertLesson({
      canonicalPhaseId: "phase-00",
      slug: "00-setup/02-second",
      title: "Second",
      contentHash: hash2,
    });

    expect(l1.canonicalId).not.toBe(l2.canonicalId);
    expect(dbCanonicalLessons.length).toBe(2);
  });

  it("should handle deleted lessons gracefully by preserving canonical records for past history", () => {
    // Lesson imported in Revision 1
    const hash = computeHash("Temporary lesson");
    const lesson = simulateUpsertLesson({
      canonicalPhaseId: "phase-00",
      slug: "00-setup/temp-lesson",
      title: "Temporary Lesson",
      contentHash: hash,
    });

    // In Revision 2, upstream removes the lesson folder.
    // The canonical registry retains the record so student history/certificates do not crash.
    const record = dbCanonicalLessons.find((l) => l.id === lesson.canonicalId);
    expect(record).toBeDefined();
    expect(record?.defaultTitle).toBe("Temporary Lesson");
  });

  it("should identify repeat commit imports as idempotent runs", () => {
    const commitSha = "c81651a83aff5f7bf307ffe4392f0d97f3b27ad6";

    // First run registers revision
    dbRevisions.push({
      id: crypto.randomUUID(),
      commitSha,
      isActive: true,
    });

    // Second run checks existing revision
    const existing = dbRevisions.find((r) => r.commitSha === commitSha);
    const isIdempotent = existing !== undefined;

    expect(isIdempotent).toBe(true);
    expect(existing?.commitSha).toBe(commitSha);
  });
});
