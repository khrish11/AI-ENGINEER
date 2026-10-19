"use client";

import { useMemo } from "react";
import type { LearnerProfile, RoadmapStore } from "@/lib/roadmap/types";

export const DEFAULT_PROFILE: LearnerProfile = {
  background: "self-taught",
  programming: {
    python: "basic",
    javascript: "none",
    git: "basic",
    linux: "none",
    sql: "none",
    docker: "none",
  },
  math: { "linear-algebra": "weak", calculus: "weak", probability: "weak", statistics: "weak" },
  ai: {
    "classical-ml": "none",
    "neural-networks": "none",
    pytorch: "none",
    transformers: "none",
    "llm-applications": "none",
    rag: "none",
    agents: "none",
    deployment: "none",
  },
  knownTopicSkillIds: [],
  goalTrackId: "general-ai",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

export function useLearnerProfile(store: RoadmapStore | null) {
  return useMemo(() => {
    const profile = store?.profile ?? null;
    return {
      profile: profile ?? DEFAULT_PROFILE,
      hasProfile: Boolean(profile),
      trackId: profile?.goalTrackId ?? store?.settings?.trackId ?? "general-ai",
      knownTopicSkillIds: profile?.knownTopicSkillIds ?? [],
    };
  }, [store]);
}
