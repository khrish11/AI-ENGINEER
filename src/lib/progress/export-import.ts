import { z } from "zod";
import { db, LEARNING_TABLES } from "./db";
import type {
  LessonProgress,
  ResourceProgress,
  ProjectProgress,
  ProjectEvidence,
  LocalProfile,
} from "./db";
import { createBase, nowIso } from "./records";
import { mergeCompletionFlags, monotonicMergeStatus, type LessonStatus } from "./completion";
import { mergeResourceProgress, type GithubResourceState } from "./resource-rules";
import { syncQueue } from "./sync-queue";

export const SCHEMA_VERSION = 1;
export const SUPPORTED_SCHEMA_VERSIONS = [1];

const baseSchema = z.object({
  id: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),
  localRevision: z.number().int().nonnegative(),
  syncStatus: z.enum(["synced", "pending", "conflict", "failed"]),
});

const lessonProgressSchema = baseSchema.extend({
  lessonId: z.string().min(1),
  lessonTitle: z.string().nullable().optional(),
  lessonHref: z.string().nullable().optional(),
  phaseSlug: z.string().nullable().optional(),
  phaseNumber: z.number().nullable().optional(),
  status: z.enum(["not_started", "in_progress", "completed", "mastered"]),
  readingComplete: z.boolean(),
  requiredResourcesComplete: z.boolean(),
  practiceComplete: z.boolean(),
  projectComplete: z.boolean(),
  masteryScore: z.number().nullable(),
  needsReview: z.boolean(),
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  masteredAt: z.string().nullable(),
});

const resourceProgressSchema = baseSchema.extend({
  resourceId: z.string().min(1),
  resourceType: z.string().nullable().optional(),
  resourceTitle: z.string().nullable().optional(),
  href: z.string().nullable().optional(),
  started: z.boolean(),
  completed: z.boolean(),
  bookmarked: z.boolean(),
  githubState: z.enum(["opened", "explored", "completed_exercise"]).nullable().optional(),
  completedAt: z.string().nullable(),
  lastOpenedAt: z.string().nullable(),
  notes: z.string().nullable(),
});

const noteSchema = baseSchema.extend({
  lessonId: z.string().nullable(),
  resourceId: z.string().nullable(),
  projectId: z.string().nullable(),
  content: z.string(),
  contentRevision: z.number().int().nonnegative(),
  conflictState: z.enum(["none", "local_wins", "remote_wins", "unresolved"]),
  conflictBackup: z.string().nullable(),
});

const bookmarkSchema = baseSchema.extend({
  lessonId: z.string().nullable(),
  resourceId: z.string().nullable(),
  projectId: z.string().nullable(),
  targetType: z.enum(["lesson", "video", "github", "docs", "papers", "datasets", "projects"]),
  title: z.string().nullable(),
  href: z.string().nullable(),
  note: z.string().nullable(),
  deletedAt: z.string().nullable(),
});

const studySessionSchema = baseSchema.extend({
  clientSessionId: z.string().min(1),
  deviceId: z.string(),
  lessonId: z.string().nullable(),
  resourceId: z.string().nullable(),
  projectId: z.string().nullable(),
  startedAt: z.string(),
  endedAt: z.string().nullable(),
  durationSeconds: z.number(),
});

const quizAttemptSchema = baseSchema.extend({
  attemptId: z.string().min(1),
  quizId: z.string(),
  lessonId: z.string(),
  answers: z.unknown(),
  score: z.number().nullable(),
  maxScore: z.number().nullable(),
  percentage: z.number().nullable(),
  startedAt: z.string(),
  submittedAt: z.string().nullable(),
  attemptNumber: z.number().int().positive(),
});

const projectProgressSchema = baseSchema.extend({
  projectId: z.string().min(1),
  milestoneId: z.string().nullable(),
  completed: z.boolean(),
  completedAt: z.string().nullable(),
  evidenceUrl: z.string().nullable(),
  notes: z.string().nullable(),
});

const roadmapStateSchema = baseSchema.extend({
  state: z.unknown(),
});

/** Phase 6 additions: evidence entries and rubric self-assessments. */
const projectEvidenceSchema = baseSchema.extend({
  projectId: z.string().min(1),
  kind: z.string().min(1),
  value: z.string(),
  title: z.string().nullable(),
  details: z
    .object({
      branch: z.string().nullable().optional(),
      commitSha: z.string().nullable().optional(),
      prUrl: z.string().nullable().optional(),
      directory: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  selfReported: z.boolean(),
  deletedAt: z.string().nullable(),
});

const reviewHistorySchema = baseSchema.extend({
  skillId: z.string().min(1),
  successfulReviews: z.number().int().nonnegative(),
  lastReviewedAt: z.string().nullable(),
  snoozedUntil: z.string().nullable(),
});

const projectSelfAssessmentSchema = baseSchema.extend({
  projectId: z.string().min(1),
  scores: z.record(z.string(), z.number()),
  totalEarned: z.number().nullable(),
  totalMax: z.number().nullable(),
  updatedAt: z.string(),
});

const localProfileSchema = z
  .object({
    id: z.string().min(1),
    deviceId: z.string(),
    guestId: z.string(),
    displayName: z.string().nullable().optional(),
    email: z.string().nullable().optional(),
    isAuthenticated: z.boolean().optional(),
    lastSyncAt: z.string().nullable().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
    localRevision: z.number().optional(),
    syncStatus: z.string().optional(),
  })
  .passthrough();

export const ExportDataSchema = z.object({
  schemaVersion: z.number(),
  app: z.literal("ai-engineer-os"),
  exportedAt: z.string(),
  data: z.object({
    localProfile: localProfileSchema.nullable().optional(),
    lessonProgress: z.array(lessonProgressSchema).optional(),
    resourceProgress: z.array(resourceProgressSchema).optional(),
    notes: z.array(noteSchema).optional(),
    bookmarks: z.array(bookmarkSchema).optional(),
    studySessions: z.array(studySessionSchema).optional(),
    quizAttempts: z.array(quizAttemptSchema).optional(),
    projectProgress: z.array(projectProgressSchema).optional(),
    roadmapState: z.array(roadmapStateSchema).optional(),
    projectEvidence: z.array(projectEvidenceSchema).optional(),
    projectSelfAssessments: z.array(projectSelfAssessmentSchema).optional(),
    reviewHistory: z.array(reviewHistorySchema).optional(),
  }),
});

export type ExportData = z.infer<typeof ExportDataSchema>;

const SENSITIVE_FIELDS = [
  "accesstoken",
  "refreshtoken",
  "idtoken",
  "sessiontoken",
  "provideraccountid",
  "oauth",
  "credentials",
  "auth_secret",
  "database_url",
  "password",
];

export function stripSensitive(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(stripSensitive);
  if (obj && typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const lowerKey = key.toLowerCase();
      if (SENSITIVE_FIELDS.some((f) => lowerKey.includes(f))) continue;
      result[key] = stripSensitive(value);
    }
    return result;
  }
  return obj;
}

export async function exportProgress(): Promise<ExportData> {
  const [
    lessonProgress,
    resourceProgress,
    notes,
    bookmarks,
    studySessions,
    quizAttempts,
    projectProgress,
    roadmapState,
    localProfile,
    projectEvidence,
    projectSelfAssessments,
    reviewHistory,
  ] = await Promise.all([
    db.lessonProgress.toArray(),
    db.resourceProgress.toArray(),
    db.notes.toArray(),
    db.bookmarks.toArray(),
    db.studySessions.toArray(),
    db.quizAttempts.toArray(),
    db.projectProgress.toArray(),
    db.roadmapState.toArray(),
    db.localProfile.toArray(),
    db.projectEvidence.toArray(),
    db.projectSelfAssessments.toArray(),
    db.reviewHistory.toArray(),
  ]);

  const data: ExportData = {
    schemaVersion: SCHEMA_VERSION,
    app: "ai-engineer-os",
    exportedAt: nowIso(),
    data: {
      localProfile: stripSensitive(localProfile[0] ?? null) as ExportData["data"]["localProfile"],
      lessonProgress: stripSensitive(lessonProgress) as ExportData["data"]["lessonProgress"],
      resourceProgress: stripSensitive(
        resourceProgress
      ) as ExportData["data"]["resourceProgress"],
      notes: stripSensitive(notes) as ExportData["data"]["notes"],
      bookmarks: stripSensitive(bookmarks) as ExportData["data"]["bookmarks"],
      studySessions: stripSensitive(studySessions) as ExportData["data"]["studySessions"],
      quizAttempts: stripSensitive(quizAttempts) as ExportData["data"]["quizAttempts"],
      projectProgress: stripSensitive(projectProgress) as ExportData["data"]["projectProgress"],
      roadmapState: stripSensitive(roadmapState) as ExportData["data"]["roadmapState"],
      projectEvidence: stripSensitive(
        projectEvidence
      ) as ExportData["data"]["projectEvidence"],
      projectSelfAssessments: stripSensitive(
        projectSelfAssessments
      ) as ExportData["data"]["projectSelfAssessments"],
      reviewHistory: stripSensitive(reviewHistory) as ExportData["data"]["reviewHistory"],
    },
  };

  return ExportDataSchema.parse(data);
}

export interface ImportPreview {
  valid: boolean;
  schemaVersion: number;
  app: string;
  exportedAt: string | null;
  counts: {
    lessonProgress: number;
    resourceProgress: number;
    notes: number;
    bookmarks: number;
    studySessions: number;
    quizAttempts: number;
    projectProgress: number;
    roadmapState: number;
    projectEvidence: number;
    projectSelfAssessments: number;
    reviewHistory: number;
  };
  errors: string[];
}

function emptyCounts() {
  return {
    lessonProgress: 0,
    resourceProgress: 0,
    notes: 0,
    bookmarks: 0,
    studySessions: 0,
    quizAttempts: 0,
    projectProgress: 0,
    roadmapState: 0,
    projectEvidence: 0,
    projectSelfAssessments: 0,
    reviewHistory: 0,
  };
}

export function previewImportFromObject(raw: unknown): ImportPreview {
  const parsed = ExportDataSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      valid: false,
      schemaVersion: 0,
      app: "",
      exportedAt: null,
      counts: emptyCounts(),
      errors: parsed.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`),
    };
  }
  if (!SUPPORTED_SCHEMA_VERSIONS.includes(parsed.data.schemaVersion)) {
    return {
      valid: false,
      schemaVersion: parsed.data.schemaVersion,
      app: parsed.data.app,
      exportedAt: parsed.data.exportedAt,
      counts: emptyCounts(),
      errors: [`Unsupported schema version ${parsed.data.schemaVersion}`],
    };
  }
  const inner = parsed.data.data;
  return {
    valid: true,
    schemaVersion: parsed.data.schemaVersion,
    app: parsed.data.app,
    exportedAt: parsed.data.exportedAt,
    counts: {
      lessonProgress: (inner.lessonProgress ?? []).length,
      resourceProgress: (inner.resourceProgress ?? []).length,
      notes: (inner.notes ?? []).length,
      bookmarks: (inner.bookmarks ?? []).length,
      studySessions: (inner.studySessions ?? []).length,
      quizAttempts: (inner.quizAttempts ?? []).length,
      projectProgress: (inner.projectProgress ?? []).length,
      roadmapState: (inner.roadmapState ?? []).length,
      projectEvidence: (inner.projectEvidence ?? []).length,
      projectSelfAssessments: (inner.projectSelfAssessments ?? []).length,
      reviewHistory: (inner.reviewHistory ?? []).length,
    },
    errors: [],
  };
}

export async function previewImport(file: File): Promise<ImportPreview> {
  try {
    const text = await file.text();
    return previewImportFromObject(JSON.parse(text));
  } catch {
    return {
      valid: false,
      schemaVersion: 0,
      app: "",
      exportedAt: null,
      counts: emptyCounts(),
      errors: ["Invalid JSON file"],
    };
  }
}

async function clearLearningData(): Promise<void> {
  await Promise.all(LEARNING_TABLES.map((table) => table.clear()));
  await db.importBackups.clear();
}

export async function importProgressFromObject(
  raw: unknown,
  mode: "merge" | "replace"
): Promise<{ success: boolean; errors: string[]; counts?: ImportPreview["counts"] }> {
  const preview = previewImportFromObject(raw);
  if (!preview.valid) return { success: false, errors: preview.errors };

  const parsed = ExportDataSchema.parse(raw);
  const incoming = parsed.data;

  try {
    await db.transaction(
      "rw",
      [...LEARNING_TABLES, db.importBackups, db.localProfile],
      async () => {
        const snapshot = await exportProgress();
        if (mode === "replace") {
          await clearLearningData();
        }
        await db.importBackups.put({
          ...createBase({ id: "pre-import-backup" }),
          payload: snapshot,
        });

        await mergeOrReplaceLessons(incoming.lessonProgress ?? [], mode);
        await mergeOrReplaceResources(incoming.resourceProgress ?? [], mode);
        await importNotes(incoming.notes ?? [], mode);
        await importBookmarks(incoming.bookmarks ?? [], mode);
        await importStudySessions(incoming.studySessions ?? []);
        await importQuizAttempts(incoming.quizAttempts ?? []);
        await importProjects(incoming.projectProgress ?? [], mode);
        await importRoadmap(incoming.roadmapState ?? [], mode);
        await importProjectEvidence(incoming.projectEvidence ?? [], mode);
        await importProjectSelfAssessments(incoming.projectSelfAssessments ?? [], mode);
        await importReviewHistory(incoming.reviewHistory ?? [], mode);

        if (incoming.localProfile) {
          const existingProfile = await db.localProfile.toArray();
          if (mode === "replace" || existingProfile.length === 0) {
            const profile = stripSensitive(incoming.localProfile) as LocalProfile;
            if (profile.id) await db.localProfile.put(profile);
          }
        }
      }
    );
  } catch (err) {
    return {
      success: false,
      errors: [err instanceof Error ? err.message : "Import failed"],
    };
  }

  return { success: true, errors: [], counts: preview.counts };
}

async function mergeOrReplaceLessons(
  incoming: NonNullable<ExportData["data"]["lessonProgress"]>,
  mode: "merge" | "replace"
) {
  for (const item of incoming) {
    const existing =
      mode === "merge"
        ? await db.lessonProgress.where("lessonId").equals(item.lessonId).first()
        : undefined;
    if (!existing) {
      await putAndQueue(db.lessonProgress, "lesson_progress", { ...item, syncStatus: "pending" });
      continue;
    }
    const flags = mergeCompletionFlags(
      {
        readingComplete: existing.readingComplete,
        requiredResourcesComplete: existing.requiredResourcesComplete,
        practiceComplete: existing.practiceComplete,
        projectComplete: existing.projectComplete,
      },
      {
        readingComplete: item.readingComplete,
        requiredResourcesComplete: item.requiredResourcesComplete,
        practiceComplete: item.practiceComplete,
        projectComplete: item.projectComplete,
      }
    );
    const masteryScores = [existing.masteryScore, item.masteryScore].filter(
      (score): score is number => typeof score === "number"
    );
    const merged: LessonProgress = {
      ...existing,
      ...flags,
      status: monotonicMergeStatus(existing.status, item.status as LessonStatus),
      masteryScore: masteryScores.length ? Math.max(...masteryScores) : null,
      needsReview: existing.needsReview || item.needsReview,
      startedAt: existing.startedAt ?? item.startedAt,
      completedAt: existing.completedAt ?? item.completedAt,
      masteredAt: existing.masteredAt ?? item.masteredAt,
      updatedAt: nowIso(),
      localRevision: existing.localRevision + 1,
      syncStatus: "pending",
    };
    await putAndQueue(db.lessonProgress, "lesson_progress", merged);
  }
}

async function mergeOrReplaceResources(
  incoming: NonNullable<ExportData["data"]["resourceProgress"]>,
  mode: "merge" | "replace"
) {
  for (const item of incoming) {
    const existing =
      mode === "merge"
        ? await db.resourceProgress.where("resourceId").equals(item.resourceId).first()
        : undefined;
    if (!existing) {
      await putAndQueue(db.resourceProgress, "resource_progress", {
        ...item,
        githubState: item.githubState ?? null,
        syncStatus: "pending",
      });
      continue;
    }
    const merged = mergeResourceProgress(
      {
        started: existing.started,
        completed: existing.completed,
        githubState: existing.githubState,
        completedAt: existing.completedAt,
        lastOpenedAt: existing.lastOpenedAt,
      },
      {
        started: item.started,
        completed: item.completed,
        githubState: (item.githubState as GithubResourceState | null) ?? null,
        completedAt: item.completedAt,
        lastOpenedAt: item.lastOpenedAt,
      }
    );
    const record: ResourceProgress = {
      ...existing,
      ...merged,
      bookmarked: existing.bookmarked || item.bookmarked,
      notes: existing.notes ?? item.notes,
      updatedAt: nowIso(),
      localRevision: existing.localRevision + 1,
      syncStatus: "pending",
    };
    await putAndQueue(db.resourceProgress, "resource_progress", record);
  }
}

async function importNotes(
  incoming: NonNullable<ExportData["data"]["notes"]>,
  mode: "merge" | "replace"
) {
  for (const item of incoming) {
    const existing = mode === "merge" ? await db.notes.get(item.id) : undefined;
    if (!existing) {
      await putAndQueue(db.notes, "note", { ...item, syncStatus: "pending" });
      continue;
    }
    if (existing.content === item.content) continue;
    // Concurrent text edits are preserved rather than silently overwritten.
    await db.notes.update(existing.id, {
      conflictState: "unresolved",
      conflictBackup: item.content,
      syncStatus: "pending",
      updatedAt: nowIso(),
    });
    await db.conflicts.put({
      id: `import-conflict-${existing.id}`,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      localRevision: existing.localRevision,
      syncStatus: "conflict",
      entityType: "note",
      entityId: existing.id,
      localData: existing,
      remoteData: item,
      conflictState: "unresolved",
      resolvedAt: null,
    });
  }
}

async function importBookmarks(
  incoming: NonNullable<ExportData["data"]["bookmarks"]>,
  mode: "merge" | "replace"
) {
  for (const item of incoming) {
    const existing = mode === "merge" ? await db.bookmarks.get(item.id) : undefined;
    if (!existing) {
      await putAndQueue(db.bookmarks, "bookmark", { ...item, syncStatus: "pending" });
      continue;
    }
    // Deletion is authoritative via tombstones, never by absence.
    if (item.deletedAt) {
      await db.bookmarks.update(existing.id, {
        deletedAt: item.deletedAt,
        syncStatus: "pending",
        updatedAt: nowIso(),
      });
    }
  }
}

async function importStudySessions(
  incoming: NonNullable<ExportData["data"]["studySessions"]>
) {
  const existing = await db.studySessions.toArray();
  const seen = new Set(existing.map((row) => row.clientSessionId));
  for (const item of incoming) {
    if (seen.has(item.clientSessionId)) continue;
    seen.add(item.clientSessionId);
    await putAndQueue(db.studySessions, "study_session", { ...item, syncStatus: "pending" });
  }
}

async function importQuizAttempts(incoming: NonNullable<ExportData["data"]["quizAttempts"]>) {
  const existing = await db.quizAttempts.toArray();
  const seen = new Set(existing.map((row) => row.attemptId));
  for (const item of incoming) {
    if (seen.has(item.attemptId)) continue;
    seen.add(item.attemptId);
    await putAndQueue(db.quizAttempts, "quiz_attempt", {
      ...item,
      answers: item.answers ?? {},
      syncStatus: "pending",
    });
  }
}

async function importProjects(
  incoming: NonNullable<ExportData["data"]["projectProgress"]>,
  mode: "merge" | "replace"
) {
  for (const item of incoming) {
    const existingRows =
      mode === "merge" ? await db.projectProgress.where("projectId").equals(item.projectId).toArray() : [];
    const existing = existingRows.find((row) => row.milestoneId === item.milestoneId);
    if (!existing) {
      await putAndQueue(db.projectProgress, "project_progress", { ...item, syncStatus: "pending" });
      continue;
    }
    const record: ProjectProgress = {
      ...existing,
      completed: existing.completed || item.completed,
      completedAt: existing.completedAt ?? item.completedAt,
      evidenceUrl: existing.evidenceUrl ?? item.evidenceUrl,
      notes: existing.notes ?? item.notes,
      updatedAt: nowIso(),
      localRevision: existing.localRevision + 1,
      syncStatus: "pending",
    };
    await putAndQueue(db.projectProgress, "project_progress", record);
  }
}

async function importRoadmap(
  incoming: NonNullable<ExportData["data"]["roadmapState"]>,
  mode: "merge" | "replace"
) {
  if (incoming.length === 0) return;
  const existing = await db.roadmapState.toArray();
  if (mode === "merge" && existing.length > 0) return;
  for (const item of incoming) {
    await putAndQueue(db.roadmapState, "roadmap_state", {
      ...item,
      state: item.state ?? {},
      syncStatus: "pending",
    });
  }
}

async function importProjectEvidence(
  incoming: NonNullable<ExportData["data"]["projectEvidence"]>,
  mode: "merge" | "replace"
) {
  for (const item of incoming) {
    const existing = mode === "merge" ? await db.projectEvidence.get(item.id) : undefined;
    if (!existing) {
      await putAndQueue(db.projectEvidence, "project_evidence", {
        ...item,
        kind: item.kind as ProjectEvidence["kind"],
        details: item.details ?? null,
        selfReported: true,
        syncStatus: "pending",
      });
      continue;
    }
    // Evidence entries are immutable once attached; a differing incoming copy
    // keeps the newer revision and re-queues for sync.
    if (item.localRevision > existing.localRevision) {
      await putAndQueue(db.projectEvidence, "project_evidence", {
        ...item,
        kind: item.kind as ProjectEvidence["kind"],
        details: item.details ?? null,
        selfReported: true,
        syncStatus: "pending",
        updatedAt: nowIso(),
      });
    }
  }
}

async function importProjectSelfAssessments(
  incoming: NonNullable<ExportData["data"]["projectSelfAssessments"]>,
  mode: "merge" | "replace"
) {
  for (const item of incoming) {
    const existing =
      mode === "merge"
        ? await db.projectSelfAssessments.where("projectId").equals(item.projectId).first()
        : undefined;
    if (!existing) {
      await putAndQueue(db.projectSelfAssessments, "project_self_assessment", {
        ...item,
        syncStatus: "pending",
      });
      continue;
    }
    // Per-category scores merge upward: the learner keeps the best self-assessed
    // score per rubric category (deterministic, no silent shrink).
    const mergedScores: Record<string, number> = { ...existing.scores };
    for (const [categoryId, score] of Object.entries(item.scores)) {
      const current = mergedScores[categoryId];
      if (typeof current !== "number" || score > current) mergedScores[categoryId] = score;
    }
    const earnedValues = Object.values(mergedScores);
    const record = {
      ...existing,
      scores: mergedScores,
      totalEarned: existing.totalEarned ?? item.totalEarned,
      totalMax: existing.totalMax ?? item.totalMax,
      updatedAt: nowIso(),
      localRevision: existing.localRevision + 1,
      syncStatus: "pending" as const,
    };
    void earnedValues;
    await putAndQueue(db.projectSelfAssessments, "project_self_assessment", record);
  }
}

async function putAndQueue<T extends { id: string; localRevision: number }>(
  table: { put: (item: T) => Promise<unknown> },
  entityType: string,
  record: T
) {
  await table.put(record);
  await syncQueue.enqueue({
    entityType,
    entityId: record.id,
    operation: "update",
    payload: record,
    baseRevision: record.localRevision,
  });
}

export async function importProgress(
  file: File,
  mode: "merge" | "replace"
): Promise<{ success: boolean; errors: string[] }> {
  try {
    const text = await file.text();
    const result = await importProgressFromObject(JSON.parse(text), mode);
    return { success: result.success, errors: result.errors };
  } catch (err) {
    return { success: false, errors: [err instanceof Error ? err.message : "Import failed"] };
  }
}

export async function resetLocalLearningData(): Promise<void> {
  await db.transaction("rw", [...LEARNING_TABLES, db.importBackups, db.localProfile], async () => {
    const snapshot = await exportProgress();
    await clearLearningData();
    await db.importBackups.put({
      ...createBase({ id: "pre-reset-backup" }),
      payload: snapshot,
    });
  });
}

export async function estimateLocalStorageBytes(): Promise<number> {
  if (typeof navigator !== "undefined" && navigator.storage?.estimate) {
    const estimate = await navigator.storage.estimate();
    return estimate.usage ?? 0;
  }
  const snapshot = await exportProgress();
  return new Blob([JSON.stringify(snapshot)]).size;
}

async function importReviewHistory(
  incoming: NonNullable<ExportData["data"]["reviewHistory"]>,
  mode: "merge" | "replace"
) {
  for (const item of incoming) {
    const existing =
      mode === "merge"
        ? await db.reviewHistory.where("skillId").equals(item.skillId).first()
        : undefined;
    if (!existing) {
      await putAndQueue(db.reviewHistory, "review_history", { ...item, syncStatus: "pending" });
      continue;
    }
    // Monotonic: keep the higher successful review count and the latest review date.
    await putAndQueue(db.reviewHistory, "review_history", {
      ...existing,
      successfulReviews: Math.max(existing.successfulReviews, item.successfulReviews),
      lastReviewedAt:
        !existing.lastReviewedAt || (item.lastReviewedAt && item.lastReviewedAt > existing.lastReviewedAt)
          ? item.lastReviewedAt
          : existing.lastReviewedAt,
      updatedAt: nowIso(),
      localRevision: existing.localRevision + 1,
      syncStatus: "pending",
    });
  }
}
