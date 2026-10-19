"use client";

import * as React from "react";
import Link from "next/link";
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
import { PageLayout } from "@/components/page-layout";
import { useLearnerStats } from "@/hooks/useLearnerStats";
import { RoadmapSummaryCard } from "@/components/roadmap/roadmap-summary-card";
import { useBookmarks } from "@/hooks/useBookmarks";
import { lessonStatusLabel } from "@/lib/progress/completion";
import {
  BookOpen,
  Clock,
  Award,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Flame,
  TrendingUp,
  Library,
  FolderKanban,
  Star,
} from "lucide-react";

function formatStudyTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${(seconds / 3600).toFixed(1)}h`;
}

export default function DashboardPage() {
  const { stats, lessons, loading } = useLearnerStats();
  const { bookmarks } = useBookmarks();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const recentLessons = React.useMemo(
    () =>
      [...lessons]
        .filter((lesson) => lesson.status !== "not_started")
        .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
        .slice(0, 6),
    [lessons]
  );

  const reviewLessons = React.useMemo(
    () => lessons.filter((lesson) => lesson.needsReview).slice(0, 6),
    [lessons]
  );

  const hasActivity =
    stats.lessonsStarted > 0 ||
    stats.resourcesCompleted > 0 ||
    stats.quizAttempts > 0 ||
    bookmarks.length > 0;

  if (loading || !mounted) {
    return (
      <PageLayout>
        <div className="container mx-auto px-4 py-6 max-w-7xl">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
          <div className="space-y-6" aria-busy="true">
            <div className="h-48 rounded-xl bg-muted animate-pulse" />
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-32 rounded-xl bg-muted animate-pulse" />
              ))}
            </div>
          </div>
        </div>
      </PageLayout>
    );
  }

  const metrics = [
    {
      label: "Lessons Started",
      value: stats.lessonsStarted.toString(),
      icon: BookOpen,
      tone: "text-accent-cyan",
      hint: `${stats.lessonsCompleted} completed`,
    },
    {
      label: "Lessons Mastered",
      value: stats.lessonsMastered.toString(),
      icon: Award,
      tone: "text-status-success",
      hint: "Best quiz score ≥ 80%",
    },
    {
      label: "Resources Completed",
      value: stats.resourcesCompleted.toString(),
      icon: Library,
      tone: "text-accent-violet",
      hint: `${stats.videosWatched} videos watched`,
    },
    {
      label: "Study Time",
      value: formatStudyTime(stats.totalStudySeconds),
      icon: Clock,
      tone: "text-accent-cyan",
      hint: `${stats.studySessionCount} sessions`,
    },
    {
      label: "Current Streak",
      value: `${stats.currentStreak}d`,
      icon: Flame,
      tone: "text-amber-400",
      hint: "Consecutive study days",
    },
    {
      label: "Quiz Attempts",
      value: stats.quizAttempts.toString(),
      icon: TrendingUp,
      tone: "text-status-success",
      hint: "Immutable attempt history",
    },
    {
      label: "Active Projects",
      value: stats.activeProjects.toString(),
      icon: FolderKanban,
      tone: "text-accent-violet",
      hint: "Milestones in progress",
    },
    {
      label: "Review Queue",
      value: stats.reviewQueue.toString(),
      icon: Star,
      tone: "text-accent-cyan",
      hint: "Flagged for review",
    },
  ];

  return (
    <PageLayout>
      <div className="container mx-auto px-4 md:px-6 py-6 md:py-8 space-y-6 max-w-7xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-border">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
              Dashboard
            </h1>
            <p className="text-sm text-muted-foreground">
              Your learning progress, calculated from real activity stored locally.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/curriculum">
              <Button variant="default" className="gap-2">
                Browse Curriculum <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link href="/saved">
              <Button variant="outline" size="sm" className="gap-2">
                Saved ({bookmarks.length})
              </Button>
            </Link>
          </div>
        </div>

        <RoadmapSummaryCard />

        {!hasActivity ? (
          <Card variant="surface" className="text-center p-8 md:p-12 border-dashed border-2">
            <div className="w-16 h-16 rounded-full bg-accent-cyan/15 text-accent-cyan flex items-center justify-center mx-auto mb-4">
              <BookOpen className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold mb-2">Your AI Journey Starts Here</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
              You have not started any lesson yet. Everything you do is saved on this device and
              survives reloads — no account required.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link href="/curriculum">
                <Button variant="default" className="gap-2">
                  Browse Curriculum <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <Link href="/roadmap">
                <Button variant="secondary">Explore Roadmap</Button>
              </Link>
            </div>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {metrics.map((metric) => (
                <Card key={metric.label}>
                  <CardHeader className="p-4 pb-2 flex-row items-center justify-between space-y-0">
                    <CardTitle className="text-xs font-medium text-muted-foreground">
                      {metric.label}
                    </CardTitle>
                    <metric.icon className={`w-4 h-4 ${metric.tone}`} />
                  </CardHeader>
                  <CardContent className="p-4 pt-1">
                    <div className="text-2xl font-bold text-foreground" data-testid={`metric-${metric.label.toLowerCase().replace(/\s+/g, "-")}`}>
                      {metric.value}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">{metric.hint}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base font-semibold">Continue learning</CardTitle>
                  <CardDescription>
                    Recently touched lessons, most recent first.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {recentLessons.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Mark a lesson as read to see it here.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {recentLessons.map((lesson) => (
                        <Link
                          key={lesson.id}
                          href={lesson.lessonHref ?? "/curriculum"}
                          className="flex items-center justify-between p-3 rounded-lg border border-border bg-surface hover:bg-accent-cyan/5 transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                              {lesson.lessonTitle ?? lesson.lessonId}
                            </p>
                            <span className="text-xs text-muted-foreground">
                              {lesson.phaseSlug ? `${lesson.phaseSlug} · ` : ""}
                              {lessonStatusLabel(lesson.status)}
                            </span>
                          </div>
                          <Badge
                            variant={
                              lesson.status === "completed" || lesson.status === "mastered"
                                ? "success"
                                : lesson.status === "in_progress"
                                  ? "default"
                                  : "secondary"
                            }
                          >
                            {lessonStatusLabel(lesson.status)}
                          </Badge>
                        </Link>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base font-semibold">Review queue</CardTitle>
                    <CardDescription>Lessons you flagged for another pass.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {reviewLessons.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Nothing flagged. Use &ldquo;Review later&rdquo; on a lesson to queue it.
                      </p>
                    ) : (
                      <ul className="space-y-2">
                        {reviewLessons.map((lesson) => (
                          <li key={lesson.id}>
                            <Link
                              href={lesson.lessonHref ?? "/curriculum"}
                              className="text-sm text-foreground hover:text-accent-cyan"
                            >
                              {lesson.lessonTitle ?? lesson.lessonId}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base font-semibold">Saved</CardTitle>
                    <CardDescription>{bookmarks.length} bookmarked items.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Link href="/saved">
                      <Button variant="secondary" size="sm" className="w-full justify-between">
                        Open saved items <ArrowRight className="w-3.5 h-3.5" />
                      </Button>
                    </Link>
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Sparkles className="w-3 h-3" />
                      Bookmark lessons, videos, repos and docs.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold">Study activity</CardTitle>
                <CardDescription>
                  Total time is derived by summing unique, immutable study sessions.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Total study time</span>
                  <span className="font-semibold text-foreground">
                    {formatStudyTime(stats.totalStudySeconds)}
                  </span>
                </div>
                <Progress
                  value={Math.min(100, (stats.totalStudySeconds / 36000) * 100)}
                  className="h-1.5"
                  variant="cyan"
                />
                <p className="text-[11px] text-muted-foreground">
                  {stats.studySessionCount} unique sessions on this device
                </p>
              </CardContent>
            </Card>
          </>
        )}

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <CheckCircle2 className="w-3.5 h-3.5 text-status-success" />
          Progress is stored in IndexedDB on this device and works offline.
        </div>
      </div>
    </PageLayout>
  );
}
