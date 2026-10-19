"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useResourceProgress } from "@/hooks/useResourceProgress";
import { useBookmarks } from "@/hooks/useBookmarks";
import type { ResourceView } from "@/lib/resources/service";

function bookmarkType(resource: ResourceView): "video" | "github" | "docs" | "papers" | "datasets" {
  if (resource.type === "youtube_video" || resource.type === "youtube_playlist") return "video";
  if (resource.type === "github_repo" || resource.type === "project_starter") return "github";
  if (resource.type === "research_paper") return "papers";
  if (resource.type === "dataset") return "datasets";
  return "docs";
}

export function ResourceProgressActions({
  resource,
  lessonId,
}: {
  resource: ResourceView;
  lessonId?: string;
}) {
  const { progress, markStarted, markCompleted, markGithubState } = useResourceProgress(resource.id);
  const { toggleBookmark, bookmarks } = useBookmarks();
  const isVideo = resource.type === "youtube_video" || resource.type === "youtube_playlist";
  const isGithub = resource.type === "github_repo" || resource.type === "project_starter";
  const bookmarked = bookmarks.some((b) => b.resourceId === resource.id);
  const metadata = {
    resourceType: resource.type,
    resourceTitle: resource.title,
    href: resource.canonicalUrl,
  };

  return (
    <div className="flex flex-wrap items-center gap-2 pt-2">
      {progress?.completed && <Badge variant="success">Completed</Badge>}
      {progress?.started && !progress.completed && <Badge variant="default">Started</Badge>}
      {isVideo && (
        <Button
          data-testid="mark-watched"
          size="sm"
          variant="outline"
          onClick={() => void markCompleted(metadata)}
        >
          Mark as watched
        </Button>
      )}
      {isGithub && (
        <>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              void markStarted("opened", metadata);
              window.open(resource.canonicalUrl, "_blank", "noopener,noreferrer");
            }}
          >
            Opened
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void markGithubState("explored", metadata)}
          >
            Explored
          </Button>
          <Button
            data-testid="mark-github-complete"
            size="sm"
            variant="outline"
            onClick={() => void markGithubState("completed_exercise", metadata)}
          >
            Completed exercise
          </Button>
        </>
      )}
      {!isVideo && !isGithub && (
        <Button
          data-testid="mark-resource-complete"
          size="sm"
          variant="outline"
          onClick={() => void markCompleted(metadata)}
        >
          Mark complete
        </Button>
      )}
      <Button
        data-testid="bookmark-resource"
        size="sm"
        variant={bookmarked ? "default" : "ghost"}
        onClick={() =>
          void toggleBookmark({
            lessonId: null,
            resourceId: resource.id,
            projectId: null,
            targetType: bookmarkType(resource),
            title: resource.title,
            href: resource.canonicalUrl,
            note: lessonId ?? null,
          })
        }
      >
        {bookmarked ? "Saved" : "Save"}
      </Button>
    </div>
  );
}
