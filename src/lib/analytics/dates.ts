/**
 * Timezone-aware day-key helpers (§42, §8).
 *
 * All timestamps are stored in UTC. Analytics buckets are computed with
 * `Intl.DateTimeFormat` against an explicit IANA timezone (learner-selected or
 * UTC by default), so a session at 23:30 UTC lands in the learner's calendar
 * day when that is their timezone. Streaks apply the same timezone consistently.
 *
 * Formatters and day-key computations are memoized per timezone: benchmarks on
 * 5,000-session datasets showed re-constructing the formatter per call was the
 * single largest analytics cost (§54). Memoization is bounded per process and
 * safe because day-key results are pure functions of (timestamp, timezone).
 */

const KEY_CACHE_LIMIT = 60_000;
const formatterCache = new Map<string, Intl.DateTimeFormat>();
const dayKeyCache = new Map<string, string>(); // `${timeZone}|${timestamp}` -> key

function invalidTimeZone(timeZone: string): boolean {
  try {
    getFormatter(timeZone);
    return false;
  } catch {
    return true;
  }
}

function getFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatterCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: String(timeZone),
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    formatterCache.set(timeZone, formatter);
  }
  return formatter;
}

export function dayKeyOf(timestamp: string, timeZone: string): string {
  const memoKey = `${timeZone}|${timestamp}`;
  const cached = dayKeyCache.get(memoKey);
  if (cached !== undefined) return cached;

  let key: string;
  if (!timeZone || invalidTimeZone(timeZone)) {
    key = timestamp.slice(0, 10);
  } else {
    try {
      key = getFormatter(timeZone).format(new Date(timestamp));
    } catch {
      key = timestamp.slice(0, 10);
    }
  }

  if (dayKeyCache.size < KEY_CACHE_LIMIT) {
    dayKeyCache.set(memoKey, key);
  }
  return key;
}

/** Today's local day key in the given timezone. */
export function todayKey(timeZone: string, now: Date = new Date()): string {
  return dayKeyOf(now.toISOString(), timeZone);
}

/** Adds calendar days to a day key (YYYY-MM-DD), unambiguous in any timezone. */
export function addDaysToKey(key: string, days: number): string {
  const date = new Date(`${key}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export interface DayBucket {
  day: string;
  seconds: number;
  sessions: number;
}

/** Buckets sessions into timezone-aware calendar days, sorted ascending. */
export function bucketSessionsByDay(
  sessions: Array<{ startedAt: string; durationSeconds: number; clientSessionId: string }>,
  timeZone: string
): DayBucket[] {
  const buckets = new Map<string, DayBucket>();
  for (const session of sessions) {
    const day = dayKeyOf(session.startedAt, timeZone);
    const bucket = buckets.get(day) ?? { day, seconds: 0, sessions: 0 };
    bucket.seconds += session.durationSeconds;
    bucket.sessions += 1;
    buckets.set(day, bucket);
  }
  return [...buckets.values()].sort((a, b) => a.day.localeCompare(b.day));
}

export function inPeriod(timestamp: string | null, start: string): boolean {
  if (!timestamp) return false;
  return timestamp >= start;
}
