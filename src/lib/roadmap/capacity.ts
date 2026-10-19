import { formatHours } from "./config";
import { daysBetween, addDays } from "./dates";
import type { BufferPreference, CapacityAnalysis, Feasibility } from "./types";

export interface CapacityInput {
  requiredMinutes: number;
  hoursPerWeek: number;
  startDate: string;
  targetDate: string | null;
  bufferPreference: BufferPreference;
  manualBufferWeeks?: number[];
  automaticBufferEvery?: number;
}

const DEFAULT_BUFFER_EVERY = 4;

export function bufferWeekIndexes(
  weeks: number,
  preference: BufferPreference,
  manualWeeks: number[] = [],
  every: number = DEFAULT_BUFFER_EVERY
): number[] {
  if (preference === "none" && manualWeeks.length === 0) return [];
  const indexes = new Set<number>();
  if (preference === "monthly") {
    for (let index = 0; index < weeks; index += 1) {
      if ((index + 1) % every === 0) indexes.add(index);
    }
  }
  for (const index of manualWeeks) {
    if (index >= 0) indexes.add(index);
  }
  return [...indexes].sort((a, b) => a - b);
}

export function countBufferWeeks(
  weeks: number,
  preference: BufferPreference,
  manualWeeks: number[] = [],
  every: number = DEFAULT_BUFFER_EVERY
): number {
  return bufferWeekIndexes(weeks, preference, manualWeeks, every).length;
}

function feasibilityFor(ratio: number): Feasibility {
  if (ratio <= 0.6) return "comfortable";
  if (ratio <= 1) return "achievable";
  if (ratio <= 1.15) return "tight";
  return "unrealistic";
}

/**
 * With no deadline the plan must absorb its own buffer weeks: find the
 * smallest total week count whose study weeks actually cover the workload.
 */
function weeksRequiredFor(
  weeklyMinutes: number,
  requiredMinutes: number,
  input: CapacityInput
): number {
  let weeks = Math.max(1, Math.ceil(requiredMinutes / weeklyMinutes));
  for (let guard = 0; guard < 1000; guard += 1) {
    const buffers = countBufferWeeks(
      weeks,
      input.bufferPreference,
      input.manualBufferWeeks ?? [],
      input.automaticBufferEvery ?? DEFAULT_BUFFER_EVERY
    );
    if ((weeks - buffers) * weeklyMinutes >= requiredMinutes) return weeks;
    weeks += 1;
  }
  return weeks;
}

export function analyzeCapacity(input: CapacityInput): CapacityAnalysis {
  const weeklyMinutes = Math.max(1, Math.round(input.hoursPerWeek * 60));
  const requiredMinutes = Math.max(0, Math.round(input.requiredMinutes));
  const requiredWeeks = Math.max(1, Math.ceil(requiredMinutes / weeklyMinutes));

  const availableWeeks = input.targetDate
    ? Math.max(0, Math.floor(daysBetween(input.startDate, input.targetDate) / 7))
    : weeksRequiredFor(weeklyMinutes, requiredMinutes, input);

  const buffers = countBufferWeeks(
    availableWeeks,
    input.bufferPreference,
    input.manualBufferWeeks ?? [],
    input.automaticBufferEvery ?? DEFAULT_BUFFER_EVERY
  );
  const studyWeeks = Math.max(0, availableWeeks - buffers);
  const availableMinutes = studyWeeks * weeklyMinutes;
  const differenceMinutes = availableMinutes - requiredMinutes;
  const ratio = availableMinutes === 0 ? Number.POSITIVE_INFINITY : requiredMinutes / availableMinutes;
  const feasibility = feasibilityFor(ratio);
  const shortfallMinutes = Math.max(0, requiredMinutes - availableMinutes);

  const options: string[] = [];
  if (feasibility !== "comfortable" && feasibility !== "achievable") {
    const extraHoursPerWeek = Math.ceil(
      (requiredMinutes / Math.max(1, studyWeeks) - weeklyMinutes) / 60
    );
    if (extraHoursPerWeek > 0) {
      options.push(`Increase weekly study time by about ${extraHoursPerWeek}h to fit the deadline.`);
    }
    const extraWeeks = Math.ceil(shortfallMinutes / weeklyMinutes);
    if (extraWeeks > 0) {
      options.push(`Extend the deadline by about ${extraWeeks} week${extraWeeks === 1 ? "" : "s"}.`);
    }
    options.push("Drop optional topics to reduce the required workload.");
    if (input.bufferPreference !== "none") {
      options.push("Remove buffer weeks for this plan.");
    }
  }

  return {
    requiredMinutes,
    availableMinutes,
    differenceMinutes,
    feasibility,
    studyWeeks,
    weeklyMinutes,
    requiredWeeks,
    options,
    shortfallMinutes,
  };
}

export function projectedEndDate(
  startDate: string,
  weeksUsed: number
): string {
  if (weeksUsed <= 0) return startDate;
  return addDays(startDate, weeksUsed * 7 - 1);
}

export function paceStatus(
  planCompletedMinutes: number,
  planTotalMinutes: number,
  elapsedWeeks: number,
  totalWeeks: number
): "ahead" | "on-track" | "behind" {
  if (totalWeeks <= 0) return "on-track";
  const expected = (elapsedWeeks / totalWeeks) * planTotalMinutes;
  const delta = planCompletedMinutes - expected;
  if (delta >= planTotalMinutes * 0.05) return "ahead";
  if (delta <= -planTotalMinutes * 0.05) return "behind";
  return "on-track";
}

export function capacitySummary(analysis: CapacityAnalysis): string {
  return `Required ${formatHours(analysis.requiredMinutes)} · available ${formatHours(
    analysis.availableMinutes
  )} · ${analysis.feasibility}`;
}
