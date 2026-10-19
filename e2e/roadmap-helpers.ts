import { expect, type Page } from "@playwright/test";

/** ISO date (YYYY-MM-DD) `days` days from now, local-noon based to avoid DST flips. */
export function isoDateInDays(days: number): string {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * Walks the 7-step onboarding wizard with deterministic inputs and generates a
 * roadmap. Returns the track name that was selected.
 */
export async function generateRoadmapViaOnboarding(
  page: Page,
  opts: { trackName?: string; hoursPerWeek?: string; startDateOffsetDays?: number } = {}
): Promise<string> {
  const trackName = opts.trackName ?? "General AI Engineer";
  const hoursPerWeek = opts.hoursPerWeek ?? "10";

  await page.goto("/onboarding");
  await expect(page.getByRole("heading", { name: "Build your learning roadmap" })).toBeVisible();

  // Step 1 — Background: choose explicitly (default is also valid).
  await page.locator("label").filter({ hasText: "Software engineer" }).first().click();
  await page.getByRole("button", { name: "Continue" }).click();

  // Steps 2–4 (Programming, Mathematics, AI & ML) keep the default levels.
  for (let step = 0; step < 3; step++) {
    await page.getByRole("button", { name: "Continue" }).click();
  }

  // Step 5 — Goal: pick the career track.
  await page.locator("label").filter({ hasText: trackName }).first().click();
  await page.getByRole("button", { name: "Continue" }).click();

  // Step 6 — Schedule.
  await page.getByLabel("Hours per week").fill(hoursPerWeek);
  await page
    .getByLabel("Start date")
    .fill(isoDateInDays(opts.startDateOffsetDays ?? 0));
  await page.getByLabel("Target completion date", { exact: false }).fill(isoDateInDays(120));
  await page.getByRole("button", { name: "Continue" }).click();

  // Step 7 — Experience: skip placement, generate directly.
  await page.getByTestId("generate-roadmap").click();

  await page.waitForURL(/\/roadmap/, { timeout: 30_000 });
  // The current-week card shows a "Week N" heading whose N depends on the start date.
  await expect(
    page.getByRole("heading", { level: 3, name: /^Week \d+$/ })
  ).toBeVisible({ timeout: 30_000 });
  return trackName;
}

/**
 * Opens the first scheduled roadmap item and, where the lesson offers them,
 * marks reading/lesson/resources/practice/project complete locally.
 */
export async function completeFirstRoadmapItem(page: Page): Promise<void> {
  await page.getByTestId("start-item").first().click();
  await expect(page.getByTestId("mark-reading-complete")).toBeVisible({ timeout: 30_000 });
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
      // Control not offered for this lesson — that is expected.
    }
  }
}
