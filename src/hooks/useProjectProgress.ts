"use client";

import { useCallback, useEffect, useState } from "react";
import { projectProgressRepo } from "@/lib/progress/repositories/project-progress";
import type { ProjectProgress } from "@/lib/progress/db";

export function useProjectProgress(projectId: string | null) {
  const [progress, setProgress] = useState<ProjectProgress[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!projectId) {
      setProgress([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setProgress(await projectProgressRepo.getByProject(projectId));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const upsert = useCallback(
    async (input: Omit<Parameters<typeof projectProgressRepo.upsert>[0], "projectId">) => {
      if (!projectId) return;
      const result = await projectProgressRepo.upsert({ projectId, ...input });
      await load();
      return result;
    },
    [projectId, load]
  );

  return {
    progress,
    loading,
    upsert,
    markMilestoneComplete: (milestoneId: string, evidenceUrl?: string | null) =>
      upsert({ milestoneId, completed: true, evidenceUrl }),
    refetch: load,
  };
}

export function useAllProjectProgress() {
  const [items, setItems] = useState<ProjectProgress[]>([]);
  useEffect(() => {
    void projectProgressRepo.getAll().then(setItems);
  }, []);
  return items;
}
