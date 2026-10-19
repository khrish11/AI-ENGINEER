"use client";

import * as React from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BookOpen,
  Clock,
  Search,
  CheckCircle,
  ArrowRight,
  ShieldCheck,
  GitCommit,
} from "lucide-react";
import { useAllLessonProgress } from "@/hooks/useProgressOverview";

export interface PhaseDisplayData {
  number: number;
  slug: string;
  title: string;
  tier: "Foundations" | "Intermediate" | "Advanced" | "Mastery";
  description: string;
  lessonCount: number;
  estimatedHours: number;
  topics: string[];
  status: "Completed" | "In Progress" | "Not Started";
}

interface CurriculumExplorerClientProps {
  initialPhases: PhaseDisplayData[];
  stats: {
    phaseCount: number;
    lessonCount: number;
    quizCount: number;
    commitSha?: string | null;
  };
}

export function CurriculumExplorerClient({
  initialPhases,
  stats,
}: CurriculumExplorerClientProps) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedTier, setSelectedTier] = React.useState<string>("all");
  const isLoading = false;
  const { progress } = useAllLessonProgress();

  const phaseCounts = React.useMemo(() => {
    const map = new Map<string, { started: number; completed: number }>();
    for (const row of progress) {
      if (!row.phaseSlug) continue;
      const entry = map.get(row.phaseSlug) ?? { started: 0, completed: 0 };
      if (row.status !== "not_started") entry.started += 1;
      if (row.status === "completed" || row.status === "mastered") entry.completed += 1;
      map.set(row.phaseSlug, entry);
    }
    return map;
  }, [progress]);

  const filteredPhases = React.useMemo(() => {
    return initialPhases.filter((phase) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        q === "" ||
        phase.title.toLowerCase().includes(q) ||
        phase.description.toLowerCase().includes(q) ||
        String(phase.number).includes(q) ||
        phase.topics.some((t) => t.toLowerCase().includes(q));

      const matchesTier =
        selectedTier === "all" || phase.tier.toLowerCase() === selectedTier.toLowerCase();

      return matchesSearch && matchesTier;
    });
  }, [initialPhases, searchQuery, selectedTier]);

  return (
    <div className="space-y-8">
      {/* Page Title & Hero */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-border">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
              Curriculum Explorer
            </h1>
            <Badge variant="default" className="font-mono">
              {stats.phaseCount} Phases
            </Badge>
            <Badge variant="secondary" className="font-mono">
              {stats.lessonCount > 0 ? `${stats.lessonCount} Lessons` : "500+ Lessons"}
            </Badge>
            {stats.quizCount > 0 && (
              <Badge variant="outline" className="font-mono text-accent-cyan border-accent-cyan/30">
                {stats.quizCount} Quizzes
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
            An authoritative, progressive AI Engineering learning track designed to transition
            software engineers to senior AI engineering specialists. Sourced directly from upstream open-source curriculum.
          </p>
        </div>

        {stats.commitSha && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-lg border border-border/60">
            <GitCommit className="w-3.5 h-3.5 text-accent-cyan" />
            <span>Synced:</span>
            <code className="font-mono text-[11px] text-foreground font-semibold">
              {stats.commitSha.slice(0, 7)}
            </code>
          </div>
        )}
      </div>

      {/* Upstream Attribution Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 px-4 rounded-xl bg-card border border-border/80 text-xs text-muted-foreground shadow-xs">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-status-success shrink-0" />
          <span>
            Curriculum sourced dynamically from{" "}
            <a
              href="https://github.com/rohitg00/ai-engineering-from-scratch"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-foreground hover:text-accent-cyan underline"
            >
              rohitg00/ai-engineering-from-scratch
            </a>{" "}
            under MIT License. Preserved canonical identities and content fingerprints.
          </span>
        </div>
      </div>

      {/* Filter Controls Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter by title, topic (e.g. PyTorch, RAG, LoRA, CUDA, Docker)..."
            className="pl-9 h-10 text-xs sm:text-sm"
            aria-label="Filter phases"
          />
        </div>

        {/* Tier buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {["all", "foundations", "intermediate", "advanced", "mastery"].map((tier) => (
            <Button
              key={tier}
              variant={selectedTier === tier ? "default" : "secondary"}
              size="sm"
              onClick={() => setSelectedTier(tier)}
              className="capitalize text-xs whitespace-nowrap h-9"
            >
              {tier}
            </Button>
          ))}
        </div>
      </div>

      {/* Phases Grid or Skeleton */}
      {isLoading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6" aria-busy="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-xl" />
          ))}
        </div>
      ) : filteredPhases.length === 0 ? (
        <Card variant="surface" className="text-center p-12 border-dashed">
          <div className="w-12 h-12 rounded-full bg-muted text-muted-foreground flex items-center justify-center mx-auto mb-3">
            <Search className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-semibold mb-1">No matching phases found</h3>
          <p className="text-sm text-muted-foreground mb-4">
            No curriculum phases match &ldquo;{searchQuery}&rdquo;. Try clearing filters.
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setSearchQuery("");
              setSelectedTier("all");
            }}
          >
            Reset Filters
          </Button>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPhases.map((phase) => {
            const counts = phaseCounts.get(phase.slug) ?? { started: 0, completed: 0 };
            const isCompleted = phase.lessonCount > 0 && counts.completed >= phase.lessonCount;
            const isInProgress = !isCompleted && counts.started > 0;

            return (
              <Card
                key={phase.number}
                variant="interactive"
                className={`flex flex-col justify-between group transition-all duration-200 border-border hover:border-accent-cyan/60 ${
                  isInProgress ? "border-accent-cyan/50 bg-accent-cyan/[0.02]" : ""
                }`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs font-bold text-accent-cyan">
                        Phase {String(phase.number).padStart(2, "0")}
                      </span>
                      <Badge
                        variant={
                          phase.tier === "Foundations"
                            ? "default"
                            : phase.tier === "Intermediate"
                            ? "secondary"
                            : phase.tier === "Advanced"
                            ? "warning"
                            : "error"
                        }
                        className="text-[10px]"
                      >
                        {phase.tier}
                      </Badge>
                    </div>

                    {isCompleted ? (
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-status-success">
                        <CheckCircle className="w-3.5 h-3.5" /> Done
                      </span>
                    ) : isInProgress ? (
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-accent-cyan animate-pulse">
                        In Progress
                      </span>
                    ) : null}
                  </div>

                  <CardTitle className="text-lg font-bold group-hover:text-accent-cyan transition-colors leading-snug">
                    {phase.title}
                  </CardTitle>
                  <CardDescription className="line-clamp-2 mt-1.5 text-xs text-muted-foreground leading-relaxed">
                    {phase.description}
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Topics badges */}
                  <div className="flex flex-wrap gap-1.5">
                    {phase.topics.map((topic) => (
                      <span
                        key={topic}
                        className="text-[10px] px-2 py-0.5 rounded-md bg-muted text-muted-foreground font-mono"
                      >
                        {topic}
                      </span>
                    ))}
                  </div>

                  {/* Stats */}
                  <div className="space-y-1.5 pt-2 border-t border-border/50">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <BookOpen className="w-3.5 h-3.5 text-accent-cyan" />
                        <strong className="text-foreground">
                          {counts.completed} / {phase.lessonCount}
                        </strong>
                        lessons completed
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-accent-cyan" />
                        ~{phase.estimatedHours} hrs
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-accent-cyan transition-all"
                        style={{
                          width: `${Math.min(
                            100,
                            phase.lessonCount > 0
                              ? Math.round((counts.completed / phase.lessonCount) * 100)
                              : 0
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                </CardContent>

                <CardFooter className="pt-2 border-t border-border">
                  <Link href={`/curriculum/${phase.slug}`} className="w-full">
                    <Button
                      variant={isInProgress ? "default" : "secondary"}
                      size="sm"
                      className="w-full justify-between group/btn text-xs font-semibold"
                    >
                      <span>{isInProgress ? "Resume Phase" : "Explore Phase"}</span>
                      <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover/btn:translate-x-1" />
                    </Button>
                  </Link>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
