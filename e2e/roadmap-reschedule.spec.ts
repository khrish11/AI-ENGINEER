import { test, expect } from "@playwright/test";
import { generateRoadmapViaOnboarding, completeFirstRoadmapItem } from "./roadmap-helpers";

test.describe("Roadmap journey — Rescheduling", () => {
  // Budget covers the strict progress-controls hydration marker (see
  // roadmap-helpers) on WebKit, where a lesson page's client hydration is
  // measured in tens of seconds. Assertions are unchanged.
  test.setTimeout(240_000);

  test("reschedule keeps completed history and moves remaining work", async ({ page }) => {
    // Start 10 days in the past so unfinished week-1 items become overdue.
    await generateRoadmapViaOnboarding(page, { startDateOffsetDays: -10 });

    // Remember the first scheduled item, then complete it.
    const firstItemTitle = await page.getByTestId("week-item").first().locator("a").first().textContent();
    await completeFirstRoadmapItem(page);
    await page.goto("/roadmap");
    // 1. Missed items collect in the backlog; open reschedule from there.
    await expect(page.getByTestId("backlog-list")).toBeVisible({ timeout: 30_000 });
    await page.getByTestId("open-reschedule").click();
    await expect(page.getByRole("dialog", { name: "Reschedule the remaining plan" })).toBeVisible();

    // 2. Move remaining work: lower weekly capacity so the rest replans.
    await page.getByLabel("Hours per week").last().fill("8");
    await page.getByTestId("apply-reschedule").click();

    // 3. Dialog closes, plan recomputes, and historical completion is unchanged:
    // the completed lesson must not reappear in the rescheduled work.
    await expect(page.getByTestId("backlog-list")).toBeVisible({ timeout: 30_000 });
    const scheduled = page.getByTestId("week-item");
    await expect(scheduled.first()).toBeVisible({ timeout: 30_000 });
    await expect(scheduled.filter({ hasText: firstItemTitle ?? "" })).toHaveCount(0);
  });
});
