import { test, expect } from "@playwright/test";

test.describe("Navigation", () => {
  test("home page loads", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/AI Engineer OS/);
    // Home hero heading (site title lives in <title>; the h1 is the marketing headline).
    await expect(page.locator("main h1:visible").first()).toContainText(/AI Engineering/i);
  });

  test("navigate to curriculum via sidebar", async ({ page }) => {
    await page.goto("/curriculum");
    await expect(page).toHaveURL(/.*curriculum/);
    await expect(page.locator("main h1:visible").first()).toContainText("Curriculum");
  });

  test("navigate to resources via sidebar", async ({ page }) => {
    await page.goto("/resources");
    await expect(page).toHaveURL(/.*resources/);
    await expect(page.locator("main h1:visible").first()).toContainText("Resources");
  });

  test("navigate to projects via sidebar", async ({ page }) => {
    await page.goto("/projects");
    await expect(page).toHaveURL(/.*projects/);
    await expect(page.locator("main h1:visible").first()).toContainText("Project Studio");
  });

  test("navigate to dashboard via sidebar", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/.*dashboard/);
    await expect(page.locator("main h1:visible").first()).toContainText("Dashboard");
  });

  test("navigate to settings via sidebar", async ({ page }) => {
    await page.goto("/settings");
    await expect(page).toHaveURL(/.*settings/);
    await expect(page.locator("main h1:visible").first()).toContainText("Settings");
  });

  test("theme toggle works", async ({ page }) => {
    await page.goto("/dashboard");
    const html = page.locator("html");
    const initialTheme = await html.getAttribute("class");

    await page.locator('button[aria-label*="Switch to"]').click();
    const newTheme = await html.getAttribute("class");

    expect(initialTheme).not.toBe(newTheme);
  });
});
