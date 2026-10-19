import { test, expect } from "@playwright/test";
import { generateRoadmapViaOnboarding } from "./roadmap-helpers";

test.describe("Roadmap journey — Progress", () => {
  test("completed lesson reflects on the roadmap", async ({ page }) => {
    await generateRoadmapViaOnboarding(page);

    // 1. Start roadmap lesson.
    await page.getByTestId("start-item").first().click();
    await expect(page.getByTestId("mark-reading-complete")).toBeVisible({ timeout: 30_000 });

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
