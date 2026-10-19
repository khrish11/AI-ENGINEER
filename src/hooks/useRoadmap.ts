"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAllLessonProgress } from "@/hooks/useProgressOverview";
import { completionSets, type CompletionSets } from "@/lib/roadmap/progress";
import {
  buildSettings,
  defaultSettings,
  emptyStore,
  generateAndSave,
  isRoadmapReady,
  loadRoadmapStore,
  rescheduleAndSave,
  saveRoadmapStore,
} from "@/lib/roadmap/store";
import type {
  LearnerProfile,
  PlacementResult,
  RoadmapSettings,
  RoadmapStore,
} from "@/lib/roadmap/types";

export interface RoadmapActions {
  generate: (settings?: Partial<RoadmapSettings>) => Promise<void>;
  reschedule: (changes?: {
    hoursPerWeek?: number;
    targetDate?: string | null;
    droppedOccurrenceIds?: string[];
    dropOptionalTopics?: boolean;
  }) => Promise<void>;
  updateSettings: (changes: Partial<RoadmapSettings>, regenerate?: boolean) => Promise<void>;
  saveProfile: (profile: LearnerProfile) => Promise<void>;
  savePlacement: (placement: PlacementResult | null) => Promise<void>;
  clearRoadmap: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useRoadmap() {
  const [store, setStore] = useState<RoadmapStore | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const storeRef = useRef<RoadmapStore | null>(null);
  const { progress, refetch } = useAllLessonProgress();

  const completion = useMemo(() => completionSets(progress), [progress]);
  const completionRef = useRef<CompletionSets>(completion);
  completionRef.current = completion;

  const applyStore = useCallback((next: RoadmapStore) => {
    storeRef.current = next;
    setStore(next);
  }, []);

  const load = useCallback(async () => {
    const loaded = await loadRoadmapStore();
    applyStore(loaded);
    setLoading(false);
  }, [applyStore]);

  useEffect(() => {
    void load();
  }, [load]);

  const persist = useCallback(
    async (mutate: (current: RoadmapStore) => Promise<RoadmapStore>) => {
      const current = storeRef.current ?? emptyStore();
      setWorking(true);
      setError(null);
      try {
        const next = await mutate(current);
        applyStore(next);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Roadmap action failed.");
        throw cause;
      } finally {
        setWorking(false);
      }
    },
    [applyStore]
  );

  const generate = useCallback(
    async (changes: Partial<RoadmapSettings> = {}) => {
      const base = storeRef.current;
      const settings = buildSettings(base?.settings ?? defaultSettings(), changes);
      await persist(async (current) => {
        const result = await generateAndSave(current, settings, {
          completed: completionRef.current.completed,
          mastered: completionRef.current.mastered,
        });
        return result.store;
      });
      await refetch();
    },
    [persist, refetch]
  );

  const reschedule = useCallback(
    async (changes: {
      hoursPerWeek?: number;
      targetDate?: string | null;
      droppedOccurrenceIds?: string[];
      dropOptionalTopics?: boolean;
    } = {}) => {
      await persist(async (current) => {
        const { dropOptionalTopics, ...rescheduleChanges } = changes;
        const settings = dropOptionalTopics
          ? buildSettings(current.settings ?? defaultSettings(), {
              includeOptionalTopics: false,
            })
          : current.settings ?? defaultSettings();
        const withSettings = dropOptionalTopics
          ? await saveRoadmapStore({ ...current, settings })
          : current;
        const result = await rescheduleAndSave(
          withSettings,
          {
            completed: completionRef.current.completed,
            mastered: completionRef.current.mastered,
          },
          rescheduleChanges
        );
        return result.store;
      });
      await refetch();
    },
    [persist, refetch]
  );

  const updateSettings = useCallback(
    async (changes: Partial<RoadmapSettings>, regenerate = true) => {
      await persist(async (current) => {
        const settings = buildSettings(current.settings ?? defaultSettings(), changes);
        if (regenerate && settings) {
          const result = await generateAndSave(current, settings, {
            completed: completionRef.current.completed,
            mastered: completionRef.current.mastered,
          });
          return result.store;
        }
        const next: RoadmapStore = { ...current, settings };
        return saveRoadmapStore(next);
      });
    },
    [persist]
  );

  const saveProfile = useCallback(
    async (profile: LearnerProfile) => {
      await persist(async (current) => saveRoadmapStore({ ...current, profile }));
    },
    [persist]
  );

  const savePlacement = useCallback(
    async (placement: PlacementResult | null) => {
      await persist(async (current) => saveRoadmapStore({ ...current, placement }));
    },
    [persist]
  );

  const clearRoadmap = useCallback(async () => {
    await persist(async (current) =>
      saveRoadmapStore({
        ...emptyStore(),
        profile: current.profile,
      })
    );
  }, [persist]);

  const refresh = useCallback(async () => {
    await refetch();
    await load();
  }, [refetch, load]);

  const actions: RoadmapActions = useMemo(
    () => ({
      generate,
      reschedule,
      updateSettings,
      saveProfile,
      savePlacement,
      clearRoadmap,
      refresh,
    }),
    [generate, reschedule, updateSettings, saveProfile, savePlacement, clearRoadmap, refresh]
  );

  return {
    store,
    plan: store?.plan ?? null,
    settings: store?.settings ?? null,
    profile: store?.profile ?? null,
    placement: store?.placement ?? null,
    completion,
    progress,
    loading,
    working,
    error,
    ready: store ? isRoadmapReady(store) : false,
    actions,
  };
}
