import { projectCatalog } from "@/lib/projects/catalog";
import type { ProjectStatus } from "@/lib/projects/completion";
import type { PublicityJson } from "./types";
import { defaultPublicity } from "./types";

/**
 * §29/§30 — every public evidence item carries provenance. Phase 7 has no
 * external verification integrations, so all evidence is `learner-submitted`;
 * nothing is ever relabelled `verified` without a real integration.
 */
export const EVIDENCE_PROVENANCE = {
  learner_submitted: "Learner-submitted",
  platform_derived: "Platform-derived",
  externally_verified: "Externally verified",
} as const;

export type EvidenceProvenance = keyof typeof EVIDENCE_PROVENANCE;

/** §30 — precise verification labels for projects. */
export type ProjectVerificationLabel =
  | "Self-reported"
  | "Self-assessed"
  | "Repository linked"
  | "GitHub metadata verified"
  | "Platform completion criteria met";

/**
 * §44/§48 — the public serializer is an ALLOW-LIST. A private field can only
 * appear if it is explicitly read from `PublicityJson` gates below; nothing
 * from private tables (notes, quiz answers, sessions detail, conflicts,
 * devices, internal user ids, emails, OAuth ids) is ever copied in bulk.
 */
export interface PublicEvidenceItem {
  id: string;
  kind: string;
  title: string | null;
  /** URL only when kind is a link type and the learner exposed the project. */
  url: string | null;
  provenance: EvidenceProvenance;
  verificationLabel: ProjectVerificationLabel;
}

export interface PublicProject {
  id: string;
  title: string;
  description: string;
  level: string;
  skills: string[];
  status: ProjectStatus | "published_evidence_only";
  phases: string[];
  estimatedHours: number;
  evidence: PublicEvidenceItem[];
  repositoryUrl: string | null;
  demoUrl: string | null;
  selfAssessedScore: { totalEarned: number; totalMax: number } | null;
  verificationLabels: ProjectVerificationLabel[];
}

export interface PublicSkill {
  skillId: string;
  band: "developing" | "proficient" | "strong";
  score: number;
  evidenceLabels: string[];
}

export interface PublicAchievement {
  id: string;
  title: string;
  description: string;
  earnedAt: string | null;
}

export interface PublicPortfolio {
  /** §31 — no email, provider ids, or internal user UUID in the public body. */
  username: string;
  displayName: string | null;
  bio: string | null;
  careerTrack: string | null;
  skills: PublicSkill[];
  projects: PublicProject[];
  achievements: PublicAchievement[];
  learningProgress: {
    canonicalLessonsCompleted: number | null;
    totalEstimatedProjectHours: number | null;
  };
  assessmentsSummary: { attempts: number; latestPercentage: number | null } | null;
  studyTimeSummary: { totalHours: number | null } | null;
  generatedAtIso: string;
}

const LINK_EVIDENCE_KINDS = new Set([
  "github_repo_url",
  "pull_request_url",
  "commit_url",
  "deployment_url",
  "documentation_url",
  "test_result",
  "benchmark_report",
]);

/** Which private source records the public project list may touch. */
export interface PrivateProjectSource {
  projectId: string;
  status: ProjectStatus | null;
  evidence: Array<{
    id: string;
    kind: string;
    value: string;
    title: string | null;
    selfReported: boolean;
    deletedAt: string | null;
  }>;
  selfAssessment: { totalEarned: number | null; totalMax: number | null } | null;
  repositoryUrl: string | null;
  demoUrl: string | null;
}

export interface PublicPortfolioInputs {
  settings: PublicityJson;
  skills: PublicSkill[] | null;
  achievements: PublicAchievement[];
  projectSources: Map<string, PrivateProjectSource>;
  canonicalLessonsCompleted: number | null;
  careerTrackFromRoadmap: string | null;
  assessments: { attempts: number; latestPercentage: number | null } | null;
  studyHours: number | null;
}

/**
 * §26 — publication comes ONLY from the stored settings:
 *   - a project appears publicly only if `settings.publicProjectIds` includes it
 *     AND `visibility.projects` is on;
 *   - evidence appears only if its id is in `publicEvidenceIds`;
 *   - self-assessed scores appear only with `exposeSelfAssessment`;
 *   - links appear only with `exposeProjectLinks` and are additionally gated per
 *     evidence visibility (§24 — GitHub evidence URLs / demo URLs are private
 *     unless explicitly selected).
 */
export function buildPublicPortfolio(inputs: PublicPortfolioInputs, nowIso: string): PublicPortfolio {
  const settings: PublicityJson = inputs.settings ?? defaultPublicity();
  const visibility = settings.visibility;

  const publishedProjects: PublicProject[] = [];
  if (visibility.projects) {
    for (const projectId of settings.publicProjectIds) {
      const catalogProject = projectCatalog.find((project) => project.id === projectId);
      if (!catalogProject) continue;
      const source = inputs.projectSources.get(projectId);
      const selectedEvidence = source
        ? source.evidence.filter(
            (entry) => !entry.deletedAt && settings.publicEvidenceIds.includes(entry.id)
          )
        : [];
      const evidence: PublicEvidenceItem[] = selectedEvidence.map((entry) => ({
        id: entry.id,
        kind: entry.kind,
        title: entry.title,
        url: visibility.exposeProjectLinks && LINK_EVIDENCE_KINDS.has(entry.kind) ? entry.value : null,
        // §29 — no external verification exists, so provenance is explicit.
        provenance: entry.selfReported ? "learner_submitted" : "platform_derived",
        verificationLabel: verificationLabelFor(entry.kind, source?.status ?? null),
      }));

      const showSelfAssessment =
        visibility.exposeSelfAssessment && source?.selfAssessment?.totalEarned !== null;
      const linksAllowed = visibility.exposeProjectLinks;

      const verificationLabels: ProjectVerificationLabel[] = ["Self-reported"];
      if (showSelfAssessment) verificationLabels.push("Self-assessed");
      if (selectedEvidence.some((entry) => entry.kind === "github_repo_url")) {
        verificationLabels.push(linksAllowed ? "Repository linked" : "Self-reported");
      }
      if (source?.status === "completed" || source?.status === "mastered") {
        verificationLabels.push("Platform completion criteria met");
      }

      publishedProjects.push({
        id: catalogProject.id,
        title: catalogProject.title,
        description: catalogProject.description,
        level: catalogProject.level,
        skills: [...catalogProject.skills],
        status:
          source?.status ?? (selectedEvidence.length > 0 ? "published_evidence_only" : "in_progress"),
        phases: [...catalogProject.phaseSlugs],
        estimatedHours: catalogProject.estimatedHours,
        evidence,
        repositoryUrl: linksAllowed ? source?.repositoryUrl ?? null : null,
        demoUrl: linksAllowed ? source?.demoUrl ?? null : null,
        selfAssessedScore:
          showSelfAssessment && source?.selfAssessment?.totalEarned != null
            ? {
                totalEarned: source.selfAssessment.totalEarned,
                totalMax: source.selfAssessment.totalMax ?? 0,
              }
            : null,
        verificationLabels,
      });
    }
  }

  const publishedAchievements =
    visibility.achievements && settings.publicAchievementIds.length > 0
      ? inputs.achievements.filter((achievement) =>
          settings.publicAchievementIds.includes(achievement.id)
        )
      : [];

  return {
    username: "",
    displayName: null,
    bio: null,
    careerTrack:
      visibility.careerTrack
        ? settings.careerTrackId ?? inputs.careerTrackFromRoadmap
        : null,
    skills: visibility.skills ? inputs.skills ?? [] : [],
    projects: publishedProjects,
    achievements: publishedAchievements,
    learningProgress: {
      canonicalLessonsCompleted: visibility.curriculumProgress
        ? inputs.canonicalLessonsCompleted
        : null,
      totalEstimatedProjectHours:
        visibility.projects && publishedProjects.length > 0
          ? Math.round(
              publishedProjects.reduce((sum, project) => sum + project.estimatedHours, 0) * 10
            ) / 10
          : null,
    },
    assessmentsSummary: visibility.assessments ? inputs.assessments : null,
    studyTimeSummary: visibility.studyTime
      ? { totalHours: inputs.studyHours }
      : { totalHours: null },
    generatedAtIso: nowIso,
  };
}

function verificationLabelFor(
  kind: string,
  status: ProjectStatus | null
): ProjectVerificationLabel {
  if (kind === "github_repo_url") return "Repository linked";
  if (status === "completed" || status === "mastered") return "Platform completion criteria met";
  return "Self-reported";
}
