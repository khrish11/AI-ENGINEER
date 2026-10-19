import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const routes = [
  "/",
  "/curriculum",
  "/curriculum/00-setup-and-tooling/01-dev-environment",
  "/roadmap",
  "/projects/gradient-descent-visualizer",
  "/practice",
  "/analytics",
  "/settings",
  "/settings/portfolio",
];

test.describe("Accessibility", () => {
  test("critical and serious violations are absent on core routes", async ({ page }) => {
    for (const route of routes) {
      await page.goto(route);
      const results = await new AxeBuilder({ page }).analyze();
      const blocking = results.violations.filter((violation) =>
        violation.impact === "critical" || violation.impact === "serious"
      );
      expect(blocking, `${route} has blocking accessibility violations`).toEqual([]);
    }
  });

  // The default theme is dark. Routes rendered inside PageLayout expose the
  // theme toggle, so verify the light theme too where it is applicable.
  test("critical and serious violations are absent in the light theme", async ({ page }) => {
    const pageLayoutRoutes = routes.filter(
      (route) => route !== "/" && route !== "/settings/portfolio"
    );
    for (const route of pageLayoutRoutes) {
      await page.goto(route);
      await page.getByRole("button", { name: "Switch to light mode" }).click();
      await expect(page.locator("html.light")).toBeAttached();
      const results = await new AxeBuilder({ page }).analyze();
      const blocking = results.violations.filter((violation) =>
        violation.impact === "critical" || violation.impact === "serious"
      );
      expect(blocking, `${route} (light theme) has blocking accessibility violations`).toEqual([]);
    }
  });

  test("keyboard focus and form labels remain usable", async ({ page }) => {
    await page.goto("/settings/portfolio");
    await page.keyboard.press("Tab");
    await expect(page.locator(":focus")).toBeVisible();
    await expect(page.getByRole("main")).toBeVisible();
    await expect(page.getByRole("textbox", { name: /display name/i })).toBeVisible();
  });
});
