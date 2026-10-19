import { STREAK_MIN_SESSION_MINUTES } from "./types";
import { dayKeyOf, todayKey, addDaysToKey } from "./dates";
import { validSessions, type ValidSession } from "./study-time";
import type { StudySession } from "@/lib/progress/db";

/**
 * §8 — a study day is a calendar day (in the learner's selected timezone)
 * containing at least one valid study session of at least
 * STREAK_MIN_SESSION_MINUTES minutes. Page visits never count. The same
 * timezone applies to both current and longest streaks.
 */
export interface StreakStats {
  currentStreak: number;
  longestStreak: number;
  qualifies: (daySeconds: number) => boolean;
  minSessionMinutes: number;
}

export function streakStats(
  sessions: StudySession[],
  timeZone: string,
  now: Date = new Date()
): StreakStats {
  return streakStatsFromValidSessions(validSessions(sessions), timeZone, now);
}

export function streakStatsFromValidSessions(
  sessions: ValidSession[],
  timeZone: string,
  now: Date = new Date()
): StreakStats {
  const threshold = STREAK_MIN_SESSION_MINUTES * 60;
  const perDay = new Map<string, number>();
  for (const session of sessions) {
    const day = dayKeyOf(session.startedAt, timeZone);
    perDay.set(day, Math.max(perDay.get(day) ?? 0, 0) + session.durationSeconds);
  }

  // Longest streak over history: walk sorted, distinct qualifying days.
  const qualifyingDays = [...perDay.entries()]
    .filter(([, seconds]) => seconds >= threshold)
    .map(([day]) => day)
    .sort((a, b) => a.localeCompare(b));
  let longest = 0;
  let run = 0;
  let previous: string | null = null;
  for (const day of qualifyingDays) {
    if (previous && addDaysToKey(previous, 1) === day) {
      run += 1;
    } else {
      run = 1;
    }
    previous = day;
    if (run > longest) longest = run;
  }

  // Current streak: walk backwards from today (or yesterday if today has no
  // qualifying session yet — a streak does not break until a full day passes).
  let current = 0;
  let cursor = todayKey(timeZone, now);
  if ((perDay.get(cursor) ?? 0) < threshold) {
    cursor = addDaysToKey(cursor, -1);
  }
  while ((perDay.get(cursor) ?? 0) >= threshold) {
    current += 1;
    cursor = addDaysToKey(cursor, -1);
  }

  return {
    currentStreak: current,
    longestStreak: Math.max(longest, current),
    qualifies: (daySeconds: number) => daySeconds >= threshold,
    minSessionMinutes: STREAK_MIN_SESSION_MINUTES,
  };
}
