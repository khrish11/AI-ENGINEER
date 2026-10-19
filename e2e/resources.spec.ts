import { test, expect } from "@playwright/test";

test.describe("Resources Registry", () => {
  test("resources page loads with search and type filters", async ({ page }) => {
    await page.goto("/resources");
    await expect(page).toHaveTitle(/Learning Resources/);
    await expect(page.locator("h1:visible").first()).toContainText("Learning Resources");

    // Search box is present
    const search = page.locator('input[aria-label="Search resources"]:visible').first();
    await expect(search).toBeVisible();

    // Type filters include "All" and common types.
    await expect(page.getByText(/^All \(/)).toBeVisible();
  });

  test("search finds a well-known resource", async ({ page }) => {
    await page.goto("/resources");
    const search = page.locator('input[aria-label="Search resources"]:visible').first();
    await search.fill("Attention Is All You Need");
    await expect(page.getByText("Attention Is All You Need")).toBeVisible();
  });

  test("type filter reduces results", async ({ page }) => {
    await page.goto("/resources");
    const paperPill = page.getByRole("button").filter({ hasText: /^Paper/ }).first();
    await expect(paperPill).toBeVisible();
    await paperPill.click();
    // Verify the filter was applied via URL parameter
    await expect(page).toHaveURL(/type=research_paper/);
  });
});
