import type { RoadmapPlan } from "@/lib/roadmap/types";
import type { StudySession } from "@/lib/progress/db";
import { validSessions } from "./study-time";

/**
 * §15/§16 — roadmap pacing from the real plan (Phase 5) and recorded sessions.
 *
 * Pace status thresholds (documented, neutral wording):
 *   >= +10% of expected workload done → ahead
 *   within ±10% → on_track
 *   -10%..-30% → slightly_behind
 *   < -30% → significantly_behind
 */
export type PaceStatus = "ahead" | "on_track" | "slightly_behind" | "significantly_behind" | "no_plan";

export interface PaceAnalytics {
  status: PaceStatus;
  expectedCompletedWorkloadShare: number | null;
  actualCompletedWorkloadShare: number | null;
  scheduledHoursToToday: number | null;
  actualStudyHours: number | null;
  backlogSize: number;
  projectedCompletion: string | null;
  projectionBasis: {
    averageWeeklyHours: number | null;
    weeklyCapacityHours: number | null;
    remainingRequiredWeeks: number | null;
  } | null;
  explanation: string[];
}

const AHEAD_THRESHOLD = 0.1;
const BEHIND_LIGHT = -0.1;
const BEHIND_HEAVY = -0.3;

export function paceAnalytics(
  plan: RoadmapPlan | null,
  sessions: StudySession[],
  now: Date = new Date()
): PaceAnalytics {
  if (!plan || plan.weeks.length === 0 || plan.summary.totalOccurrences === 0) {
    return {
      status: "no_plan",
      expectedCompletedWorkloadShare: null,
      actualCompletedWorkloadShare: null,
      scheduledHoursToToday: null,
      actualStudyHours: null,
      backlogSize: 0,
      projectedCompletion: null,
      projectionBasis: null,
      explanation: ["Generate a roadmap in /onboarding to see pace analytics."],
    };
  }

  const nowIso = now.toISOString();
  const weeksUpToNow = plan.weeks.filter(
    (week) => week.kind === "study" && week.endDate <= nowIso
  );
  const weeksAfterNow = plan.weeks.filter(
    (week) => week.kind === "study" && week.endDate > nowIso
  );

  // Scheduled workload for weeks that have already ended.
  const scheduledMinutesToToday = weeksUpToNow.reduce(
    (sum, week) => sum + week.scheduledMinutes,
    0
  );

  // Completed share of the whole plan from plan summary (occurrence-based).
  const plannedShare =
    plan.summary.completedOccurrences / Math.max(plan.summary.totalOccurrences, 1);

  // Expected share: fraction of scheduled study weeks elapsed, by elapsed weeks.
  const totalStudyWeeks = plan.weeks.filter((week) => week.kind === "study").length;
  const elapsedStudyWeeks = weeksUpToNow.length;
  const expectedShare =
    totalStudyWeeks > 0 ? Math.min(1, elapsedStudyWeeks / totalStudyWeeks) : 0;

  // backlog: occurrences still scheduled in future weeks after today
  const backlogItems = new Set<string>();
  for (const week of weeksAfterNow) {
    for (const item of week.items) backlogItems.add(item.occurrenceId);
  }
  const backlogSize =
    Math.max(0, plan.summary.scheduledOccurrences - plan.summary.completedOccurrences - backlogItems.size) +
    backlogItems.size; // all future occurrences are owed work

  const sessionsValid = validSessions(sessions);
  const actualStudySeconds = sessionsValid.reduce((sum, session) => sum + session.durationSeconds, 0);
  const completedWorkShare = plannedShare;

  const delta = plannedShare - expectedShare;
  let status: PaceStatus = "on_track";
  if (delta >= AHEAD_THRESHOLD) status = "ahead";
  else if (delta < BEHIND_HEAVY) status = "significantly_behind";
  else if (delta < BEHIND_LIGHT) status = "slightly_behind";

  // Deterministic projection (§16): recent 4-week average pace vs remaining weeks.
  const remainingOccurrences = Math.max(
    0,
    plan.summary.scheduledOccurrences - plan.summary.completedOccurrences
  );
  const recentWindowMs = 28 * 24 * 60 * 60 * 1000;
  const recentStart = new Date(now.getTime() - recentWindowMs).toISOString();
  const recentSessions = sessionsValid.filter((session) => session.startedAt >= recentStart);
  const recentSeconds = recentSessions.reduce((sum, session) => sum + session.durationSeconds, 0);
  const averageWeeklyHours = Math.round((recentSeconds / 4 / 3600) * 100) / 100;

  // Remaining required weeks on the plan (study weeks with items today or later).
  const remainingOccurrencesPerWeek = weeksAfterNow.reduce(
    (count, week) => count + new Set(week.items.map((item) => item.occurrenceId)).size,
    0
  );
  let projectedCompletion: string | null = null;
  const projectionBasis = {
    averageWeeklyHours,
    weeklyCapacityHours: plan.hoursPerWeek,
    remainingRequiredWeeks: weeksAfterNow.length || null,
  };
  const explanation: string[] = [];
  if (remainingOccurrencesPerWeek <= 0 || recentSeconds === 0) {
    explanation.push("Not enough activity to estimate reliably.");
  } else if (averageWeeklyHours <= 0) {
    explanation.push("Not enough activity to estimate reliably.");
  } else {
    // Deterministic extrapolation: remaining occasions consumed at observed pace.
    const lastWeek = plan.weeks[plan.weeks.length - 1];
    const planHorizon = lastWeek ? Date.parse(lastWeek.endDate) : now.getTime();
    const observedSharePerWeek =
      delta >= 0 ? 1 / Math.max(1, elapsedStudyWeeks) : 0;
    void observedSharePerWeek;
    // Use plan hours (capacity) as the stable assumption when recent pace lags.
    const effectiveWeeklyHours = averageWeeklyHours > 0 ? averageWeeklyHours : plan.hoursPerWeek;
    const totalPlanHours = plan.summary.totalMinutes / 60;
    const doneHours = plannedShare * totalPlanHours;
    const remainingHours = Math.max(0, totalPlanHours - doneHours);
    const weeksRemaining = Math.ceil(remainingHours / Math.max(effectiveWeeklyHours, 0.5));
    const projectedMs = Math.max(planHorizon, now.getTime() + weeksRemaining * 7 * 24 * 60 * 60 * 1000);
    projectedCompletion = new Date(projectedMs).toISOString();
    explanation.push(
      `Based on ${averageWeeklyHours}h average study/week (28-day window), ${plan.hoursPerWeek}h planned capacity, and ${remainingOccurrences} occurrences remaining.`
    );
  }

  return {
    status,
    expectedCompletedWorkloadShare: Math.round(expectedShare * 100),
    actualCompletedWorkloadShare: Math.round(completedWorkShare * 100),
    scheduledHoursToToday: Math.round((scheduledMinutesToToday / 60) * 10) / 10,
    actualStudyHours: Math.round((actualStudySeconds / 3600) * 10) / 10,
    backlogSize,
    projectedCompletion,
    projectionBasis,
    explanation,
  };
}
