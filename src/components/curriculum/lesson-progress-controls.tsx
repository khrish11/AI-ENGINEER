"use client";

import * as React from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLessonProgress } from "@/hooks/useLessonProgress";
import { useBookmarks } from "@/hooks/useBookmarks";
import { useStudySession } from "@/hooks/useStudySession";
import { lessonStatusLabel, type LessonActivityAvailability } from "@/lib/progress/completion";
import {
  BookOpen,
  Bookmark,
  BookmarkCheck,
  CheckCircle2,
  Circle,
  FolderKanban,
  HelpCircle,
  Library,
  Star,
} from "lucide-react";

export function LessonProgressControls({
  lessonId,
  title,
  phaseSlug,
  phaseNumber,
  href,
  availability,
}: {
  lessonId: string;
  title: string;
  phaseSlug: string;
  phaseNumber: number;
  href: string;
  availability: LessonActivityAvailability;
}) {
  const metadata = React.useMemo(
    () => ({ lessonTitle: title, lessonHref: href, phaseSlug, phaseNumber }),
    [title, href, phaseSlug, phaseNumber]
  );
  const { progress, evaluation, markReadingComplete, upsert } = useLessonProgress(
    lessonId,
    availability,
    metadata
  );
  const { bookmarks, toggleBookmark } = useBookmarks();
  useStudySession({ lessonId });
  const bookmarked = bookmarks.some((b) => b.lessonId === lessonId);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-border">
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          data-testid="lesson-status"
          variant={
            progress?.status === "completed" || progress?.status === "mastered"
              ? "success"
              : progress?.status === "in_progress"
                ? "default"
                : "secondary"
          }
        >
          {lessonStatusLabel(progress?.status ?? "not_started")}
        </Badge>
        {progress?.needsReview && <Badge variant="warning">Needs review</Badge>}
        <Button
          data-testid="mark-reading-complete"
          onClick={() => void markReadingComplete()}
          variant={progress?.readingComplete ? "secondary" : "outline"}
          size="sm"
          className="gap-1"
        >
          <BookOpen className="w-3 h-3" />
          {progress?.readingComplete ? "Reading complete" : "Mark reading complete"}
        </Button>
        {evaluation?.canMarkComplete && progress?.status !== "completed" && progress?.status !== "mastered" && (
          <Button
            data-testid="mark-lesson-complete"
            size="sm"
            onClick={() => void upsert({ status: "completed" })}
          >
            <CheckCircle2 className="w-3 h-3" /> Mark complete
          </Button>
        )}
        {availability.hasResources && !progress?.requiredResourcesComplete && (
          <Button
            data-testid="mark-resources-complete"
            size="sm"
            variant="outline"
            className="gap-1"
            onClick={() => void upsert({ requiredResourcesComplete: true })}
          >
            <Library className="w-3 h-3" /> Resources complete
          </Button>
        )}
        {availability.hasQuiz && !progress?.practiceComplete && (
          <Button
            data-testid="mark-practice-complete"
            size="sm"
            variant="outline"
            className="gap-1"
            onClick={() => void upsert({ practiceComplete: true })}
          >
            <HelpCircle className="w-3 h-3" /> Practice complete
          </Button>
        )}
        {availability.hasProject && !progress?.projectComplete && (
          <Button
            data-testid="mark-project-complete"
            size="sm"
            variant="outline"
            className="gap-1"
            onClick={() => void upsert({ projectComplete: true })}
          >
            <FolderKanban className="w-3 h-3" /> Project complete
          </Button>
        )}
        <Button
          data-testid="toggle-needs-review"
          size="sm"
          variant="ghost"
          className="gap-1"
          onClick={() => void upsert({ needsReview: !progress?.needsReview })}
        >
          {progress?.needsReview ? (
            <Star className="w-3 h-3 text-amber-400" />
          ) : (
            <Circle className="w-3 h-3" />
          )}
          {progress?.needsReview ? "In review queue" : "Review later"}
        </Button>
        <Button
          data-testid="bookmark-lesson"
          onClick={() =>
            void toggleBookmark({
              lessonId,
              resourceId: null,
              projectId: null,
              targetType: "lesson",
              title,
              href,
              note: null,
            })
          }
          variant={bookmarked ? "default" : "outline"}
          size="sm"
          className="gap-1"
        >
          {bookmarked ? <BookmarkCheck className="w-3 h-3" /> : <Bookmark className="w-3 h-3" />}
          {bookmarked ? "Bookmarked" : "Bookmark"}
        </Button>
      </div>
      <Link href={`/curriculum/${phaseSlug}`}>
        <Button variant="ghost" size="sm">
          Back to phase
        </Button>
      </Link>
    </div>
  );
}

export function LessonOverviewProgress({
  lessonId,
  availability,
}: {
  lessonId: string;
  availability: LessonActivityAvailability;
}) {
  const { progress, evaluation } = useLessonProgress(lessonId, availability);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Progress & mastery</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p data-testid="overview-status">
          Status: {lessonStatusLabel(progress?.status ?? "not_started")}
        </p>
        <p>Progress: {evaluation?.progressPercent ?? 0}%</p>
        <ul className="list-disc pl-5 text-muted-foreground">
          <li>Reading {progress?.readingComplete ? "complete" : "required"}</li>
          {availability.hasResources && (
            <li>Resources {progress?.requiredResourcesComplete ? "complete" : "required"}</li>
          )}
          {availability.hasQuiz && (
            <li>Practice {progress?.practiceComplete ? "complete" : "required"}</li>
          )}
          {availability.hasProject && (
            <li>Project {progress?.projectComplete ? "complete" : "required"}</li>
          )}
        </ul>
        {evaluation?.canMarkMastered && <Badge variant="success">Ready for mastery</Badge>}
      </CardContent>
    </Card>
  );
}
