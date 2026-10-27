import { test, expect } from "@playwright/test";
import { generateRoadmapViaOnboarding } from "./roadmap-helpers";

test.describe("Roadmap journey — Progress", () => {
  // The hydration marker gate is a strict contract (mounted + auth + progress
  // read settled); on WebKit a lesson page's client hydration can take tens of
  // seconds, so both the gate budget and the test budget are sized to the
  // slowest supported engine. No assertion is relaxed and nothing retries.
  test.describe.configure({ timeout: 180_000 });

  test("completed lesson reflects on the roadmap", async ({ page }) => {
    await generateRoadmapViaOnboarding(page);

    // 1. Start roadmap lesson.
    await page.getByTestId("start-item").first().click();
    await expect(page.getByTestId("mark-reading-complete")).toBeVisible({ timeout: 30_000 });
    // Hydration marker gate: SSR buttons accept no clicks until the controls
    // component mounts (see BUG-04 loading-window notes on the progress UI).
    await expect(
      page.getByTestId("mark-reading-complete").locator("xpath=ancestor::*[@data-progress-hydrated]")
    ).toBeVisible({ timeout: 60_000 });
    // Deterministic point: auth status resolved (guest banner only ever renders
    // for genuinely unauthenticated visitors — see BUG-006 loading gate).
    await expect(page.getByRole("link", { name: "Sign in with Google" })).toBeHidden();

    // 2. Mark lesson progress (all controls the lesson offers).
    await page.getByTestId("mark-reading-complete").click();
    for (const testId of [
      "mark-lesson-complete",
      "mark-resources-complete",
      "mark-practice-complete",
      "mark-project-complete",
    ]) {
      try {
        await page.getByTestId(testId).click({ timeout: 4_000 });
      } catch {
        // Control not offered for this lesson — expected.
      }
    }
    await expect(page.getByTestId("lesson-status")).toContainText(/Complete/i, {
      timeout: 10_000,
    });

    // 3. Return roadmap.
    await page.goto("/roadmap");

    // 4. Item reflects completion.
    await expect(page.getByText(/Completed this week/)).toBeVisible({ timeout: 30_000 });
  });
});
