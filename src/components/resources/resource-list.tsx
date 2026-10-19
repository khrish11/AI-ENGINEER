import * as React from "react";
import { ResourceCard } from "@/components/resources/resource-card";
import type { ResourceView } from "@/lib/resources/service";
import { cn } from "@/lib/utils";

export interface ResourceListProps {
  resources: ResourceView[];
  emptyTitle?: string;
  emptyMessage?: string;
  emptyIcon?: React.ComponentType<{ className?: string }>;
  className?: string;
  columns?: 2 | 3;
  /** When set, progress actions are scoped to this lesson. */
  lessonId?: string;
}

export function ResourceList({
  resources,
  emptyTitle = "No resources found",
  emptyMessage = "Try adjusting your search or filters.",
  emptyIcon: EmptyIcon,
  className,
  columns = 3,
  lessonId,
}: ResourceListProps) {
  if (resources.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-surface/40 p-10 text-center">
        {EmptyIcon && (
          <EmptyIcon className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
        )}
        <h3 className="text-base font-semibold mb-1">{emptyTitle}</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          {emptyMessage}
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "grid gap-4",
        columns === 2 ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3",
        className
      )}
    >
      {resources.map((resource) => (
        <ResourceCard key={resource.id} resource={resource} lessonId={lessonId} />
      ))}
    </div>
  );
}
