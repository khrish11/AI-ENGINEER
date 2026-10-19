"use client";

import { useMemo } from "react";
import { analyzeCapacity } from "@/lib/roadmap/capacity";
import { daysBetween, formatShortDate, todayIso } from "@/lib/roadmap/dates";
import type { CompletionSets } from "@/lib/roadmap/progress";
import { missingPrerequisites, roadmapGraph } from "@/lib/roadmap/graph";
import type { RoadmapStore } from "@/lib/roadmap/types";

export interface RoadmapNotification {
  id: string;
  kind: "overdue" | "buffer" | "blocked" | "feasibility" | "info";
  tone: "warning" | "info";
  text: string;
}

/** In-app notifications only. No push or email in this phase. */
export function useRoadmapNotifications(
  store: RoadmapStore | null,
  completion: CompletionSets | null = null,
  todayOverride?: string | null
): RoadmapNotification[] {
  return useMemo(() => {
    if (!store?.plan || !store.settings) return [];
    const plan = store.plan;
    const settings = store.settings;
    const today = todayOverride ?? todayIso();
    const notifications: RoadmapNotification[] = [];

    const overdue = new Set<string>();
    for (const week of plan.weeks) {
      if (week.endDate >= today) continue;
      for (const item of week.items) {
        if (!completion?.completed.has(item.canonicalLessonKey)) overdue.add(item.occurrenceId);
      }
    }
    if (overdue.size > 0) {
      notifications.push({
        id: "overdue",
        kind: "overdue",
        tone: "warning",
        text: `${overdue.size} roadmap task${overdue.size === 1 ? "" : "s"} are past their week. Reschedule the remaining work or keep them in the backlog.`,
      });
    }

    const bufferWeek = plan.weeks.find(
      (week) => week.kind === "buffer" && week.startDate > today && daysBetween(today, week.startDate) <= 14
    );
    if (bufferWeek) {
      notifications.push({
        id: "buffer",
        kind: "buffer",
        tone: "info",
        text: `Buffer week starts ${formatShortDate(bufferWeek.startDate)} — catch-up time with no new mandatory content.`,
      });
    }

    const completedKeys = completion?.completed ?? new Set<string>();
    const currentWeek = plan.weeks.find((week) => week.startDate <= today && today <= week.endDate);
    if (currentWeek) {
      for (const item of currentWeek.items) {
        if (completedKeys.has(item.canonicalLessonKey)) continue;
        const blocked = missingPrerequisites(roadmapGraph, item.occurrenceId, completedKeys);
        if (blocked.length > 0) {
          notifications.push({
            id: `blocked-${item.occurrenceId}`,
            kind: "blocked",
            tone: "warning",
            text: `“${item.title}” is scheduled this week but its prerequisite is not finished yet.`,
          });
          break;
        }
      }
    }

    const analysis = analyzeCapacity({
      requiredMinutes: plan.summary.totalMinutes,
      hoursPerWeek: settings.availableHoursPerWeek,
      startDate: plan.startDate,
      targetDate: plan.targetDate,
      bufferPreference: settings.bufferPreference,
      manualBufferWeeks: settings.bufferWeeks,
    });
    if (analysis.feasibility === "tight" || analysis.feasibility === "unrealistic") {
      notifications.push({
        id: "feasibility",
        kind: "feasibility",
        tone: "warning",
        text:
          analysis.shortfallMinutes > 0
            ? `Your target is about ${Math.round(analysis.shortfallMinutes / 60)}h short. ${analysis.options[0] ?? ""}`.trim()
            : `Your plan is tight against the deadline. ${analysis.options[0] ?? ""}`.trim(),
      });
    }

    return notifications;
  }, [store, completion, todayOverride]);
}
