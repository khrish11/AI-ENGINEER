import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadPublishedProfile, loadPublicPortfolio } from "@/lib/portfolio/publication";
import { EVIDENCE_PROVENANCE } from "@/lib/portfolio/public-view";
import { validateSlug } from "@/lib/portfolio/slug";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ username: string }> };

/**
 * §31 — public portfolio with Open Graph metadata. Private/disabled portfolios
 * return 404 and the metadata never leaks that the tree exists.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const validation = validateSlug(username);
  if (!validation.valid) return { title: "Portfolio not found" };
  try {
    const profile = await loadPublishedProfile(validation.normalized ?? "");
    if (!profile) return { title: "Portfolio not found" };
    return {
      title: `${profile.displayName ?? profile.username} — Portfolio`,
      description:
        profile.bio ??
        "Evidence-based engineering portfolio: published projects, selected achievements and skills.",
      openGraph: {
        title: `${profile.displayName ?? profile.username} — Portfolio`,
        description: profile.bio ?? "Evidence-based engineering portfolio.",
        type: "profile",
      },
    };
  } catch {
    return { title: "Portfolio not found" };
  }
}

export default async function PublicPortfolioPage({ params }: Props) {
  const { username } = await params;
  const validation = validateSlug(username);
  if (!validation.valid) notFound();

  let profile = null;
  try {
    profile = await loadPublishedProfile(validation.normalized ?? "");
  } catch {
    notFound();
  }
  if (!profile) notFound();
  const portfolio = await loadPublicPortfolio(profile);
  if (!portfolio) notFound();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto max-w-4xl px-4 py-10 space-y-10">
        <header className="space-y-3 border-b border-border pb-8">
          <h1 className="text-4xl font-bold tracking-tight">
            {portfolio.displayName ?? profile.displayName ?? profile.username}
          </h1>
          {profile.bio && <p className="text-muted-foreground max-w-2xl">{profile.bio}</p>}
          {portfolio.careerTrack && (
            <p className="text-sm text-muted-foreground">Target track: {portfolio.careerTrack}</p>
          )}
        </header>

        {portfolio.projects.length > 0 && (
          <section aria-labelledby="portfolio-projects" className="space-y-4">
            <h2 id="portfolio-projects" className="text-2xl font-semibold">Projects</h2>
            {portfolio.projects.map((project) => (
              <article key={project.id} className="rounded-xl border border-border p-6 space-y-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-xl font-semibold">{project.title}</h3>
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">
                    {project.status.replace(/_/g, " ")}
                  </span>
                </div>
                <p className="text-muted-foreground">{project.description}</p>
                <p className="text-sm text-muted-foreground">
                  Skills: {project.skills.join(", ")} · est. {project.estimatedHours}h
                </p>
                {project.evidence.length > 0 && (
                  <ul className="text-sm space-y-1">
                    {project.evidence.map((entry) => (
                      <li key={entry.id}>
                        {entry.title ?? entry.kind}
                        {entry.url && (
                          <>
                            {" — "}
                            <a className="underline" href={entry.url} rel="nofollow noopener">
                              {entry.url}
                            </a>
                          </>
                        )}{" "}
                        <span className="text-xs text-muted-foreground">
                          ({EVIDENCE_PROVENANCE[entry.provenance]} · {entry.verificationLabel})
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {project.selfAssessedScore && (
                  <p className="text-sm text-muted-foreground">
                    Self-assessed rubric score (learner-entered, not a verified grade):{" "}
                    {project.selfAssessedScore.totalEarned}/{project.selfAssessedScore.totalMax}
                  </p>
                )}
              </article>
            ))}
          </section>
        )}

        {portfolio.skills.length > 0 && (
          <section aria-labelledby="portfolio-skills" className="space-y-3">
            <h2 id="portfolio-skills" className="text-2xl font-semibold">Skills</h2>
            <ul className="grid sm:grid-cols-2 gap-2 text-sm">
              {portfolio.skills.map((skill) => (
                <li key={skill.skillId} className="rounded-lg border border-border px-4 py-2">
                  {skill.skillId} — {skill.band}
                </li>
              ))}
            </ul>
          </section>
        )}

        {portfolio.achievements.length > 0 && (
          <section aria-labelledby="portfolio-achievements" className="space-y-3">
            <h2 id="portfolio-achievements" className="text-2xl font-semibold">Achievements</h2>
            <ul className="space-y-2 text-sm">
              {portfolio.achievements.map((achievement) => (
                <li key={achievement.id}>
                  <strong>{achievement.title}</strong>
                  {achievement.earnedAt && ` — earned ${achievement.earnedAt.slice(0, 10)}`}
                </li>
              ))}
            </ul>
          </section>
        )}

        {portfolio.learningProgress.canonicalLessonsCompleted !== null && (
          <section aria-labelledby="portfolio-progress" className="space-y-2">
            <h2 id="portfolio-progress" className="text-2xl font-semibold">Learning progress</h2>
            <p className="text-sm text-muted-foreground">
              {portfolio.learningProgress.canonicalLessonsCompleted} canonical lessons completed.
            </p>
          </section>
        )}

        <footer className="border-t border-border pt-6 text-xs text-muted-foreground">
          Everything here is learner-selected. Evidence is learner-submitted and has not been
          externally verified.
        </footer>
      </div>
    </div>
  );
}
