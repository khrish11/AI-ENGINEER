"use client";

import * as React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useAchievements,
  useAnalyticsOverview,
  useAnalyticsPeriod,
  useAnalyticsSources,
  useAssessmentAnalytics,
  useOverviewSkillCounts,
  useProjectAnalytics,
  useReviewQueue,
  useRoadmapPace,
  useSkillAnalytics,
  useStreaks,
  useStudyAnalytics,
} from "@/hooks/useAnalytics";
import { PERIOD_LABELS, type Period } from "@/lib/analytics/types";
import { formatPeriodAbsolute } from "@/lib/analytics/format";

const LEARNER_TIMEZONE = "UTC";

function formatStudyTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${(seconds / 3600).toFixed(1)}h`;
}

export function AnalyticsPageClient() {
  const { bundle, loading, error, refetch } = useAnalyticsSources();
  const { period, setPeriod, periodStart, availablePeriods } = useAnalyticsPeriod();
  const overview = useAnalyticsOverview(bundle, LEARNER_TIMEZONE, periodStart);
  const study = useStudyAnalytics(bundle, LEARNER_TIMEZONE, periodStart);
  const streaks = useStreaks(bundle, LEARNER_TIMEZONE);
  const skillsResult = useSkillAnalytics(bundle);
  const skillCounts = useOverviewSkillCounts(bundle, skillsResult?.skills ?? null);
  const pace = useRoadmapPace(bundle);
  const projects = useProjectAnalytics(bundle, LEARNER_TIMEZONE, periodStart);
  const assessments = useAssessmentAnalytics(bundle, periodStart);
  const reviewQueue = useReviewQueue(bundle);
  const achievements = useAchievements(bundle);
  const [reviewBusy, setReviewBusy] = React.useState<string | null>(null);

  /** §14 — snooze + successful-review actions persist to review history. */
  const snooze = async (skillId: string) => {
    setReviewBusy(skillId);
    try {
      const { reviewHistoryRepo } = await import("@/lib/progress/repositories/review-history");
      await reviewHistoryRepo.snooze(
        skillId,
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      );
      refetch();
    } finally {
      setReviewBusy(null);
    }
  };

  const markReviewed = async (skillId: string) => {
    setReviewBusy(skillId);
    try {
      const { reviewHistoryRepo } = await import("@/lib/progress/repositories/review-history");
      await reviewHistoryRepo.markReviewed(skillId);
      refetch();
    } finally {
      setReviewBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 md:px-6 py-8 max-w-7xl space-y-6" aria-busy="true">
        <div className="h-10 w-64 rounded bg-muted animate-pulse" />
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
        <span className="sr-only">Loading analytics…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 md:px-6 py-8 max-w-7xl">
        <Card>
          <CardHeader>
            <CardTitle>Analytics unavailable</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={refetch}>Retry</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!bundle || !overview) return null;

  const curriculum = overview.curriculum;
  const noActivity = overview.studyTime.sessionCount === 0 && overview.lessonsCompleted === 0;

  return (
    <div className="container mx-auto px-4 md:px-6 py-6 md:py-8 space-y-6 max-w-7xl">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-border">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Every number here is derived from your stored lesson, session, assessment and
            project records — nothing estimated.
          </p>
        </div>
        <div
          role="group"
          aria-label="Analytics period filter"
          className="flex flex-wrap gap-2"
        >
          {availablePeriods.map((value) => (
            <Button
              key={value}
              size="sm"
              variant={period === value ? "default" : "outline"}
              aria-pressed={period === value}
              onClick={() => setPeriod(value as Period)}
            >
              {PERIOD_LABELS[value as Period]}
            </Button>
          ))}
        </div>
      </header>

      {noActivity && (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">
              No learning history yet. Complete your first lesson or record a study session to
              begin building your analytics — no example data is shown until real records exist.
            </p>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="overview">
        <TabsList aria-label="Analytics sections">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="activity">Learning activity</TabsTrigger>
          <TabsTrigger value="skills">Skills</TabsTrigger>
          <TabsTrigger value="roadmap">Roadmap</TabsTrigger>
          <TabsTrigger value="projects">Projects</TabsTrigger>
          <TabsTrigger value="assessments">Assessments</TabsTrigger>
          <TabsTrigger value="review">Review</TabsTrigger>
          <TabsTrigger value="achievements">Achievements</TabsTrigger>
        </TabsList>

        {/* ------------------------- Overview ------------------------- */}
        <TabsContent value="overview" className="mt-6 space-y-4">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              label="Lessons completed"
              value={overview.lessonsCompleted.toString()}
              hint={`${curriculum.canonicalTotal} canonical lesson identities (541 in the curriculum)`}
            />
            <MetricCard
              label="Lessons mastered"
              value={overview.lessonsMastered.toString()}
              hint="Mastered canonical identities"
            />
            <MetricCard
              label="Curriculum progress"
              value={`${overview.curriculum.occurrencesCompleted}/${curriculum.byPhase.reduce(
                (sum, phase) => sum + phase.occurrences,
                0
              )} occurrences`}
              hint={`${curriculum.phasesInProgress} phases in progress`}
            />
            <MetricCard
              label="Study time"
              value={formatStudyTime(overview.studyTime.totalSeconds)}
              hint={`${overview.studyTime.sessionCount} valid sessions`}
            />
            <MetricCard
              label="Projects completed"
              value={overview.projectsCompleted.toString()}
              hint={`${overview.projectsMastered} mastered, ${overview.projectsInProgress} active`}
            />
            <MetricCard
              label="Assessments taken"
              value={overview.assessmentsTaken.toString()}
              hint="Valid attempts recorded"
            />
            <MetricCard
              label="Roadmap progress"
              value={overview.roadmapProgress === null ? "—" : `${overview.roadmapProgress}%`}
              hint="From your plan, when one exists"
            />
            <MetricCard
              label="Current streak"
              value={streaks ? `${streaks.currentStreak}d` : "—"}
              hint={`A study day = ≥ ${streaks?.minSessionMinutes ?? 10} min of recorded sessions`}
            />
          </div>

          {skillCounts && (
            <Card>
              <CardHeader>
                <CardTitle>Skill bands</CardTitle>
                <CardDescription>
                  Evidence-based mastery bands from lesson, assessment and project records.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-3">
                <Badge variant="outline">Developing: {skillCounts.developing}</Badge>
                <Badge variant="outline">Proficient: {skillCounts.proficient}</Badge>
                <Badge variant="outline">Strong: {skillCounts.strong}</Badge>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ---------------------- Learning activity ------------------- */}
        <TabsContent value="activity" className="mt-6 space-y-4">
          {!study || study.stats.sessionCount === 0 ? (
            <EmptyCard message="No study sessions recorded yet. Sessions only count when explicitly started and stopped." />
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Study time</CardTitle>
                  <CardDescription>
                    Total {formatStudyTime(study.stats.totalSeconds)} · median session{" "}
                    {formatStudyTime(study.stats.medianSessionSeconds)} · longest{" "}
                    {formatStudyTime(study.stats.longestSessionSeconds)} · avg/week{" "}
                    {formatStudyTime(study.stats.averageWeeklySeconds)}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <DailyStudyChart daily={study.stats.daily} />
                </CardContent>
              </Card>
              <div className="grid md:grid-cols-3 gap-4">
                <DimensionListCard
                  title="Study time by phase"
                  rows={study.byPhase}
                  label="Phase"
                />
                <DimensionListCard
                  title="Study time by project"
                  rows={study.byProject}
                  label="Project"
                />
                <DimensionListCard
                  title="Study time by resource type"
                  rows={study.byResourceType}
                  label="Type"
                />
              </div>
            </>
          )}
        </TabsContent>

        {/* ---------------------------- Skills ------------------------ */}
        <TabsContent value="skills" className="mt-6 space-y-4">
          {!skillsResult || skillsResult.skills.length === 0 ? (
            <EmptyCard message="No skill evidence yet. Take an assessment or complete lessons to see skill status here." />
          ) : (
            skillsResult.skills.map((skill) => (
              <Card key={skill.skillId}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between gap-3">
                    <span>{skill.skillId}</span>
                    <Badge variant="outline">{skill.mastery.band}</Badge>
                  </CardTitle>
                  <CardDescription>
                    Evidence score {skill.mastery.score}/100 · evidence coverage: {skill.evidenceCoverage}
                    {skill.weak ? " · currently weak" : ""}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="text-sm space-y-1 text-muted-foreground list-disc pl-5">
                    {skill.mastery.labels.map((label) => (
                      <li key={label}>{label}</li>
                    ))}
                    {skill.lastReviewedAt && (
                      <li>Last successful review: {skill.lastReviewedAt.slice(0, 10)}</li>
                    )}
                  </ul>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* --------------------------- Roadmap ------------------------ */}
        <TabsContent value="roadmap" className="mt-6 space-y-4">
          {pace === null || pace.status === "no_plan" ? (
            <EmptyCard message={pace?.explanation[0] ?? "Loading roadmap analytics…"} />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Roadmap pace</CardTitle>
                <CardDescription>{paceStatusLabel(pace.status)}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Progress
                  aria-label="Expected completed workload"
                  value={pace.expectedCompletedWorkloadShare ?? 0}
                />
                <Progress
                  aria-label="Actual completed workload"
                  value={pace.actualCompletedWorkloadShare ?? 0}
                />
                <div className="grid sm:grid-cols-2 gap-2 text-sm">
                  <div>Expected workload completed: {pace.expectedCompletedWorkloadShare ?? "—"}%</div>
                  <div>Actual workload completed: {pace.actualCompletedWorkloadShare ?? "—"}%</div>
                  <div>Scheduled hours by today: {pace.scheduledHoursToToday ?? "—"}</div>
                  <div>Recorded study hours: {pace.actualStudyHours ?? "—"}</div>
                  <div>Backlog: {pace.backlogSize} occurrences</div>
                </div>
                {pace.projectedCompletion && (
                  <p className="text-sm text-muted-foreground">
                    Projected completion: {formatPeriodAbsolute(pace.projectedCompletion)} ·{" "}
                    {pace.explanation.join(" ")}
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ---------------------------- Projects ---------------------- */}
        <TabsContent value="projects" className="mt-6 space-y-4">
          {!projects || projects.started === 0 ? (
            <EmptyCard message="No project activity yet. Start a project milestone in the project studio." />
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Project totals</CardTitle>
                  <CardDescription>
                    Started {projects.started} · active {projects.inProgress} · submitted{" "}
                    {projects.submitted} · completed {projects.completed} · mastered{" "}
                    {projects.mastered} · evidence {projects.evidenceProvided}
                  </CardDescription>
                </CardHeader>
              </Card>
              {projects.rows
                .filter((row) => row.status !== "not_started")
                .map((row) => (
                  <Card key={row.projectId}>
                    <CardHeader>
                      <CardTitle>{row.title}</CardTitle>
                      <CardDescription>
                        {row.status} · {row.milestonesCompleted}/{row.milestonesRequired} required
                        milestones · {row.evidenceCount} evidence · est. {row.estimatedHours}h
                      </CardDescription>
                    </CardHeader>
                    {row.selfAssessmentHistory.length > 0 && (
                      <CardContent className="text-sm text-muted-foreground">
                        Self-assessed rubric score (learner-entered, not a verified grade):{" "}
                        {row.selfAssessmentHistory[0].totalEarned ?? "—"}/
                        {row.selfAssessmentHistory[0].totalMax ?? "—"}
                      </CardContent>
                    )}
                  </Card>
                ))}
            </>
          )}
        </TabsContent>

        {/* -------------------------- Assessments --------------------- */}
        <TabsContent value="assessments" className="mt-6 space-y-4">
          {!assessments || assessments.rows.every((row) => row.attempts === 0) ? (
            <EmptyCard message="Take an assessment to see attempts, trends and weak skills here." />
          ) : (
            <>
              {assessments.rows
                .filter((row) => row.attempts > 0)
                .map((row) => (
                  <Card key={row.assessmentId}>
                    <CardHeader>
                      <CardTitle>{row.title}</CardTitle>
                      <CardDescription>
                        {row.attempts} attempt(s) · best {row.bestScore ?? "—"}% · latest{" "}
                        {row.latestScore ?? "—"}% · recent avg {row.averageRecentScore ?? "—"}% ·
                        trend {row.improvementTrend}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground">
                      Skills tested: {row.skillsTested.join(", ") || "—"}
                    </CardContent>
                  </Card>
                ))}
              {assessments.weakSkills.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Weak skills</CardTitle>
                    <CardDescription>
                      Deterministic from the latest attempts (threshold 70%, window 3).
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-2">
                    {assessments.weakSkills.map((skill) => (
                      <Badge key={skill} variant="outline">
                        {skill}
                      </Badge>
                    ))}
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        {/* ---------------------------- Review ------------------------ */}
        <TabsContent value="review" className="mt-6 space-y-4">
          {!reviewQueue || reviewQueue.length === 0 ? (
            <EmptyCard message="Nothing to review right now. Weak-skill signals will appear here with an explanation." />
          ) : (
            reviewQueue.map((item) => (
              <Card key={item.skillId}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{item.skillId}</span>
                    {item.overdue && <Badge variant="outline">Overdue</Badge>}
                  </CardTitle>
                  <CardDescription>
                    {item.dueInDays !== null ? `Review in ${item.dueInDays} day(s)` : "When convenient"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-sm font-medium">Why review this now?</p>
                  <p className="text-sm text-muted-foreground">{item.whyNow}</p>
                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={reviewBusy === item.skillId}
                      onClick={() => void markReviewed(item.skillId)}
                    >
                      Mark reviewed
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={reviewBusy === item.skillId}
                      onClick={() => void snooze(item.skillId)}
                    >
                      Snooze 7 days
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* -------------------------- Achievements -------------------- */}
        <TabsContent value="achievements" className="mt-6 space-y-4">
          {achievements === null ? null : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {achievements.map((achievement) =>
                achievement.earnedAt ? (
                  <Card key={achievement.id}>
                    <CardHeader>
                      <CardTitle className="text-base">{achievement.title}</CardTitle>
                      <CardDescription>
                        Earned {achievement.earnedAt.slice(0, 10)} · {achievement.sourceEvidence}
                      </CardDescription>
                    </CardHeader>
                  </Card>
                ) : (
                  <Card key={achievement.id} className="opacity-60">
                    <CardHeader>
                      <CardTitle className="text-base">{achievement.title}</CardTitle>
                      <CardDescription>
                        Not earned yet · {achievement.description}
                      </CardDescription>
                    </CardHeader>
                  </Card>
                )
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MetricCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl">{value}</CardTitle>
      </CardHeader>
      <CardContent className="text-xs text-muted-foreground">{hint}</CardContent>
    </Card>
  );
}

function EmptyCard({ message }: { message: string }) {
  return (
    <Card>
      <CardContent className="py-8 text-center text-muted-foreground">{message}</CardContent>
    </Card>
  );
}

/** Accessible study-time bar chart: real SVG with text alternatives (§53). */
function DailyStudyChart({ daily }: { daily: Array<{ day: string; seconds: number }> }) {
  if (daily.length === 0) return <p className="text-sm text-muted-foreground">No sessions in this period.</p>;
  const maxSeconds = Math.max(...daily.map((bucket) => bucket.seconds), 1);
  const shown = daily.slice(-30);
  return (
    <figure>
      <div role="img" aria-label={`Study time per day for the last ${shown.length} recorded days`}>
        <div className="flex items-end gap-1 h-32">
          {shown.map((bucket) => (
            <div
              key={bucket.day}
              className="flex-1 bg-cyan-500/40 rounded-t"
              style={{ height: `${Math.round((bucket.seconds / maxSeconds) * 100)}%` }}
              title={`${bucket.day}: ${formatStudyTime(bucket.seconds)}`}
            />
          ))}
        </div>
      </div>
      <figcaption className="sr-only">
        {daily
          .slice(-14)
          .map((bucket) => `${bucket.day}: ${formatStudyTime(bucket.seconds)}`)
          .join("; ")}
      </figcaption>
    </figure>
  );
}

function DimensionListCard({
  title,
  rows,
  label,
}: {
  title: string;
  rows: Array<{ key: string; seconds: number }>;
  label: string;
}) {
  const total = rows.reduce((sum, row) => sum + row.seconds, 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {rows.length === 0 && <CardDescription>Nothing recorded in this period.</CardDescription>}
      </CardHeader>
      <CardContent>
        {rows.length > 0 && (
          <table className="w-full text-sm">
            <caption className="sr-only">{`${label} study time breakdown`}</caption>
            <thead>
              <tr className="text-left text-muted-foreground">
                <th scope="col" className="pb-1">{label}</th>
                <th scope="col" className="pb-1 text-right">Time</th>
                <th scope="col" className="pb-1 text-right">Share</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 8).map((row) => (
                <tr key={row.key}>
                  <td className="py-0.5 pr-2 truncate max-w-40">{row.key}</td>
                  <td className="py-0.5 text-right">{formatStudyTime(row.seconds)}</td>
                  <td className="py-0.5 text-right">
                    {total > 0 ? `${Math.round((row.seconds / total) * 100)}%` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}

function paceStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    ahead: "Ahead of the planned schedule",
    on_track: "On track with the planned schedule",
    slightly_behind: "Slightly behind the planned schedule",
    significantly_behind: "Significantly behind the planned schedule",
    no_plan: "No roadmap plan",
  };
  return labels[status] ?? status;
}
