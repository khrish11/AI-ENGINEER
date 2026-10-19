"use client";

import * as React from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageLayout } from "@/components/page-layout";
import { useAllProjectProgress } from "@/hooks/useProjectProgress";
import { useAllProjectEvidence } from "@/hooks/useProjectEvidence";
import { filterProjects, projectCatalog } from "@/lib/projects/catalog";
import type { ProjectDefinition, ProjectLevel } from "@/lib/projects/schema";
import { auditPrerequisites } from "@/lib/projects/completion";
import { ArrowRight, Clock, FolderKanban, Search } from "lucide-react";

const LEVELS: ProjectLevel[] = ["beginner", "intermediate", "advanced", "capstone"];

export default function ProjectsPage() {
  const [search, setSearch] = React.useState("");
  const [levels, setLevels] = React.useState<ProjectLevel[]>([]);
  const [phaseSlug, setPhaseSlug] = React.useState<string>("all");
  const [skill, setSkill] = React.useState<string>("all");
  const [track, setTrack] = React.useState<string>("all");

  const progressByProject = useProjectCompletionSummary();
  const completedProjectIds = React.useMemo(
    () =>
      new Set(
        projectCatalog
          .filter((p) => (progressByProject.get(p.id) ?? "not_started") === "completed" || (progressByProject.get(p.id) ?? "") === "mastered")
          .map((p) => p.id)
      ),
    [progressByProject]
  );

  const phaseOptions = React.useMemo(() => {
    const slugs = new Set<string>();
    for (const project of projectCatalog) for (const p of project.phaseSlugs) slugs.add(p);
    return [...slugs].sort();
  }, []);

  const skillOptions = React.useMemo(() => {
    const skills = new Set<string>();
    for (const project of projectCatalog) for (const s of project.skills) skills.add(s);
    return [...skills].sort();
  }, []);

  const trackOptions = React.useMemo(() => {
    const tracks = new Set<string>();
    for (const project of projectCatalog) for (const t of project.relevantTracks) tracks.add(t);
    return [...tracks].sort();
  }, []);

  const filtered = React.useMemo(
    () =>
      filterProjects({
        level: levels.length ? levels : undefined,
        phaseSlugs: phaseSlug === "all" ? undefined : [phaseSlug],
        skillIds: skill === "all" ? undefined : [skill],
        trackIds: track === "all" ? undefined : [track],
        status: "active" as const,
        search,
      }),
    [levels, phaseSlug, skill, track, search]
  );

  return (
    <PageLayout>
      <div className="container mx-auto px-4 md:px-6 py-6 md:py-8 space-y-8 max-w-7xl">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-border">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-3xl font-bold tracking-tight text-foreground">Project Studio</h1>
              <Badge variant="default">Proof-of-Work</Badge>
            </div>
            <p className="text-sm text-muted-foreground max-w-2xl">
              Structured engineering projects with milestones, deliverables, evidence, and
              self-assessed rubrics. Completion requires real milestone work and attached
              evidence — opening a page is never enough.
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="text-xs text-muted-foreground space-y-1">
            <span>Search</span>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Vector RAG, attention, MCP…"
              aria-label="Search projects"
            />
          </label>
          <label className="text-xs text-muted-foreground space-y-1">
            <span>Phase</span>
            <select
              className="h-9 w-full rounded-lg border border-border bg-surface px-2 text-sm text-foreground"
              value={phaseSlug}
              onChange={(e) => setPhaseSlug(e.target.value)}
              aria-label="Filter by phase"
            >
              <option value="all">All phases</option>
              {phaseOptions.map((slug) => (
                <option key={slug} value={slug}>{slug}</option>
              ))}
            </select>
          </label>
          <label className="text-xs text-muted-foreground space-y-1">
            <span>Skill</span>
            <select
              className="h-9 w-full rounded-lg border border-border bg-surface px-2 text-sm text-foreground"
              value={skill}
              onChange={(e) => setSkill(e.target.value)}
              aria-label="Filter by skill"
            >
              <option value="all">All skills</option>
              {skillOptions.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="text-xs text-muted-foreground space-y-1">
            <span>Track</span>
            <select
              className="h-9 w-full rounded-lg border border-border bg-surface px-2 text-sm text-foreground"
              value={track}
              onChange={(e) => setTrack(e.target.value)}
              aria-label="Filter by career track"
            >
              <option value="all">All tracks</option>
              {trackOptions.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </label>
          <fieldset className="text-xs text-muted-foreground">
            <legend className="mb-1">Level</legend>
            <div className="flex flex-wrap gap-1">
              {LEVELS.map((level) => (
                <button
                  key={level}
                  type="button"
                  aria-pressed={levels.includes(level)}
                  className={`rounded-md border px-2 py-1 capitalize ${
                    levels.includes(level)
                      ? "border-accent-cyan bg-accent-cyan/10 text-accent-cyan"
                      : "border-border bg-surface"
                  }`}
                  onClick={() =>
                    setLevels((current) =>
                      current.includes(level)
                        ? current.filter((l) => l !== level)
                        : [...current, level]
                    )
                  }
                >
                  {level}
                </button>
              ))}
            </div>
          </fieldset>
        </div>

        <p className="text-xs text-muted-foreground" data-testid="project-count">
          {filtered.length} of {projectCatalog.length} projects
        </p>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              status={progressByProject.get(project.id) ?? "not_started"}
              prereqMissing={auditPrerequisites(project, completedProjectIds).missing}
            />
          ))}
          {filtered.length === 0 && (
            <Card variant="surface" className="md:col-span-2 lg:col-span-3 text-center p-10 border-dashed">
              <FolderKanban className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <h3 className="text-base font-semibold mb-1">No projects match those filters</h3>
              <p className="text-sm text-muted-foreground">Try clearing a filter or the search box.</p>
            </Card>
          )}
        </div>
      </div>
    </PageLayout>
  );
}

/** Small helper: merges Phase 4 milestone records into ProjectStatus summaries. */
function useProjectCompletionSummary(): Map<string, string> {
  const progress = useAllProjectProgress();
  const evidence = useAllProjectEvidence();
  return React.useMemo(() => {
    const summary = new Map<string, string>();
    const milestoneStateByProject = new Map<string, number>();
    for (const row of progress) {
      milestoneStateByProject.set(row.projectId, (milestoneStateByProject.get(row.projectId) ?? 0) + 1);
    }
    const next = new Map<string, string>();
    for (const project of projectCatalog) {
      const doneMilestones = progress.filter(
        (row) => row.projectId === project.id && row.completed
      ).length;
      const hasEvidence = evidence.some((row) => row.projectId === project.id);
      if (doneMilestones === 0 && !hasEvidence) {
        next.set(project.id, "not_started");
      } else if (doneMilestones < project.milestones.filter((m) => m.required).length) {
        next.set(project.id, "in_progress");
      } else {
        next.set(project.id, "submitted");
      }
    }
    void milestoneStateByProject;
    void summary;
    return next;
  }, [progress, evidence]);
}

const LEVEL_BADGE: Record<ProjectLevel, "success" | "info" | "warning" | "secondary"> = {
  beginner: "success",
  intermediate: "info",
  advanced: "warning",
  capstone: "secondary",
};

function ProjectCard({
  project,
  status,
  prereqMissing,
}: {
  project: ProjectDefinition;
  status: string;
  prereqMissing: string[];
}) {
  const total = project.milestones.filter((m) => m.required).length;
  return (
    <Card variant="interactive" className="flex flex-col justify-between">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between mb-2">
          <Badge variant={LEVEL_BADGE[project.level]} className="capitalize">
            {project.level}
          </Badge>
          <Badge variant="outline" className="text-[10px]">{project.phaseSlugs[0]}</Badge>
        </div>
        <CardTitle className="text-lg font-bold">{project.title}</CardTitle>
        <CardDescription className="line-clamp-2">{project.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-1">
          {project.skills.slice(0, 4).map((skill) => (
            <Badge key={skill} variant="muted" className="text-[10px]">
              {skill}
            </Badge>
          ))}
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" aria-hidden="true" /> ~{project.estimatedHours}h
          </span>
          <span data-testid={`project-progress-${project.slug}`}>
            {status === "not_started"
              ? "Not started"
              : status === "in_progress"
                ? "In progress"
                : "Milestones done"}
          </span>
        </div>
        {prereqMissing.length > 0 && project.level === "capstone" && (
          <p className="text-[11px] text-status-warning">
            Prerequisites recommended first: {prereqMissing.map((slug) => slug.replace("proj-", "")).join(", ")}
          </p>
        )}
      </CardContent>
      <CardFooter>
        <Link href={`/projects/${project.slug}`} className="w-full">
          <Button className="w-full gap-1.5" data-testid={`open-project-${project.slug}`}>
            {status === "not_started" ? "Start" : "Continue"} <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
}
