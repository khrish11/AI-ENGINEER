import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { KnownTopicsPanel } from "@/components/roadmap/known-topics-panel";
import { defaultSettings } from "@/lib/roadmap/store";
import { generateRoadmap } from "@/lib/roadmap/scheduler";

const KNOWN_ID = "07-transformers-deep-dive/01-why-transformers";

afterEach(cleanup);

function fixture(restored = false) {
  const settings = {
    ...defaultSettings(),
    startDate: "2026-01-05",
    bufferPreference: "none" as const,
    knownOccurrenceIds: [KNOWN_ID],
    manuallyIncluded: restored ? [KNOWN_ID] : [],
  };
  const plan = generateRoadmap({
    trackId: settings.trackId,
    startDate: settings.startDate,
    targetDate: settings.targetDate,
    availableHoursPerWeek: settings.availableHoursPerWeek,
    studyDays: settings.studyDays,
    bufferPreference: settings.bufferPreference,
    includeOptionalTopics: settings.includeOptionalTopics,
    knownOccurrenceIds: settings.knownOccurrenceIds,
    manuallyIncluded: settings.manuallyIncluded,
  }).plan;
  return { plan, settings };
}

describe("KnownTopicsPanel", () => {
  it("exposes the known-topic reason and an accessible exact-occurrence Add back action", async () => {
    const user = userEvent.setup();
    const onAddBack = vi.fn();
    const { plan, settings } = fixture();
    render(
      <KnownTopicsPanel
        plan={plan}
        settings={settings}
        onAddBack={onAddBack}
        onUseKnownExclusion={vi.fn()}
      />
    );

    await user.click(screen.getByText("Review excluded and restored topics"));
    expect(screen.getByText("You already know this — kept out of your plan.")).toBeTruthy();
    const addBack = screen.getByRole("button", { name: /Add back Why Transformers/i });
    addBack.focus();
    await user.keyboard("{Enter}");
    expect(onAddBack).toHaveBeenCalledWith(KNOWN_ID);
  });

  it("shows a persisted manual restoration and lets the user reverse only that override", async () => {
    const user = userEvent.setup();
    const onUseKnownExclusion = vi.fn();
    const { plan, settings } = fixture(true);
    render(
      <KnownTopicsPanel
        plan={plan}
        settings={settings}
        onAddBack={vi.fn()}
        onUseKnownExclusion={onUseKnownExclusion}
      />
    );

    await user.click(screen.getByText("Review excluded and restored topics"));
    expect(screen.getByText("Manually restored to your schedule. Your knowledge declaration is still saved.")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /Use known exclusion for Why Transformers/i }));
    expect(onUseKnownExclusion).toHaveBeenCalledWith(KNOWN_ID);
  });
});
