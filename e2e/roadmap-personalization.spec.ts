import { test, expect, type Page } from "@playwright/test";
import { isoDateInDays } from "./roadmap-helpers";

/**
 * Reads the persisted roadmap store straight out of IndexedDB so the assertion
 * is about the generated roadmap DATA, not the rendered DOM. Returns the set of
 * occurrence ids the learner declared known (and which therefore must not be
 * scheduled) plus every occurrence id that actually appears in the plan.
 */
async function readRoadmapData(page: Page): Promise<{ known: string[]; scheduled: string[] }> {
  return page.evaluate(() => {
    return new Promise<{ known: string[]; scheduled: string[] }>((resolve, reject) => {
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
                settings?: { knownOccurrenceIds?: string[] };
                plan?: { weeks?: { items?: { occurrenceId: string }[] }[] };
              }
            | undefined;
          const known = state?.settings?.knownOccurrenceIds ?? [];
          const scheduled = (state?.plan?.weeks ?? []).flatMap((week) =>
            (week.items ?? []).map((item) => item.occurrenceId)
          );
          resolve({ known, scheduled });
        };
      };
    });
  });
}

test.describe("Roadmap personalisation — knowledge-aware generation", () => {
  test("topics marked as already known are excluded from the generated roadmap data", async ({
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

    // Step 7 — experience: declare the whole tooling phase as already known.
    // These chips feed the placement engine, which resolves them to canonical
    // occurrence ids that the scheduler must then keep out of the plan.
    // Gate on the step content first so the wizard has committed to this step
    // before interacting (under full-suite CPU contention a click dispatched
    // mid re-render is lost, which strands the page before /roadmap).
    await expect(page.getByRole("heading", { name: "Topics you already know" })).toBeVisible({
      timeout: 30_000,
    });
    for (const chip of ["Python", "Git", "Linux & Shell", "Docker & Containers"]) {
      await page.locator("label").filter({ hasText: chip }).first().click();
    }
    // Positive proof all four declarations landed and React has settled.
    await expect(page.getByText("4 known topics")).toBeVisible({ timeout: 30_000 });

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

    const { known, scheduled } = await readRoadmapData(page);
    const scheduledSet = new Set(scheduled);

    // Core guarantee: no declared-known topic is scheduled as mandatory content.
    for (const occurrenceId of known) {
      expect(scheduledSet.has(occurrenceId)).toBe(false);
    }

    // The declared tooling knowledge must have skipped at least one setup lesson
    // that otherwise appears in a General AI plan.
    expect(known.some((id) => id.startsWith("00-setup-and-tooling/"))).toBe(true);
  });
});
