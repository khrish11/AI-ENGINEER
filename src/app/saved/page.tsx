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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageLayout } from "@/components/page-layout";
import { useBookmarks } from "@/hooks/useBookmarks";
import type { Bookmark } from "@/lib/progress/db";
import {
  BookOpen,
  Video,
  FileCode2,
  Library,
  FileText,
  FolderKanban,
  Database,
  ExternalLink,
  Trash2,
  Search,
} from "lucide-react";

type BookmarkType = "all" | "lesson" | "video" | "github" | "docs" | "papers" | "datasets" | "projects";

const FILTERS: Array<{ id: BookmarkType; label: string }> = [
  { id: "all", label: "All" },
  { id: "lesson", label: "Lessons" },
  { id: "video", label: "Videos" },
  { id: "github", label: "GitHub" },
  { id: "docs", label: "Docs" },
  { id: "papers", label: "Papers" },
  { id: "datasets", label: "Datasets" },
  { id: "projects", label: "Projects" },
];

const TYPE_LABELS: Record<string, string> = {
  lesson: "Lesson",
  video: "Video",
  github: "GitHub",
  docs: "Documentation",
  papers: "Paper",
  datasets: "Dataset",
  projects: "Project",
};

const TYPE_ICONS: Record<string, React.ElementType> = {
  lesson: BookOpen,
  video: Video,
  github: FileCode2,
  docs: FileText,
  papers: FileText,
  datasets: Database,
  projects: FolderKanban,
};

function bookmarkHref(bookmark: Bookmark): string | null {
  if (bookmark.href) return bookmark.href;
  if (bookmark.lessonId) return "/curriculum";
  return null;
}

export default function SavedPage() {
  const { bookmarks, loading, remove } = useBookmarks();
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState<BookmarkType>("all");

  const counts = React.useMemo(() => {
    const map: Record<string, number> = { all: bookmarks.length };
    for (const bookmark of bookmarks) {
      map[bookmark.targetType] = (map[bookmark.targetType] ?? 0) + 1;
    }
    return map;
  }, [bookmarks]);

  const filteredBookmarks = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return bookmarks.filter((bookmark) => {
      if (filter !== "all" && bookmark.targetType !== filter) return false;
      if (!q) return true;
      return (
        (bookmark.title ?? "").toLowerCase().includes(q) ||
        (bookmark.href ?? "").toLowerCase().includes(q) ||
        (bookmark.lessonId ?? "").toLowerCase().includes(q) ||
        (bookmark.resourceId ?? "").toLowerCase().includes(q) ||
        (bookmark.projectId ?? "").toLowerCase().includes(q) ||
        (bookmark.note ?? "").toLowerCase().includes(q)
      );
    });
  }, [bookmarks, query, filter]);

  if (loading) {
    return (
      <PageLayout>
        <div className="container mx-auto px-4 py-6 max-w-4xl">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Saved</h1>
          <div className="h-64 flex items-center justify-center">
            <div className="animate-pulse rounded-full bg-muted h-8 w-8" />
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Saved</h1>
            <p className="text-sm text-muted-foreground">
              Your bookmarked lessons, resources, and projects. Stored on this device.
            </p>
          </div>

          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search saved items..."
              className="pl-9"
              aria-label="Search saved items"
            />
          </div>
        </div>

        <div className="flex gap-2 mb-6 overflow-x-auto pb-1" data-testid="saved-filters">
          {FILTERS.map((item) => (
            <Button
              key={item.id}
              onClick={() => setFilter(item.id)}
              variant={filter === item.id ? "default" : "outline"}
              size="sm"
              className="whitespace-nowrap"
            >
              {item.label}
              <span className="ml-1.5 text-[10px] opacity-70">{counts[item.id] ?? 0}</span>
            </Button>
          ))}
        </div>

        {filteredBookmarks.length === 0 ? (
          <Card variant="surface" className="text-center p-12 border-dashed border-2">
            <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
              <Library className="w-8 h-8 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold mb-2">
              {bookmarks.length === 0 ? "No saved items yet" : "No items match this filter"}
            </h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto mb-4">
              Bookmark lessons, videos, GitHub repositories, papers, datasets and documentation
              from across the curriculum to find them here later.
            </p>
            <Link href="/curriculum">
              <Button variant="secondary" size="sm">
                Browse curriculum
              </Button>
            </Link>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredBookmarks.map((bookmark) => {
              const Icon = TYPE_ICONS[bookmark.targetType] ?? BookOpen;
              const href = bookmarkHref(bookmark);
              const external = Boolean(href && /^https?:\/\//.test(href));
              return (
                <Card key={bookmark.id} data-testid="saved-item" className="flex items-start gap-3 p-4">
                  <div className="flex-shrink-0">
                    <Icon className="w-5 h-5 text-accent-cyan mt-0.5" />
                  </div>
                  <CardHeader className="p-0 flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="secondary" className="text-[10px]">
                        {TYPE_LABELS[bookmark.targetType] ?? bookmark.targetType}
                      </Badge>
                      {bookmark.note && (
                        <Badge variant="outline" className="text-[10px]">
                          Lesson-linked
                        </Badge>
                      )}
                    </div>
                    <CardTitle className="text-sm font-medium truncate">
                      {bookmark.title ??
                        bookmark.href ??
                        bookmark.lessonId ??
                        bookmark.resourceId ??
                        `Saved item ${bookmark.id.slice(0, 8)}`}
                    </CardTitle>
                    <CardDescription className="text-xs truncate">
                      {bookmark.href ??
                        bookmark.lessonId ??
                        bookmark.resourceId ??
                        bookmark.projectId ??
                        ""}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-0 flex items-center gap-1 shrink-0">
                    {href && (
                      <a
                        href={href}
                        target={external ? "_blank" : undefined}
                        rel={external ? "noopener noreferrer" : undefined}
                        className="inline-flex"
                      >
                        <Button variant="ghost" size="sm" className="gap-1">
                          Open <ExternalLink className="w-3 h-3" />
                        </Button>
                      </a>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      data-testid="remove-bookmark"
                      onClick={() => void remove(bookmark.id)}
                      className="gap-1 text-status-error"
                      aria-label={`Remove bookmark ${bookmark.title ?? bookmark.id}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Remove
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </PageLayout>
  );
}
