"use client";

import { useEffect, useMemo, useState } from "react";
import { todayIso } from "@/lib/roadmap/dates";
import { currentWeek } from "@/lib/roadmap/scheduler";
import type { CompletionSets } from "@/lib/roadmap/progress";
import type { PlanItem, RoadmapPlan, RoadmapWeek } from "@/lib/roadmap/types";

export interface WeekItemView extends PlanItem {
  completed: boolean;
  overdue: boolean;
}

export interface CurrentWeekView {
  week: RoadmapWeek | null;
  items: WeekItemView[];
  completedItems: WeekItemView[];
  capacityMinutes: number;
  scheduledMinutes: number;
  remainingMinutes: number;
  overdueCount: number;
  weeksElapsed: number;
  totalWeeks: number;
  isFuture: boolean;
  pastWeeks: RoadmapWeek[];
  upcomingWeeks: RoadmapWeek[];
}

/** Today's date, resolved after mount so server and client markup agree. */
export function useToday(): string | null {
  const [today, setToday] = useState<string | null>(null);
  useEffect(() => {
    setToday(todayIso());
  }, []);
  return today;
}

export function useCurrentWeek(
  plan: RoadmapPlan | null,
  completion: CompletionSets | null = null,
  todayOverride?: string | null
): CurrentWeekView {
  const today = useToday();
  const activeToday = todayOverride ?? today;

  return useMemo(() => {
    const empty: CurrentWeekView = {
      week: null,
      items: [],
      completedItems: [],
      capacityMinutes: 0,
      scheduledMinutes: 0,
      remainingMinutes: 0,
      overdueCount: 0,
      weeksElapsed: 0,
      totalWeeks: 0,
      isFuture: false,
      pastWeeks: [],
      upcomingWeeks: [],
    };
    if (!plan || !activeToday) return empty;

    const week = currentWeek(plan, activeToday);
    const pastWeeks = plan.weeks.filter((w) => w.endDate < activeToday);
    const upcomingWeeks = plan.weeks.filter((w) => w.startDate > activeToday);

    const overdueKeys = new Set<string>();
    for (const pastWeek of pastWeeks) {
      for (const item of pastWeek.items) {
        if (!completion?.completed.has(item.canonicalLessonKey)) {
          overdueKeys.add(item.occurrenceId);
        }
      }
    }

    const toView = (item: PlanItem): WeekItemView => ({
      ...item,
      completed: completion ? completion.completed.has(item.canonicalLessonKey) : false,
      overdue: overdueKeys.has(item.occurrenceId),
    });

    const items = (week?.items ?? []).map(toView).filter((item) => !item.completed);
    const completedItems = (week?.items ?? []).map(toView).filter((item) => item.completed);

    const overdueCount = overdueKeys.size;

    const scheduledMinutes = week?.scheduledMinutes ?? 0;
    const capacityMinutes = week?.capacityMinutes ?? 0;

    return {
      week: week ?? null,
      items,
      completedItems,
      capacityMinutes,
      scheduledMinutes,
      remainingMinutes: Math.max(0, capacityMinutes - scheduledMinutes),
      overdueCount,
      weeksElapsed: pastWeeks.length,
      totalWeeks: plan.weeks.length,
      isFuture: Boolean(week && week.startDate > activeToday),
      pastWeeks,
      upcomingWeeks,
    };
  }, [plan, activeToday, completion]);
}
