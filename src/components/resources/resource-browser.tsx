"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ResourceList } from "@/components/resources/resource-list";
import { typeMeta } from "@/components/resources/resource-card";
import type { ResourceView } from "@/lib/resources/service";
import { RESOURCE_TYPES, type ResourceType } from "@/lib/resources/types";
import { cn } from "@/lib/utils";
import { Search, SlidersHorizontal, X } from "lucide-react";

export interface ResourceBrowserFilters {
  q: string;
  type: string;
  phase: string;
}

export interface PhaseOption {
  value: string;
  label: string;
  count: number;
}

export interface ResourceBrowserProps {
  resources: ResourceView[];
  phases: PhaseOption[];
  initialFilters: ResourceBrowserFilters;
}

const SORT_OPTIONS = [
  { value: "recommended", label: "Recommended first" },
  { value: "title", label: "A–Z" },
] as const;

function matchesQuery(resource: ResourceView, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  const haystack = [
    resource.title,
    resource.description ?? "",
    resource.organization ?? "",
    resource.authorName ?? "",
    resource.sourcePlatform ?? "",
    ...resource.tags,
    resource.github ? `${resource.github.owner}/${resource.github.repository}` : "",
    resource.paper?.title ?? "",
    resource.youtube?.channelName ?? "",
    ...resource.lessons.map((l) => `${l.lessonTitle} ${l.phaseSlug}`),
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

export function ResourceBrowser({
  resources,
  phases,
  initialFilters,
}: ResourceBrowserProps) {
  const router = useRouter();
  const [query, setQuery] = React.useState(initialFilters.q);
  const [type, setType] = React.useState(initialFilters.type || "all");
  const [phase, setPhase] = React.useState(initialFilters.phase || "all");
  const [sort, setSort] = React.useState<(typeof SORT_OPTIONS)[number]["value"]>(
    "recommended"
  );

  const typeCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of resources) counts[r.type] = (counts[r.type] ?? 0) + 1;
    return counts;
  }, [resources]);

  const filtered = React.useMemo(() => {
    const list = resources.filter((r) => {
      if (type !== "all" && r.type !== type) return false;
      if (phase !== "all" && !r.lessons.some((l) => l.phaseSlug === phase))
        return false;
      return matchesQuery(r, query);
    });

    return [...list].sort((a, b) => {
      if (sort === "title") return a.title.localeCompare(b.title);
      const aRec = a.lessons.some((l) => l.recommended) ? 1 : 0;
      const bRec = b.lessons.some((l) => l.recommended) ? 1 : 0;
      if (aRec !== bRec) return bRec - aRec;
      if (b.bestScore !== a.bestScore) return b.bestScore - a.bestScore;
      return a.title.localeCompare(b.title);
    });
  }, [resources, type, phase, query, sort]);

  // Keep the URL in sync so filtered views are shareable/bookmarkable.
  React.useEffect(() => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (type !== "all") params.set("type", type);
    if (phase !== "all") params.set("phase", phase);
    const qs = params.toString();
    router.replace(qs ? `/resources?${qs}` : "/resources", { scroll: false });
  }, [query, type, phase, router]);

  const hasActiveFilters =
    query !== "" || type !== "all" || phase !== "all";

  const clearFilters = () => {
    setQuery("");
    setType("all");
    setPhase("all");
  };

  return (
    <div className="space-y-6">
      {/* Filter toolbar */}
      <div className="rounded-xl border border-border bg-surface/60 p-4 space-y-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search resources, authors, tags, or lessons…"
              className="pl-9"
              aria-label="Search resources"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex gap-3">
            <select
              value={phase}
              onChange={(e) => setPhase(e.target.value)}
              aria-label="Filter by phase"
              className="h-10 rounded-lg border border-border bg-surface px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan"
            >
              <option value="all">All phases</option>
              {phases.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label} ({p.count})
                </option>
              ))}
            </select>

            <select
              value={sort}
              onChange={(e) =>
                setSort(e.target.value as (typeof SORT_OPTIONS)[number]["value"])
              }
              aria-label="Sort resources"
              className="h-10 rounded-lg border border-border bg-surface px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan"
            >
              {SORT_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Type filter pills */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1 text-xs font-semibold text-muted-foreground uppercase">
            <SlidersHorizontal className="w-3.5 h-3.5" /> Type
          </span>
          <button type="button" onClick={() => setType("all")}>
            <Badge
              variant={type === "all" ? "default" : "muted"}
              className={cn("cursor-pointer", type === "all" && "ring-1 ring-accent-cyan/40")}
            >
              All ({resources.length})
            </Badge>
          </button>
          {RESOURCE_TYPES.filter((t) => (typeCounts[t] ?? 0) > 0).map((t) => {
            const meta = typeMeta(t as ResourceType);
            const isActive = type === t;
            return (
              <button key={t} type="button" onClick={() => setType(t)}>
                <Badge
                  variant={isActive ? meta.variant : "muted"}
                  className={cn(
                    "cursor-pointer gap-1",
                    isActive && "ring-1 ring-accent-cyan/40"
                  )}
                >
                  <meta.Icon className="w-3 h-3" />
                  {meta.label} ({typeCounts[t]})
                </Badge>
              </button>
            );
          })}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="gap-1 text-xs ml-auto"
            >
              <X className="w-3.5 h-3.5" /> Clear filters
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing{" "}
          <span className="font-semibold text-foreground">{filtered.length}</span>{" "}
          of {resources.length} resources
        </p>
      </div>

      <ResourceList resources={filtered} />
    </div>
  );
}
