import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  reviewHistory,
  bookmarks,
  notes,
  projectEvidence,
  projectProgress,
  projectSelfAssessments,
  quizAttempts,
  roadmapState,
  studySessions,
  syncBatches,
  syncConflicts,
  tombstones,
  userLessonProgress,
  userResourceProgress,
} from "@/db/schema";
import { getAuthenticatedUserId } from "@/lib/auth/session";
import {
  SyncRequestSchema,
  SyncResponseSchema,
  type SyncResponse,
} from "@/lib/progress/sync/protocol";
import { processSyncBatch, mergeMasteryScore } from "@/lib/progress/sync/engine";
import { fetchRemoteChanges, getCloudSnapshot, hydrateStore } from "@/lib/progress/sync/server";
import { monotonicMergeStatus, type LessonStatus } from "@/lib/progress/completion";
import { checkRateLimit } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function toDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toNumber(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

/** GET returns the caller's full cloud snapshot (used by guest -> account merge). */
export async function GET() {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json(
      {
        error: "Authentication required",
        guest: true,
        message: "Guest progress remains on this device. Sign in to read cloud state.",
      },
      { status: 401 }
    );
  }

  const snapshot = await getCloudSnapshot(userId);
  return NextResponse.json(snapshot, {
    headers: { "Cache-Control": "no-store, private" },
  });
}

export async function POST(req: NextRequest) {
  try {
    const contentLength = Number(req.headers?.get?.("content-length") ?? 0);
    if (contentLength > 1_000_000) {
      return NextResponse.json({ error: "Request too large" }, { status: 413 });
    }
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json(
        {
          error: "Authentication required for cloud sync",
          guest: true,
          message: "Guest progress remains on this device. Sign in to synchronize.",
        },
        { status: 401 }
      );
    }
    const rateLimit = checkRateLimit(`sync:${userId}`, { limit: 60, windowMs: 60_000 });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many requests" },
        {
          status: 429,
          headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
        }
      );
    }

    const body = await req.json().catch(() => null);
    const parsed = SyncRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.errors },
        { status: 400 }
      );
    }

    // Idempotency: a replay of an already-processed batch returns the prior
    // result verbatim and never re-applies mutations.
    const existing = await db
      .select()
      .from(syncBatches)
      .where(
        and(
          eq(syncBatches.userId, userId),
          eq(syncBatches.clientBatchId, parsed.data.clientBatchId)
        )
      )
      .limit(1);

    if (existing[0]?.responseJson) {
      return NextResponse.json(SyncResponseSchema.parse(existing[0].responseJson), {
        headers: { "Cache-Control": "no-store, private" },
      });
    }

    const batchStart = new Date();
    const store = await hydrateStore(userId);
    const computed = processSyncBatch(store, userId, parsed.data);
    const persisted = await persistMutations(userId, parsed.data, computed);

    const remoteChanges = await fetchRemoteChanges(
      userId,
      parsed.data.lastSyncCursor,
      batchStart
    );

    const response: SyncResponse = {
      accepted: persisted.accepted,
      rejected: [...computed.rejected, ...persisted.rejected],
      remoteChanges,
      conflicts: computed.conflicts,
      nextSyncCursor: batchStart.toISOString(),
    };

    await db
      .insert(syncBatches)
      .values({
        userId,
        clientBatchId: parsed.data.clientBatchId,
        status: response.rejected.length > 0 ? "partial" : "applied",
        appliedCount: response.accepted.length,
        rejectedCount: response.rejected.length,
        conflictCount: response.conflicts.length,
        metadata: {
          deviceId: parsed.data.deviceId,
          lastSyncCursor: parsed.data.lastSyncCursor,
        },
        responseJson: response,
        deviceId: isUuid(parsed.data.deviceId) ? parsed.data.deviceId : null,
      })
      .onConflictDoNothing();

    return NextResponse.json(SyncResponseSchema.parse(response), {
      headers: { "Cache-Control": "no-store, private" },
    });
  } catch (err) {
    console.error("Sync request failed", err instanceof Error ? err.message : "unknown error");
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}

async function persistMutations(
  userId: string,
  request: ReturnType<typeof SyncRequestSchema.parse>,
  computed: SyncResponse
): Promise<{ accepted: string[]; rejected: SyncResponse["rejected"] }> {
  const accepted: string[] = [];
  const rejected: SyncResponse["rejected"] = [];
  const acceptedSet = new Set(computed.accepted);

  for (const mutation of request.mutations) {
    if (!acceptedSet.has(mutation.entityId)) continue;
    const payload = mutation.payload;

    try {
      switch (mutation.entityType) {
        case "lesson_progress":
          await persistLessonProgress(userId, mutation.entityId, payload);
          break;
        case "resource_progress":
          if (!isUuid(payload.resourceId)) {
            rejected.push({ entityId: mutation.entityId, reason: "Invalid resourceId" });
            continue;
          }
          await persistResourceProgress(userId, payload.resourceId, payload);
          break;
        case "note":
          await persistNote(userId, mutation.entityId, payload);
          break;
        case "bookmark":
          await persistBookmark(userId, mutation.entityId, mutation.operation, payload);
          break;
        case "study_session":
          await persistStudySession(userId, payload);
          break;
        case "quiz_attempt":
          await persistQuizAttempt(userId, mutation.entityId, payload);
          break;
        case "project_progress":
          await persistProjectProgress(userId, payload);
          break;
        case "review_history":
          await persistReviewHistory(userId, payload);
          break;
        case "project_evidence":
          await persistProjectEvidence(userId, mutation.entityId, payload);
          break;
        case "project_self_assessment":
          await persistProjectSelfAssessment(userId, mutation.entityId, payload);
          break;
        case "roadmap_state":
          await persistRoadmap(userId, payload);
          break;
        case "tombstone":
          await persistTombstone(userId, mutation.entityId, payload);
          break;
        default:
          break;
      }
      accepted.push(mutation.entityId);
    } catch (err) {
      rejected.push({
        entityId: mutation.entityId,
        reason: err instanceof Error ? err.message : "Persistence error",
      });
    }
  }

  for (const conflict of computed.conflicts) {
    const row = conflict as {
      entityType: string;
      entityId: string;
      localData?: unknown;
      remoteData?: unknown;
    };
    await db.insert(syncConflicts).values({
      userId,
      entityType: row.entityType,
      entityId: row.entityId,
      localData: row.localData ?? {},
      remoteData: row.remoteData ?? {},
      conflictState: "unresolved",
    });
  }

  return { accepted, rejected };
}

async function persistLessonProgress(
  userId: string,
  entityId: string,
  payload: Record<string, unknown>
) {
  const lessonKey = String(payload.lessonId ?? entityId);
  const existing = await db
    .select()
    .from(userLessonProgress)
    .where(
      and(eq(userLessonProgress.userId, userId), eq(userLessonProgress.lessonKey, lessonKey))
    )
    .limit(1);

  const status = monotonicMergeStatus(
    (existing[0]?.status as LessonStatus) ?? "not_started",
    (payload.status as LessonStatus) ?? "not_started"
  );

  const readingComplete = Boolean(existing[0]?.readingComplete || payload.readingComplete);
  const requiredResourcesComplete = Boolean(
    existing[0]?.requiredResourcesComplete || payload.requiredResourcesComplete
  );
  const practiceComplete = Boolean(existing[0]?.practiceComplete || payload.practiceComplete);
  const projectComplete = Boolean(existing[0]?.projectComplete || payload.projectComplete);
  const needsReview = Boolean(existing[0]?.needsReview || payload.needsReview);
  const masteryScore = mergeMasteryScore(existing[0]?.masteryScore, payload.masteryScore);

  const flags = [
    readingComplete,
    requiredResourcesComplete,
    practiceComplete,
    projectComplete,
  ];
  const progressPercent = Math.round(
    (flags.filter(Boolean).length / Math.max(1, flags.length)) * 100
  );

  if (existing[0]) {
    await db
      .update(userLessonProgress)
      .set({
        status,
        readingComplete,
        requiredResourcesComplete,
        practiceComplete,
        projectComplete,
        needsReview,
        masteryScore,
        progressPercent,
        startedAt: existing[0].startedAt ?? toDate(payload.startedAt),
        completedAt: existing[0].completedAt ?? toDate(payload.completedAt),
        masteredAt: existing[0].masteredAt ?? toDate(payload.masteredAt),
        localRevision: Math.max(existing[0].localRevision, 0) + 1,
        syncStatus: "synced",
        updatedAt: new Date(),
      })
      .where(eq(userLessonProgress.id, existing[0].id));
    return;
  }

  await db.insert(userLessonProgress).values({
    userId,
    lessonKey,
    status,
    readingComplete,
    requiredResourcesComplete,
    practiceComplete,
    projectComplete,
    needsReview,
    masteryScore,
    progressPercent,
    startedAt: toDate(payload.startedAt),
    completedAt: toDate(payload.completedAt),
    masteredAt: toDate(payload.masteredAt),
    syncStatus: "synced",
  });
}

async function persistResourceProgress(
  userId: string,
  resourceId: string,
  payload: Record<string, unknown>
) {
  const existing = await db
    .select()
    .from(userResourceProgress)
    .where(
      and(eq(userResourceProgress.userId, userId), eq(userResourceProgress.resourceId, resourceId))
    )
    .limit(1);

  const completed = Boolean(existing[0]?.status === "completed" || payload.completed);
  const metadata = {
    ...((existing[0]?.metadata ?? {}) as Record<string, unknown>),
    githubState: payload.githubState ?? null,
    resourceType: payload.resourceType ?? null,
    resourceTitle: payload.resourceTitle ?? null,
    href: payload.href ?? null,
  };

  if (existing[0]) {
    await db
      .update(userResourceProgress)
      .set({
        status: completed ? "completed" : "started",
        completedAt: completed ? (existing[0].completedAt ?? new Date()) : null,
        lastAccessedAt: new Date(),
        localRevision: existing[0].localRevision + 1,
        syncStatus: "synced",
        metadata,
        updatedAt: new Date(),
      })
      .where(eq(userResourceProgress.id, existing[0].id));
    return;
  }

  await db
    .insert(userResourceProgress)
    .values({
      userId,
      resourceId,
      status: completed ? "completed" : "started",
      completedAt: completed ? new Date() : null,
      lastAccessedAt: new Date(),
      syncStatus: "synced",
      metadata,
    })
    .onConflictDoNothing();
}

async function persistNote(
  userId: string,
  noteId: string,
  payload: Record<string, unknown>
) {
  if (!isUuid(noteId)) return;
  const existing = await db.select().from(notes).where(eq(notes.id, noteId)).limit(1);
  if (existing[0] && existing[0].userId !== userId) return;

  if (existing[0]) {
    await db
      .update(notes)
      .set({
        content: String(payload.content ?? existing[0].content),
        contentRevision: existing[0].contentRevision + 1,
        localRevision: existing[0].localRevision + 1,
        syncStatus: "synced",
        updatedAt: new Date(),
      })
      .where(and(eq(notes.id, noteId), eq(notes.userId, userId)));
    return;
  }

  await db.insert(notes).values({
    id: noteId,
    userId,
    lessonKey: typeof payload.lessonId === "string" ? payload.lessonId : null,
    resourceId: isUuid(payload.resourceId) ? payload.resourceId : null,
    projectId: typeof payload.projectId === "string" ? payload.projectId : null,
    content: String(payload.content ?? ""),
    contentRevision: 1,
    syncStatus: "synced",
  });
}

async function persistBookmark(
  userId: string,
  bookmarkId: string,
  operation: "create" | "update" | "delete",
  payload: Record<string, unknown>
) {
  if (!isUuid(bookmarkId)) return;
  const existing = await db.select().from(bookmarks).where(eq(bookmarks.id, bookmarkId)).limit(1);
  if (existing[0] && existing[0].userId !== userId) return;

  if (operation === "delete") {
    const deletedAt = new Date();
    await db
      .insert(tombstones)
      .values({
        userId,
        entityId: bookmarkId,
        entityType: "bookmark",
        deletedAt,
        revision: mutationRevision(payload),
      })
      .onConflictDoUpdate({
        target: [tombstones.userId, tombstones.entityType, tombstones.entityId],
        set: { deletedAt, revision: mutationRevision(payload) },
      });

    if (existing[0]) {
      await db
        .update(bookmarks)
        .set({ deletedAt, syncStatus: "synced", updatedAt: deletedAt })
        .where(and(eq(bookmarks.id, bookmarkId), eq(bookmarks.userId, userId)));
    }
    return;
  }

  const values = {
    lessonKey: typeof payload.lessonId === "string" ? payload.lessonId : null,
    resourceId: isUuid(payload.resourceId) ? payload.resourceId : null,
    projectId: typeof payload.projectId === "string" ? payload.projectId : null,
    targetType: typeof payload.targetType === "string" ? payload.targetType : "lesson",
    title: typeof payload.title === "string" ? payload.title.slice(0, 500) : null,
    href: typeof payload.href === "string" ? payload.href : null,
    deletedAt: null,
    syncStatus: "synced" as const,
    updatedAt: new Date(),
  };

  if (existing[0]) {
    await db
      .update(bookmarks)
      .set({ ...values, localRevision: existing[0].localRevision + 1 })
      .where(and(eq(bookmarks.id, bookmarkId), eq(bookmarks.userId, userId)));
    return;
  }

  await db.insert(bookmarks).values({ id: bookmarkId, userId, ...values }).onConflictDoNothing();
}

async function persistStudySession(userId: string, payload: Record<string, unknown>) {
  const clientSessionId = payload.clientSessionId;
  if (!isUuid(clientSessionId)) return;

  await db
    .insert(studySessions)
    .values({
      userId,
      clientSessionId,
      deviceId: isUuid(payload.deviceId) ? payload.deviceId : null,
      lessonKey: typeof payload.lessonId === "string" ? payload.lessonId : null,
      resourceId: isUuid(payload.resourceId) ? payload.resourceId : null,
      projectId: typeof payload.projectId === "string" ? payload.projectId : null,
      startedAt: toDate(payload.startedAt) ?? new Date(),
      endedAt: toDate(payload.endedAt),
      durationSeconds: Math.max(0, toNumber(payload.durationSeconds) ?? 0),
      syncStatus: "synced",
    })
    .onConflictDoNothing();
}

async function persistQuizAttempt(
  userId: string,
  entityId: string,
  payload: Record<string, unknown>
) {
  const attemptId = isUuid(payload.attemptId) ? payload.attemptId : entityId;
  if (!isUuid(attemptId)) return;

  await db
    .insert(quizAttempts)
    .values({
      userId,
      attemptId,
      quizId: isUuid(payload.quizId) ? payload.quizId : null,
      lessonId: typeof payload.lessonId === "string" ? payload.lessonId : null,
      score: toNumber(payload.score),
      maxScore: toNumber(payload.maxScore),
      percentage: toNumber(payload.percentage),
      answers: payload.answers ?? {},
      startedAt: toDate(payload.startedAt),
      submittedAt: toDate(payload.submittedAt),
      attemptNumber: toNumber(payload.attemptNumber) ?? 1,
      syncStatus: "synced",
    })
    .onConflictDoNothing();
}

const REVIEW_HISTORY_MAX_REVIEWS = 1000;

/** §14 — review scheduling state: upsert per (user, skill), monotonic review count. */
async function persistReviewHistory(userId: string, payload: Record<string, unknown>) {
  const skillId = String(payload.skillId ?? "").slice(0, 120);
  if (!skillId) return;
  const lastReviewedAt = typeof payload.lastReviewedAt === "string" ? payload.lastReviewedAt.slice(0, 100) : null;
  const snoozedUntil = typeof payload.snoozedUntil === "string" ? payload.snoozedUntil.slice(0, 100) : null;
  const successfulReviewsRaw = Number(payload.successfulReviews);
  const successfulReviews = Number.isFinite(successfulReviewsRaw)
    ? Math.min(Math.max(0, Math.round(successfulReviewsRaw)), REVIEW_HISTORY_MAX_REVIEWS)
    : 0;

  const existing = await db
    .select()
    .from(reviewHistory)
    .where(and(eq(reviewHistory.userId, userId), eq(reviewHistory.skillId, skillId)))
    .limit(1);

  if (existing[0]) {
    await db
      .update(reviewHistory)
      .set({
        successfulReviews: Math.max(existing[0].successfulReviews, successfulReviews),
        lastReviewedAt: lastReviewedAt ? new Date(lastReviewedAt) : existing[0].lastReviewedAt,
        // A snooze is a learner decision - always take the newest value.
        snoozedUntil:
          snoozedUntil !== undefined && snoozedUntil !== null
            ? new Date(snoozedUntil)
            : existing[0].snoozedUntil,
        updatedAt: new Date(),
        syncStatus: "synced",
      })
      .where(eq(reviewHistory.id, existing[0].id));
    return;
  }

  await db.insert(reviewHistory).values({
    userId,
    skillId,
    successfulReviews,
    lastReviewedAt: lastReviewedAt ? new Date(lastReviewedAt) : null,
    snoozedUntil: snoozedUntil ? new Date(snoozedUntil) : null,
    syncStatus: "synced",
  });
}

async function persistProjectProgress(userId: string, payload: Record<string, unknown>) {
  const projectId = String(payload.projectId ?? "unknown").slice(0, 200);
  const milestoneId =
    typeof payload.milestoneId === "string" ? payload.milestoneId.slice(0, 200) : null;
  const completed = Boolean(payload.completed);

  const existing = await db
    .select()
    .from(projectProgress)
    .where(
      and(
        eq(projectProgress.userId, userId),
        eq(projectProgress.projectId, projectId),
        milestoneId ? eq(projectProgress.milestoneId, milestoneId) : isNull(projectProgress.milestoneId)
      )
    )
    .limit(1);

  if (existing[0]) {
    await db
      .update(projectProgress)
      .set({
        completed: existing[0].completed || completed,
        completedAt: existing[0].completedAt ?? (completed ? new Date() : null),
        evidenceUrl:
          typeof payload.evidenceUrl === "string" ? payload.evidenceUrl : existing[0].evidenceUrl,
        note: typeof payload.notes === "string" ? payload.notes : existing[0].note,
        syncStatus: "synced",
        updatedAt: new Date(),
      })
      .where(eq(projectProgress.id, existing[0].id));
    return;
  }

  await db.insert(projectProgress).values({
    userId,
    lessonKey: projectId,
    projectId,
    milestoneId,
    completed,
    completedAt: completed ? new Date() : null,
    evidenceUrl: typeof payload.evidenceUrl === "string" ? payload.evidenceUrl : null,
    note: typeof payload.notes === "string" ? payload.notes : null,
    syncStatus: "synced",
  });
}

async function persistProjectEvidence(
  userId: string,
  entityId: string,
  payload: Record<string, unknown>
) {
  const projectId = String(payload.projectId ?? "unknown").slice(0, 200);
  const kind = String(payload.kind ?? "other").slice(0, 50);
  const value = typeof payload.value === "string" ? payload.value : null;
  const evidenceId = typeof payload.id === "string" && isUuid(payload.id) ? payload.id : null;

  // Upsert by client id when it is a valid uuid; otherwise let Postgres generate one.
  if (evidenceId) {
    const existing = await db
      .select()
      .from(projectEvidence)
      .where(and(eq(projectEvidence.userId, userId), eq(projectEvidence.id, evidenceId)))
      .limit(1);
    if (existing[0]) {
      if (payload.deletedAt) {
        await db
          .update(projectEvidence)
          .set({ deletedAt: new Date(String(payload.deletedAt)), syncStatus: "synced", updatedAt: new Date() })
          .where(eq(projectEvidence.id, existing[0].id));
        return;
      }
      await db
        .update(projectEvidence)
        .set({
          kind,
          value: value ?? existing[0].value,
          title: typeof payload.title === "string" ? payload.title : existing[0].title,
          details: payload.details ?? existing[0].details,
          syncStatus: "synced",
          updatedAt: new Date(),
        })
        .where(eq(projectEvidence.id, existing[0].id));
      return;
    }
  }

  await db.insert(projectEvidence).values({
    ...(evidenceId ? { id: evidenceId } : {}),
    userId,
    projectId,
    kind,
    value,
    title: typeof payload.title === "string" ? payload.title : null,
    details: (payload.details ?? null) as never,
    selfReported: true,
    deletedAt: payload.deletedAt ? new Date(String(payload.deletedAt)) : null,
    syncStatus: "synced",
  });
}

async function persistProjectSelfAssessment(
  userId: string,
  entityId: string,
  payload: Record<string, unknown>
) {
  const projectId = String(payload.projectId ?? "unknown").slice(0, 200);
  const scores = (payload.scores ?? {}) as Record<string, number>;
  const assessmentId = typeof payload.id === "string" && isUuid(payload.id) ? payload.id : null;

  await db
    .insert(projectSelfAssessments)
    .values({
      ...(assessmentId ? { id: assessmentId } : {}),
      userId,
      projectId,
      scores,
      totalEarned: typeof payload.totalEarned === "number" ? payload.totalEarned : null,
      totalMax: typeof payload.totalMax === "number" ? payload.totalMax : null,
      selfAssessedAt: payload.updatedAt ? new Date(String(payload.updatedAt)) : new Date(),
      syncStatus: "synced",
    })
    .onConflictDoUpdate({
      target: projectSelfAssessments.id,
      set: {
        scores,
        totalEarned: typeof payload.totalEarned === "number" ? payload.totalEarned : null,
        totalMax: typeof payload.totalMax === "number" ? payload.totalMax : null,
        selfAssessedAt: new Date(),
        syncStatus: "synced",
        updatedAt: new Date(),
      },
    });
}

async function persistRoadmap(userId: string, payload: Record<string, unknown>) {
  const state = (payload.state ?? payload) as Record<string, unknown>;
  await db
    .insert(roadmapState)
    .values({ userId, state, syncStatus: "synced" })
    .onConflictDoUpdate({
      target: roadmapState.userId,
      set: { state, updatedAt: new Date(), syncStatus: "synced" },
    });
}

async function persistTombstone(
  userId: string,
  entityId: string,
  payload: Record<string, unknown>
) {
  const entityType = String(payload.entityType ?? "bookmark").slice(0, 50);
  const deletedAt = toDate(payload.deletedAt) ?? new Date();
  const revision = toNumber(payload.revision) ?? 1;

  await db
    .insert(tombstones)
    .values({ userId, entityId, entityType, deletedAt, revision })
    .onConflictDoUpdate({
      target: [tombstones.userId, tombstones.entityType, tombstones.entityId],
      set: { deletedAt, revision },
    });

  if (entityType === "note" && isUuid(entityId)) {
    await db.delete(notes).where(and(eq(notes.id, entityId), eq(notes.userId, userId)));
  }
}

function mutationRevision(payload: Record<string, unknown>): number {
  return toNumber(payload.localRevision) ?? 1;
}
