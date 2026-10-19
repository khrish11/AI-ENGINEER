import { bucketSessionsByDay, inPeriod } from "./dates";
import type { StudySession } from "@/lib/progress/db";

/**
 * §7 — study-time analytics from immutable study-session records.
 * Sessions with a missing end or a negative duration are invalid and ignored.
 * Exact duplicates (same clientSessionId) are never counted twice.
 */
export const MIN_VALID_SESSION_SECONDS = 60;

export interface ValidSession {
  clientSessionId: string;
  startedAt: string;
  durationSeconds: number;
  lessonId: string | null;
  resourceId: string | null;
  projectId: string | null;
}

export function validSessions(sessions: StudySession[]): ValidSession[] {
  const seen = new Set<string>();
  const result: ValidSession[] = [];
  for (const session of sessions) {
    if (!session.startedAt) continue;
    const started = Date.parse(session.startedAt);
    if (!Number.isFinite(started)) continue;
    if (session.durationSeconds === null || session.durationSeconds < MIN_VALID_SESSION_SECONDS) continue;
    if (seen.has(session.clientSessionId)) continue;
    seen.add(session.clientSessionId);
    result.push({
      clientSessionId: session.clientSessionId,
      startedAt: session.startedAt,
      durationSeconds: session.durationSeconds,
      lessonId: session.lessonId,
      resourceId: session.resourceId,
      projectId: session.projectId,
    });
  }
  return result;
}

function medianSeconds(durations: number[]): number {
  if (durations.length === 0) return 0;
  const sorted = [...durations].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid];
}

export interface StudyTimeStats {
  totalSeconds: number;
  averageWeeklySeconds: number;
  medianSessionSeconds: number;
  longestSessionSeconds: number;
  studyDays: number;
  sessionCount: number;
  daily: Array<{ day: string; seconds: number }>;
}

/**
 * §7 totals. Overlapping windows of the same session are not double-counted
 * because each calendar-day bucket accumulates each session exactly once.
 */
export function studyTimeStats(
  sessions: StudySession[],
  timeZone: string,
  options: { periodStart?: string; now?: Date } = {}
): StudyTimeStats {
  const periodStart = options.periodStart ?? "0000-01-01T00:00:00.000Z";
  return studyTimeStatsFromValidSessions(
    validSessions(sessions).filter((session) => inPeriod(session.startedAt, periodStart)),
    timeZone,
    options
  );
}

export function studyTimeStatsFromValidSessions(
  valid: ValidSession[],
  timeZone: string,
  options: { now?: Date } = {}
): StudyTimeStats {

  const daily = bucketSessionsByDay(valid, timeZone).map((bucket) => ({
    day: bucket.day,
    seconds: bucket.seconds,
  }));
  const totalSeconds = daily.reduce((sum, bucket) => sum + bucket.seconds, 0);

  // Average weekly study time: total spread over the weeks spanned by the data
  // (at least one), using the first and last study day.
  const days = daily.length;
  let averageWeeklySeconds = 0;
  if (days > 0) {
    const first = Date.parse(`${daily[0].day}T00:00:00Z`);
    const lastRaw = options.now ?? new Date();
    const last = Math.max(
      first + 7 * 24 * 60 * 60 * 1000 - 1,
      Date.parse(`${daily[days - 1].day}T12:00:00Z`)
    );
    const nowMs = Date.parse(lastRaw.toISOString());
    const spanMs = Math.max(last, nowMs) - first;
    const weeks = Math.max(1, spanMs / (7 * 24 * 60 * 60 * 1000));
    averageWeeklySeconds = Math.round(totalSeconds / weeks);
  }

  return {
    totalSeconds,
    averageWeeklySeconds,
    medianSessionSeconds: medianSeconds(valid.map((s) => s.durationSeconds)),
    longestSessionSeconds: valid.reduce((max, s) => Math.max(max, s.durationSeconds), 0),
    studyDays: days,
    sessionCount: valid.length,
    daily,
  };
}

/** Study seconds grouped by dimension (phase / project / resource type). */
export type StudyTimeByDimension = Array<{ key: string; seconds: number }>;

export function studyTimeByDimension(
  sessions: StudySession[],
  dimension: (session: ValidSession) => string,
  timeZone: string,
  options: { periodStart?: string } = {}
): StudyTimeByDimension {
  const periodStart = options.periodStart ?? "0000-01-01T00:00:00.000Z";
  const valid = validSessions(sessions).filter((session) => inPeriod(session.startedAt, periodStart));
  const totals = new Map<string, number>();
  for (const session of valid) {
    const key = dimension(session);
    totals.set(key, (totals.get(key) ?? 0) + session.durationSeconds);
  }
  return [...totals.entries()]
    .map(([key, seconds]) => ({ key, seconds }))
    .sort((a, b) => b.seconds - a.seconds);
}
