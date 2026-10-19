"use client";

import { useMemo } from "react";
import { defaultSettings } from "@/lib/roadmap/store";
import type { RoadmapSettings, RoadmapStore } from "@/lib/roadmap/types";

export function useRoadmapSettings(store: RoadmapStore | null) {
  return useMemo(() => {
    const settings = store?.settings ?? null;
    return {
      settings: settings ?? defaultSettings(),
      hasSettings: Boolean(settings),
      bufferWeeks: settings?.bufferWeeks ?? [],
      studyDays: settings?.studyDays ?? [1, 3, 5],
      includeOptionalTopics: settings?.includeOptionalTopics ?? false,
      manualExclusions: settings?.manuallyExcluded ?? [],
      manualInclusions: settings?.manuallyIncluded ?? [],
    };
  }, [store]);
}
