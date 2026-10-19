"use client";

import * as React from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useProjectProgress } from "@/hooks/useProjectProgress";
import { useProjectEvidence } from "@/hooks/useProjectEvidence";
import { useProjectSelfAssessment } from "@/hooks/useProjectSelfAssessment";
import { projectProgressRepo } from "@/lib/progress/repositories/project-progress";
import { computeProjectStatus, type ProjectStatusInputs, type MilestoneState } from "@/lib/projects/completion";
import { scoreRubric, rubricVerdict, SELF_ASSESSED_LABEL } from "@/lib/projects/rubric";
import { checkEvidenceUrl, validateGithubSubmission } from "@/lib/projects/evidence";
import { EVIDENCE_KINDS, type EvidenceKind, type ProjectDefinition } from "@/lib/projects/schema";
import type { ProjectEvidence, ProjectProgress } from "@/lib/progress/db";
import {
  CheckCircle2,
  Circle,
  ClipboardCheck,
  Link2,
  Loader2,
  Trash2,
  Trophy,
} from "lucide-react";

const EVIDENCE_KIND_LABELS: Record<EvidenceKind, string> = {
  github_repo_url: "GitHub repository",
  pull_request_url: "Pull request",
  commit_url: "Commit",
  deployment_url: "Deployment URL",
  documentation_url: "Documentation URL",
  screenshot: "Screenshot",
  markdown_reflection: "Written reflection",
  evaluation_result: "Evaluation result",
  test_result: "Test result",
  benchmark_report: "Benchmark report",
  notebook: "Notebook",
  repository_directory: "Repository directory",
};

const STATUS_LABELS: Record<string, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  submitted: "Submitted",
  completed: "Completed",
  mastered: "Mastered",
};

const STATUS_BADGE: Record<string, "muted" | "outline" | "info" | "success" | "secondary"> = {
  not_started: "muted",
  in_progress: "outline",
  submitted: "info",
  completed: "success",
  mastered: "secondary",
};

export function ProjectWorkspace({ project }: { project: ProjectDefinition }) {
  const { progress, loading, markMilestoneComplete } = useProjectProgress(project.id);
  const { evidence, attach, remove } = useProjectEvidence(project.id);
  const {
    scores,
    setScore,
    calculated,
    save,
    saving,
    loading: assessmentLoading,
  } = useProjectSelfAssessment(
    project.rubric ? project.id : null,
    project.rubric ?? null
  );

  const { milestoneStates, status } = React.useMemo(() => {
    // Persisted rows → status inputs (compute stays a pure function).
    const milestoneStates: MilestoneState[] = progress
      .filter((row) => row.milestoneId)
      .map((row) => ({
        milestoneId: row.milestoneId as string,
        completed: row.completed,
        evidenceUrl: row.evidenceUrl,
      }));
    const evidenceEntries: ProjectStatusInputs["evidence"] = evidence.map((entry) => ({
      id: entry.id,
      projectId: entry.projectId,
      kind: entry.kind,
      value: entry.value,
      title: entry.title,
      createdAt: entry.createdAt,
      selfReported: entry.selfReported,
    }));
    const status = computeProjectStatus(project, {
      milestoneStates,
      evidence: evidenceEntries,
      selfAssessment:
        scores && Object.keys(scores).length > 0
          ? { scores, updatedAt: null }
          : null,
    });
    return { milestoneStates, status };
  }, [project, progress, evidence, scores]);

  const requiredMilestones = project.milestones.filter((m) => m.required);
  const completedRequired = requiredMilestones.filter((m) =>
    milestoneStates.find((s) => s.milestoneId === m.id)?.completed
  ).length;

  return (
    <div className="space-y-6">
      {/* Header ------------------------------------------------------------ */}
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={status.status === "mastered" ? "secondary" : STATUS_BADGE[status.status]} data-testid="project-status-badge">
            {STATUS_LABELS[status.status]}
          </Badge>
          <Badge variant="outline" className="capitalize">{project.level}</Badge>
          <Badge variant="muted" className="capitalize">source: {project.source}</Badge>
          <Badge variant="muted">~{project.estimatedHours}h</Badge>
        </div>
        <h1 className="text-3xl font-bold tracking-tight">{project.title}</h1>
        <p className="text-sm text-muted-foreground max-w-3xl">{project.description}</p>
        <Progress
          value={completedRequired}
          max={Math.max(requiredMilestones.length, 1)}
          variant={status.status === "completed" || status.status === "mastered" ? "success" : "cyan"}
          aria-label="Required milestone progress"
          data-testid="project-progress-bar"
        />
        <p className="text-xs text-muted-foreground">
          {completedRequired}/{requiredMilestones.length} required milestones ·{" "}
          {status.requiredEvidenceProvided ? "required" : "required"} evidence attached{" "}
          {status.requiredEvidenceProvided ? "" : "pending"}
        </p>
      </header>

      {/* Attributes -------------------------------------------------------- */}
      <Card variant="surface">
        <CardContent className="grid gap-4 sm:grid-cols-2 text-sm">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
              Learning objectives
            </h2>
            <ul className="list-disc pl-4 space-y-1">
              {project.learningObjectives.map((objective) => (
                <li key={objective}>{objective}</li>
              ))}
            </ul>
          </div>
          <div className="space-y-3">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                Skills exercised
              </h2>
              <div className="flex flex-wrap gap-1">
                {project.skills.map((skill) => (
                  <Badge key={skill} variant="muted" className="text-[10px]">{skill}</Badge>
                ))}
              </div>
            </div>
            {project.suggestedStack.length > 0 && (
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                  Suggested stack
                </h2>
                <div className="flex flex-wrap gap-1">
                  {project.suggestedStack.map((tool) => (
                    <Badge key={tool} variant="outline" className="text-[10px]">{tool}</Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Milestones --------------------------------------------------------- */}
      <section aria-labelledby="milestones-heading" className="space-y-3">
        <h2 id="milestones-heading" className="text-xl font-semibold">Milestones</h2>
        {loading ? (
          <Loader2 className="animate-spin text-muted-foreground" aria-label="Loading milestones" />
        ) : (
          requiredMilestones.map((milestone) => {
            const state = milestoneStates.find((s) => s.milestoneId === milestone.id);
            const completed = Boolean(state?.completed);
            return (
              <MilestoneRow
                key={milestone.id}
                projectId={project.id}
                milestone={milestone}
                project={project}
                completed={completed}
                progressRow={progress.find((row) => row.milestoneId === milestone.id) ?? null}
                evidence={evidence.filter((e) => !e.deletedAt)}
                onComplete={(evidenceUrl) => markMilestoneComplete(milestone.id, evidenceUrl)}
              />
            );
          })
        )}
        {project.milestones.some((m) => !m.required) && (
          <p className="text-xs text-muted-foreground">
            Optional milestones in this project:{" "}
            {project.milestones.filter((m) => !m.required).map((m) => m.title).join(", ")}
          </p>
        )}
      </section>

      {/* Evidence ----------------------------------------------------------- */}
      <EvidenceSection project={project} evidence={evidence} attach={attach} remove={remove} />

      {/* Rubric -------------------------------------------------------------- */}
      {project.rubric && (
        <RubricSection
          project={project}
          scores={scores}
          calculated={calculated}
          setScore={setScore}
          save={save}
          saving={saving}
        />
      )}

      {/* Completion summary -------------------------------------------------- */}
      <Card variant="surface" data-testid="completion-summary">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Trophy className="w-4 h-4 text-accent-cyan" aria-hidden="true" /> Completion checklist
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5 text-sm">
          <ChecklistItem
            done={status.requiredMilestonesComplete}
            label="All required milestones complete with their evidence"
          />
          <ChecklistItem
            done={status.requiredEvidenceProvided}
            label="All required project evidence attached"
          />
          {project.rubric && (
            <ChecklistItem
              done={status.minimumSelfAssessmentCompleted}
              label="Every rubric category self-assessed"
            />
          )}
          {(status.status === "completed" || status.status === "mastered") && (
            <ChecklistItem
              done
              label={
                status.status === "mastered"
                  ? "Mastered — rubric score cleared the mastery threshold"
                  : "Completed — rubric score cleared the completion threshold"
              }
            />
          )}
          {status.rubricScore?.assessed && (
            <p className="text-xs text-muted-foreground">
              Rubric score: {status.rubricScore.total}/{status.rubricScore.max} ({SELF_ASSESSED_LABEL.toLowerCase()}
              , never certified externally)
            </p>
          )}
          {project.prerequisites.length > 0 && (
            <p className="text-xs text-muted-foreground pt-1">
              Prerequisites (recommended first):{" "}
              {project.prerequisites.map((id) => id.replace("proj-", "")).join(", ")}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ChecklistItem({ done, label }: { done: boolean; label: string }) {
  return (
    <p className="flex items-start gap-2">
      {done ? (
        <CheckCircle2 className="w-4 h-4 mt-0.5 text-status-success shrink-0" aria-label="done" />
      ) : (
        <Circle className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" aria-label="pending" />
      )}
      <span className={done ? "text-foreground" : "text-muted-foreground"}>{label}</span>
    </p>
  );
}

function MilestoneRow({
  projectId,
  milestone,
  project,
  completed,
  progressRow,
  evidence,
  onComplete,
}: {
  projectId: string;
  milestone: ProjectDefinition["milestones"][number];
  project: ProjectDefinition;
  completed: boolean;
  progressRow: ProjectProgress | null;
  evidence: ProjectEvidence[];
  onComplete: (evidenceUrl: string | null) => void;
}) {
  const [notes, setNotes] = React.useState(progressRow?.notes ?? "");
  const [saving, setSaving] = React.useState(false);

  const requirementKinds = milestone.requiredEvidence
    .map((id) => project.requiredEvidence.find((r) => r.id === id)?.kind)
    .filter((k): k is EvidenceKind => Boolean(k));
  const missingKinds = requirementKinds.filter(
    (kind) => !evidence.some((entry) => entry.kind === kind)
  );

  const complete = async () => {
    if (completed) return;
    if (missingKinds.length > 0) {
      // UI blocks completion until the required evidence kinds exist project-wide.
      return;
    }
    setSaving(true);
    try {
      await onComplete(missingKinds.length === 0 && evidence.length > 0 ? evidence[0].value : null);
      if (notes) {
        await projectProgressRepo.upsert({
          projectId,
          milestoneId: milestone.id,
          completed: true,
          notes,
        });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card variant="surface">
      <CardContent className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold">{milestone.title}</h3>
              <Badge variant="muted">~{Math.round(milestone.estimatedMinutes / 60 * 10) / 10}h</Badge>
              {!milestone.required && <Badge variant="outline">optional</Badge>}
            </div>
            <p className="text-sm text-muted-foreground">{milestone.objective}</p>
            <p className="text-xs text-muted-foreground">
              Expected output: {milestone.expectedOutput}
            </p>
            {missingKinds.length > 0 && (
              <p className="text-xs text-status-warning" data-testid={`milestone-evidence-warning-${milestone.id}`}>
                Needs evidence first: {missingKinds.map((k) => EVIDENCE_KIND_LABELS[k]).join(", ")}
              </p>
            )}
          </div>
          <div className="shrink-0 text-right space-y-2">
            {completed ? (
              <span className="inline-flex items-center gap-1 text-status-success text-sm" data-testid={`milestone-complete-${milestone.id}`}>
                <CheckCircle2 className="w-4 h-4" aria-hidden="true" /> Done
              </span>
            ) : (
              <Button
                size="sm"
                onClick={complete}
                disabled={saving || missingKinds.length > 0}
                data-testid={`milestone-complete-${milestone.id}`}
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> : null}
                Mark complete
              </Button>
            )}
          </div>
        </div>
        <Input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Milestone notes (optional, stored locally and synced)"
          aria-label={`Notes for milestone ${milestone.title}`}
        />
      </CardContent>
    </Card>
  );
}

function EvidenceSection({
  project,
  evidence,
  attach,
  remove,
}: {
  project: ProjectDefinition;
  evidence: ProjectEvidence[];
  attach: (input: {
    kind: EvidenceKind;
    value: string;
    title?: string | null;
    details?: { branch?: string; commitSha?: string; prUrl?: string; directory?: string } | null;
  }) => Promise<unknown>;
  remove: (recordId: string) => Promise<void>;
}) {
  const requiredKinds = new Set(
    project.requiredEvidence.filter((requirement) => requirement.required).map((r) => r.kind)
  );
  const [kind, setKind] = React.useState<EvidenceKind>(
    project.requiredEvidence[0]?.kind ?? "github_repo_url"
  );
  const [value, setValue] = React.useState("");
  const [title, setTitle] = React.useState("");
  const [branch, setBranch] = React.useState("");
  const [commitSha, setCommitSha] = React.useState("");
  const [prUrl, setPrUrl] = React.useState("");
  const [directory, setDirectory] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const submit = async () => {
    setError(null);
    if (!value.trim()) {
      setError("Provide a link, path, or reflection for this evidence.");
      return;
    }
    const urlCheck = checkEvidenceUrl(value.trim());
    const isUrlKind = ["github_repo_url", "pull_request_url", "deployment_url", "documentation_url"].includes(kind);
    if (isUrlKind && urlCheck.ok && !value.startsWith("http")) {
      setError(urlCheck.reason ?? "Invalid URL.");
      return;
    }
    const githubDetails =
      kind === "github_repo_url" && (branch || commitSha || prUrl || directory)
        ? { branch: branch || undefined, commitSha: commitSha || undefined, prUrl: prUrl || undefined, directory: directory || undefined }
        : null;
    if (kind === "github_repo_url" && githubDetails) {
      const githubCheck = validateGithubSubmission({ repositoryUrl: value.trim(), ...githubDetails });
      if (!githubCheck.ok) {
        setError(githubCheck.reason ?? "Invalid GitHub submission.");
        return;
      }
    }
    setBusy(true);
    try {
      await attach({
        kind,
        value: value.trim(),
        title: title.trim() || null,
        details: githubDetails,
      });
      setValue("");
      setTitle("");
      setBranch("");
      setCommitSha("");
      setPrUrl("");
      setDirectory("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not attach evidence.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="evidence-heading" className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 id="evidence-heading" className="text-xl font-semibold">Evidence</h2>
        <Badge variant="muted">Self-reported</Badge>
      </div>
      <p className="text-xs text-muted-foreground max-w-2xl">
        Evidence is private by default. Attached links are validated (https only, http allowed for
        localhost) but never treated as externally verified.
      </p>
      {!project.requiredEvidence.some((r) => r.required) ? null : (
        <ul className="text-xs text-muted-foreground list-disc pl-4">
          {project.requiredEvidence
            .filter((r) => r.required)
            .map((r) => (
              <li key={r.id}>{r.description}</li>
            ))}
        </ul>
      )}

      <Card variant="surface">
        <CardContent className="grid gap-2 sm:grid-cols-3 items-end" data-testid="evidence-form">
          <label className="text-xs text-muted-foreground space-y-1">
            <span>Kind</span>
            <select
              className="h-9 w-full rounded-lg border border-border bg-surface px-2 text-sm text-foreground"
              value={kind}
              onChange={(e) => setKind(e.target.value as EvidenceKind)}
              aria-label="Evidence kind"
            >
              {EVIDENCE_KINDS.map((option) => (
                <option key={option} value={option}>
                  {EVIDENCE_KIND_LABELS[option]}{requiredKinds.has(option) ? " (required)" : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-muted-foreground space-y-1 sm:col-span-2">
            <span>Value (URL, path, or reflection)</span>
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="https://github.com/you/your-project"
              aria-label="Evidence value"
            />
          </label>
          <label className="text-xs text-muted-foreground space-y-1">
            <span>Title (optional)</span>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Evidence title" />
          </label>
          {kind === "github_repo_url" && (
            <>
              <label className="text-xs text-muted-foreground space-y-1">
                <span>Branch</span>
                <Input value={branch} onChange={(e) => setBranch(e.target.value)} aria-label="GitHub branch" />
              </label>
              <label className="text-xs text-muted-foreground space-y-1">
                <span>Commit SHA</span>
                <Input value={commitSha} onChange={(e) => setCommitSha(e.target.value)} aria-label="Commit SHA" />
              </label>
              <label className="text-xs text-muted-foreground space-y-1">
                <span>Pull request URL</span>
                <Input value={prUrl} onChange={(e) => setPrUrl(e.target.value)} aria-label="Pull request URL" />
              </label>
              <label className="text-xs text-muted-foreground space-y-1 sm:col-span-2">
                <span>Relevant directory (optional)</span>
                <Input value={directory} onChange={(e) => setDirectory(e.target.value)} aria-label="Repository directory" />
              </label>
            </>
          )}
          <Button onClick={submit} disabled={busy} data-testid="attach-evidence">
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> : <Link2 className="w-3.5 h-3.5" aria-hidden="true" />}
            Attach
          </Button>
          {error && (
            <p role="alert" className="sm:col-span-3 text-xs text-status-error" data-testid="evidence-error">
              {error}
            </p>
          )}
        </CardContent>
      </Card>

      {evidence.filter((e) => !e.deletedAt).length > 0 && (
        <ul className="space-y-2">
          {evidence
            .filter((e) => !e.deletedAt)
            .map((entry) => (
              <li
                key={entry.id}
                className="flex items-start justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                data-testid={`evidence-entry-${entry.kind}`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="muted" className="text-[10px]">
                      {EVIDENCE_KIND_LABELS[entry.kind as EvidenceKind] ?? entry.kind}
                    </Badge>
                    {entry.title && <span className="font-medium truncate">{entry.title}</span>}
                  </div>
                  <p className="text-xs text-muted-foreground truncate" title={entry.value}>
                    {entry.value}
                  </p>
                  {entry.details && (
                    <p className="text-[11px] text-muted-foreground">
                      {[
                        entry.details.branch ? `branch: ${entry.details.branch}` : null,
                        entry.details.commitSha ? `commit: ${entry.details.commitSha}` : null,
                        entry.details.prUrl ? `PR: ${entry.details.prUrl}` : null,
                        entry.details.directory ? `dir: ${entry.details.directory}` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Remove evidence"
                  data-testid={`remove-evidence-${entry.id}`}
                  onClick={() => void remove(entry.id)}
                >
                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                </Button>
              </li>
            ))}
        </ul>
      )}
    </section>
  );
}

function RubricSection({
  project,
  scores,
  calculated,
  setScore,
  save,
  saving,
}: {
  project: ProjectDefinition;
  scores: Record<string, number>;
  calculated: ReturnType<typeof scoreRubric> | null;
  setScore: (categoryId: string, score: number) => void;
  save: () => Promise<unknown>;
  saving: boolean;
}) {
  const rubric = project.rubric!;
  const [feedback, setFeedback] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const verdict = calculated
    ? rubricVerdict(calculated, {
        completion: rubric.completionThreshold,
        mastery: rubric.masteryThreshold,
      })
    : null;

  const submit = async () => {
    setError(null);
    setFeedback(null);
    const unscored = rubric.categories.filter(
      (category) => typeof scores[category.id] !== "number"
    );
    if (unscored.length > 0) {
      setError(
        `Self-assessment incomplete: score every category first (missing: ${unscored
          .map((category) => category.category)
          .join(", ")}).`
      );
      return;
    }
    try {
      await save();
      setFeedback(
        `Saved — self-assessed total ${calculated?.total}/${calculated?.max} (${verdict === "mastered" ? "mastery level" : verdict === "completed" ? "completion level" : "below completion level"}). ${SELF_ASSESSED_LABEL} only.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save self-assessment.");
    }
  };

  return (
    <section aria-labelledby="rubric-heading" className="space-y-3">
      <h2 id="rubric-heading" className="text-xl font-semibold">Evaluation rubric</h2>
      <p className="text-xs text-muted-foreground max-w-2xl">
        Score yourself honestly per category. The result is {SELF_ASSESSED_LABEL.toLowerCase()} and
        feeds project completion and mastery evidence — it is never external certification.
      </p>
      <Card variant="surface">
        <table className="w-full text-sm" data-testid="rubric-table">
          <caption className="sr-only">Project rubric self-assessment</caption>
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="py-2 pr-2">Category</th>
              <th scope="col" className="py-2 pr-2">Criteria</th>
              <th scope="col" className="py-2 pr-2">Min expectation</th>
              <th scope="col" className="py-2 w-28">Score (0–{rubric.categories.reduce((sum, c) => sum + c.weight, 0)})</th>
            </tr>
          </thead>
          <tbody>
            {rubric.categories.map((category) => (
              <tr key={category.id} className="border-t border-border align-top">
                <td className="py-2 pr-2 font-medium">
                  {category.category}
                  <span className="block text-[10px] text-muted-foreground font-normal">
                    weight {category.weight}
                  </span>
                </td>
                <td className="py-2 pr-2 text-muted-foreground">
                  <ul className="list-disc pl-4">
                    {category.criteria.map((criterion) => (
                      <li key={criterion}>{criterion}</li>
                    ))}
                  </ul>
                </td>
                <td className="py-2 text-xs text-muted-foreground">
                  Min: {category.minimumExpectation}
                </td>
                <td className="py-2">
                  <select
                    className="h-8 w-full rounded-md border border-border bg-surface px-1.5 text-xs text-foreground"
                    value={scores[category.id] ?? ""}
                    onChange={(e) =>
                      setScore(category.id, Number(e.target.value))
                    }
                    aria-label={`Score for ${category.category} (0 to ${category.weight})`}
                    data-testid={`rubric-score-${category.id}`}
                  >
                    <option value="">—</option>
                    {Array.from({ length: category.weight + 1 }, (_, i) => (
                      <option key={i} value={i}>{i}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <div className="flex items-center gap-3 flex-wrap">
        <Button onClick={submit} disabled={saving} data-testid="rubric-save">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> : <ClipboardCheck className="w-3.5 h-3.5" aria-hidden="true" />}
          Save self-assessment
        </Button>
        {calculated && (
          <span className="text-sm text-muted-foreground" data-testid="rubric-total">
            Total: {calculated.total}/{calculated.max}
            {calculated.percentage !== null ? ` (${calculated.percentage}%)` : ""}
          </span>
        )}
        {feedback && (
          <p role="status" className="text-xs text-status-success w-full" data-testid="rubric-feedback">
            {feedback}
          </p>
        )}
        {error && (
          <p role="alert" className="text-xs text-status-error w-full" data-testid="rubric-error">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
