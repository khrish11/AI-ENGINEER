"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { generateRoadmap } from "@/lib/roadmap/scheduler";
import { analyzeCapacity } from "@/lib/roadmap/capacity";
import { formatMinutes } from "@/lib/roadmap/config";
import { formatLongDate, todayIso } from "@/lib/roadmap/dates";
import type { CompletionSets } from "@/lib/roadmap/progress";
import type { RoadmapSettings, RoadmapStore } from "@/lib/roadmap/types";

export function RescheduleDialog({
  open,
  onOpenChange,
  store,
  completion,
  onApply,
  working,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  store: RoadmapStore;
  completion: CompletionSets | null;
  onApply: (changes: {
    hoursPerWeek?: number;
    targetDate?: string | null;
    droppedOccurrenceIds?: string[];
    dropOptionalTopics?: boolean;
  }) => Promise<void>;
  working?: boolean;
}) {
  const settings = store.settings;
  const plan = store.plan;
  const [hours, setHours] = React.useState(settings?.availableHoursPerWeek ?? 10);
  const [targetDate, setTargetDate] = React.useState(settings?.targetDate ?? "");
  const [dropOptional, setDropOptional] = React.useState(false);
  const [applied, setApplied] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setHours(settings?.availableHoursPerWeek ?? 10);
      setTargetDate(settings?.targetDate ?? "");
      setDropOptional(false);
      setApplied(false);
    }
  }, [open, settings]);

  const preview = React.useMemo(() => {
    if (!settings || !plan || !open) return null;
    try {
      const generated = generateRoadmap({
        trackId: settings.trackId,
        startDate: settings.startDate,
        targetDate: targetDate || null,
        availableHoursPerWeek: hours,
        studyDays: settings.studyDays,
        bufferPreference: settings.bufferPreference,
        manualBufferWeeks: settings.bufferWeeks,
        includeOptionalTopics: dropOptional ? false : settings.includeOptionalTopics,
        completedCanonicalLessonKeys: [...(completion?.completed ?? [])],
        manuallyIncluded: settings.manuallyIncluded,
        manuallyExcluded: settings.manuallyExcluded,
      });
      const analysis = analyzeCapacity({
        requiredMinutes: generated.plan.summary.totalMinutes,
        hoursPerWeek: hours,
        startDate: settings.startDate,
        targetDate: targetDate || null,
        bufferPreference: settings.bufferPreference,
        manualBufferWeeks: settings.bufferWeeks,
      });
      return { generated, analysis };
    } catch {
      return null;
    }
  }, [settings, plan, open, hours, targetDate, dropOptional, completion]);

  const previousWeeks = plan?.weeks.length ?? 0;
  const nextWeeks = preview?.generated.plan.weeks.length ?? previousWeeks;
  const previousEnd = plan?.weeks[plan.weeks.length - 1]?.endDate ?? null;
  const nextEnd =
    preview?.generated.plan.weeks[preview.generated.plan.weeks.length - 1]?.endDate ?? previousEnd;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-label="Reschedule roadmap" className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Reschedule the remaining plan</DialogTitle>
          <DialogDescription>
            Finished weeks are never rebuilt. Only work from today forward is recalculated, and
            missed lessons move into a prioritised backlog.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1.5 text-sm">
              <span className="font-medium text-foreground">Hours per week</span>
              <Input
                type="number"
                min={1}
                max={40}
                value={hours}
                onChange={(event) => setHours(Number(event.target.value) || 1)}
                aria-label="Hours per week"
              />
            </label>
            <label className="space-y-1.5 text-sm">
              <span className="font-medium text-foreground">New target date</span>
              <Input
                type="date"
                value={targetDate}
                onChange={(event) => setTargetDate(event.target.value)}
                aria-label="New target completion date"
              />
            </label>
          </div>

          <label className="flex items-start gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              className="mt-1 accent-cyan-500"
              checked={dropOptional}
              onChange={(event) => setDropOptional(event.target.checked)}
            />
            <span>
              Drop optional content for now
              <span className="block text-xs text-muted-foreground">
                Optional lessons can be restored later from the curriculum view.
              </span>
            </span>
          </label>

          <div className="rounded-lg border border-border bg-surface p-3 text-xs text-muted-foreground space-y-1">
            <p className="font-semibold text-foreground">Impact preview</p>
            {preview ? (
              <>
                <p>
                  Weeks: {previousWeeks} → {nextWeeks}
                  {nextWeeks !== previousWeeks
                    ? nextWeeks < previousWeeks
                      ? " (shorter)"
                      : " (longer)"
                    : ""}
                </p>
                <p>
                  Projected end:{" "}
                  {nextEnd ? formatLongDate(nextEnd) : "—"}
                  {previousEnd && nextEnd !== previousEnd
                    ? ` (was ${formatLongDate(previousEnd)})`
                    : ""}
                </p>
                <p>
                  Required {formatMinutes(preview.analysis.requiredMinutes)} · capacity{" "}
                  {formatMinutes(preview.analysis.availableMinutes)} ·{" "}
                  <Badge
                    variant={
                      preview.analysis.feasibility === "comfortable" ||
                      preview.analysis.feasibility === "achievable"
                        ? "success"
                        : preview.analysis.feasibility === "tight"
                          ? "warning"
                          : "error"
                    }
                    className="text-[10px]"
                  >
                    {preview.analysis.feasibility}
                  </Badge>
                </p>
                <p>Replanning from {formatLongDate(todayIso())}.</p>
              </>
            ) : (
              <p>Adjust the values to see the impact before committing.</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={working}>
            Cancel
          </Button>
          <Button
            isLoading={working}
            data-testid="apply-reschedule"
            onClick={async () => {
              await onApply({
                hoursPerWeek: hours,
                targetDate: targetDate || null,
                dropOptionalTopics: dropOptional,
              });
              setApplied(true);
              onOpenChange(false);
            }}
          >
            {applied ? "Applied" : "Apply changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
