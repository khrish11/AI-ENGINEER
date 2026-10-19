"use client";

import Link from "next/link";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useRoadmap } from "@/hooks/useRoadmap";
import { skillsById, trackById, tracks } from "@/lib/roadmap/config";
import { generateRoadmap } from "@/lib/roadmap/scheduler";
import { compareTracks, trackStats } from "@/lib/roadmap/tracks";
import type { TrackId } from "@/lib/roadmap/types";
import { ArrowRight, CheckCircle2, GitCompareArrows, Trophy } from "lucide-react";

export function TrackCatalog() {
  const { ready, store, settings, completion, working, actions } = useRoadmap();
  const [compareA, setCompareA] = React.useState<TrackId>("rag");
  const [compareB, setCompareB] = React.useState<TrackId>("agent");
  const [switchTarget, setSwitchTarget] = React.useState<TrackId | null>(null);

  const currentTrack = settings?.trackId ?? store?.profile?.goalTrackId ?? "general-ai";
  const comparison = React.useMemo(() => compareTracks(compareA, compareB), [compareA, compareB]);

  const preview = React.useMemo(() => {
    if (!switchTarget || !settings) return null;
    try {
      const generated = generateRoadmap({
        ...settings,
        trackId: switchTarget,
        startDate: settings.startDate,
        completedCanonicalLessonKeys: [...(completion?.completed ?? [])],
      });
      const currentWeeks = store?.plan?.weeks.length ?? 0;
      return {
        weeks: generated.plan.weeks.length,
        currentWeeks,
        requiredMinutes: generated.plan.summary.totalMinutes,
        coreTotal: generated.plan.summary.coreTotal,
        hours: Math.round(generated.plan.summary.totalMinutes / 60),
      };
    } catch {
      return null;
    }
  }, [switchTarget, settings, store, completion]);

  const switchTrack = async () => {
    if (!switchTarget) return;
    await actions.updateSettings({ trackId: switchTarget }, true);
    setSwitchTarget(null);
  };

  const statsByTrack = Object.fromEntries(tracks.map((track) => [track.id, trackStats(track.id)]));

  return (
    <div className="space-y-6">
      {/* Comparison */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <GitCompareArrows className="w-4 h-4" aria-hidden="true" />
            Compare two tracks
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <label className="text-xs text-muted-foreground">
              Track A
              <select
                className="ml-2 h-9 rounded-lg border border-border bg-surface px-2 text-sm text-foreground"
                value={compareA}
                onChange={(event) => setCompareA(event.target.value as TrackId)}
                aria-label="First track to compare"
              >
                {tracks.map((track) => (
                  <option key={track.id} value={track.id}>
                    {track.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-muted-foreground">
              Track B
              <select
                className="ml-2 h-9 rounded-lg border border-border bg-surface px-2 text-sm text-foreground"
                value={compareB}
                onChange={(event) => setCompareB(event.target.value as TrackId)}
                aria-label="Second track to compare"
              >
                {tracks.map((track) => (
                  <option key={track.id} value={track.id}>
                    {track.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-2 sm:grid-cols-3 text-center">
            <div className="rounded-lg border border-border bg-surface p-3">
              <p className="text-lg font-semibold text-foreground">
                {comparison.sharedCoreOccurrenceIds.length}
              </p>
              <p className="text-[11px] text-muted-foreground">Shared core lessons</p>
            </div>
            <div className="rounded-lg border border-border bg-surface p-3">
              <p className="text-lg font-semibold text-foreground">
                {comparison.uniqueCoreA.length} / {comparison.uniqueCoreB.length}
              </p>
              <p className="text-[11px] text-muted-foreground">Unique core (A / B)</p>
            </div>
            <div className="rounded-lg border border-border bg-surface p-3">
              <p className="text-lg font-semibold text-foreground">
                {comparison.additionalHoursB >= 0 ? "+" : ""}
                {comparison.additionalHoursB}h
              </p>
              <p className="text-[11px] text-muted-foreground">B vs A required hours</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 text-xs">
            <div className="rounded-lg border border-border bg-card/60 p-3">
              <p className="font-semibold text-foreground mb-1">
                {trackById[comparison.trackA].name} only
              </p>
              <ul className="space-y-0.5 text-muted-foreground">
                {comparison.uniqueCoreA.slice(0, 6).map((key) => (
                  <li key={key} className="truncate">
                    {key.split("/")[1]?.replace(/-/g, " ") ?? key}
                  </li>
                ))}
                {comparison.uniqueCoreA.length === 0 && <li>—</li>}
                {comparison.uniqueCoreA.length > 6 && (
                  <li>+ {comparison.uniqueCoreA.length - 6} more</li>
                )}
              </ul>
            </div>
            <div className="rounded-lg border border-border bg-card/60 p-3">
              <p className="font-semibold text-foreground mb-1">
                {trackById[comparison.trackB].name} only
              </p>
              <ul className="space-y-0.5 text-muted-foreground">
                {comparison.uniqueCoreB.slice(0, 6).map((key) => (
                  <li key={key} className="truncate">
                    {key.split("/")[1]?.replace(/-/g, " ") ?? key}
                  </li>
                ))}
                {comparison.uniqueCoreB.length === 0 && <li>—</li>}
                {comparison.uniqueCoreB.length > 6 && (
                  <li>+ {comparison.uniqueCoreB.length - 6} more</li>
                )}
              </ul>
            </div>
          </div>

          {comparison.projectDifference.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Major project differences: {comparison.projectDifference.join(" · ")}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Catalog */}
      <div className="grid gap-4 lg:grid-cols-2">
        {tracks.map((track) => {
          const stats = statsByTrack[track.id];
          const isCurrent = currentTrack === track.id;
          return (
            <Card key={track.id} className={isCurrent ? "border-accent-cyan/60" : undefined}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">{track.name}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">{track.tagline}</p>
                  </div>
                  {isCurrent && <Badge variant="default">Current</Badge>}
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="text-xs text-muted-foreground">{track.description}</p>

                <div className="flex flex-wrap gap-1.5 text-[11px]">
                  <Badge variant="outline">{stats.core} core</Badge>
                  <Badge variant="outline">{stats.important} important</Badge>
                  <Badge variant="outline">{stats.optional} optional</Badge>
                  <Badge variant="outline">{stats.skip} skipped</Badge>
                  <Badge variant="secondary">~{stats.requiredHours}h required</Badge>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    Core skills
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {track.coreSkills.map((skill) => (
                      <Badge key={skill} variant="muted" className="text-[10px]">
                        {skillsById.get(skill)?.name ?? skill}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    Target roles
                  </p>
                  <p className="text-xs text-muted-foreground">{track.targetRoles.join(" · ")}</p>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    Included phases ({stats.phases.length}/20)
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {stats.phases.map((phase) => phase.slice(0, 2)).join(", ")}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1">
                    <Trophy className="w-3 h-3" aria-hidden="true" /> Major projects
                  </p>
                  <ul className="space-y-0.5 text-xs text-muted-foreground">
                    {track.majorProjects.map((project) => (
                      <li key={project}>• {project}</li>
                    ))}
                  </ul>
                </div>

                <p className="text-[11px] text-muted-foreground">
                  Hours are estimates from curriculum durations — no employment or salary outcome
                  is implied or promised.
                </p>

                <div className="flex gap-2">
                  <Button
                    variant={isCurrent ? "secondary" : "default"}
                    size="sm"
                    disabled={isCurrent || !ready}
                    onClick={() => setSwitchTarget(track.id)}
                    data-testid={`switch-track-${track.id}`}
                  >
                    {isCurrent ? "Current track" : "Switch to this track"}{" "}
                    {!isCurrent && <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />}
                  </Button>
                  <Link href="/roadmap">
                    <Button variant="ghost" size="sm">
                      Open roadmap
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={switchTarget !== null} onOpenChange={(next) => !next && setSwitchTarget(null)}>
        <DialogContent aria-label="Switch track preview">
          <DialogHeader>
            <DialogTitle>
              Switch to {switchTarget ? trackById[switchTarget].name : ""}?
            </DialogTitle>
            <DialogDescription>
              Completed lessons are kept. Your remaining plan is regenerated for the new track.
            </DialogDescription>
          </DialogHeader>

          {preview && (
            <div className="rounded-lg border border-border bg-surface p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-semibold text-foreground">Preview</p>
              <p>
                Lessons required: {preview.coreTotal} core · ~{preview.hours}h
              </p>
              <p>
                Weeks: {preview.currentWeeks || "—"} → {preview.weeks}
              </p>
              <p className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-status-success" aria-hidden="true" />
                Your completed history is preserved and shared through canonical lesson identity.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSwitchTarget(null)} disabled={working}>
              Cancel
            </Button>
            <Button
              onClick={() => void switchTrack()}
              isLoading={working}
              data-testid="confirm-switch-track"
            >
              Switch track
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
