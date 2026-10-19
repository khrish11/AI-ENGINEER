import * as React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageLayout } from "@/components/page-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PhaseLessonList } from "@/components/curriculum/phase-lesson-list";
import { PhaseProgressSummary } from "@/components/curriculum/phase-progress-summary";
import { getPhaseDetails } from "@/lib/curriculum/service";
import {
  BookOpen,
  Clock,
  ChevronLeft,
  ShieldCheck,
  ArrowRight,
  Layers,
} from "lucide-react";

interface PhasePageProps {
  params: Promise<{
    phaseSlug: string;
  }>;
}

export async function generateMetadata({ params }: PhasePageProps) {
  const { phaseSlug } = await params;
  const phaseInfo = await getPhaseDetails(phaseSlug);
  if (!phaseInfo) {
    return { title: "Phase Not Found | AI Engineer OS" };
  }
  return {
    title: `Phase ${phaseInfo.phase.phaseNumber}: ${phaseInfo.phase.title} | AI Engineer OS`,
    description: `Master ${phaseInfo.phase.title} with ${phaseInfo.phase.lessonCount} comprehensive lessons, code sandboxes, and interactive quizzes.`,
  };
}

export default async function PhasePage({ params }: PhasePageProps) {
  const { phaseSlug } = await params;
  const phaseInfo = await getPhaseDetails(phaseSlug);

  if (!phaseInfo) {
    notFound();
  }

  const { phase, lessons } = phaseInfo;

  // Calculate total estimated minutes
  const totalMinutes = lessons.reduce(
    (sum, l) => sum + (l.estimatedMinutes || 45),
    0
  );
  const totalHours = Math.max(1, Math.round(totalMinutes / 60));

  // Determine tier based on phase number
  const tier =
    phase.phaseNumber <= 5
      ? "Foundations"
      : phase.phaseNumber <= 11
      ? "Intermediate"
      : phase.phaseNumber <= 16
      ? "Advanced"
      : "Mastery";

  const firstLesson = lessons[0];

  return (
    <PageLayout>
      <div className="container mx-auto px-4 md:px-6 py-6 space-y-8 max-w-6xl">
        {/* Breadcrumb Navigation */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Link
            href="/curriculum"
            className="flex items-center gap-1 hover:text-accent-cyan transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Curriculum Explorer
          </Link>
          <span>/</span>
          <span className="text-foreground font-mono font-medium">
            Phase {String(phase.phaseNumber).padStart(2, "0")}
          </span>
        </div>

        {/* Phase Header Banner */}
        <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-card via-card/90 to-accent-cyan/5 p-6 sm:p-8 backdrop-blur-sm">
          <div className="absolute top-0 right-0 -mt-12 -mr-12 w-96 h-96 bg-accent-cyan/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-md bg-accent-cyan/10 text-accent-cyan border border-accent-cyan/20">
                Phase {String(phase.phaseNumber).padStart(2, "0")}
              </span>

              <Badge
                variant={
                  tier === "Foundations"
                    ? "default"
                    : tier === "Intermediate"
                    ? "secondary"
                    : tier === "Advanced"
                    ? "warning"
                    : "error"
                }
                className="text-xs font-semibold"
              >
                {tier} Tier
              </Badge>

            </div>

            <div className="space-y-2 max-w-3xl">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-foreground">
                {phase.title}
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                Step-by-step master sequence covering practical implementation, theory, code sandboxes, and verification quizzes.
              </p>
            </div>

            <PhaseProgressSummary lessonIds={lessons.map((lesson) => lesson.id)} />

            {/* Quick Metrics & Start Action */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-border/60">
              <div className="flex flex-wrap items-center gap-6 text-xs sm:text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5 font-medium">
                  <BookOpen className="w-4 h-4 text-accent-cyan" />
                  <strong className="text-foreground">{phase.lessonCount}</strong> Lessons
                </span>
                <span className="flex items-center gap-1.5 font-medium">
                  <Clock className="w-4 h-4 text-accent-cyan" />
                  ~<strong className="text-foreground">{totalHours}</strong> Hours Total
                </span>
                <span className="flex items-center gap-1.5 font-medium">
                  <Layers className="w-4 h-4 text-accent-cyan" />
                  Canonical ID: <code className="text-[11px] font-mono text-muted-foreground">{phase.permanentKey}</code>
                </span>
              </div>

              {firstLesson && (
                <Link href={`/curriculum/${phaseSlug}/${firstLesson.lessonSlug}`}>
                  <Button
                    size="sm"
                    className="w-full sm:w-auto font-semibold gap-2 shadow-sm"
                  >
                    <span>Start Lesson 01</span>
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Upstream Attribution & Open Source License */}
        <div className="flex items-center justify-between p-3 px-4 rounded-lg bg-muted/40 border border-border/60 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-status-success shrink-0" />
            <span>
              Curriculum sourced from{" "}
              <a
                href="https://github.com/rohitg00/ai-engineering-from-scratch"
                target="_blank"
                rel="noreferrer"
                className="font-medium text-foreground hover:text-accent-cyan underline"
              >
                rohitg00/ai-engineering-from-scratch
              </a>{" "}
              under MIT License. Original author: Rohit Ghumare.
            </span>
          </div>
        </div>

        {/* Lessons List Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-foreground">Curriculum Sequence</h2>
              <p className="text-xs text-muted-foreground">
                Complete lessons in order to build compounding engineering mastery.
              </p>
            </div>
          </div>

          <PhaseLessonList phaseSlug={phaseSlug} lessons={lessons} />
        </div>
      </div>
    </PageLayout>
  );
}
