import { test, expect } from "@playwright/test";
import { generateRoadmapViaOnboarding } from "./roadmap-helpers";

test.describe("Roadmap journey — Track", () => {
  test("compare, switch, and confirm a career track change", async ({ page }) => {
    await generateRoadmapViaOnboarding(page, { trackName: "General AI Engineer" });

    // 1. Open /roadmap/paths.
    await page.goto("/roadmap/paths");
    await expect(page.getByRole("heading", { name: "Career Tracks" })).toBeVisible();

    // 2. Compare two tracks.
    const main = page.getByRole("main");
    await main.getByLabel("First track to compare").selectOption({ label: "LLM Application Engineer" });
    await main.getByLabel("Second track to compare").selectOption({ label: "ML Engineer" });
    await expect(main.getByText("B vs A required hours")).toBeVisible();

    // 3. Switch track.
    // Scope to the live main tree: under full-suite load the router keeps a stale
    // display:none offscreen copy of the catalog mounted briefly after the compare
    // selects update, and an unscoped getByTestId then hits strict mode on 2 nodes
    // (the stale copy renders the button disabled while its store is still loading).
    // getByRole("main") excludes that hidden subtree, so we target the real control.
    await main.getByTestId("switch-track-mlops").click();

    // 4. Preview effect.
    const preview = page.getByRole("dialog", { name: /Switch to MLOps/ });
    await expect(preview).toBeVisible();
    await expect(preview.getByText("Your completed history is preserved")).toBeVisible();

    // 5. Confirm change.
    await preview.getByTestId("confirm-switch-track").click();
    await preview.getByTestId("confirm-switch-track").waitFor({ state: "hidden", timeout: 20_000 });

    // The MLOps card now shows "Current" (its switch button is disabled).
    await expect(main.getByTestId("switch-track-mlops")).toBeDisabled();
    await expect(page.locator("label").filter({ hasText: "MLOps" }).first()).toBeVisible();
  });
});
