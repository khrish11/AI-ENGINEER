import { test, expect, type Page } from "@playwright/test";
import { isoDateInDays } from "./roadmap-helpers";

/**
 * Reads the persisted roadmap store straight out of IndexedDB so the assertion
 * is about the generated roadmap DATA, not the rendered DOM. Returns the set of
 * occurrence ids the learner declared known (and which therefore must not be
 * scheduled) plus every occurrence id that actually appears in the plan.
 */
async function readRoadmapData(page: Page): Promise<{
  known: string[];
  manuallyIncluded: string[];
  scheduled: string[];
  totalMinutes: number;
}> {
  return page.evaluate(() => {
    return new Promise<{
      known: string[];
      manuallyIncluded: string[];
      scheduled: string[];
      totalMinutes: number;
    }>((resolve, reject) => {
      const open = indexedDB.open("aiEngineerOsDb");
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const idb = open.result;
        const tx = idb.transaction("roadmapState", "readonly");
        const getAll = tx.objectStore("roadmapState").getAll();
        getAll.onerror = () => reject(getAll.error);
        getAll.onsuccess = () => {
          const record = (getAll.result as { state?: Record<string, never> }[])[0];
          const state = record?.state as
            | {
                settings?: { knownOccurrenceIds?: string[]; manuallyIncluded?: string[] };
                plan?: {
                  weeks?: { items?: { occurrenceId: string }[] }[];
                  summary?: { totalMinutes?: number };
                };
              }
            | undefined;
          const known = state?.settings?.knownOccurrenceIds ?? [];
          const manuallyIncluded = state?.settings?.manuallyIncluded ?? [];
          const scheduled = (state?.plan?.weeks ?? []).flatMap((week) =>
            (week.items ?? []).map((item) => item.occurrenceId)
          );
          resolve({
            known,
            manuallyIncluded,
            scheduled,
            totalMinutes: state?.plan?.summary?.totalMinutes ?? 0,
          });
        };
      };
    });
  });
}

test.describe("Roadmap personalisation — knowledge-aware generation", () => {
  test("a later-phase known topic can be added back, persisted, and excluded again", async ({
    page,
  }) => {
    await page.goto("/onboarding");
    await expect(page.getByRole("heading", { name: "Build your learning roadmap" })).toBeVisible();

    // Step 1 — background.
    await page.locator("label").filter({ hasText: "Software engineer" }).first().click();
    await page.getByRole("button", { name: "Continue" }).click();

    // Steps 2–4 keep default self-assessment levels.
    for (let i = 0; i < 3; i++) {
      await page.getByRole("button", { name: "Continue" }).click();
    }

    // Step 5 — goal track.
    await page.locator("label").filter({ hasText: "General AI Engineer" }).first().click();
    await page.getByRole("button", { name: "Continue" }).click();

    // Step 6 — schedule.
    await page.getByLabel("Hours per week").fill("10");
    await page.getByLabel("Start date").fill(isoDateInDays(0));
    await page.getByRole("button", { name: "Continue" }).click();

    // Step 7 — declare later-phase Transformer and Attention knowledge.
    // Gate on the step content first so the wizard has committed to this step
    // before interacting (under full-suite CPU contention a click dispatched
    // mid re-render is lost, which strands the page before /roadmap).
    await expect(page.getByRole("heading", { name: "Topics you already know" })).toBeVisible({
      timeout: 30_000,
    });
    for (const chip of ["Transformer Architecture", "Attention"]) {
      await page.locator("label").filter({ hasText: chip }).first().click();
    }
    // Positive proof both declarations landed and React has settled.
    await expect(page.getByText("2 known topics")).toBeVisible({ timeout: 30_000 });

    const generate = page.getByTestId("generate-roadmap");
    await expect(generate).toBeEnabled({ timeout: 10_000 });
    await generate.click();
    await page.waitForURL(/\/roadmap/, { timeout: 30_000 });
    await expect(page.getByRole("heading", { level: 3, name: /^Week \d+$/ })).toBeVisible({
      timeout: 30_000,
    });

    // Inspect the actual persisted roadmap data (not the render).
    await expect
      .poll(async () => (await readRoadmapData(page)).known.length, { timeout: 15_000 })
      .toBeGreaterThan(0);

    const baseline = await readRoadmapData(page);
    const { known, scheduled } = baseline;
    const scheduledSet = new Set(scheduled);

    // Core guarantee: no declared-known topic is scheduled as mandatory content.
    for (const occurrenceId of known) {
      expect(scheduledSet.has(occurrenceId)).toBe(false);
    }

    const laterPhaseId = "07-transformers-deep-dive/01-why-transformers";
    expect(known).toContain(laterPhaseId);

    // Use the visible, keyboard-accessible roadmap control rather than calling
    // scheduler internals. The exact occurrence is restored; knowledge stays saved.
    const knownPanel = page.getByTestId("known-topics-panel");
    await knownPanel.locator("summary").click();
    await knownPanel.getByRole("button", { name: /Add back Why Transformers/i }).click();
    await expect
      .poll(async () => {
        const state = await readRoadmapData(page);
        return {
          scheduled: state.scheduled.includes(laterPhaseId),
          manual: state.manuallyIncluded.includes(laterPhaseId),
          known: state.known.includes(laterPhaseId),
          minutes: state.totalMinutes,
        };
      })
      .toEqual({ scheduled: true, manual: true, known: true, minutes: baseline.totalMinutes + 45 });

    await page.reload();
    const reloadedPanel = page.getByTestId("known-topics-panel");
    await reloadedPanel.locator("summary").click();
    await expect(reloadedPanel.getByText("Manually restored to your schedule. Your knowledge declaration is still saved.")).toBeVisible();

    // Reversing the override restores the known exclusion without changing the
    // learner's declared knowledge.
    await reloadedPanel
      .getByRole("button", { name: /Use known exclusion for Why Transformers/i })
      .click();
    await expect
      .poll(async () => {
        const state = await readRoadmapData(page);
        return {
          scheduled: state.scheduled.includes(laterPhaseId),
          manual: state.manuallyIncluded.includes(laterPhaseId),
          known: state.known.includes(laterPhaseId),
          minutes: state.totalMinutes,
        };
      })
      .toEqual({ scheduled: false, manual: false, known: true, minutes: baseline.totalMinutes });
  });
});
