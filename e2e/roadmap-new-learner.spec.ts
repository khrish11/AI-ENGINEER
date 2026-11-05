import { test, expect } from "@playwright/test";
import { generateRoadmapViaOnboarding } from "./roadmap-helpers";

test.describe("Roadmap journey — New learner", () => {
  test("onboarding wizard generates a deterministic roadmap", async ({ page }) => {
    // 1. Open onboarding.
    await page.goto("/onboarding");
    await expect(page.getByRole("heading", { name: "Build your learning roadmap" })).toBeVisible();

    // 2. Select background.
    await page.locator("label").filter({ hasText: "Software engineer" }).first().click();
    await page.getByRole("button", { name: "Continue" }).click();

    // 3. Steps 2–4 (programming, math, AI/ML) keep default self-assessments.
    for (let step = 0; step < 3; step++) {
      await page.getByRole("button", { name: "Continue" }).click();
    }

    // 4. Select the AI Engineer track.
    await page.locator("label").filter({ hasText: "General AI Engineer" }).first().click();
    await page.getByRole("button", { name: "Continue" }).click();

    // 5. Set 10 hours/week and the timeline.
    await page.getByLabel("Hours per week").fill("10");
    await page.getByRole("button", { name: "Continue" }).click();

    // 6. Continue past placement and select one product plus one deep-build track.
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByTestId("capstone-workload-preview")).toContainText("Your roadmap preview");
    await page.locator("label").filter({ hasText: "Real-Time Voice Assistant" }).click();
    await page.locator("label").filter({ hasText: "Advanced RAG" }).click();

    // 7. Generate the selected roadmap.
    await page.getByTestId("generate-roadmap").click();

    // 7. Verify the current week on /roadmap.
    await page.waitForURL(/\/roadmap/, { timeout: 30_000 });
    await expect(page.getByRole("heading", { name: "Week 1", exact: true })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("start-item").first()).toBeVisible();
    await expect(page.getByText(/of 10h capacity/)).toBeVisible();
  });

  test("capstone choices and preview survive generation and reload", async ({ page }) => {
    await page.goto("/onboarding");
    for (let step = 0; step < 7; step++) {
      await page.getByRole("button", { name: "Continue" }).click();
    }
    const preview = page.getByTestId("capstone-workload-preview");
    await expect(page.getByTestId("preview-core-count")).toHaveText("4");
    await expect(page.getByTestId("preview-optional-count")).toHaveText("0 of 81");
    await expect(page.getByTestId("preview-prerequisite-delta")).toHaveText("0 · 0h");

    await page.getByText("Project details", { exact: true }).first().click();
    await expect(page.getByText("Curriculum description is not available in roadmap metadata.").first()).toBeVisible();

    const initialWorkload = await page.getByTestId("preview-total-workload").textContent();
    await page.locator("label").filter({ hasText: "Real-Time Voice Assistant" }).click();
    await expect(page.getByTestId("preview-optional-count")).toHaveText("1 of 81");
    await expect(page.getByTestId("preview-selection-counts")).toHaveText("1 standalone · 0 tracks");
    await expect(page.getByTestId("preview-total-workload")).not.toHaveText(initialWorkload ?? "");

    await page.getByText("Advanced RAG", { exact: true }).click();
    await expect(page.getByTestId("preview-optional-count")).toHaveText("7 of 81");
    await expect(page.getByTestId("preview-prerequisite-delta")).toHaveText("10 · 15h");

    await page.getByText("Safety harness", { exact: true }).click();
    await expect(page.getByTestId("preview-optional-count")).toHaveText("13 of 81");
    await expect(page.getByTestId("preview-prerequisite-delta")).toHaveText("10 · 15h");
    await page.getByText("Safety harness", { exact: true }).click();
    await expect(page.getByTestId("preview-optional-count")).toHaveText("7 of 81");
    await expect(preview).toContainText("Preliminary estimate");

    await page.getByTestId("generate-roadmap").click();
    await page.waitForURL(/\/roadmap/);
    await page.reload();

    const selection = await page.evaluate(() =>
      new Promise<{ products: string[]; tracks: string[] }>((resolve, reject) => {
        const open = indexedDB.open("aiEngineerOsDb");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const request = open.result.transaction("roadmapState", "readonly").objectStore("roadmapState").getAll();
          request.onerror = () => reject(request.error);
          request.onsuccess = () => {
            const value = request.result[0]?.state?.settings?.capstoneSelection;
            resolve({ products: value?.selectedProductIds ?? [], tracks: value?.selectedTrackIds ?? [] });
          };
        };
      })
    );
    expect(selection.products).toContain("19-capstone-projects/03-realtime-voice-assistant");
    expect(selection.tracks).toContain("advanced-rag");
    expect(selection.tracks).not.toContain("safety");
  });

  test("guest roadmap survives a reload", async ({ page }) => {
    await generateRoadmapViaOnboarding(page);

    await page.reload();
    await expect(page.getByRole("heading", { name: "Week 1", exact: true })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("start-item").first()).toBeVisible();
  });
});
