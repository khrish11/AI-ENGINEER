"use client";

import Link from "next/link";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatMinutes } from "@/lib/roadmap/config";
import { WEEKDAY_SHORT, formatLongDate } from "@/lib/roadmap/dates";
import type { CurrentWeekView } from "@/hooks/useCurrentWeek";
import type { TrackId } from "@/lib/roadmap/types";
import { ArrowRight, CalendarClock, CheckCircle2, ListTodo, Timer } from "lucide-react";

const IMPORTANCE_LABEL = {
  core: "Core",
  important: "Important",
  optional: "Optional",
  skip: "Skip",
} as const;

const DIFFICULTY_LABEL = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
} as const;

export function CurrentWeekCard({
  view,
  trackId,
  onExplain,
}: {
  view: CurrentWeekView;
  trackId: TrackId;
  onExplain?: (occurrenceId: string) => void;
}) {
  if (!view.week) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Current week</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No schedule yet. Run onboarding to build your first roadmap.
          </p>
        </CardContent>
      </Card>
    );
  }

  const week = view.week;
  const isBuffer = week.kind === "buffer";
  const capacityPercent =
    view.capacityMinutes > 0
      ? Math.round((view.scheduledMinutes / view.capacityMinutes) * 100)
      : 0;

  const byDay = new Map<number, typeof view.items>();
  for (const item of view.items) {
    const list = byDay.get(item.dayOfWeek) ?? [];
    list.push(item);
    byDay.set(item.dayOfWeek, list);
  }

  return (
    <Card className="border-accent-cyan/50">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">Week {week.weekNumber}</CardTitle>
            <Badge variant="outline" className="text-[10px]">
              {formatLongDate(week.startDate)} – {formatLongDate(week.endDate)}
            </Badge>
            {isBuffer && <Badge variant="warning">Buffer week</Badge>}
            {view.isFuture && <Badge variant="muted">Starts later</Badge>}
          </div>
          <span className="text-xs text-muted-foreground">
            {formatMinutes(view.scheduledMinutes)} scheduled of {formatMinutes(view.capacityMinutes)} capacity
          </span>
        </div>
        <Progress
          value={capacityPercent}
          aria-label={`Week capacity used: ${capacityPercent}%`}
          className="mt-1"
        />
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg border border-border bg-surface p-2">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Capacity</p>
            <p className="text-sm font-semibold text-foreground">{formatMinutes(view.capacityMinutes)}</p>
          </div>
          <div className="rounded-lg border border-border bg-surface p-2">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Scheduled</p>
            <p className="text-sm font-semibold text-foreground">{formatMinutes(view.scheduledMinutes)}</p>
          </div>
          <div className="rounded-lg border border-border bg-surface p-2">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Remaining</p>
            <p className="text-sm font-semibold text-foreground">{formatMinutes(view.remainingMinutes)}</p>
          </div>
        </div>

        {view.overdueCount > 0 && (
          <p className="flex items-center gap-1.5 text-xs text-status-warning" data-testid="overdue-banner">
            <CalendarClock className="w-3.5 h-3.5" aria-hidden="true" />
            {view.overdueCount} earlier task{view.overdueCount === 1 ? "" : "s"} not finished — open
            the backlog below to move them.
          </p>
        )}

        {isBuffer && (
          <p className="text-sm text-muted-foreground">
            This is a buffer week: catch-up, review, and nothing new is mandatory. You can still
            work ahead from the timeline.
          </p>
        )}

        {view.items.length === 0 && view.completedItems.length === 0 && !isBuffer && (
          <p className="text-sm text-muted-foreground">
            Nothing scheduled for this week yet.
          </p>
        )}

        {[...byDay.entries()].map(([day, items]) => (
          <div key={day} className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {WEEKDAY_SHORT[day]}
            </p>
            <ul className="space-y-1.5">
              {items.map((item) => (
                <li
                  key={`${item.occurrenceId}-${item.part}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-surface p-2.5"
                  data-testid="week-item"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Link
                        href={`/curriculum/${item.occurrenceId}`}
                        className="truncate text-sm font-medium text-foreground hover:text-accent-cyan"
                      >
                        {item.title}
                      </Link>
                      {item.totalParts > 1 && (
                        <Badge variant="muted" className="text-[10px]">
                          Part {item.part} of {item.totalParts}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                      <span>{formatMinutes(item.allocatedMinutes)}</span>
                      <span aria-hidden="true">·</span>
                      <span>{item.phaseSlug}</span>
                      <span aria-hidden="true">·</span>
                      <span>{DIFFICULTY_LABEL[item.difficulty]}</span>
                      <Badge variant={item.importance === "core" ? "default" : "outline"} className="text-[10px]">
                        {IMPORTANCE_LABEL[item.importance]}
                      </Badge>
                      {item.prerequisites.length > 0 && (
                        <Badge variant="muted" className="text-[10px]">
                          {item.prerequisites.length} prerequisite
                          {item.prerequisites.length === 1 ? "" : "s"}
                        </Badge>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {onExplain && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onExplain(item.occurrenceId)}
                        aria-label={`Why is ${item.title} in my plan?`}
                      >
                        Why?
                      </Button>
                    )}
                    <Link href={`/curriculum/${item.occurrenceId}`}>
                      <Button size="sm" variant="secondary" data-testid="start-item">
                        Start <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                      </Button>
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}

        {view.completedItems.length > 0 && (
          <div className="space-y-1.5">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-status-success">
              <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
              Completed this week ({view.completedItems.length})
            </p>
            <ul className="space-y-1">
              {view.completedItems.map((item) => (
                <li
                  key={item.occurrenceId}
                  className="flex items-center justify-between text-xs text-muted-foreground"
                >
                  <span className="truncate">{item.title}</span>
                  <span className="flex items-center gap-1.5">
                    <Timer className="w-3 h-3" aria-hidden="true" />
                    {formatMinutes(item.allocatedMinutes)}
                    <Badge variant="success" className="text-[10px]">
                      Done
                    </Badge>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <ListTodo className="w-3.5 h-3.5" aria-hidden="true" />
          {view.items.length} task{view.items.length === 1 ? "" : "s"} left this week · track:{" "}
          {trackId}
        </p>
      </CardContent>
    </Card>
  );
}
