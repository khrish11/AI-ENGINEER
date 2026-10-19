"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useAllLessonProgress } from "@/hooks/useProgressOverview";
import { CheckCircle, Clock } from "lucide-react";

export function PhaseProgressSummary({
  lessonIds,
  variant = "banner",
}: {
  lessonIds: string[];
  variant?: "banner" | "inline";
}) {
  const { byLessonId, loading } = useAllLessonProgress();

  const completed = lessonIds.filter((id) => {
    const status = byLessonId.get(id)?.status;
    return status === "completed" || status === "mastered";
  }).length;
  const started = lessonIds.filter((id) => {
    const status = byLessonId.get(id)?.status;
    return status && status !== "not_started";
  }).length;
  const total = lessonIds.length;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  const status =
    completed === total && total > 0 ? "Completed" : started > 0 ? "In Progress" : "Not Started";

  if (loading) {
    return variant === "inline" ? (
      <span className="text-xs text-muted-foreground">Loading progress…</span>
    ) : null;
  }

  if (variant === "inline") {
    return (
      <span
        data-testid="phase-progress-inline"
        className="flex items-center gap-1.5 text-xs text-muted-foreground"
      >
        <Clock className="w-3.5 h-3.5 text-accent-cyan" />
        <strong className="text-foreground">
          {completed} / {total}
        </strong>
        lessons completed
      </span>
    );
  }

  return (
    <div className="space-y-2" data-testid="phase-progress-summary">
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          variant={
            status === "Completed" ? "success" : status === "In Progress" ? "default" : "secondary"
          }
          className="gap-1"
        >
          {status === "Completed" && <CheckCircle className="w-3 h-3" />}
          {status}
        </Badge>
        <span className="text-xs text-muted-foreground">
          <strong className="text-foreground">
            {completed} / {total}
          </strong>{" "}
          lessons completed · {started} started
        </span>
      </div>
      <Progress value={percent} className="h-1.5" variant="cyan" />
    </div>
  );
}
