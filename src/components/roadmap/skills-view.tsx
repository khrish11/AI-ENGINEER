"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { useSkillProgress } from "@/hooks/useSkillProgress";

type SkillGroups = ReturnType<typeof useSkillProgress>;

const STATUS_LABEL: Record<string, string> = {
  "not-started": "Not started",
  learning: "Learning",
  completed: "Completed",
  mastered: "Mastered",
};

export function SkillsView({ groups, masteredSkills, learningSkills }: SkillGroups) {
  if (groups.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Skills appear here once your track has classified lessons.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
        <Badge variant="outline">{groups.flatMap((group) => group.skills).length} skills tracked</Badge>
        <Badge variant="success">{masteredSkills} mastered</Badge>
        <Badge variant="info">{learningSkills} learning</Badge>
        <span className="self-center">
          Derived from your completed lessons — never stored separately.
        </span>
      </div>

      <div className="space-y-5">
        {groups.map((group) => (
          <section key={group.groupId} aria-labelledby={`skill-group-${group.groupId}`}>
            <h3
              id={`skill-group-${group.groupId}`}
              className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2"
            >
              {group.groupName}
            </h3>
            <ul className="grid gap-2 sm:grid-cols-2">
              {group.skills.map((skill) => (
                <li key={skill.skillId} className="rounded-lg border border-border bg-surface p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-foreground">{skill.skillName}</span>
                    <Badge
                      variant={
                        skill.status === "mastered"
                          ? "success"
                          : skill.status === "completed"
                            ? "default"
                            : skill.status === "learning"
                              ? "info"
                              : "muted"
                      }
                      className="text-[10px]"
                    >
                      {STATUS_LABEL[skill.status]}
                    </Badge>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {skill.coreTotal} core lesson{skill.coreTotal === 1 ? "" : "s"} (
                    {skill.coreCompleted} completed) · {skill.importantTotal} important (
                    {skill.importantCompleted} completed)
                    {skill.masteredCount > 0 ? ` · ${skill.masteredCount} mastered` : ""}
                  </p>
                  <Progress
                    value={skill.percent}
                    className="mt-2 h-1.5"
                    variant={skill.status === "mastered" ? "success" : "cyan"}
                    aria-label={`${skill.skillName}: ${skill.percent}% complete`}
                  />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
