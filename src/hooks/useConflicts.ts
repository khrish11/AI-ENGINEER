"use client";

import { useCallback, useEffect, useState } from "react";
import {
  conflictResolver,
  type ConflictItem,
  type ConflictResolution,
} from "@/lib/progress/conflicts";

export function useConflicts() {
  const [conflicts, setConflicts] = useState<ConflictItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setConflicts(await conflictResolver.getUnresolved());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const resolve = useCallback(
    async (conflictId: string, resolution: ConflictResolution, mergedData?: unknown) => {
      await conflictResolver.resolve(conflictId, resolution, mergedData);
      await load();
    },
    [load]
  );

  return { conflicts, loading, resolve, refetch: load };
}
