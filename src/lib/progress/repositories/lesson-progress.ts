import { db, type LessonProgress } from "../db";
import { bumpRevision, createBase, nowIso } from "../records";
import { syncQueue } from "../sync-queue";
import {
  evaluateCompletion,
  monotonicMergeStatus,
  type LessonActivityAvailability,
  type LessonStatus,
} from "../completion";

export interface UpsertLessonProgressInput {
  lessonId: string;
  lessonTitle?: string | null;
  lessonHref?: string | null;
  phaseSlug?: string | null;
  phaseNumber?: number | null;
  status?: LessonProgress["status"];
  readingComplete?: boolean;
  requiredResourcesComplete?: boolean;
  practiceComplete?: boolean;
  projectComplete?: boolean;
  masteryScore?: number | null;
  needsReview?: boolean;
  startedAt?: string | null;
  completedAt?: string | null;
  masteredAt?: string | null;
  availability?: LessonActivityAvailability;
}

function mergeLocalMastery(
  current: number | null,
  candidate: number | null | undefined
): number | null {
  if (candidate === null || candidate === undefined) return current;
  if (current === null) return candidate;
  return Math.max(current, candidate);
}

const DEFAULT_AVAILABILITY: LessonActivityAvailability = {
  hasVideo: false,
  hasQuiz: false,
  hasProject: false,
  hasResources: false,
};

function emptyProgress(lessonId: string): LessonProgress {
  return {
    ...createBase(),
    lessonId,
    lessonTitle: null,
    lessonHref: null,
    phaseSlug: null,
    phaseNumber: null,
    status: "not_started",
    readingComplete: false,
    requiredResourcesComplete: false,
    practiceComplete: false,
    projectComplete: false,
    masteryScore: null,
    needsReview: false,
    startedAt: null,
    completedAt: null,
    masteredAt: null,
  };
}

export class LessonProgressRepository {
  async getByLesson(lessonId: string): Promise<LessonProgress | null> {
    return (await db.lessonProgress.where("lessonId").equals(lessonId).first()) ?? null;
  }

  async getAll(): Promise<LessonProgress[]> {
    return db.lessonProgress.toArray();
  }

  async getByPhase(phaseSlug: string): Promise<LessonProgress[]> {
    return db.lessonProgress.where("phaseSlug").equals(phaseSlug).toArray();
  }

  async upsert(input: UpsertLessonProgressInput): Promise<LessonProgress> {
    const existing = await this.getByLesson(input.lessonId);
    const base = existing ?? emptyProgress(input.lessonId);
    const now = nowIso();

    // Completion fields are monotonic locally too: a component that reports a
    // stale `false` must not erase a checkbox the learner already earned.
    const merged = {
      readingComplete: base.readingComplete || Boolean(input.readingComplete),
      requiredResourcesComplete:
        base.requiredResourcesComplete || Boolean(input.requiredResourcesComplete),
      practiceComplete: base.practiceComplete || Boolean(input.practiceComplete),
      projectComplete: base.projectComplete || Boolean(input.projectComplete),
      masteryScore: mergeLocalMastery(base.masteryScore, input.masteryScore),
      needsReview: input.needsReview ?? base.needsReview,
    };

    // Completion rules adapt to what the lesson actually contains. Explicitly
    // passing `null` availability keeps a lesson open until its own panels
    // report their state.
    const evaluation = evaluateCompletion(
      input.status ?? base.status,
      input.availability ?? DEFAULT_AVAILABILITY,
      {
        readingComplete: merged.readingComplete,
        requiredResourcesComplete: merged.requiredResourcesComplete,
        practiceComplete: merged.practiceComplete,
        projectComplete: merged.projectComplete,
      },
      merged.masteryScore,
      merged.needsReview
    );

    // Local status is monotonic: a page re-render or a newly required activity
    // must never erase a completion the learner already earned.
    const status: LessonStatus = monotonicMergeStatus(base.status, evaluation.status);

    const startedAt =
      status !== "not_started" ? (base.startedAt ?? now) : base.startedAt;
    const completedAt =
      status === "completed" || status === "mastered" ? (base.completedAt ?? now) : base.completedAt;
    const masteredAt = status === "mastered" ? (base.masteredAt ?? now) : base.masteredAt;

    const record: LessonProgress = {
      ...base,
      ...(existing ? bumpRevision(existing.localRevision) : createBase({ id: base.id })),
      lessonId: input.lessonId,
      lessonTitle: input.lessonTitle ?? base.lessonTitle ?? null,
      lessonHref: input.lessonHref ?? base.lessonHref ?? null,
      phaseSlug: input.phaseSlug ?? base.phaseSlug ?? null,
      phaseNumber: input.phaseNumber ?? base.phaseNumber ?? null,
      status,
      readingComplete: merged.readingComplete,
      requiredResourcesComplete: merged.requiredResourcesComplete,
      practiceComplete: merged.practiceComplete,
      projectComplete: merged.projectComplete,
      masteryScore: merged.masteryScore,
      needsReview: merged.needsReview,
      startedAt,
      completedAt,
      masteredAt,
    };

    await db.lessonProgress.put(record);
    await syncQueue.enqueue({
      entityType: "lesson_progress",
      entityId: record.id,
      operation: existing ? "update" : "create",
      payload: record,
      baseRevision: existing?.localRevision ?? 0,
    });
    return record;
  }

  async markReadingComplete(
    lessonId: string,
    availability?: LessonActivityAvailability,
    metadata?: Partial<UpsertLessonProgressInput>
  ): Promise<LessonProgress> {
    return this.upsert({
      lessonId,
      readingComplete: true,
      availability,
      ...metadata,
    });
  }

  async markResourcesComplete(
    lessonId: string,
    availability?: LessonActivityAvailability
  ): Promise<LessonProgress> {
    return this.upsert({ lessonId, requiredResourcesComplete: true, availability });
  }

  async markPracticeComplete(
    lessonId: string,
    availability?: LessonActivityAvailability
  ): Promise<LessonProgress> {
    return this.upsert({ lessonId, practiceComplete: true, availability });
  }

  async markProjectComplete(
    lessonId: string,
    availability?: LessonActivityAvailability
  ): Promise<LessonProgress> {
    return this.upsert({ lessonId, projectComplete: true, availability });
  }

  async setMasteryScore(lessonId: string, score: number | null): Promise<LessonProgress> {
    return this.upsert({ lessonId, masteryScore: score });
  }

  async setNeedsReview(lessonId: string, needsReview: boolean): Promise<LessonProgress> {
    return this.upsert({ lessonId, needsReview });
  }

  async delete(lessonId: string): Promise<void> {
    const record = await this.getByLesson(lessonId);
    if (record) await db.lessonProgress.delete(record.id);
  }
}

export const lessonProgressRepo = new LessonProgressRepository();
