import { test, expect } from "@playwright/test";

test.describe("Offline service worker", () => {
  test("serves cached curriculum shell offline and preserves local progress", async ({ page, context }) => {
    await page.goto("/");
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await page.goto("/curriculum/00-setup-and-tooling/01-dev-environment");
    // The lesson markdown body repeats the title as a content h1; assert the workspace header only.
    await expect(page.getByRole("heading", { name: "Dev Environment" }).first()).toBeVisible();
    // A click before client hydration lands on the SSR-only button and is a no-op
    // (the write never reaches IndexedDB), so retry the click until the local
    // store visibly registers it. Scope to main + first(): the offline shell
    // reload can leave a duplicate status badge in the DOM.
    await expect(async () => {
      await page.getByRole("main").getByTestId("mark-reading-complete").click();
      await expect(page.getByRole("main").getByTestId("lesson-status").first()).not.toHaveText("Not Started", { timeout: 2_000 });
      await expect(page).toHaveURL(/01-dev-environment/);
    }).toPass({ timeout: 30_000 });

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
    await expect(page.getByRole("heading", { name: "Dev Environment" }).first()).toBeVisible();
    await expect(page.getByRole("main").getByTestId("lesson-status").first()).toContainText(/In Progress|Complete/, { timeout: 15_000 });
    await context.setOffline(false);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Dev Environment" }).first()).toBeVisible();
  });
});
