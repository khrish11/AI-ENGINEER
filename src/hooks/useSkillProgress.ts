"use client";

import { useMemo } from "react";
import type { CompletionSets } from "@/lib/roadmap/progress";
import { computeSkillProgress, type SkillGroupProgress } from "@/lib/roadmap/skills";
import type { TrackId } from "@/lib/roadmap/types";

export function useSkillProgress(
  trackId: TrackId,
  completion: CompletionSets | null = null
): { groups: SkillGroupProgress[]; masteredSkills: number; learningSkills: number } {
  return useMemo(() => {
    const groups = computeSkillProgress(
      trackId,
      completion?.completed ?? [],
      completion?.mastered ?? []
    );
    const masteredSkills = groups
      .flatMap((group) => group.skills)
      .filter((skill) => skill.status === "mastered").length;
    const learningSkills = groups
      .flatMap((group) => group.skills)
      .filter((skill) => skill.status === "learning").length;
    return { groups, masteredSkills, learningSkills };
  }, [trackId, completion]);
}
