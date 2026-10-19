"use client";

import { useCallback, useEffect, useState } from "react";
import { quizAttemptsRepo } from "@/lib/progress/repositories/quiz-attempts";
import type { QuizAttempt } from "@/lib/progress/db";
import { newId } from "@/lib/progress/records";

export function useQuizAttempts(lessonId: string | null) {
  const [attempts, setAttempts] = useState<QuizAttempt[]>([]);
  const [bestScore, setBestScore] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!lessonId) {
      setAttempts([]);
      setBestScore(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setAttempts(await quizAttemptsRepo.getByLesson(lessonId));
      setBestScore(await quizAttemptsRepo.getBestScore(lessonId));
    } finally {
      setLoading(false);
    }
  }, [lessonId]);

  useEffect(() => {
    void load();
  }, [load]);

  const submitAttempt = useCallback(
    async (input: {
      quizId: string;
      answers: unknown;
      score: number;
      maxScore: number;
      startedAt: string;
    }) => {
      if (!lessonId) return;
      const percentage = input.maxScore === 0 ? 0 : Math.round((input.score / input.maxScore) * 100);
      const result = await quizAttemptsRepo.create({
        attemptId: newId(),
        quizId: input.quizId,
        lessonId,
        answers: input.answers,
        score: input.score,
        maxScore: input.maxScore,
        percentage,
        startedAt: input.startedAt,
        submittedAt: new Date().toISOString(),
        attemptNumber: await quizAttemptsRepo.nextAttemptNumber(lessonId),
      });
      await load();
      return result;
    },
    [lessonId, load]
  );

  return { attempts, bestScore, loading, submitAttempt, refetch: load };
}
