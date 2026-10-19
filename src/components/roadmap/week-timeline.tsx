"use client";

import Link from "next/link";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { formatMinutes } from "@/lib/roadmap/config";
import { formatLongDate, todayIso } from "@/lib/roadmap/dates";
import type { CompletionSets } from "@/lib/roadmap/progress";
import type { RoadmapPlan, RoadmapWeek } from "@/lib/roadmap/types";
import { ChevronDown } from "lucide-react";

function WeekRow({
  week,
  completion,
  today,
  defaultOpen,
}: {
  week: RoadmapWeek;
  completion: CompletionSets | null;
  today: string;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  const isBuffer = week.kind === "buffer";
  const isPast = week.endDate < today;
  const isCurrent = week.startDate <= today && today <= week.endDate;

  const completedCount = week.items.filter((item) =>
    completion?.completed.has(item.canonicalLessonKey)
  ).length;
  const percent =
    week.items.length === 0
      ? 0
      : Math.round((completedCount / week.items.length) * 100);

  const statusText = isBuffer
    ? "Buffer week"
    : isPast
      ? percent === 100 && week.items.length > 0
        ? "Completed"
        : "Past week"
      : isCurrent
        ? "Current week"
        : "Upcoming";

  return (
    <div
      className={`rounded-xl border bg-surface ${
        isCurrent ? "border-accent-cyan/60" : "border-border"
      }`}
    >
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan rounded-xl"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={`Week ${week.weekNumber}, ${statusText}`}
      >
        <span className="flex items-center gap-3 min-w-0">
          <span
            className={`w-8 h-8 shrink-0 rounded-lg flex items-center justify-center font-mono text-xs font-bold ${
              isBuffer
                ? "bg-status-warning/20 text-status-warning"
                : isPast
                  ? "bg-status-success/20 text-status-success"
                  : isCurrent
                    ? "bg-accent-cyan/20 text-accent-cyan"
                    : "bg-muted text-muted-foreground"
            }`}
          >
            W{week.weekNumber}
          </span>
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-1.5">
              <span className="text-sm font-semibold text-foreground">
                {formatLongDate(week.startDate)} – {formatLongDate(week.endDate)}
              </span>
              {isBuffer && (
                <Badge variant="warning" className="text-[10px]">
                  Buffer
                </Badge>
              )}
              {isCurrent && (
                <Badge variant="default" className="text-[10px]">
                  Current
                </Badge>
              )}
              <Badge variant="outline" className="text-[10px]">
                {statusText}
              </Badge>
            </span>
            <span className="block text-xs text-muted-foreground">
              {isBuffer
                ? "No mandatory new content"
                : `${formatMinutes(week.scheduledMinutes)} scheduled · ${week.items.length} item${
                    week.items.length === 1 ? "" : "s"
                  }`}
            </span>
          </span>
        </span>
        <span className="flex items-center gap-2">
          {week.items.length > 0 && (
            <span className="w-24 hidden sm:block">
              <Progress value={percent} aria-label={`Week ${week.weekNumber} progress ${percent}%`} />
            </span>
          )}
          <ChevronDown
            className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        </span>
      </button>

      {open && (
        <div className="border-t border-border/60 px-4 py-3 space-y-1.5">
          {week.items.length === 0 && (
            <p className="text-xs text-muted-foreground">Nothing scheduled.</p>
          )}
          {week.items.map((item) => {
            const done = completion?.completed.has(item.canonicalLessonKey) ?? false;
            return (
              <div
                key={`${item.occurrenceId}-${item.part}`}
                className="flex items-center justify-between gap-2 text-xs"
              >
                <span className="flex items-center gap-2 min-w-0">
                  <span aria-hidden="true">{done ? "✓" : "○"}</span>
                  <Link
                    href={`/curriculum/${item.occurrenceId}`}
                    className={`truncate hover:text-accent-cyan ${
                      done ? "line-through text-muted-foreground" : "text-foreground"
                    }`}
                  >
                    {item.title}
                  </Link>
                </span>
                <span className="flex shrink-0 items-center gap-1.5 text-muted-foreground">
                  <span>{formatMinutes(item.allocatedMinutes)}</span>
                  <Badge variant={done ? "success" : item.importance === "core" ? "default" : "outline"} className="text-[10px]">
                    {done ? "Done" : item.importance === "core" ? "Core" : item.importance}
                  </Badge>
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function WeekTimeline({
  plan,
  completion,
  onExplain,
}: {
  plan: RoadmapPlan;
  completion: CompletionSets | null;
  onExplain?: (occurrenceId: string) => void;
}) {
  const today = todayIso();
  const [filter, setFilter] = React.useState<"all" | "upcoming" | "completed" | "buffers">(
    "all"
  );

  const filtered = plan.weeks.filter((week) => {
    if (filter === "all") return true;
    if (filter === "buffers") return week.kind === "buffer";
    if (filter === "completed") return week.endDate < today && week.kind === "study";
    return week.startDate >= today;
  });

  if (filtered.length === 0) {
    return <p className="text-sm text-muted-foreground">No weeks match this filter.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Timeline filter">
        {(
          [
            ["all", "All weeks"],
            ["upcoming", "Upcoming"],
            ["completed", "Completed"],
            ["buffers", "Buffers"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={filter === value}
            onClick={() => setFilter(value)}
            className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan ${
              filter === value
                ? "bg-accent-cyan/15 text-accent-cyan border border-accent-cyan/30"
                : "border border-border bg-surface text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.map((week) => (
          <div key={week.index}>
            <WeekRow
              week={week}
              completion={completion}
              today={today}
              defaultOpen={week.startDate <= today && today <= week.endDate}
            />
            {onExplain && week.items.length > 0 && (
              <div className="mt-1 pl-11">
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => week.items[0] && onExplain(week.items[0].occurrenceId)}
                >
                  Why is week {week.weekNumber} scheduled this way?
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
