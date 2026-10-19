"use client";

import * as React from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useProjectProgress } from "@/hooks/useProjectProgress";
import { lessonProgressRepo } from "@/lib/progress/repositories/lesson-progress";
import type { LessonActivityAvailability } from "@/lib/progress/completion";
import { getProjectsForPhase } from "@/lib/projects/catalog";
import { CheckCircle2, Circle, ExternalLink, FolderKanban } from "lucide-react";

export function LessonProjectsPanel({
  lessonId,
  phaseSlug,
  availability,
}: {
  lessonId: string;
  phaseSlug: string;
  availability: LessonActivityAvailability;
}) {
  const projects = React.useMemo(
    () => getProjectsForPhase(phaseSlug).filter((p) => p.status === "active"),
    [phaseSlug]
  );

  if (projects.length === 0) {
    return (
      <Card variant="surface" className="text-center p-10 border-dashed">
        <FolderKanban className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
        <h3 className="text-base font-semibold mb-1">No milestone project for this lesson</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto mb-4">
          This lesson does not map to a milestone project yet. Practical work can still be
          tracked with notes and resources.
        </p>
        <Link href="/projects">
          <Button variant="secondary" size="sm">
            Browse project catalog
          </Button>
        </Link>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {projects.map((project) => (
        <ProjectMilestones
          key={project.id}
          projectId={project.id}
          title={project.title}
          description={project.description}
          tier={project.level}
          estimatedHours={project.estimatedHours}
          milestones={project.milestones}
          lessonId={lessonId}
          availability={availability}
        />
      ))}
    </div>
  );
}

function ProjectMilestones({
  projectId,
  title,
  description,
  tier,
  estimatedHours,
  milestones,
  lessonId,
  availability,
}: {
  projectId: string;
  title: string;
  description: string;
  tier: string;
  estimatedHours: number;
  milestones: Array<{ id: string; title: string }>;
  lessonId: string;
  availability: LessonActivityAvailability;
}) {
  const { progress, upsert, markMilestoneComplete } = useProjectProgress(projectId);
  const [evidenceDrafts, setEvidenceDrafts] = React.useState<Record<string, string>>({});
  const markedLessonComplete = React.useRef(false);

  const completedIds = new Set(
    progress.filter((row) => row.completed).map((row) => row.milestoneId ?? "")
  );
  const allComplete = milestones.every((milestone) => completedIds.has(milestone.id));

  React.useEffect(() => {
    if (!allComplete || markedLessonComplete.current) return;
    markedLessonComplete.current = true;
    void lessonProgressRepo.markProjectComplete(lessonId, availability);
  }, [allComplete, lessonId, availability]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base font-semibold">{title}</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{tier}</Badge>
            <Badge variant="muted">~{estimatedHours} hrs</Badge>
            {allComplete && <Badge variant="success">Complete</Badge>}
          </div>
        </div>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {milestones.map((milestone) => {
          const done = completedIds.has(milestone.id);
          return (
            <div
              key={milestone.id}
              className="rounded-lg border border-border bg-surface p-3 space-y-2"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-sm font-medium">
                  {done ? (
                    <CheckCircle2 className="w-4 h-4 text-status-success" />
                  ) : (
                    <Circle className="w-4 h-4 text-muted-foreground" />
                  )}
                  {milestone.title}
                </span>
                {!done && (
                  <Button
                    size="sm"
                    variant="outline"
                    data-testid={`project-milestone-${milestone.id}`}
                    onClick={() =>
                      void markMilestoneComplete(
                        milestone.id,
                        evidenceDrafts[milestone.id] || null
                      )
                    }
                  >
                    Mark complete
                  </Button>
                )}
              </div>
              {!done && (
                <Input
                  value={evidenceDrafts[milestone.id] ?? ""}
                  onChange={(event) =>
                    setEvidenceDrafts((prev) => ({
                      ...prev,
                      [milestone.id]: event.target.value,
                    }))
                  }
                  placeholder="Evidence URL (optional)"
                  className="h-8 text-xs"
                  aria-label={`Evidence URL for ${milestone.title}`}
                />
              )}
              {done && progress.find((row) => row.milestoneId === milestone.id)?.evidenceUrl && (
                <a
                  href={
                    progress.find((row) => row.milestoneId === milestone.id)?.evidenceUrl ??
                    "#"
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-accent-cyan hover:underline"
                >
                  Evidence <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          );
        })}
        <Button
          size="sm"
          variant="ghost"
          onClick={() =>
            void upsert({ milestoneId: null, completed: false, notes: "Started" })
          }
        >
          Mark project started
        </Button>
      </CardContent>
    </Card>
  );
}
