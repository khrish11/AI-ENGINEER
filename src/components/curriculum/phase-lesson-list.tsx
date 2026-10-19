"use client";

import * as React from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Search,
  BookOpen,
  Clock,
  Code2,
  HelpCircle,
  FileCode2,
  ArrowRight,
  Filter,
} from "lucide-react";
import type { LessonSummary } from "@/lib/curriculum/service";
import { useAllLessonProgress } from "@/hooks/useProgressOverview";
import { lessonStatusLabel } from "@/lib/progress/completion";
import { PhaseProgressSummary } from "@/components/curriculum/phase-progress-summary";

interface PhaseLessonListProps {
  phaseSlug: string;
  lessons: LessonSummary[];
}

const STATUS_FILTERS = [
  { id: "all", label: "All" },
  { id: "not_started", label: "Not Started" },
  { id: "in_progress", label: "In Progress" },
  { id: "completed", label: "Completed" },
  { id: "mastered", label: "Mastered" },
  { id: "needs_review", label: "Needs Review" },
] as const;

export function PhaseLessonList({ phaseSlug, lessons }: PhaseLessonListProps) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedDifficulty, setSelectedDifficulty] = React.useState<string>("all");
  const [selectedFilter, setSelectedFilter] = React.useState<string>("all");
  const [selectedStatus, setSelectedStatus] = React.useState<string>("all");
  const { byLessonId } = useAllLessonProgress();

  const filteredLessons = React.useMemo(() => {
    return lessons.filter((lesson) => {
      // Search filter
      const matchesSearch =
        searchQuery === "" ||
        lesson.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (lesson.tagline && lesson.tagline.toLowerCase().includes(searchQuery.toLowerCase())) ||
        lesson.lessonSlug.toLowerCase().includes(searchQuery.toLowerCase());

      // Difficulty filter
      const matchesDifficulty =
        selectedDifficulty === "all" ||
        lesson.difficulty.toLowerCase() === selectedDifficulty.toLowerCase();

      // Feature filter
      const matchesFeature =
        selectedFilter === "all" ||
        (selectedFilter === "code" && lesson.hasCode) ||
        (selectedFilter === "quiz" && lesson.hasQuiz) ||
        (selectedFilter === "notebook" && lesson.hasNotebook);

      const row = byLessonId.get(lesson.id);
      const status = row?.status ?? "not_started";
      const failsStatusFilter =
        selectedStatus === "all"
          ? false
          : selectedStatus === "needs_review"
            ? !row?.needsReview
            : selectedStatus === "completed"
              ? status !== "completed" && status !== "mastered"
              : status !== selectedStatus;

      return matchesSearch && matchesDifficulty && matchesFeature && !failsStatusFilter;
    });
  }, [lessons, searchQuery, selectedDifficulty, selectedFilter, selectedStatus, byLessonId]);

  return (
    <div className="space-y-6">
      <PhaseProgressSummary lessonIds={lessons.map((lesson) => lesson.id)} />

      {/* Search & Filters Toolbar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-4 rounded-xl border border-border bg-card/60 backdrop-blur-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search ${lessons.length} lessons in this phase...`}
            className="pl-9 h-9 text-xs"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Difficulty Filter */}
          <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg text-xs">
            <span className="text-[11px] font-medium text-muted-foreground px-2">Level:</span>
            {["all", "beginner", "intermediate", "advanced"].map((diff) => (
              <button
                key={diff}
                onClick={() => setSelectedDifficulty(diff)}
                className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors capitalize ${
                  selectedDifficulty === diff
                    ? "bg-background text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {diff}
              </button>
            ))}
          </div>

          {/* Feature Filter */}
          <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg text-xs">
            <Filter className="w-3 h-3 text-muted-foreground ml-1.5" />
            {["all", "code", "quiz", "notebook"].map((f) => (
              <button
                key={f}
                onClick={() => setSelectedFilter(f)}
                className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors capitalize ${
                  selectedFilter === f
                    ? "bg-background text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Progress status filters */}
      <div className="flex flex-wrap items-center gap-1.5" data-testid="lesson-status-filters">
        {STATUS_FILTERS.map((filter) => (
          <button
            key={filter.id}
            onClick={() => setSelectedStatus(filter.id)}
            className={`px-2.5 py-1 rounded-full border text-[11px] font-medium transition-colors ${
              selectedStatus === filter.id
                ? "border-accent-cyan bg-accent-cyan/10 text-accent-cyan"
                : "border-border bg-surface text-muted-foreground hover:text-foreground"
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {/* Results Header */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Showing <strong className="text-foreground">{filteredLessons.length}</strong> of {lessons.length} lessons
        </span>
        {(searchQuery ||
          selectedDifficulty !== "all" ||
          selectedFilter !== "all" ||
          selectedStatus !== "all") && (
          <button
            onClick={() => {
              setSearchQuery("");
              setSelectedDifficulty("all");
              setSelectedFilter("all");
              setSelectedStatus("all");
            }}
            className="text-accent-cyan hover:underline"
          >
            Reset filters
          </button>
        )}
      </div>

      {/* Lesson List Cards */}
      {filteredLessons.length === 0 ? (
        <Card className="text-center py-12 border-dashed">
          <CardContent className="space-y-3">
            <BookOpen className="w-8 h-8 text-muted-foreground mx-auto opacity-50" />
            <p className="text-sm font-semibold text-foreground">No lessons found</p>
            <p className="text-xs text-muted-foreground">
              Try adjusting your search terms or filters.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filteredLessons.map((lesson, idx) => {
            const displayIndex = String(idx + 1).padStart(2, "0");
            const lessonUrl = `/curriculum/${phaseSlug}/${lesson.lessonSlug}`;

            return (
              <Card
                key={lesson.id}
                className="group border-border hover:border-accent-cyan/50 transition-all duration-200 hover:shadow-md bg-card/80"
              >
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between p-4 sm:p-5 gap-4">
                  {/* Left: Index + Title + Details */}
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    <span className="shrink-0 text-sm font-mono font-bold text-muted-foreground/60 group-hover:text-accent-cyan transition-colors pt-0.5">
                      {displayIndex}
                    </span>

                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={lessonUrl}
                          className="font-semibold text-sm sm:text-base text-foreground group-hover:text-accent-cyan transition-colors truncate"
                        >
                          {lesson.title}
                        </Link>
                        <Badge
                          variant={
                            lesson.difficulty === "Beginner"
                              ? "success"
                              : lesson.difficulty === "Intermediate"
                              ? "secondary"
                              : "warning"
                          }
                          className="text-[10px] h-5"
                        >
                          {lesson.difficulty}
                        </Badge>
                        <Badge
                          data-testid={`lesson-status-${lesson.lessonSlug}`}
                          variant={
                            (byLessonId.get(lesson.id)?.status ?? "not_started") === "mastered"
                              ? "info"
                              : (byLessonId.get(lesson.id)?.status ?? "not_started") === "completed"
                                ? "success"
                                : (byLessonId.get(lesson.id)?.status ?? "not_started") ===
                                    "in_progress"
                                  ? "default"
                                  : "muted"
                          }
                          className="text-[10px] h-5"
                        >
                          {lessonStatusLabel(byLessonId.get(lesson.id)?.status ?? "not_started")}
                        </Badge>
                        {byLessonId.get(lesson.id)?.needsReview && (
                          <Badge variant="warning" className="text-[10px] h-5">
                            Needs review
                          </Badge>
                        )}
                      </div>

                      {lesson.tagline && (
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {lesson.tagline}
                        </p>
                      )}

                      {/* Meta badges: time, code, quiz, languages */}
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground pt-1">
                        <span className="flex items-center gap-1 font-mono">
                          <Clock className="w-3 h-3 text-muted-foreground" />
                          {lesson.estimatedMinutes}m
                        </span>

                        {lesson.hasCode && (
                          <span className="flex items-center gap-1 text-accent-cyan">
                            <Code2 className="w-3 h-3" />
                            Code Sandbox
                          </span>
                        )}

                        {lesson.hasQuiz && (
                          <span className="flex items-center gap-1 text-status-success">
                            <HelpCircle className="w-3 h-3" />
                            Interactive Quiz
                          </span>
                        )}

                        {lesson.hasNotebook && (
                          <span className="flex items-center gap-1 text-accent-purple">
                            <FileCode2 className="w-3 h-3" />
                            Notebook
                          </span>
                        )}

                        {lesson.languages.length > 0 && (
                          <div className="flex items-center gap-1">
                            {lesson.languages.slice(0, 3).map((lang) => (
                              <span
                                key={lang}
                                className="px-1.5 py-0.2 rounded bg-muted text-[10px] font-mono text-muted-foreground"
                              >
                                {lang}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Action button */}
                  <div className="shrink-0 flex items-center justify-end sm:border-l sm:border-border/60 sm:pl-4">
                    <Link href={lessonUrl}>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="group/btn text-xs font-medium gap-1.5 hover:bg-accent-cyan hover:text-white dark:hover:text-black transition-colors"
                      >
                        <span>Open Lesson</span>
                        <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover/btn:translate-x-0.5" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
