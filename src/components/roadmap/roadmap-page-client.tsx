"use client";

import Link from "next/link";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageLayout } from "@/components/page-layout";
import { useRoadmap } from "@/hooks/useRoadmap";
import { useCurrentWeek } from "@/hooks/useCurrentWeek";
import { useRoadmapProgress } from "@/hooks/useRoadmapProgress";
import { useSkillProgress } from "@/hooks/useSkillProgress";
import { useRoadmapNotifications } from "@/hooks/useRoadmapNotifications";
import { CalendarView } from "@/components/roadmap/calendar-view";
import { CurriculumOverlay } from "@/components/roadmap/curriculum-overlay";
import { CurrentWeekCard } from "@/components/roadmap/current-week-card";
import { ItemExplainer } from "@/components/roadmap/item-explainer";
import { BacklogPanel } from "@/components/roadmap/backlog-panel";
import { RescheduleDialog } from "@/components/roadmap/reschedule-dialog";
import { RoadmapSettingsDialog } from "@/components/roadmap/roadmap-settings-dialog";
import { SkillsView } from "@/components/roadmap/skills-view";
import { WeekTimeline } from "@/components/roadmap/week-timeline";
import { trackById, tracks, formatMinutes, phaseOrder } from "@/lib/roadmap/config";
import { formatLongDate, todayIso } from "@/lib/roadmap/dates";
import type { RoadmapSettings } from "@/lib/roadmap/types";
import {
  ArrowRight,
  CalendarRange,
  Compass,
  Gauge,
  ListChecks,
  Map,
  Settings2,
  Sparkles,
} from "lucide-react";

const FEASIBILITY_LABEL = {
  comfortable: "Comfortable",
  achievable: "Achievable",
  tight: "Tight",
  unrealistic: "Unrealistic",
} as const;

export function RoadmapPageClient() {
  const { ready, loading, working, store, plan, settings, completion, error, actions } =
    useRoadmap();
  const weekView = useCurrentWeek(plan, completion);
  const progress = useRoadmapProgress(store, completion);
  const skillProgress = useSkillProgress(settings?.trackId ?? "general-ai", completion);
  const notifications = useRoadmapNotifications(store, completion);

  const [explainer, setExplainer] = React.useState<string | null>(null);
  const [rescheduleOpen, setRescheduleOpen] = React.useState(false);
  const [settingsOpen, setSettingsOpen] = React.useState(false);

  const track = trackById[settings?.trackId ?? "general-ai"] ?? tracks[0];

  const excludedPhases = React.useMemo(() => {
    if (!settings || settings.manuallyExcluded.length === 0) return [];
    return phaseOrder.filter((phaseSlug) =>
      settings.manuallyExcluded.some((id) => id.startsWith(`${phaseSlug}/`))
    );
  }, [settings]);

  const include = async (occurrenceId: string) => {
    if (!settings) return;
    const excluded = settings.manuallyExcluded.filter((id) => id !== occurrenceId);
    const included = settings.manuallyIncluded.includes(occurrenceId)
      ? settings.manuallyIncluded
      : [...settings.manuallyIncluded, occurrenceId];
    await actions.updateSettings(
      { manuallyExcluded: excluded, manuallyIncluded: included },
      false
    );
    await actions.reschedule({});
  };

  const exclude = async (occurrenceId: string) => {
    if (!settings) return;
    const excluded = settings.manuallyExcluded.includes(occurrenceId)
      ? settings.manuallyExcluded
      : [...settings.manuallyExcluded, occurrenceId];
    const included = settings.manuallyIncluded.filter((id) => id !== occurrenceId);
    await actions.updateSettings(
      { manuallyExcluded: excluded, manuallyIncluded: included },
      false
    );
    await actions.reschedule({ droppedOccurrenceIds: [occurrenceId] });
  };

  const togglePhase = async (phaseSlug: string, occurrenceIds: string[]) => {
    if (!settings) return;
    const isExcluded = excludedPhases.includes(phaseSlug);
    if (isExcluded) {
      const excluded = settings.manuallyExcluded.filter((id) => !id.startsWith(`${phaseSlug}/`));
      await actions.updateSettings({ manuallyExcluded: excluded }, false);
      await actions.reschedule({});
    } else {
      const excluded = [...new Set([...settings.manuallyExcluded, ...occurrenceIds])];
      await actions.updateSettings({ manuallyExcluded: excluded }, false);
      await actions.reschedule({});
    }
  };

  const move = async (occurrenceId: string, weekIndex: number) => {
    if (!settings) return;
    await actions.updateSettings(
      { manualWeekAssignments: { ...settings.manualWeekAssignments, [occurrenceId]: weekIndex } },
      false
    );
    await actions.reschedule({});
  };

  const saveSettings = async (changes: Partial<RoadmapSettings>) => {
    await actions.updateSettings(changes, true);
  };

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="h-24 rounded-xl bg-muted animate-pulse" />
        <div className="h-64 rounded-xl bg-muted animate-pulse" />
      </div>
    );
  }

  if (!ready || !store || !plan || !settings) {
    return (
      <Card variant="surface" className="text-center p-8 md:p-12 border-dashed border-2">
        <div className="w-16 h-16 rounded-full bg-accent-cyan/15 text-accent-cyan flex items-center justify-center mx-auto mb-4">
          <Compass className="w-8 h-8" aria-hidden="true" />
        </div>
        <h2 className="text-xl font-bold mb-2">No roadmap yet</h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
          Seven quick questions about your background, goals, and study time. The plan is computed
          deterministically on this device — no account and no AI required.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/onboarding">
            <Button className="gap-2" data-testid="start-onboarding">
              Start onboarding <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Button>
          </Link>
          <Link href="/roadmap/paths">
            <Button variant="outline">Compare career tracks</Button>
          </Link>
        </div>
      </Card>
    );
  }

  const feasibility = progress.analysis?.feasibility ?? "achievable";

  return (
    <div className="space-y-6">
      {error && (
        <p role="alert" className="text-sm text-status-error">
          {error}
        </p>
      )}

      {/* Header */}
      <div className="rounded-xl border border-border bg-surface p-4 md:p-5 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-foreground">{track.name}</h2>
              <Badge variant="outline">{settings.availableHoursPerWeek}h / week</Badge>
              <Badge variant="outline">
                {plan.targetDate ? `Target ${formatLongDate(plan.targetDate)}` : "No fixed deadline"}
              </Badge>
              <Badge
                variant={
                  feasibility === "comfortable" || feasibility === "achievable"
                    ? "success"
                    : feasibility === "tight"
                      ? "warning"
                      : "error"
                }
                data-testid="feasibility-badge"
              >
                <Gauge className="w-3 h-3" aria-hidden="true" />
                {FEASIBILITY_LABEL[feasibility]}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {progress.percent}% of planned lessons complete · {progress.coreCompleted}/
              {progress.coreTotal} core · projected finish{" "}
              {progress.projectedEnd ? formatLongDate(progress.projectedEnd) : "—"}
              {progress.pace !== "on-track" ? ` · ${progress.pace.replace("-", " ")}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)} data-testid="open-settings">
              <Settings2 className="w-3.5 h-3.5" aria-hidden="true" /> Settings
            </Button>
            <Button variant="outline" size="sm" onClick={() => setRescheduleOpen(true)}>
              Reschedule
            </Button>
            <Link href="/roadmap/paths">
              <Button variant="secondary" size="sm">
                <Map className="w-3.5 h-3.5" aria-hidden="true" /> Tracks
              </Button>
            </Link>
            <Link href="/onboarding">
              <Button variant="ghost" size="sm">
                Re-run onboarding
              </Button>
            </Link>
          </div>
        </div>
        <Progress
          value={progress.percent}
          aria-label={`Roadmap progress ${progress.percent}%`}
          className="h-2"
        />
      </div>

      {notifications.length > 0 && (
        <ul className="space-y-1.5" aria-label="Roadmap notifications">
          {notifications.map((notification) => (
            <li
              key={notification.id}
              className={`rounded-lg border px-3 py-2 text-xs ${
                notification.tone === "warning"
                  ? "border-status-warning/40 bg-status-warning/10 text-foreground"
                  : "border-border bg-surface text-muted-foreground"
              }`}
            >
              <span className="font-semibold mr-1.5">
                {notification.kind === "overdue"
                  ? "Overdue"
                  : notification.kind === "buffer"
                    ? "Buffer ahead"
                    : notification.kind === "blocked"
                      ? "Prerequisite"
                      : notification.kind === "feasibility"
                        ? "Deadline"
                        : "Notice"}
                :
              </span>
              {notification.text}
            </li>
          ))}
        </ul>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <CurrentWeekCard view={weekView} trackId={track.id} onExplain={setExplainer} />

          <Tabs defaultValue="timeline">
            <TabsList className="w-full sm:w-auto overflow-x-auto">
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
              <TabsTrigger value="curriculum">Curriculum</TabsTrigger>
              <TabsTrigger value="calendar">Calendar</TabsTrigger>
              <TabsTrigger value="skills">Skills</TabsTrigger>
            </TabsList>

            <TabsContent value="timeline">
              <WeekTimeline plan={plan} completion={completion} onExplain={setExplainer} />
            </TabsContent>
            <TabsContent value="curriculum">
              <CurriculumOverlay
                trackId={track.id}
                completion={completion}
                excludedPhases={excludedPhases}
                onTogglePhase={togglePhase}
              />
            </TabsContent>
            <TabsContent value="calendar">
              <CalendarView plan={plan} completion={completion} />
            </TabsContent>
            <TabsContent value="skills">
              <SkillsView {...skillProgress} />
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-6">
          <BacklogPanel
            plan={plan}
            completion={completion}
            onReschedule={() => setRescheduleOpen(true)}
            onExclude={exclude}
            onExplain={setExplainer}
          />

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Workload</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Required</span>
                <span className="font-semibold text-foreground">
                  {formatMinutes(progress.analysis?.requiredMinutes ?? plan.summary.totalMinutes)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Available until target</span>
                <span className="font-semibold text-foreground">
                  {formatMinutes(progress.analysis?.availableMinutes ?? 0)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Difference</span>
                <span
                  className={`font-semibold ${
                    (progress.analysis?.differenceMinutes ?? 0) < 0
                      ? "text-status-error"
                      : "text-status-success"
                  }`}
                >
                  {(progress.analysis?.differenceMinutes ?? 0) >= 0 ? "+" : ""}
                  {formatMinutes(Math.abs(progress.analysis?.differenceMinutes ?? 0))}
                </span>
              </div>
              {progress.analysis && progress.analysis.options.length > 0 && (
                <ul className="mt-1 space-y-1 text-xs text-muted-foreground list-disc pl-4">
                  {progress.analysis.options.map((option) => (
                    <li key={option}>{option}</li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Plan history</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-muted-foreground">
              <p>
                <ListChecks className="w-3.5 h-3.5 inline mr-1.5" aria-hidden="true" />
                {store.history.length} recorded change{store.history.length === 1 ? "" : "s"}
                {store.history.length > 0 ? ` · last: ${store.history[store.history.length - 1].summary}` : ""}
              </p>
              <p>
                <CalendarRange className="w-3.5 h-3.5 inline mr-1.5" aria-hidden="true" />
                {plan.weeks.length} weeks · {plan.weeks.filter((w) => w.kind === "buffer").length}{" "}
                buffer weeks
              </p>
              <p>
                <Sparkles className="w-3.5 h-3.5 inline mr-1.5" aria-hidden="true" />
                Generated locally on {formatLongDate(plan.startDate)} · deterministic
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      <ItemExplainer
        occurrenceId={explainer}
        trackId={track.id}
        plan={plan}
        completion={completion}
        onClose={() => setExplainer(null)}
        onExclude={exclude}
        onInclude={include}
        onMove={move}
      />

      <RescheduleDialog
        open={rescheduleOpen}
        onOpenChange={setRescheduleOpen}
        store={store}
        completion={completion}
        working={working}
        onApply={async (changes) => {
          await actions.reschedule(changes);
        }}
      />

      <RoadmapSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        settings={settings}
        working={working}
        onSave={saveSettings}
      />

      <p className="text-[11px] text-muted-foreground">
        Planning runs entirely in your browser using the deterministic roadmap engine. Plan
        generation measured locally: well under 500ms for {plan.summary.totalOccurrences} lessons.
      </p>
      <span className="sr-only">Today is {todayIso()}</span>
    </div>
  );
}
