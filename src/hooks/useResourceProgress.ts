"use client";

import { useCallback, useEffect, useState } from "react";
import { resourceProgressRepo } from "@/lib/progress/repositories/resource-progress";
import type { ResourceProgress } from "@/lib/progress/db";
import type { GithubResourceState } from "@/lib/progress/resource-rules";

type ResourceMetadata = {
  resourceType?: string | null;
  resourceTitle?: string | null;
  href?: string | null;
};

export function useResourceProgress(resourceId: string | null) {
  const [progress, setProgress] = useState<ResourceProgress | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!resourceId) {
      setProgress(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setProgress((await resourceProgressRepo.getByResource(resourceId)) ?? null);
    } finally {
      setLoading(false);
    }
  }, [resourceId]);

  useEffect(() => {
    void load();
  }, [load]);

  const markStarted = useCallback(
    async (githubState?: GithubResourceState, metadata?: ResourceMetadata) => {
      if (!resourceId) return;
      const result = await resourceProgressRepo.markStarted(
        resourceId,
        githubState,
        metadata
      );
      setProgress(result);
      return result;
    },
    [resourceId]
  );

  const markCompleted = useCallback(
    async (metadata?: ResourceMetadata) => {
      if (!resourceId) return;
      const result = await resourceProgressRepo.markCompleted(resourceId, metadata);
      setProgress(result);
      return result;
    },
    [resourceId]
  );

  const markGithubState = useCallback(
    async (state: GithubResourceState, metadata?: ResourceMetadata) => {
      if (!resourceId) return;
      const result = await resourceProgressRepo.markGithubState(
        resourceId,
        state,
        metadata
      );
      setProgress(result);
      return result;
    },
    [resourceId]
  );

  return { progress, loading, markStarted, markCompleted, markGithubState, refetch: load };
}

export function useAllResourceProgress() {
  const [items, setItems] = useState<ResourceProgress[]>([]);
  useEffect(() => {
    void resourceProgressRepo.getAll().then(setItems);
  }, []);
  return items;
}
