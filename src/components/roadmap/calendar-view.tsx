"use client";

import Link from "next/link";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { formatMinutes } from "@/lib/roadmap/config";
import { WEEKDAY_SHORT, formatLongDate, todayIso } from "@/lib/roadmap/dates";
import type { CompletionSets } from "@/lib/roadmap/progress";
import type { RoadmapPlan } from "@/lib/roadmap/types";

/** Study-day view of the next few weeks, one row per week. */
export function CalendarView({ plan, completion }: { plan: RoadmapPlan; completion: CompletionSets | null }) {
  const today = todayIso();
  const upcoming = plan.weeks
    .filter((week) => week.endDate >= today)
    .slice(0, 6);

  if (upcoming.length === 0) {
    return <p className="text-sm text-muted-foreground">No upcoming weeks.</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Study days:{" "}
        {plan.studyDays.map((day) => WEEKDAY_SHORT[day]).join(", ") || "not set"} ·{" "}
        {formatMinutes(plan.hoursPerWeek * 60)} per week
      </p>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <caption className="sr-only">Study-day calendar for the next six weeks</caption>
          <thead>
            <tr className="text-left text-muted-foreground">
              <th scope="col" className="border border-border bg-surface px-2 py-1.5 font-semibold">
                Week
              </th>
              {WEEKDAY_SHORT.map((day) => (
                <th scope="col" key={day} className="border border-border bg-surface px-2 py-1.5 font-semibold">
                  {day}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {upcoming.map((week) => (
              <tr key={week.index}>
                <th scope="row" className="border border-border bg-surface px-2 py-1.5 align-top whitespace-nowrap">
                  <span className="block font-semibold text-foreground">W{week.weekNumber}</span>
                  <span className="block text-[10px] font-normal text-muted-foreground">
                    {formatLongDate(week.startDate)}
                  </span>
                  {week.kind === "buffer" && (
                    <Badge variant="warning" className="mt-1 text-[10px]">
                      Buffer
                    </Badge>
                  )}
                </th>
                {WEEKDAY_SHORT.map((_day, dayIndex) => {
                  const items = week.items.filter((item) => item.dayOfWeek === dayIndex);
                  return (
                    <td key={dayIndex} className="border border-border bg-card/40 px-1.5 py-1.5 align-top">
                      {items.map((item) => {
                        const done = completion?.completed.has(item.canonicalLessonKey) ?? false;
                        return (
                          <Link
                            key={`${item.occurrenceId}-${item.part}`}
                            href={`/curriculum/${item.occurrenceId}`}
                            className={`mb-1 block rounded border px-1.5 py-1 transition-colors ${
                              done
                                ? "border-status-success/40 bg-status-success/10 text-muted-foreground line-through"
                                : "border-border bg-surface text-foreground hover:border-accent-cyan/60"
                            }`}
                          >
                            <span className="block truncate">{item.title}</span>
                            <span className="block text-[10px] text-muted-foreground">
                              {formatMinutes(item.allocatedMinutes)}
                              {done ? " · Done" : ""}
                            </span>
                          </Link>
                        );
                      })}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
