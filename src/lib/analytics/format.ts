import { dayKeyOf } from "./dates";

/** Absolute day already stored in UTC ISO; display in learner timezone. */
export function formatPeriodAbsolute(iso: string, timeZone: string = "UTC"): string {
  return dayKeyOf(iso, timeZone);
}
