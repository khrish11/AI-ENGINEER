import * as React from "react";
import {
  Badge,
  type BadgeProps,
} from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ResourceView } from "@/lib/resources/service";
import { ResourceProgressActions } from "@/components/resources/resource-progress-actions";
import type { ResourceType, VerificationStatus } from "@/lib/resources/types";
import {
  BookOpen,
  Database,
  ExternalLink,
  FileCode2,
  FileText,
  FlaskConical,
  FolderKanban,
  GraduationCap,
  ShieldCheck,
  Star,
  Video,
} from "lucide-react";

const TYPE_META: Record<
  ResourceType,
  { label: string; variant: BadgeProps["variant"]; Icon: React.ComponentType<{ className?: string }> }
> = {
  youtube_video: { label: "Video", variant: "error", Icon: Video },
  youtube_playlist: { label: "Playlist", variant: "error", Icon: Video },
  github_repo: { label: "Repo", variant: "default", Icon: FileCode2 },
  official_documentation: { label: "Docs", variant: "info", Icon: FileText },
  research_paper: { label: "Paper", variant: "secondary", Icon: FlaskConical },
  dataset: { label: "Dataset", variant: "warning", Icon: Database },
  written_tutorial: { label: "Tutorial", variant: "info", Icon: BookOpen },
  interactive_lab: { label: "Lab", variant: "warning", Icon: FlaskConical },
  project_starter: { label: "Starter", variant: "muted", Icon: FolderKanban },
  book: { label: "Book", variant: "muted", Icon: BookOpen },
  course: { label: "Course", variant: "success", Icon: GraduationCap },
};

const VERIFICATION_META: Record<
  VerificationStatus,
  { label: string; variant: BadgeProps["variant"]; note: string }
> = {
  unverified: { label: "Unverified", variant: "muted", note: "Not yet checked" },
  reachable: { label: "Reachable", variant: "success", note: "URL responds successfully" },
  partially_verified: {
    label: "Partial",
    variant: "warning",
    note: "Reachable but bot-protected or dynamic",
  },
  verified: { label: "Verified", variant: "success", note: "Fully verified" },
  unavailable: { label: "Unavailable", variant: "error", note: "URL does not respond" },
  regional: { label: "Regional", variant: "warning", note: "Available in some regions only" },
  unknown: { label: "Unknown", variant: "muted", note: "Status unknown" },
};

export function typeMeta(type: ResourceType) {
  return TYPE_META[type] ?? TYPE_META.official_documentation;
}

export function formatDuration(seconds: number | null | undefined): string | null {
  if (!seconds || seconds <= 0) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function authorLine(resource: ResourceView): string | null {
  if (resource.paper) return resource.paper.authors.join(", ");
  if (resource.youtube?.channelName) return resource.youtube.channelName;
  if (resource.github) return `${resource.github.owner}/${resource.github.repository}`;
  if (resource.organization) return resource.organization;
  return resource.authorName;
}

export function ResourceCard({
  resource,
  lessonId,
}: {
  resource: ResourceView;
  lessonId?: string;
}) {
  const meta = typeMeta(resource.type);
  const verification = VERIFICATION_META[resource.verificationStatus];
  const author = authorLine(resource);
  const recommended = resource.lessons.some((l) => l.recommended);
  const duration =
    formatDuration(resource.youtube?.durationSeconds) ??
    (resource.estimatedDurationMinutes
      ? `${resource.estimatedDurationMinutes} min`
      : null);
  const lessonLinks = resource.lessons.slice(0, 3);

  return (
    <Card variant="interactive" className="flex flex-col justify-between">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5">
            <Badge variant={meta.variant} className="gap-1">
              <meta.Icon className="w-3 h-3" /> {meta.label}
            </Badge>
            {recommended && (
              <Badge variant="warning" className="gap-1">
                <Star className="w-3 h-3" /> Recommended
              </Badge>
            )}
          </div>
          {duration && (
            <span className="text-xs text-muted-foreground font-mono shrink-0">
              {duration}
            </span>
          )}
        </div>
        <CardTitle className="text-base font-bold line-clamp-2">
          {resource.title}
        </CardTitle>
        {author && (
          <CardDescription className="text-xs font-medium text-accent-cyan line-clamp-1">
            {author}
          </CardDescription>
        )}
      </CardHeader>

      <CardContent className="space-y-3">
        {resource.description && (
          <p className="text-sm text-muted-foreground line-clamp-3">
            {resource.description}
          </p>
        )}

        {resource.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {resource.tags.slice(0, 4).map((t) => (
              <span
                key={t}
                className="text-[10px] px-2 py-0.5 rounded bg-muted text-muted-foreground font-mono"
              >
                {t}
              </span>
            ))}
          </div>
        )}

        {lessonLinks.length > 0 && (
          <div className="space-y-1 pt-1">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Used in
            </span>
            <ul className="space-y-0.5">
              {lessonLinks.map((l) => (
                <li key={l.lessonId}>
                  <a
                    href={`/curriculum/${l.lessonSlug}`}
                    className="text-xs text-muted-foreground hover:text-accent-cyan hover:underline line-clamp-1"
                  >
                    {l.lessonTitle}{" "}
                    <span className="text-muted-foreground/60">
                      ({l.role})
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>

      <div className="px-6">
        <ResourceProgressActions resource={resource} lessonId={lessonId} />
      </div>

      <CardFooter className="pt-2 border-t border-border flex items-center justify-between">
        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <ShieldCheck
            className={
              resource.verificationStatus === "unavailable"
                ? "w-3.5 h-3.5 text-status-error"
                : "w-3.5 h-3.5 text-status-success"
            }
          />
          {verification.label}
        </span>
        <a
          href={resource.canonicalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex"
        >
          <Button variant="ghost" size="sm" className="gap-1 text-xs">
            {resource.type === "youtube_video" ? "Watch" : "Open"}
            <ExternalLink className="w-3.5 h-3.5" />
          </Button>
        </a>
      </CardFooter>
    </Card>
  );
}
