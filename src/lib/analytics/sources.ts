import { db } from "@/lib/progress/db";
import type { AnalyticsSources } from "./types";
import { roadmapStateRepo } from "@/lib/progress/repositories/roadmap-state";
import { RoadmapPlanSchema, RoadmapStoreSchema, type RoadmapPlan } from "@/lib/roadmap/types";

/**
 * §2 — the single adapter from stored learner records to analytics inputs.
 * Guests and authenticated users read from the same local-first store
 * (Dexie); nothing here touches duplicated counters.
 */
export type Sources = AnalyticsSources;

/**
 * roadmap_state.state stores a RoadmapStore ({ plan, profile, overrides… }),
 * not a bare RoadmapPlan. Unwrap .plan and validate so malformed/partial
 * records degrade to "no plan" instead of crashing pace analytics.
 */
export function parseStoredRoadmapPlan(state: unknown): RoadmapPlan | null {
  if (state === null || typeof state !== "object") return null;
  const store = RoadmapStoreSchema.safeParse(state);
  if (store.success) return store.data.plan;
  const bare = RoadmapPlanSchema.safeParse(state);
  return bare.success ? bare.data : null;
}

export interface AnalyticsBundle {
  lessons: AnalyticsSources["lessons"];
  resources: AnalyticsSources["resources"];
  studySessions: AnalyticsSources["studySessions"];
  quizAttempts: AnalyticsSources["quizAttempts"];
  projectProgress: AnalyticsSources["projectProgress"];
  projectEvidence: AnalyticsSources["projectEvidence"];
  projectSelfAssessments: AnalyticsSources["projectSelfAssessments"];
  roadmapPlan: RoadmapPlan | null;
}

export async function sourcesFromDb(bundle: AnalyticsBundle): Promise<AnalyticsSources> {
  return bundle;
}

export async function loadAnalyticsBundle(): Promise<AnalyticsBundle> {
  const [lessons, resources, studySessions, quizAttempts, projectProgress, projectEvidence, projectSelfAssessments] =
    await Promise.all([
      db.lessonProgress.toArray(),
      db.resourceProgress.toArray(),
      db.studySessions.toArray(),
      db.quizAttempts.toArray(),
      db.projectProgress.toArray(),
      db.projectEvidence.toArray(),
      db.projectSelfAssessments.toArray(),
    ]);
  const roadmapRecord = await roadmapStateRepo.get();
  const roadmapPlan = parseStoredRoadmapPlan(roadmapRecord?.state);
  return {
    lessons,
    resources,
    studySessions,
    quizAttempts,
    projectProgress,
    projectEvidence,
    projectSelfAssessments,
    roadmapPlan,
  };
}
