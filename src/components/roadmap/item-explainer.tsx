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
import { Badge } from "@/components/ui/badge";
import { formatMinutes, occurrenceById } from "@/lib/roadmap/config";
import { explainItem, explainSkipped } from "@/lib/roadmap/explain";
import { prerequisiteChain, roadmapGraph } from "@/lib/roadmap/graph";
import type { CompletionSets } from "@/lib/roadmap/progress";
import type { RoadmapPlan, TrackId } from "@/lib/roadmap/types";
import { Lightbulb, XCircle } from "lucide-react";

export function ItemExplainer({
  occurrenceId,
  trackId,
  plan,
  completion,
  onClose,
  onExclude,
  onInclude,
  onMove,
}: {
  occurrenceId: string | null;
  trackId: TrackId;
  plan: RoadmapPlan | null;
  completion: CompletionSets | null;
  onClose: () => void;
  onExclude?: (occurrenceId: string) => void;
  onInclude?: (occurrenceId: string) => void;
  onMove?: (occurrenceId: string, weekIndex: number) => void;
}) {
  const [targetWeek, setTargetWeek] = React.useState<string>("");
  const open = Boolean(occurrenceId);

  if (!occurrenceId) return null;

  const occurrence = occurrenceById.get(occurrenceId);
  if (!occurrence) return null;

  const explanation = explainItem(occurrenceId, trackId);
  const skipped = explainSkipped(occurrenceId, trackId);
  const done = completion?.completed.has(occurrence.canonicalLessonKey) ?? false;
  const scheduledWeeks = (plan?.weeks ?? [])
    .filter((week) => week.items.some((item) => item.occurrenceId === occurrenceId))
    .map((week) => week.index);
  const isScheduled = scheduledWeeks.length > 0;
  const prerequisites = prerequisiteChain(roadmapGraph, occurrenceId, 3)
    .map((id) => occurrenceById.get(id)?.title ?? id)
    .filter(Boolean);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent aria-label={`Why ${occurrence.title} is in your roadmap`}>
        <DialogHeader>
          <DialogTitle>{occurrence.title}</DialogTitle>
          <DialogDescription>
            {explanation.summary} · {formatMinutes(occurrence.estimatedMinutes ?? 0)} estimate
            {done ? " · completed" : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-surface p-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <Lightbulb className="w-3.5 h-3.5 text-accent-cyan" aria-hidden="true" />
              Why am I learning this?
            </p>
            <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground list-disc pl-4">
              {explanation.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </div>

          {prerequisites.length > 0 && (
            <div className="rounded-lg border border-border bg-surface p-3">
              <p className="text-xs font-semibold text-foreground">Comes after</p>
              <p className="mt-1 text-xs text-muted-foreground">{prerequisites.join(" → ")}</p>
            </div>
          )}

          {!isScheduled && (
            <div className="rounded-lg border border-border bg-surface p-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <XCircle className="w-3.5 h-3.5 text-status-warning" aria-hidden="true" />
                Why was this skipped?
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{skipped.text}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge variant="outline" className="text-[10px]">
                  {explanation.importance}
                </Badge>
                {skipped.minutesSaved > 0 && (
                  <Badge variant="info" className="text-[10px]">
                    ~{formatMinutes(skipped.minutesSaved)} saved
                  </Badge>
                )}
              </div>
            </div>
          )}

          {isScheduled && plan && onMove && (
            <div className="flex flex-wrap items-end gap-2">
              <label className="text-xs text-muted-foreground">
                <span className="block mb-1">Move to week</span>
                <select
                  className="h-9 rounded-lg border border-border bg-surface px-2 text-xs text-foreground"
                  value={targetWeek}
                  onChange={(event) => setTargetWeek(event.target.value)}
                  aria-label="Target week"
                >
                  <option value="">Choose a week…</option>
                  {plan.weeks
                    .filter((week) => week.kind === "study")
                    .map((week) => (
                      <option key={week.index} value={week.index}>
                        Week {week.weekNumber} ({week.startDate})
                      </option>
                    ))}
                </select>
              </label>
              <Button
                size="sm"
                variant="secondary"
                disabled={targetWeek === ""}
                onClick={() => {
                  if (targetWeek === "") return;
                  onMove(occurrenceId, Number(targetWeek));
                  onClose();
                }}
              >
                Move lesson
              </Button>
            </div>
          )}

          <p className="text-[11px] text-muted-foreground">
            Completing this lesson records progress once for its canonical identity{" "}
            <code className="text-foreground">{occurrence.canonicalLessonKey}</code>
            {occurrence.isAlias ? " — this curriculum location shares that identity." : "."}
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          {isScheduled ? (
            onExclude && (
              <Button
                variant="secondary"
                onClick={() => {
                  onExclude(occurrenceId);
                  onClose();
                }}
              >
                Exclude from plan
              </Button>
            )
          ) : (
            onInclude && (
              <Button
                onClick={() => {
                  onInclude(occurrenceId);
                  onClose();
                }}
              >
                Add back to plan
              </Button>
            )
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
