"use client";

import Link from "next/link";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useRoadmap } from "@/hooks/useRoadmap";
import { useCurrentWeek } from "@/hooks/useCurrentWeek";
import { useRoadmapProgress } from "@/hooks/useRoadmapProgress";
import { trackById } from "@/lib/roadmap/config";
import { formatLongDate } from "@/lib/roadmap/dates";
import { formatMinutes } from "@/lib/roadmap/config";
import { ArrowRight, CalendarClock, Compass, Gauge } from "lucide-react";

const PACE_LABEL = {
  ahead: "Ahead of pace",
  "on-track": "On track",
  behind: "Behind pace",
} as const;

export function RoadmapSummaryCard() {
  const { ready, loading, store, plan, settings, completion } = useRoadmap();
  const weekView = useCurrentWeek(plan, completion);
  const progress = useRoadmapProgress(store, completion);

  if (loading) {
    return (
      <Card aria-busy="true">
        <CardHeader>
          <CardTitle className="text-base">Roadmap</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-20 rounded-lg bg-muted animate-pulse" />
        </CardContent>
      </Card>
    );
  }

  if (!ready || !plan || !settings) {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-base">Roadmap</CardTitle>
          <CardDescription>
            Get a deterministic week-by-week plan matched to your goal track and study hours.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/onboarding">
            <Button className="gap-2" data-testid="dashboard-start-onboarding">
              Build my roadmap <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  const track = trackById[settings.trackId];
  const nextLesson = weekView.items[0] ?? null;
  const tasksLeft = weekView.items.length;
  const feasibility = progress.analysis?.feasibility ?? "achievable";

  return (
    <Card className="border-accent-cyan/40">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Compass className="w-4 h-4 text-accent-cyan" aria-hidden="true" />
            Roadmap
          </CardTitle>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="outline">{track.name}</Badge>
            <Badge variant="outline">
              <Gauge className="w-3 h-3" aria-hidden="true" />
              {PACE_LABEL[progress.pace]}
            </Badge>
            <Badge
              variant={
                feasibility === "comfortable" || feasibility === "achievable"
                  ? "success"
                  : feasibility === "tight"
                    ? "warning"
                    : "error"
              }
            >
              {feasibility}
            </Badge>
          </div>
        </div>
        <CardDescription>
          {progress.completedRequired} / {progress.totalRequired} planned lessons complete ·{" "}
          {weekView.overdueCount > 0 ? `${weekView.overdueCount} overdue` : "nothing overdue"}
        </CardDescription>
        <Progress
          value={progress.percent}
          className="mt-1"
          aria-label={`Roadmap progress ${progress.percent}%`}
        />
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-3 text-center">
          <div className="rounded-lg border border-border bg-surface p-2">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">This week</p>
            <p className="text-sm font-semibold text-foreground">
              {tasksLeft} task{tasksLeft === 1 ? "" : "s"} left
            </p>
          </div>
          <div className="rounded-lg border border-border bg-surface p-2">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Projected finish
            </p>
            <p className="text-sm font-semibold text-foreground">
              {progress.projectedEnd ? formatLongDate(progress.projectedEnd) : "—"}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-surface p-2">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Remaining</p>
            <p className="text-sm font-semibold text-foreground">
              {formatMinutes(progress.analysis?.requiredMinutes ?? plan.summary.totalMinutes)}
            </p>
          </div>
        </div>

        {nextLesson ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-surface p-2.5">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Continue roadmap
              </p>
              <p className="truncate text-sm font-medium text-foreground">{nextLesson.title}</p>
              <p className="text-[11px] text-muted-foreground">
                {nextLesson.phaseSlug} · {formatMinutes(nextLesson.allocatedMinutes)}
              </p>
            </div>
            <Link href={`/curriculum/${nextLesson.occurrenceId}`}>
              <Button size="sm" data-testid="dashboard-continue-lesson">
                Continue <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </Button>
            </Link>
          </div>
        ) : (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarClock className="w-3.5 h-3.5" aria-hidden="true" />
            This week is clear — check the timeline for what is next.
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Link href="/roadmap">
            <Button variant="secondary" size="sm">
              Open roadmap
            </Button>
          </Link>
          <Link href="/roadmap/paths">
            <Button variant="ghost" size="sm">
              Compare tracks
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
