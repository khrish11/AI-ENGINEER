"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMinutes, occurrenceById } from "@/lib/roadmap/config";
import type { RoadmapPlan, RoadmapSettings } from "@/lib/roadmap/types";
import { BookOpenCheck, ChevronDown } from "lucide-react";

const KNOWN_TOPIC_REASON = "You already know this — kept out of your plan.";

export function KnownTopicsPanel({
  plan,
  settings,
  working = false,
  onAddBack,
  onUseKnownExclusion,
}: {
  plan: RoadmapPlan;
  settings: RoadmapSettings;
  working?: boolean;
  onAddBack: (occurrenceId: string) => Promise<void> | void;
  onUseKnownExclusion: (occurrenceId: string) => Promise<void> | void;
}) {
  const skippedById = new Map(plan.skipped.map((entry) => [entry.occurrenceId, entry]));
  const manuallyIncluded = new Set(settings.manuallyIncluded);
  const rows = settings.knownOccurrenceIds
    .map((occurrenceId) => {
      const occurrence = occurrenceById.get(occurrenceId);
      if (!occurrence) return null;
      return {
        occurrence,
        restored: manuallyIncluded.has(occurrenceId),
        reason: skippedById.get(occurrenceId)?.reason ?? KNOWN_TOPIC_REASON,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  if (rows.length === 0) return null;

  const restoredCount = rows.filter((row) => row.restored).length;
  const excludedCount = rows.length - restoredCount;

  return (
    <Card data-testid="known-topics-panel">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <BookOpenCheck className="h-4 w-4 text-accent-cyan" aria-hidden="true" />
              Known topics
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              {excludedCount} excluded · {restoredCount} manually restored
            </p>
          </div>
          <Badge variant="outline">{rows.length}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <details className="group">
          <summary className="flex min-h-9 cursor-pointer list-none items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan [&::-webkit-details-marker]:hidden">
            Review excluded and restored topics
            <ChevronDown
              className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180"
              aria-hidden="true"
            />
          </summary>
          <div className="mt-3 max-h-96 overflow-y-auto pr-1">
            <ul className="space-y-2" aria-label="Known roadmap topics">
              {rows.map(({ occurrence, reason, restored }) => (
                <li
                  key={occurrence.occurrenceId}
                  className="rounded-lg border border-border/70 bg-card/60 p-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">{occurrence.title}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {occurrence.phaseSlug} · {formatMinutes(occurrence.estimatedMinutes ?? 0)}
                      </p>
                    </div>
                    <Badge variant={restored ? "success" : "muted"}>
                      {restored ? "Restored" : "Excluded"}
                    </Badge>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {restored
                      ? "Manually restored to your schedule. Your knowledge declaration is still saved."
                      : reason}
                  </p>
                  <Button
                    className="mt-3 w-full sm:w-auto"
                    size="sm"
                    variant={restored ? "outline" : "secondary"}
                    disabled={working}
                    aria-label={`${restored ? "Use known exclusion for" : "Add back"} ${occurrence.title}`}
                    onClick={() => {
                      if (restored) void onUseKnownExclusion(occurrence.occurrenceId);
                      else void onAddBack(occurrence.occurrenceId);
                    }}
                  >
                    {restored ? "Use known exclusion" : "Add back"}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">
            Add back changes only this curriculum occurrence. It does not remove the topic from
            your saved knowledge selections.
          </p>
        </details>
      </CardContent>
    </Card>
  );
}
