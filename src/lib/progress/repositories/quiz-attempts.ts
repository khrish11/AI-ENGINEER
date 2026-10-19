import { db, type QuizAttempt } from "../db";
import { createBase } from "../records";
import { syncQueue } from "../sync-queue";

export interface CreateQuizAttemptInput {
  attemptId: string;
  quizId: string;
  lessonId: string;
  answers: unknown;
  score: number | null;
  maxScore: number | null;
  percentage: number | null;
  startedAt: string;
  submittedAt?: string;
  attemptNumber: number;
}

export class QuizAttemptsRepository {
  async getByLesson(lessonId: string): Promise<QuizAttempt[]> {
    return db.quizAttempts.where("lessonId").equals(lessonId).toArray();
  }

  async getByAttemptId(attemptId: string): Promise<QuizAttempt | null> {
    return (await db.quizAttempts.where("attemptId").equals(attemptId).first()) ?? null;
  }

  async getBestScore(lessonId: string): Promise<number | null> {
    const attempts = await this.getByLesson(lessonId);
    const scores = attempts.map((a) => a.percentage).filter((p): p is number => p !== null);
    if (scores.length === 0) return null;
    return Math.max(...scores);
  }

  async nextAttemptNumber(lessonId: string): Promise<number> {
    const attempts = await this.getByLesson(lessonId);
    return attempts.length + 1;
  }

  async create(input: CreateQuizAttemptInput): Promise<QuizAttempt> {
    const existing = await this.getByAttemptId(input.attemptId);
    if (existing) return existing;

    const record: QuizAttempt = {
      ...createBase(),
      attemptId: input.attemptId,
      quizId: input.quizId,
      lessonId: input.lessonId,
      answers: input.answers,
      score: input.score,
      maxScore: input.maxScore,
      percentage: input.percentage,
      startedAt: input.startedAt,
      submittedAt: input.submittedAt ?? null,
      attemptNumber: input.attemptNumber,
    };
    await db.quizAttempts.add(record);
    await syncQueue.enqueue({
      entityType: "quiz_attempt",
      entityId: record.id,
      operation: "create",
      payload: record,
      baseRevision: 0,
    });
    return record;
  }

  async getAll(): Promise<QuizAttempt[]> {
    return db.quizAttempts.toArray();
  }
}

export const quizAttemptsRepo = new QuizAttemptsRepository();
