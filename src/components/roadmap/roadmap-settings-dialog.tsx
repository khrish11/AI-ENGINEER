"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { occurrenceById } from "@/lib/roadmap/config";
import { todayIso } from "@/lib/roadmap/dates";
import { BUFFER_PREFERENCES, type BufferPreference, type RoadmapSettings } from "@/lib/roadmap/types";

const BUFFER_LABELS: Record<BufferPreference, string> = {
  none: "None",
  monthly: "Monthly",
  manual: "Manual only",
};

export function RoadmapSettingsDialog({
  open,
  onOpenChange,
  settings,
  onSave,
  working,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: RoadmapSettings;
  onSave: (changes: Partial<RoadmapSettings>) => Promise<void>;
  working?: boolean;
}) {
  const [hours, setHours] = React.useState(settings.availableHoursPerWeek);
  const [startDate, setStartDate] = React.useState(settings.startDate);
  const [targetDate, setTargetDate] = React.useState(settings.targetDate ?? "");
  const [bufferPreference, setBufferPreference] = React.useState<BufferPreference>(
    settings.bufferPreference
  );
  const [studyDays, setStudyDays] = React.useState<number[]>(settings.studyDays);
  const [includeOptional, setIncludeOptional] = React.useState(settings.includeOptionalTopics);
  const [newBufferWeek, setNewBufferWeek] = React.useState("");
  const [bufferWeeks, setBufferWeeks] = React.useState<number[]>(settings.bufferWeeks);

  React.useEffect(() => {
    if (!open) return;
    setHours(settings.availableHoursPerWeek);
    setStartDate(settings.startDate);
    setTargetDate(settings.targetDate ?? "");
    setBufferPreference(settings.bufferPreference);
    setStudyDays(settings.studyDays);
    setIncludeOptional(settings.includeOptionalTopics);
    setBufferWeeks(settings.bufferWeeks);
    setNewBufferWeek("");
  }, [open, settings]);

  const excluded = settings.manuallyExcluded
    .map((id) => occurrenceById.get(id)?.title ?? id)
    .slice(0, 40);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-label="Roadmap settings" className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Roadmap settings</DialogTitle>
          <DialogDescription>
            Saving regenerates the remaining schedule. Completed weeks are never changed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1.5 text-sm">
              <span className="font-medium text-foreground">Hours per week</span>
              <Input
                type="number"
                min={1}
                max={40}
                value={hours}
                onChange={(event) => setHours(Number(event.target.value) || 1)}
                aria-label="Hours per week"
              />
            </label>
            <label className="space-y-1.5 text-sm">
              <span className="font-medium text-foreground">Start date</span>
              <Input
                type="date"
                value={startDate}
                min={todayIso()}
                onChange={(event) => setStartDate(event.target.value)}
                aria-label="Start date"
              />
            </label>
            <label className="space-y-1.5 text-sm">
              <span className="font-medium text-foreground">Target date</span>
              <Input
                type="date"
                value={targetDate}
                onChange={(event) => setTargetDate(event.target.value)}
                aria-label="Target completion date"
              />
            </label>
            <fieldset className="space-y-1.5 text-sm">
              <legend className="font-medium text-foreground">Buffer weeks</legend>
              <div className="flex gap-1.5">
                {BUFFER_PREFERENCES.map((option) => (
                  <label
                    key={option}
                    className={`cursor-pointer rounded-md border px-2.5 py-1.5 text-xs transition-colors focus-within:ring-2 focus-within:ring-accent-cyan ${
                      bufferPreference === option
                        ? "border-accent-cyan bg-accent-cyan/10 text-accent-cyan"
                        : "border-border bg-surface text-muted-foreground"
                    }`}
                  >
                    <input
                      type="radio"
                      className="sr-only"
                      name="buffer-preference"
                      checked={bufferPreference === option}
                      onChange={() => setBufferPreference(option)}
                    />
                    {BUFFER_LABELS[option]}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>

          <fieldset className="space-y-1.5 text-sm">
            <legend className="font-medium text-foreground">Study days</legend>
            <div className="flex flex-wrap gap-1.5">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label, day) => (
                <label
                  key={label}
                  className={`cursor-pointer rounded-md border px-2.5 py-1.5 text-xs transition-colors focus-within:ring-2 focus-within:ring-accent-cyan ${
                    studyDays.includes(day)
                      ? "border-accent-cyan bg-accent-cyan/10 text-accent-cyan"
                      : "border-border bg-surface text-muted-foreground"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={studyDays.includes(day)}
                    onChange={() =>
                      setStudyDays((current) =>
                        current.includes(day)
                          ? current.filter((value) => value !== day)
                          : [...current, day].sort((a, b) => a - b)
                      )
                    }
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="space-y-2 text-sm">
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                className="mt-1 accent-cyan-500"
                checked={includeOptional}
                onChange={(event) => setIncludeOptional(event.target.checked)}
              />
              <span>
                Include optional topics
                <span className="block text-xs text-muted-foreground">
                  Optional lessons add depth and lengthen the plan.
                </span>
              </span>
            </label>

            <div className="flex flex-wrap items-end gap-2">
              <label className="text-xs text-muted-foreground">
                <span className="block mb-1">Add buffer / holiday week</span>
                <Input
                  type="number"
                  min={1}
                  placeholder="Week number"
                  value={newBufferWeek}
                  onChange={(event) => setNewBufferWeek(event.target.value)}
                  aria-label="Week number to mark as buffer"
                  className="h-9 w-40"
                />
              </label>
              <Button
                size="sm"
                variant="secondary"
                disabled={newBufferWeek === ""}
                onClick={() => {
                  const value = Number(newBufferWeek);
                  if (!Number.isFinite(value) || value < 1) return;
                  setBufferWeeks((current) =>
                    current.includes(value - 1)
                      ? current
                      : [...current, value - 1].sort((a, b) => a - b)
                  );
                  setNewBufferWeek("");
                }}
              >
                Mark as buffer
              </Button>
              {bufferWeeks.length > 0 && (
                <span className="flex flex-wrap gap-1">
                  {bufferWeeks.map((week) => (
                    <button
                      key={week}
                      type="button"
                      onClick={() => setBufferWeeks((current) => current.filter((value) => value !== week))}
                      className="rounded-full border border-status-warning/50 bg-status-warning/10 px-2 py-0.5 text-[11px] text-status-warning focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan"
                      aria-label={`Remove buffer week ${week + 1}`}
                    >
                      W{week + 1} ✕
                    </button>
                  ))}
                </span>
              )}
            </div>
          </div>

          {excluded.length > 0 && (
            <div className="rounded-lg border border-border bg-surface p-3">
              <p className="text-xs font-semibold text-foreground">
                Excluded from your plan ({excluded.length})
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {excluded.slice(0, 8).join(", ")}
                {excluded.length > 8 ? ` and ${excluded.length - 8} more` : ""}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Restore any lesson from the curriculum view.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={working}>
            Cancel
          </Button>
          <Button
            isLoading={working}
            data-testid="save-roadmap-settings"
            onClick={async () => {
              await onSave({
                availableHoursPerWeek: hours,
                startDate,
                targetDate: targetDate || null,
                bufferPreference,
                studyDays,
                includeOptionalTopics: includeOptional,
                bufferWeeks,
              });
              onOpenChange(false);
            }}
          >
            Save and regenerate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
