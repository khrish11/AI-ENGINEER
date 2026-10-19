"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { lessonProgressRepo } from "@/lib/progress/repositories/lesson-progress";
import type { LessonProgress } from "@/lib/progress/db";

export function useAllLessonProgress() {
  const [progress, setProgress] = useState<LessonProgress[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setProgress(await lessonProgressRepo.getAll());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const byLessonId = useMemo(
    () => new Map(progress.map((row) => [row.lessonId, row])),
    [progress]
  );

  return { progress, byLessonId, loading, refetch: load };
}
