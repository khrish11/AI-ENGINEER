import { test, expect, type Page } from "@playwright/test";

const LESSON_URL = "/curriculum/00-setup-and-tooling/01-dev-environment";

test.describe.configure({ timeout: 120_000 });

async function openLesson(page: Page, url: string = LESSON_URL) {
  await page.goto(url);
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  await expect(page.getByRole("main").getByTestId("mark-reading-complete")).toBeVisible({
    timeout: 30_000,
  });
}

async function waitForAutosave(page: Page) {
  // The notes editor autosaves on an 800ms debounce.
  await page.waitForTimeout(1400);
}

test.describe("Guest learner persistence", () => {
  test("marks reading, keeps a note and a bookmark across reloads", async ({ page }) => {
    await openLesson(page);

    const main = page.getByRole("main");
    await expect(main.getByTestId("lesson-status")).toHaveText("Not Started");
    await main.getByTestId("mark-reading-complete").click();
    await expect(main.getByTestId("lesson-status")).not.toHaveText("Not Started");
    await expect(page.getByRole("button", { name: "Reading complete", exact: true }).first()).toBeVisible();

    // Notes autosave locally with a debounce.
    await page.getByRole("tab", { name: /Notes/i }).click();
    const editor = page.getByTestId("notes-editor");
    await editor.fill("Guest note that must survive a reload.");
    await waitForAutosave(page);
    await expect(page.getByText(/characters/)).toBeVisible();

    // Bookmark from the workspace header.
    await page.getByTestId("bookmark-lesson").first().click();
    await expect(page.getByRole("button", { name: "Bookmarked", exact: true }).first()).toBeVisible();

    await page.reload();
    await expect(page.getByRole("main").getByTestId("lesson-status")).not.toHaveText("Not Started");
    await expect(page.getByRole("button", { name: "Reading complete", exact: true }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Bookmarked", exact: true }).first()).toBeVisible();

    await page.getByRole("tab", { name: /Notes/i }).click();
    await expect(page.getByTestId("notes-editor")).toHaveValue(
      "Guest note that must survive a reload."
    );
  });

  test("persists resource progress manually", async ({ page }) => {
    // This lesson has a curated video, repository and documentation.
    await openLesson(page, "/curriculum/00-setup-and-tooling/07-docker-for-ai");
    await page.getByRole("tab", { name: /Resources/i }).click();

    const markWatched = page.getByTestId("mark-watched").first();
    await expect(markWatched).toBeVisible();
    await markWatched.click();
    await expect(page.getByText("Completed").first()).toBeVisible();

    await page.reload();
    await page.getByRole("tab", { name: /Resources/i }).click();
    await expect(page.getByText("Completed").first()).toBeVisible();
  });
});

test.describe("Saved items", () => {
  test("bookmark, filter, remove and keep the removal after reload", async ({ page }) => {
    await openLesson(page);
    await page.getByTestId("bookmark-lesson").first().click();
    await expect(page.getByRole("button", { name: "Bookmarked", exact: true }).first()).toBeVisible();

    await page.goto("/saved");
    await expect(page.getByTestId("saved-item")).toHaveCount(1);
    await page.getByRole("button", { name: /^Lessons/ }).click();
    await expect(page.getByTestId("saved-item")).toHaveCount(1);

    await page.getByTestId("remove-bookmark").click();
    await expect(page.getByTestId("saved-item")).toHaveCount(0);
    await expect(page.getByText(/No saved items yet/)).toBeVisible();

    await page.reload();
    await expect(page.getByText(/No saved items yet/)).toBeVisible();
  });
});

test.describe("Backup roundtrip", () => {
  test("exports JSON, resets local data and imports the backup", async ({ page }) => {
    await openLesson(page);
    await page.getByTestId("mark-reading-complete").click();
    await page.getByTestId("bookmark-lesson").first().click();
    await expect(page.getByRole("button", { name: "Bookmarked", exact: true }).first()).toBeVisible();

    await page.goto("/settings");
    const downloadPromise = page.waitForEvent("download");
    await page.locator('[data-testid="export-progress"]:visible').first().click();
    const download = await downloadPromise;
    const backupPath = await download.path();
    expect(backupPath).toBeTruthy();

    page.on("dialog", (dialog) => dialog.accept());
    await page.getByTestId("reset-local-data").click();
    await expect(page.getByText(/Local learning data reset/)).toBeVisible();

    await page.setInputFiles('[data-testid="import-file-input"]', backupPath as string);
    await expect(page.getByText("Import Preview")).toBeVisible();
    await page.getByTestId("import-apply").click();
    await expect(page.getByText(/Import applied/)).toBeVisible();

    await openLesson(page);
    await expect(page.getByRole("button", { name: "Reading complete", exact: true }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Bookmarked", exact: true }).first()).toBeVisible();
  });
});

test.describe("Offline behavior", () => {
  test("shows offline state and keeps local activity until the network returns", async ({
    page,
    context,
  }) => {
    await openLesson(page);

    await context.setOffline(true);
    await page.getByRole("main").getByTestId("mark-reading-complete").click();
    await expect(page.getByTestId("sync-status")).toHaveText("Offline", { timeout: 15_000 });
    await expect(page.getByRole("button", { name: "Reading complete", exact: true }).first()).toBeVisible();

    // Restore the network, then confirm the queued local state survived.
    await context.setOffline(false);
    await expect(page.getByTestId("sync-status")).toHaveText(/Local only|Synced/);
    await page.reload();
    await expect(page.getByRole("button", { name: "Reading complete", exact: true }).first()).toBeVisible();
  });
});

test.describe("Authentication", () => {
  test.skip(
    !process.env.AUTH_GITHUB_ID && !process.env.AUTH_GOOGLE_ID,
    "OAuth provider credentials are not configured"
  );

  test("shows configured providers on settings", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByTestId("auth-config-hint")).toBeHidden();
  });
});
