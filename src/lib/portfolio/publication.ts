/**
 * §35/§36 — server-side publication: loads the real learner records owned by an
 * authenticated identity and feeds the allow-list serializer. Portfolio tables
 * only store publication CONFIGURATION; progress data is read live (§36) so a
 * reset or deletion (§43) immediately empties the public view.
 */
import { eq } from "drizzle-orm";
import { db as pg } from "@/db";
import {
  portfolioProfiles,
  projectEvidence,
  projectProgress,
  projectSelfAssessments,
  quizAttempts,
  studySessions,
  userLessonProgress,
} from "@/db/schema";
import type { ProjectStatus } from "@/lib/projects/completion";
import { projectCatalog } from "@/lib/projects/catalog";
import { buildPublicPortfolio, type PrivateProjectSource, type PublicPortfolio } from "./public-view";
import type { PublicityJson } from "./types";
import { defaultPublicity } from "./types";
import {
  computeProjectStatus,
  type EvidenceEntry,
  type MilestoneState,
} from "@/lib/projects/completion";
import { validSessions } from "@/lib/analytics/study-time";
import { skillAnalytics } from "@/lib/analytics/skills";
import { buildPublicSkills } from "./skills-view";

export interface LoadedProfile {
  userId: string;
  username: string;
  displayName: string | null;
  bio: string | null;
  publicity: PublicityJson;
  published: boolean;
}

export async function loadPublishedProfile(username: string): Promise<LoadedProfile | null> {
  const rows = await pg
    .select()
    .from(portfolioProfiles)
    .where(eq(portfolioProfiles.username, username.toLowerCase()))
    .limit(1);
  if (rows.length === 0) return null;
  const row = rows[0];
  // §31 — an unpublished/disabled portfolio is indistinguishable from absent: return null.
  if (!row.published) return null;
  const publicity =
    row.publicity && typeof row.publicity === "object"
      ? (row.publicity as PublicityJson)
      : defaultPublicity();
  return {
    userId: row.userId,
    username: row.username as string,
    displayName: row.displayName,
    bio: row.bio,
    publicity,
    published: row.published,
  };
}

export async function loadPublicPortfolio(profile: LoadedProfile): Promise<PublicPortfolio | null> {
  if (!profile.published) return null;
  const userId = profile.userId;

  const [lessonRows, sessionRows, attemptRows, projectRows, evidenceRows, assessmentRows] =
    await Promise.all([
      pg.select().from(userLessonProgress).where(eq(userLessonProgress.userId, userId)),
      pg.select().from(studySessions).where(eq(studySessions.userId, userId)),
      pg.select().from(quizAttempts).where(eq(quizAttempts.userId, userId)),
      pg.select().from(projectProgress).where(eq(projectProgress.userId, userId)),
      pg.select().from(projectEvidence).where(eq(projectEvidence.userId, userId)),
      pg.select().from(projectSelfAssessments).where(eq(projectSelfAssessments.userId, userId)),
    ]);

  const canonicalCompleted = new Set(
    lessonRows
      .filter((row) => row.status === "completed" || row.status === "mastered")
      .map((row) => row.lessonKey)
  ).size;

  const sessionSeconds = validSessions(
    sessionRows.map((row) => ({
      id: row.id,
      createdAt: (row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt)).toISOString(),
      updatedAt: (row.updatedAt instanceof Date ? row.updatedAt : new Date(row.updatedAt)).toISOString(),
      localRevision: row.localRevision,
      syncStatus: "synced" as const,
      clientSessionId: row.clientSessionId,
      deviceId: row.deviceId ?? "",
      startedAt: (row.startedAt instanceof Date ? row.startedAt : new Date(row.startedAt)).toISOString(),
      endedAt: row.endedAt
        ? (row.endedAt instanceof Date ? row.endedAt : new Date(row.endedAt)).toISOString()
        : null,
      durationSeconds: row.durationSeconds ?? 0,
      lessonId: row.lessonKey,
      resourceId: row.resourceId,
      projectId: row.projectId,
    }))
  ).reduce((sum, session) => sum + session.durationSeconds, 0);
  const studyHours = Math.round((sessionSeconds / 3600) * 10) / 10;

  const attemptPercentages = attemptRows
    .map((row) => row.percentage)
    .filter((value): value is number => value !== null && value >= 0);

  const evidenceByProject = new Map<string, EvidenceEntry[]>();
  for (const entry of evidenceRows) {
    if (entry.deletedAt) continue;
    const list = evidenceByProject.get(entry.projectId) ?? [];
    list.push({
      id: entry.id,
      projectId: entry.projectId,
      kind: entry.kind as EvidenceEntry["kind"],
      value: entry.value ?? "",
      title: entry.title,
      createdAt: (
        entry.createdAt instanceof Date ? entry.createdAt : new Date(entry.createdAt ?? Date.now())
      ).toISOString(),
      selfReported: entry.selfReported,
    });
    evidenceByProject.set(entry.projectId, list);
  }

  const milestonesByProject = new Map<string, MilestoneState[]>();
  for (const row of projectRows) {
    if (!row.milestoneId) continue;
    const list = milestonesByProject.get(row.projectId) ?? [];
    list.push({
      milestoneId: row.milestoneId,
      completed: row.completed,
      evidenceUrl: row.evidenceUrl,
    });
    milestonesByProject.set(row.projectId, list);
  }

  const projectSources = new Map<string, PrivateProjectSource>();
  for (const projectId of profile.publicity.publicProjectIds) {
    const evidence = evidenceByProject.get(projectId) ?? [];
    const states = milestonesByProject.get(projectId) ?? [];
    const selfAssessmentRow = assessmentRows.find((row) => row.projectId === projectId);
    const status = deriveStatus(
      projectId,
      evidence,
      states,
      selfAssessmentRow
      ? { scores: selfAssessmentRow.scores, updatedAt: selfAssessmentRow.updatedAt }
      : null
    );
    projectSources.set(projectId, {
      projectId,
      status,
      evidence: evidence.map((entry) => ({
        id: entry.id,
        kind: entry.kind,
        value: entry.value,
        title: entry.title ?? null,
        selfReported: entry.selfReported,
        deletedAt: null,
      })),
      selfAssessment:
        selfAssessmentRow && selfAssessmentRow.totalEarned !== null
          ? { totalEarned: selfAssessmentRow.totalEarned, totalMax: selfAssessmentRow.totalMax }
          : null,
      repositoryUrl:
        evidence.find((entry) => entry.kind === "github_repo_url")?.value ?? null,
      demoUrl: evidence.find((entry) => entry.kind === "deployment_url")?.value ?? null,
    });
  }

  const assessments =
    attemptPercentages.length > 0
      ? {
          attempts: attemptPercentages.length,
          latestPercentage:
            attemptRows
              .filter((row) => row.percentage !== null)
              .sort((a, b) => compareIso(a.completedAt, b.completedAt))[0]?.percentage ?? null,
        }
      : null;

  // Skills are recomputed server-side from the owner's stored records (§26):
  // the client only controls WHICH skill ids are published, never their values.
  const publicSkills = profile.publicity.visibility.skills
    ? buildPublicSkills(
        skillAnalytics({
          lessonProgress: lessonRows.map((row) => ({
            id: row.id,
            createdAt: (row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt)).toISOString(),
            updatedAt: (row.updatedAt instanceof Date ? row.updatedAt : new Date(row.updatedAt)).toISOString(),
            localRevision: row.localRevision,
            syncStatus: "synced" as const,
            lessonId: row.lessonKey,
            status: row.status,
            readingComplete: row.readingComplete,
            requiredResourcesComplete: row.requiredResourcesComplete,
            practiceComplete: row.practiceComplete,
            projectComplete: row.projectComplete,
            masteryScore: row.masteryScore,
            needsReview: row.needsReview,
            startedAt: row.startedAt
              ? (row.startedAt instanceof Date ? row.startedAt : new Date(row.startedAt)).toISOString()
              : null,
            completedAt: row.completedAt
              ? (row.completedAt instanceof Date ? row.completedAt : new Date(row.completedAt)).toISOString()
              : null,
            masteredAt: row.masteredAt
              ? (row.masteredAt instanceof Date ? row.masteredAt : new Date(row.masteredAt)).toISOString()
              : null,
          })),
          attempts: attemptRows
            .filter((row) => row.percentage !== null && row.submittedAt && row.quizId)
            .map((row) => ({
              assessmentId: row.quizId as string,
              percentage: row.percentage,
              submittedAt: row.submittedAt
                ? (row.submittedAt instanceof Date ? row.submittedAt : new Date(row.submittedAt)).toISOString()
                : null,
              answers: (row.answers ?? {}) as never,
            })),
          projectProgress: [...milestonesByProject.entries()].map(([projectId, states]) => ({
            projectId,
            completed:
              states.length > 0 &&
              states.every((state) => state.completed) &&
              evidenceByProject.has(projectId) &&
              evidenceByProject.get(projectId)!.length > 0,
          })),
        }).skills,
        profile.publicity.publicSkillIds
      )
    : [];

  return buildPublicPortfolio(
    {
      settings: profile.publicity,
      skills: publicSkills.length > 0 ? publicSkills : null,
      achievements: [],
      projectSources,
      canonicalLessonsCompleted: canonicalCompleted,
      careerTrackFromRoadmap: null,
      assessments: assessments
        ? { attempts: assessments.attempts, latestPercentage: assessments.latestPercentage }
        : null,
      studyHours,
    },
    new Date().toISOString()
  );
}

function compareIso(a: Date | string | null, b: Date | string | null): number {
  const av = a instanceof Date ? a.toISOString() : a ?? "";
  const bv = b instanceof Date ? b.toISOString() : b ?? "";
  return av.localeCompare(bv);
}

/** Real Phase 6 status uses the catalog project + the Phase 6 state machine. */
function deriveStatus(
  projectId: string,
  evidence: EvidenceEntry[],
  states: MilestoneState[],
  selfAssessment: { scores: unknown; updatedAt: Date | string } | null
): ProjectStatus {
  const project = projectCatalog.find((entry) => entry.id === projectId);
  if (!project) return "not_started";
  const scores = selfAssessment?.scores as Record<string, number> | undefined;
  const { status } = computeProjectStatus(project, {
    milestoneStates: states,
    evidence,
    selfAssessment:
      scores && selfAssessment
        ? { scores, updatedAt: String(selfAssessment.updatedAt) }
        : null,
  });
  return status;
}
