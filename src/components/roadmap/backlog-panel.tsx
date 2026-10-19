"use client";

import Link from "next/link";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMinutes, occurrenceById } from "@/lib/roadmap/config";
import { todayIso } from "@/lib/roadmap/dates";
import { orderBacklog } from "@/lib/roadmap/rescheduler";
import type { CompletionSets } from "@/lib/roadmap/progress";
import type { RoadmapPlan, ScheduledOccurrence } from "@/lib/roadmap/types";
import { AlertTriangle, ArchiveRestore, CalendarClock } from "lucide-react";

const IMPORTANCE_LABEL = {
  core: "Core",
  important: "Important",
  optional: "Optional",
  skip: "Skip",
} as const;

export function BacklogPanel({
  plan,
  completion,
  onReschedule,
  onExclude,
  onExplain,
}: {
  plan: RoadmapPlan;
  completion: CompletionSets | null;
  onReschedule?: () => void;
  onExclude?: (occurrenceId: string) => void;
  onExplain?: (occurrenceId: string) => void;
}) {
  const today = todayIso();

  const backlog = React.useMemo(() => {
    const seen = new Set<string>();
    const missed: ScheduledOccurrence[] = [];
    for (const week of plan.weeks) {
      if (week.endDate >= today) continue;
      for (const item of week.items) {
        if (completion?.completed.has(item.canonicalLessonKey)) continue;
        if (seen.has(item.canonicalLessonKey)) continue;
        const occurrence = occurrenceById.get(item.occurrenceId);
        if (!occurrence) continue;
        seen.add(item.canonicalLessonKey);
        missed.push({
          occurrenceId: occurrence.occurrenceId,
          canonicalLessonKey: occurrence.canonicalLessonKey,
          phaseSlug: occurrence.phaseSlug,
          lessonSlug: occurrence.lessonSlug,
          title: occurrence.title,
          difficulty: occurrence.difficulty,
          importance: item.importance,
          minutes: item.minutes,
          prerequisites: item.prerequisites,
          projectRelevant: item.projectRelevant,
          skillTags: item.skillTags,
        });
      }
    }
    return orderBacklog(missed);
  }, [plan, completion, today]);

  if (backlog.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Backlog</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Nothing overdue. Missed lessons will collect here automatically, prioritised so
            prerequisite-blocking core work comes first.
          </p>
        </CardContent>
      </Card>
    );
  }

  const blockedCount = backlog.filter(
    (item) => !completion?.completed.has(item.canonicalLessonKey)
  ).length;

  return (
    <Card className="border-status-warning/40">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Backlog</CardTitle>
          <Badge variant="warning">
            <AlertTriangle className="w-3 h-3" aria-hidden="true" />
            {blockedCount} missed
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Ordered by prerequisite impact: blocking core work first, then core, important, and
          optional.
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        <ul className="space-y-1.5" data-testid="backlog-list">
          {backlog.slice(0, 12).map((item) => (
            <li
              key={item.occurrenceId}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-surface p-2.5"
            >
              <div className="min-w-0 flex-1">
                <Link
                  href={`/curriculum/${item.occurrenceId}`}
                  className="block truncate text-sm font-medium text-foreground hover:text-accent-cyan"
                >
                  {item.title}
                </Link>
                <p className="text-[11px] text-muted-foreground">
                  {item.phaseSlug} · {formatMinutes(item.minutes)} ·{" "}
                  <Badge variant={item.importance === "core" ? "default" : "outline"} className="text-[10px]">
                    {IMPORTANCE_LABEL[item.importance]}
                  </Badge>
                  {item.prerequisites.length > 0 && (
                    <>
                      {" "}
                      · {item.prerequisites.length} prerequisite
                      {item.prerequisites.length === 1 ? "" : "s"}
                    </>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                {onExplain && (
                  <Button variant="ghost" size="sm" onClick={() => onExplain(item.occurrenceId)}>
                    Why?
                  </Button>
                )}
                {onExclude && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onExclude(item.occurrenceId)}
                    aria-label={`Drop ${item.title} from plan`}
                  >
                    <ArchiveRestore className="w-3.5 h-3.5" aria-hidden="true" /> Drop
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
        {backlog.length > 12 && (
          <p className="text-[11px] text-muted-foreground">+ {backlog.length - 12} more</p>
        )}
        {onReschedule && (
          <Button variant="secondary" size="sm" className="w-full" onClick={onReschedule} data-testid="open-reschedule">
            <CalendarClock className="w-4 h-4" aria-hidden="true" /> Reschedule remaining work
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
