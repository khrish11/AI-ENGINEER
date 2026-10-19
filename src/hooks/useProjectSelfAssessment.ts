"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { projectSelfAssessmentRepo } from "@/lib/progress/repositories/project-self-assessment";
import type { Rubric } from "@/lib/projects/schema";
import { scoreRubric, type RubricScoreResult } from "@/lib/projects/rubric";

export function useProjectSelfAssessment(projectId: string | null, rubric: Rubric | null) {
  const [scores, setScores] = useState<Record<string, number>>({});
  const [calculated, setCalculated] = useState<RubricScoreResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const loadRequest = useRef(0);

  const load = useCallback(async () => {
    const request = ++loadRequest.current;
    if (!projectId) {
      if (request === loadRequest.current) {
        setLoading(false);
      }
      return;
    }
    setLoading(true);
    try {
      const existing = await projectSelfAssessmentRepo.getByProject(projectId);
      if (request === loadRequest.current) {
        setScores(existing?.scores ?? {});
        if (rubric) {
          setCalculated(scoreRubric(rubric, existing?.scores ?? {}));
        }
      }
    } finally {
      if (request === loadRequest.current) {
        setLoading(false);
      }
    }
  }, [projectId, rubric]);

  useEffect(() => {
    void load();
  }, [load]);

  const setScore = useCallback((categoryId: string, score: number) => {
    setScores((current) => ({ ...current, [categoryId]: score }));
  }, []);

  const save = useCallback(async () => {
    if (!projectId || !rubric) return null;
    setSaving(true);
    try {
      const record = await projectSelfAssessmentRepo.save({ projectId, scores, rubric });
      setScores(record.scores);
      setCalculated(scoreRubric(rubric, record.scores));
      return record;
    } finally {
      setSaving(false);
    }
  }, [projectId, rubric, scores]);

  return { scores, setScore, calculated, loading, saving, save, refetch: load };
}
