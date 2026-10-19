"use client";

import { useMemo } from "react";
import { analyzeCapacity } from "@/lib/roadmap/capacity";
import { paceStatus, projectedEndDate } from "@/lib/roadmap/capacity";
import { daysBetween, todayIso } from "@/lib/roadmap/dates";
import type { CompletionSets } from "@/lib/roadmap/progress";
import type { CapacityAnalysis, RoadmapStore } from "@/lib/roadmap/types";

export interface RoadmapProgressView {
  requiredKeys: Set<string>;
  completedRequired: number;
  totalRequired: number;
  percent: number;
  coreTotal: number;
  coreCompleted: number;
  completedMinutes: number;
  totalMinutes: number;
  elapsedWeeks: number;
  totalWeeks: number;
  pace: "ahead" | "on-track" | "behind";
  projectedEnd: string | null;
  deadline: string | null;
  deadlineStatus: "met" | "missed" | "no-deadline";
  analysis: CapacityAnalysis | null;
  hasPlan: boolean;
}

export function useRoadmapProgress(
  store: RoadmapStore | null,
  completion: CompletionSets | null = null,
  todayOverride?: string | null
): RoadmapProgressView {
  return useMemo(() => {
    const empty: RoadmapProgressView = {
      requiredKeys: new Set<string>(),
      completedRequired: 0,
      totalRequired: 0,
      percent: 0,
      coreTotal: 0,
      coreCompleted: 0,
      completedMinutes: 0,
      totalMinutes: 0,
      elapsedWeeks: 0,
      totalWeeks: 0,
      pace: "on-track",
      projectedEnd: null,
      deadline: null,
      deadlineStatus: "no-deadline",
      analysis: null,
      hasPlan: false,
    };
    if (!store?.plan || !store.settings) return empty;

    const plan = store.plan;
    const settings = store.settings;
    const today = todayOverride ?? todayIso();

    const requiredKeys = new Set<string>();
    const minutesByCanonical = new Map<string, number>();
    const coreKeys = new Set<string>();

    for (const week of plan.weeks) {
      for (const item of week.items) {
        requiredKeys.add(item.canonicalLessonKey);
        if (!minutesByCanonical.has(item.canonicalLessonKey)) {
          minutesByCanonical.set(item.canonicalLessonKey, item.minutes);
        }
        if (item.importance === "core") coreKeys.add(item.canonicalLessonKey);
      }
    }

    let completedMinutes = 0;
    let completedRequired = 0;
    let coreCompleted = 0;
    for (const key of requiredKeys) {
      const done = completion?.completed.has(key) ?? false;
      if (done) {
        completedRequired += 1;
        completedMinutes += minutesByCanonical.get(key) ?? 0;
      }
    }
    for (const key of coreKeys) {
      if (completion?.completed.has(key)) coreCompleted += 1;
    }

    const totalMinutes = [...minutesByCanonical.values()].reduce((sum, value) => sum + value, 0);
    const elapsedWeeks = plan.weeks.filter((week) => week.endDate < today).length;
    const totalWeeks = plan.weeks.length;

    const analysis = analyzeCapacity({
      requiredMinutes: plan.summary.totalMinutes,
      hoursPerWeek: settings.availableHoursPerWeek,
      startDate: plan.startDate,
      targetDate: plan.targetDate,
      bufferPreference: settings.bufferPreference,
      manualBufferWeeks: settings.bufferWeeks,
    });

    const projectedEnd = projectedEndDate(plan.startDate, totalWeeks);
    const deadline = plan.targetDate;
    let deadlineStatus: RoadmapProgressView["deadlineStatus"] = "no-deadline";
    if (deadline) {
      deadlineStatus =
        daysBetween(projectedEnd, deadline) >= 0
          ? "met"
          : elapsedWeeks >= totalWeeks
            ? "missed"
            : "missed";
    }

    return {
      requiredKeys,
      completedRequired,
      totalRequired: requiredKeys.size,
      percent:
        requiredKeys.size === 0 ? 0 : Math.round((completedRequired / requiredKeys.size) * 100),
      coreTotal: coreKeys.size,
      coreCompleted,
      completedMinutes,
      totalMinutes,
      elapsedWeeks,
      totalWeeks,
      pace: paceStatus(completedMinutes, totalMinutes, elapsedWeeks, totalWeeks),
      projectedEnd,
      deadline,
      deadlineStatus,
      analysis,
      hasPlan: true,
    };
  }, [store, completion, todayOverride]);
}
