"use client";

import { useCallback, useEffect, useState } from "react";
import { lessonProgressRepo } from "@/lib/progress/repositories/lesson-progress";
import type { LessonProgress } from "@/lib/progress/db";
import type { LessonActivityAvailability } from "@/lib/progress/completion";
import { evaluateCompletion } from "@/lib/progress/completion";

export interface LessonProgressMetadata {
  lessonTitle?: string | null;
  lessonHref?: string | null;
  phaseSlug?: string | null;
  phaseNumber?: number | null;
}

export function useLessonProgress(
  lessonId: string | null,
  availability?: LessonActivityAvailability,
  metadata?: LessonProgressMetadata
) {
  const [progress, setProgress] = useState<LessonProgress | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!lessonId) {
      setProgress(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setProgress((await lessonProgressRepo.getByLesson(lessonId)) ?? null);
    } finally {
      setLoading(false);
    }
  }, [lessonId]);

  useEffect(() => {
    void load();
  }, [load]);

  const upsert = useCallback(
    async (input: Omit<Parameters<typeof lessonProgressRepo.upsert>[0], "lessonId">) => {
      if (!lessonId) return;
      const result = await lessonProgressRepo.upsert({
        lessonId,
        availability,
        ...metadata,
        ...input,
      });
      setProgress(result);
      return result;
    },
    [lessonId, availability, metadata]
  );

  const markReadingComplete = useCallback(async () => {
    if (!lessonId) return;
    const result = await lessonProgressRepo.upsert({
      lessonId,
      availability,
      ...metadata,
      readingComplete: true,
    });
    setProgress(result);
    return result;
  }, [lessonId, availability, metadata]);

  const evaluation = progress
    ? evaluateCompletion(
        progress.status,
        availability ?? {
          hasVideo: false,
          hasQuiz: false,
          hasProject: false,
          hasResources: false,
        },
        progress,
        progress.masteryScore,
        progress.needsReview
      )
    : null;

  return {
    progress,
    loading,
    evaluation,
    upsert,
    markReadingComplete,
    refetch: load,
  };
}
