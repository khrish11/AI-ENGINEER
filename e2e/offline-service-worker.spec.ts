import { test, expect } from "@playwright/test";

test.describe("Offline service worker", () => {
  test("serves cached curriculum shell offline and preserves local progress", async ({ page, context }) => {
    await page.goto("/");
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await page.goto("/curriculum/00-setup-and-tooling/01-dev-environment");
    await expect(page.getByRole("heading", { name: "Dev Environment" })).toBeVisible();
    await page.getByTestId("mark-reading-complete").click();
    await page.waitForTimeout(250);

    const cacheState = await page.evaluate(async () => {
      const names = await caches.keys();
      return Promise.all(
        names.map(async (name) => {
          const items = await (await caches.open(name)).keys();
          return {
            name,
            urls: items.map((request) => new URL(request.url).pathname),
          };
        })
      );
    });
    expect(cacheState.some((cache) => cache.name.startsWith("ai-engineer-shell-v2"))).toBe(true);
    expect(cacheState.flatMap((cache) => cache.urls).some((url) => url.startsWith("/api/"))).toBe(false);

    await context.setOffline(true);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Dev Environment" })).toBeVisible();
    await expect(page.getByTestId("lesson-status")).toContainText(/In Progress|Complete/);
    await context.setOffline(false);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Dev Environment" })).toBeVisible();
  });
});
