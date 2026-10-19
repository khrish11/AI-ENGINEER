"use client";

import * as React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLearnerStats } from "@/hooks/useLearnerStats";
import { useAnalyticsSources } from "@/hooks/useAnalytics";
import { deriveAchievements } from "@/lib/analytics/achievements";
import { useSkillAnalytics } from "@/hooks/useAnalytics";
import { defaultVisibility, type PortfolioSettings, type PortfolioVisibility } from "@/lib/portfolio/types";
import { validateSlug } from "@/lib/portfolio/slug";
import { LocalPortfolioDraft } from "@/lib/portfolio/local-draft";
import type { AuthStatus } from "@/hooks/useAuthStatus";

const VISIBILITY_LABELS: Array<{ key: keyof PortfolioVisibility; label: string }> = [
  { key: "careerTrack", label: "Career track" },
  { key: "skills", label: "Skills (evidence-based status)" },
  { key: "projects", label: "Projects" },
  { key: "achievements", label: "Achievements" },
  { key: "curriculumProgress", label: "Curriculum progress" },
  { key: "studyTime", label: "Study-time totals" },
  { key: "assessments", label: "Assessment summary" },
];

/**
 * §25/§32/§34/§37 — portfolio settings. Everything private by default; guests
 * keep a local Dexie draft and cannot publish; signed-in learners persist to
 * the server and can export structured JSON.
 */
export function PortfolioSettingsClient({ auth }: { auth: AuthStatus | null }) {
  const { stats } = useLearnerStats();
  const { bundle } = useAnalyticsSources();
  const achievements = React.useMemo(
    () =>
      bundle
        ? deriveAchievements({
            lessons: bundle.sources.lessons,
            studySessions: bundle.sources.studySessions,
            quizAttempts: bundle.sources.quizAttempts,
            projectProgress: bundle.sources.projectProgress,
            projectEvidence: bundle.sources.projectEvidence,
          }).filter((achievement) => achievement.earnedAt)
        : [],
    [bundle]
  );
  const [settings, setSettings] = React.useState<PortfolioSettings | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [slugError, setSlugError] = React.useState<string | null>(null);
  const [completedProjectIds, setCompletedProjectIds] = React.useState<string[]>([]);

  React.useEffect(() => {
    void (async () => {
      if (!auth?.authenticated) {
        try {
          const draft = await LocalPortfolioDraft.load();
          setSettings(draft ?? fallbackSettings());
        } catch {
          setSettings(fallbackSettings());
          setMessage("Unable to load the local draft; using private defaults.");
        }
        setLoading(false);
        return;
      }
      try {
        const response = await fetch("/api/portfolio/settings");
        const payload = (await response.json()) as { settings: PortfolioSettings | null };
        setSettings(payload.settings ?? fallbackSettings());
      } catch {
        setSettings(fallbackSettings());
      } finally {
        setLoading(false);
      }
    })();
  }, [auth?.authenticated]);

  React.useEffect(() => {
    // Completed projects come from the learner's real milestone records.
    void (async () => {
      const { projectProgressRepo } = await import("@/lib/progress/repositories/project-progress");
      const { projectCatalog } = await import("@/lib/projects/catalog");
      const rows = await projectProgressRepo.getAll();
      const doneByProject = new Map<string, number>();
      for (const row of rows) {
        if (!row.completed) continue;
        doneByProject.set(row.projectId, (doneByProject.get(row.projectId) ?? 0) + 1);
      }
      const ids: string[] = [];
      for (const project of projectCatalog) {
        const required = project.milestones.filter((milestone) => milestone.required).length;
        if ((doneByProject.get(project.id) ?? 0) >= required && required > 0) ids.push(project.id);
      }
      setCompletedProjectIds(ids);
    })();
  }, []);

  const skillsResult = useSkillAnalytics(bundle);

  const patch = (updater: (current: PortfolioSettings) => PortfolioSettings) => {
    setSettings((current) => (current ? updater(current) : current));
  };

  const save = async (publish?: boolean) => {
    if (!settings) return;
    if (!auth?.authenticated) {
      await LocalPortfolioDraft.save(settings);
      setMessage("Saved as a local draft. Sign in with an account to publish a public portfolio.");
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/portfolio/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          portfolioEnabled: settings.portfolioEnabled,
          username: settings.username,
          displayName: settings.displayName,
          bio: settings.bio,
          visibility: settings.visibility,
          publicProjectIds: settings.publicProjectIds,
          publicEvidenceIds: settings.publicEvidenceIds,
          publicAchievementIds: settings.publicAchievementIds,
          publicSkillIds: settings.publicSkillIds,
          careerTrackId: settings.careerTrackId,
          published: publish ?? settings.published,
        }),
      });
      const payload = (await response.json()) as { settings?: PortfolioSettings; error?: string };
      if (!response.ok) {
        setMessage(payload.error ?? "Save failed");
      } else if (payload.settings) {
        setSettings(payload.settings);
        setMessage(publish ? "Portfolio published." : "Settings saved.");
      }
    } catch {
      setMessage("Save failed — check your connection.");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !settings) {
    return (
      <div aria-busy="true">
        <div className="h-40 rounded-xl bg-muted animate-pulse" />
        <span className="sr-only">Loading portfolio settings…</span>
      </div>
    );
  }

  const slugValidation = settings.username ? validateSlug(settings.username) : { valid: true, reason: null };

  return (
    <div className="space-y-6">
      <header className="space-y-1 border-b border-border pb-4">
        <h1 className="text-3xl font-bold tracking-tight">Portfolio</h1>
        <p className="text-sm text-muted-foreground">
          An opt-in public portfolio of your real work. Nothing is published unless you
          explicitly enable and select it here — the default for every item is PRIVATE.
        </p>
      </header>

      {!auth?.authenticated && (
        <Card>
          <CardContent className="text-sm text-muted-foreground py-3">
            Guest Mode: settings are stored as a local draft and will not be published. Sign in
            to publish a public portfolio at a URL.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Publication</CardTitle>
          <CardDescription>
            Publishes at /portfolio/&lt;username&gt;. Publishing requires a signed-in account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={settings.portfolioEnabled}
              onChange={(event) =>
                patch((current) => ({ ...current, portfolioEnabled: event.target.checked }))
              }
            />
            Enable public portfolio (off by default)
          </label>
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="portfolio-username">
              Public username (lowercase letters, numbers, hyphen)
            </label>
            <Input
              id="portfolio-username"
              value={settings.username ?? ""}
              onChange={(event) => {
                const value = event.target.value;
                patch((current) => ({ ...current, username: value || null }));
                setSlugError(value ? validateSlug(value).reason : null);
              }}
              placeholder="girish"
              autoComplete="off"
            />
            {slugError && <p className="text-xs text-status-error">{slugError}</p>}
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="portfolio-display-name">
              Display name (optional)
            </label>
            <Input
              id="portfolio-display-name"
              value={settings.displayName ?? ""}
              onChange={(event) =>
                patch((current) => ({ ...current, displayName: event.target.value || null }))
              }
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="portfolio-bio">
              Bio (optional)
            </label>
            <textarea
              id="portfolio-bio"
              className="w-full rounded-md border border-border bg-transparent p-2 text-sm"
              rows={3}
              maxLength={400}
              value={settings.bio ?? ""}
              onChange={(event) => patch((current) => ({ ...current, bio: event.target.value || null }))}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => save()} disabled={saving || !slugValidation.valid}>
              Save settings
            </Button>
            <Button
              onClick={() => save(true)}
              disabled={saving || !settings.username || !settings.portfolioEnabled}
            >
              Publish
            </Button>
            {settings.published && (
              <Button variant="outline" onClick={() => save(false)}>
                Unpublish
              </Button>
            )}
            {auth?.authenticated && settings.username && (
              <Button variant="outline" onClick={() => window.open("/api/portfolio/export", "_blank")}>
                Export JSON
              </Button>
            )}
          </div>
          {message && <p className="text-sm">{message}</p>}
          {settings.published && settings.username && (
            <p className="text-sm text-muted-foreground">
              Public at{" "}
              <a className="underline" href={`/portfolio/${settings.username}`}>
                /portfolio/{settings.username}
              </a>
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Visibility</CardTitle>
          <CardDescription>Each section is published only when toggled on.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {VISIBILITY_LABELS.map(({ key, label }) => (
            <label key={key} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={settings.visibility[key]}
                onChange={(event) =>
                  patch((current) => ({
                    ...current,
                    visibility: { ...current.visibility, [key]: event.target.checked },
                  }))
                }
              />
              {label}
            </label>
          ))}
          <label className="flex items-center gap-2 text-sm pt-2">
            <input
              type="checkbox"
              checked={settings.showSelfAssessment}
              onChange={(event) =>
                patch((current) => ({ ...current, showSelfAssessment: event.target.checked }))
              }
            />
            Show self-assessed rubric scores on published projects (always labelled “self-assessed”)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={settings.showProjectLinks}
              onChange={(event) =>
                patch((current) => ({ ...current, showProjectLinks: event.target.checked }))
              }
            />
            Show repository/demo links on published evidence
          </label>
        </CardContent>
      </Card>

      {settings.visibility.projects && (
        <Card>
          <CardHeader>
            <CardTitle>Publish projects</CardTitle>
            <CardDescription>
              Only projects you completed appear here. {completedProjectIds.length} eligible.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {completedProjectIds.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Complete a project’s required milestones to publish it.
              </p>
            ) : (
              completedProjectIds.map((projectId) => {
                const selected = settings.publicProjectIds.includes(projectId);
                return (
                  <label key={projectId} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={(event) =>
                        patch((current) => ({
                          ...current,
                          publicProjectIds: event.target.checked
                            ? [...current.publicProjectIds, projectId]
                            : current.publicProjectIds.filter((id) => id !== projectId),
                        }))
                      }
                    />
                    {projectId}
                  </label>
                );
              })
            )}
            <div className="pt-2 space-y-2">
              <p className="text-sm font-medium">Publish specific evidence</p>
              <p className="text-xs text-muted-foreground">
                Evidence stays learner-submitted provenance; nothing is labelled verified.
              </p>
              {(bundle?.sources.projectEvidence ?? [])
                .filter(
                  (entry) =>
                    !entry.deletedAt && settings.publicProjectIds.includes(entry.projectId)
                )
                .map((entry) => (
                  <label key={entry.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={settings.publicEvidenceIds.includes(entry.id)}
                      onChange={(event) =>
                        patch((current) => ({
                          ...current,
                          publicEvidenceIds: event.target.checked
                            ? [...current.publicEvidenceIds, entry.id]
                            : current.publicEvidenceIds.filter((id) => id !== entry.id),
                        }))
                      }
                    />
                    {entry.title ?? entry.kind} ({entry.kind})
                  </label>
                ))}
              {(bundle?.sources.projectEvidence ?? []).filter(
                (entry) => !entry.deletedAt && settings.publicProjectIds.includes(entry.projectId)
              ).length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Attach evidence in the project studio to select it.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {settings.visibility.skills && (
        <Card>
          <CardHeader>
            <CardTitle>Publish skills</CardTitle>
            <CardDescription>
              Only explicitly selected skills appear publicly, with their evidence-based status.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            {(skillsResult?.skills ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Complete lessons or assessments to build skill evidence.
              </p>
            ) : (
              (skillsResult?.skills ?? []).map((skill) => (
                <label key={skill.skillId} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={settings.publicSkillIds.includes(skill.skillId)}
                    onChange={(event) =>
                      patch((current) => ({
                        ...current,
                        publicSkillIds: event.target.checked
                          ? [...current.publicSkillIds, skill.skillId]
                          : current.publicSkillIds.filter((id) => id !== skill.skillId),
                      }))
                    }
                  />
                  {skill.skillId} ({skill.mastery.band})
                </label>
              ))
            )}
          </CardContent>
        </Card>
      )}

      {settings.visibility.achievements && (
        <Card>
          <CardHeader>
            <CardTitle>Publish achievements</CardTitle>
            <CardDescription>
              {stats.lessonsCompleted > 0 ? "Your achievements:" : "No achievements earned yet."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {achievements.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Achievements appear once you complete real lessons, projects or assessments.
              </p>
            ) : (
              achievements
                .map((achievement) => {
                  const selected = settings.publicAchievementIds.includes(achievement.id);
                  return (
                    <label key={achievement.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={(event) =>
                          patch((current) => ({
                            ...current,
                            publicAchievementIds: event.target.checked
                              ? [...current.publicAchievementIds, achievement.id]
                              : current.publicAchievementIds.filter(
                                  (id) => id !== achievement.id
                                ),
                          }))
                        }
                      />
                      {achievement.title} — {achievement.earnedAt?.slice(0, 10)}
                    </label>
                  );
                })
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function fallbackSettings(): PortfolioSettings {
  return {
    portfolioEnabled: false,
    username: null,
    displayName: null,
    bio: null,
    careerTrackId: null,
    visibility: defaultVisibility(),
    publicProjectIds: [],
    publicEvidenceIds: [],
    publicAchievementIds: [],
    publicSkillIds: [],
    published: false,
    showSelfAssessment: false,
    showProjectLinks: false,
    updatedAt: null,
  };
}
