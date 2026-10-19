"use client";

import { useEffect, useState } from "react";
import { emptyLearnerStats, getLearnerStats, type LearnerStats } from "@/lib/progress/learner-stats";
import { lessonProgressRepo } from "@/lib/progress/repositories/lesson-progress";
import type { LessonProgress } from "@/lib/progress/db";

export function useLearnerStats() {
  const [stats, setStats] = useState<LearnerStats>(emptyLearnerStats());
  const [lessons, setLessons] = useState<LessonProgress[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [nextStats, nextLessons] = await Promise.all([
        getLearnerStats(),
        lessonProgressRepo.getAll(),
      ]);
      if (!cancelled) {
        setStats(nextStats);
        setLessons(nextLessons);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { stats, lessons, loading };
}
