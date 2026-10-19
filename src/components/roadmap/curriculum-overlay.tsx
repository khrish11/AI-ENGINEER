"use client";

import Link from "next/link";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { occurrences, phaseOrder, tracks } from "@/lib/roadmap/config";
import type { CompletionSets } from "@/lib/roadmap/progress";
import type { TrackId } from "@/lib/roadmap/types";
import { explainImportance, explainSkipped } from "@/lib/roadmap/explain";

const IMPORTANCE_BADGE: Record<string, "default" | "info" | "outline" | "muted"> = {
  core: "default",
  important: "info",
  optional: "outline",
  skip: "muted",
};

const IMPORTANCE_LABEL: Record<string, string> = {
  core: "Core",
  important: "Important",
  optional: "Optional",
  skip: "Skip",
};

interface PhaseRow {
  phaseSlug: string;
  counts: Record<string, number>;
  total: number;
  completed: number;
}

export function CurriculumOverlay({
  trackId,
  completion,
  excludedPhases,
  onTogglePhase,
}: {
  trackId: TrackId;
  completion: CompletionSets | null;
  excludedPhases: string[];
  onTogglePhase?: (phaseSlug: string, occurrenceIds: string[]) => void;
}) {
  const [expanded, setExpanded] = React.useState<string | null>(null);
  const track = tracks.find((candidate) => candidate.id === trackId) ?? tracks[0];

  const rows: PhaseRow[] = React.useMemo(() => {
    return phaseOrder.map((phaseSlug) => {
      const phaseOccurrences = occurrences.filter((item) => item.phaseSlug === phaseSlug);
      const counts: Record<string, number> = { core: 0, important: 0, optional: 0, skip: 0 };
      const canonical = new Map<string, typeof phaseOccurrences[number]>();
      for (const occurrence of phaseOccurrences) {
        const importance = occurrence.importance[trackId] ?? "skip";
        const existing = canonical.get(occurrence.canonicalLessonKey);
        if (!existing) {
          canonical.set(occurrence.canonicalLessonKey, occurrence);
          continue;
        }
        const rank = { core: 0, important: 1, optional: 2, skip: 3 };
        if (rank[importance] < rank[existing.importance[trackId] ?? "skip"]) {
          canonical.set(occurrence.canonicalLessonKey, occurrence);
        }
      }
      for (const occurrence of canonical.values()) {
        counts[occurrence.importance[trackId] ?? "skip"] += 1;
      }
      let completed = 0;
      for (const occurrence of canonical.values()) {
        if (completion?.completed.has(occurrence.canonicalLessonKey)) completed += 1;
      }
      return { phaseSlug, counts, total: canonical.size, completed };
    });
  }, [trackId, completion]);

  const totals = rows.reduce(
    (acc, row) => ({
      core: acc.core + row.counts.core,
      important: acc.important + row.counts.important,
      optional: acc.optional + row.counts.optional,
      skip: acc.skip + row.counts.skip,
      completed: acc.completed + row.completed,
      total: acc.total + row.total,
    }),
    { core: 0, important: 0, optional: 0, skip: 0, completed: 0, total: 0 }
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>
          {totals.completed} / {totals.total} canonical lessons completed on this track
        </span>
        <span aria-hidden="true">·</span>
        <span>{totals.core} core</span>
        <span aria-hidden="true">·</span>
        <span>{totals.important} important</span>
        <span aria-hidden="true">·</span>
        <span>{totals.optional} optional</span>
        <span aria-hidden="true">·</span>
        <span>{totals.skip} skipped</span>
      </div>

      <ul className="space-y-2">
        {rows.map((row) => {
          const isExpanded = expanded === row.phaseSlug;
          const excluded = excludedPhases.includes(row.phaseSlug);
          const percent =
            row.total === 0 ? 0 : Math.round((row.completed / row.total) * 100);
          const phaseOccurrences = occurrences.filter(
            (item) => item.phaseSlug === row.phaseSlug
          );
          const rationale = track.phaseRationale[row.phaseSlug];

          return (
            <li key={row.phaseSlug} className="rounded-xl border border-border bg-surface">
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">
                      Phase {String(phaseOrder.indexOf(row.phaseSlug)).padStart(2, "0")} ·{" "}
                      {row.phaseSlug.replace(/^\d+-/, "").replace(/-/g, " ")}
                    </span>
                    {row.counts.core > 0 && (
                      <Badge variant="default" className="text-[10px]">
                        {row.counts.core} core
                      </Badge>
                    )}
                    {row.counts.important > 0 && (
                      <Badge variant="info" className="text-[10px]">
                        {row.counts.important} important
                      </Badge>
                    )}
                    {row.counts.skip > 0 && row.counts.skip === row.total && (
                      <Badge variant="muted" className="text-[10px]">
                        Skipped for this track
                      </Badge>
                    )}
                    {excluded && (
                      <Badge variant="warning" className="text-[10px]">
                        Excluded by you
                      </Badge>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {row.completed} / {row.total} completed
                    {rationale ? ` · ${rationale}` : ""}
                  </p>
                  <Progress value={percent} className="mt-1.5 h-1.5" aria-label={`${row.phaseSlug} progress ${percent}%`} />
                </div>
                <div className="flex items-center gap-1.5">
                  {onTogglePhase && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onTogglePhase(row.phaseSlug, phaseOccurrences.map((item) => item.occurrenceId))}
                    >
                      {excluded ? "Restore phase" : "Exclude phase"}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setExpanded(isExpanded ? null : row.phaseSlug)}
                    aria-expanded={isExpanded}
                  >
                    {isExpanded ? "Hide lessons" : "Show lessons"}
                  </Button>
                  <Link href={`/curriculum/${row.phaseSlug}`}>
                    <Button variant="secondary" size="sm">
                      Open
                    </Button>
                  </Link>
                </div>
              </div>

              {isExpanded && (
                <div className="border-t border-border/60 px-4 py-3">
                  <ul className="grid gap-1 sm:grid-cols-2">
                    {phaseOccurrences.map((occurrence) => {
                      const importance = occurrence.importance[trackId] ?? "skip";
                      const done = completion?.completed.has(occurrence.canonicalLessonKey) ?? false;
                      const skippedReason =
                        importance === "skip" || importance === "optional"
                          ? explainSkipped(occurrence.occurrenceId, trackId)
                          : null;
                      return (
                        <li
                          key={occurrence.occurrenceId}
                          className="flex items-start justify-between gap-2 rounded-lg border border-border/60 bg-card/60 px-2.5 py-1.5"
                        >
                          <span className="min-w-0">
                            <Link
                              href={`/curriculum/${occurrence.occurrenceId}`}
                              className="block truncate text-xs text-foreground hover:text-accent-cyan"
                            >
                              {done ? "✓ " : ""}
                              {occurrence.title}
                            </Link>
                            {skippedReason && (
                              <span className="block text-[11px] text-muted-foreground">
                                {skippedReason.text}
                              </span>
                            )}
                          </span>
                          <span className="flex shrink-0 flex-col items-end gap-0.5">
                            <Badge variant={IMPORTANCE_BADGE[importance]} className="text-[10px]">
                              {IMPORTANCE_LABEL[importance]}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground" title={explainImportance(importance)}>
                              {occurrence.isAlias ? "Duplicate location" : importance}
                            </span>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
