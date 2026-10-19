import { test, expect } from "@playwright/test";

test.describe("Curriculum Explorer & Lesson Workspace", () => {
  test("curriculum browser displays phases and stats", async ({ page }) => {
    await page.goto("/curriculum");
    await expect(page).toHaveTitle(/Curriculum/);
    await expect(page.getByRole("heading", { name: "Curriculum Explorer" })).toBeVisible();

    // Check stats badges scoped to the hero section
    await expect(page.getByText(/^\d+ Phases$/).first()).toBeVisible();
    await expect(page.getByText(/^\d+ Lessons$/).first()).toBeVisible();

    // Check phase card
    const phase0 = page.getByText("Phase 00", { exact: false }).first();
    await expect(phase0).toBeVisible();
  });

  test("search filtering filters phases on curriculum page", async ({ page }) => {
    await page.goto("/curriculum");
    const searchInput = page.locator('input[placeholder*="Filter by title, topic"]:visible');
    await expect(searchInput).toBeVisible();

    // Type "Computer" to match Phase 4: Computer Vision
    await searchInput.fill("Computer");
    await expect(page.getByText("Phase 4: Computer Vision", { exact: true })).toBeVisible();
  });

  test("phase detail page loads and shows lessons", async ({ page }) => {
    await page.goto("/curriculum/00-setup-and-tooling");
    await expect(page.locator("h1:visible").first()).toBeVisible();
    await expect(page.getByText(/Phase 00/i).first()).toBeVisible();

    // Upstream attribution banner must be present
    await expect(page.getByText(/rohitg00\/ai-engineering-from-scratch/i)).toBeVisible();

    // Lesson list must be displayed
    await expect(page.getByText(/Lessons/i).first()).toBeVisible();
  });

  test("lesson workspace loads with all 7 tabs and MIT attribution", async ({ page }) => {
    await page.goto("/curriculum/00-setup-and-tooling/01-dev-environment");

    // Header and title
    await expect(
      page.getByRole("heading", { name: "Dev Environment", level: 1 }).first()
    ).toBeVisible();

    // Upstream attribution & license notice
    await expect(page.getByText(/MIT License/i).first()).toBeVisible();

    // Check workspace tabs exist
    await expect(page.getByRole("tab", { name: /Read/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /Videos/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /GitHub/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /Practice/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /Projects/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /Notes/i })).toBeVisible();

    // Switch to Notes tab
    await page.getByRole("tab", { name: /Notes/i }).click();
    await expect(page.getByPlaceholder(/Capture your key takeaways/i)).toBeVisible();

    // Switch to Practice tab
    await page.getByRole("tab", { name: /Practice/i }).click();
    await expect(page.getByRole("heading", { name: "Knowledge Check" })).toBeVisible();
  });
});
