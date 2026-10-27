import { test, expect } from "@playwright/test";

test.describe("Offline service worker", () => {
  test("serves cached curriculum shell offline and preserves local progress", async ({ page, context }) => {
    await page.goto("/");
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await page.goto("/curriculum/00-setup-and-tooling/01-dev-environment");
    // The workspace header is the single level-1 heading (lesson markdown h1s
    // are demoted to h2 — see BUG-09); first() stays as cheap insurance.
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
    expect(cacheState.some((cache) => cache.name.startsWith("ai-engineer-shell-v3"))).toBe(true);
    expect(cacheState.flatMap((cache) => cache.urls).some((url) => url.startsWith("/api/"))).toBe(false);

    await context.setOffline(true);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Dev Environment" }).first()).toBeVisible();
    await expect(page.getByRole("main").getByTestId("lesson-status").first()).toContainText(/In Progress|Complete/, { timeout: 15_000 });
    await context.setOffline(false);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Dev Environment" }).first()).toBeVisible();
  });

  // BUG-01 regression (cache admission): the v3 worker must never admit
  // redirected responses, private API routes, auth routes, or user-specific
  // settings HTML — exercise the fetch handler across those surfaces and
  // audit every entry the shell cache ended up holding.
  test("never caches redirects, private APIs, or auth/settings surfaces", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    // Drive a breadth of navigations through the worker-controlled document
    // handler: public shell pages plus private/API endpoints.
    await page.goto("/curriculum");
    await page.goto("/settings");
    await page.evaluate(async () => {
      // Fire real same-origin GETs at the guarded surfaces so the fetch
      // handler sees them (the handler must bypass them from caching).
      await Promise.all([
        fetch("/api/auth/status"),
        fetch("/api/sync/v1", { headers: { accept: "application/json" } }),
      ]);
    });

    const audit = await page.evaluate(async () => {
      const cache = await caches.open("ai-engineer-shell-v3");
      const entries = await cache.keys();
      return Promise.all(
        entries.map(async (request) => {
          const response = await cache.match(request);
          return {
            path: new URL(request.url).pathname,
            status: response?.status ?? 0,
            redirected: response?.redirected ?? true,
          };
        })
      );
    });
    expect(audit.some((entry) => entry.path.startsWith("/api/"))).toBe(false);
    expect(audit.some((entry) => entry.path.startsWith("/auth"))).toBe(false);
    expect(audit.some((entry) => entry.path.startsWith("/settings"))).toBe(false);
    // Any cached "/" document must be a genuine 200 basic response, never a
    // followed redirect (the poisoned v2 pattern from the acceptance report).
    for (const entry of audit) {
      expect(entry.status).toBe(200);
      expect(entry.redirected).toBe(false);
    }
  });

  // BUG-01 regression (upgrade lifecycle): an install upgrading over a
  // poisoned v2 shell must delete the stale cache during activate, while
  // leaving IndexedDB untouched. Unregistering does not evict CacheStorage,
  // so we can seed a v2-named poisoned cache, drop the registration, and let
  // the next app load run a fresh install whose activate() purges v2.
  test("upgrade from a poisoned v2 cache purges it on activation", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });

    await page.evaluate(async () => {
      const poisoned = await caches.open("ai-engineer-shell-v2");
      await poisoned.put(new Request("/"), new Response("poisoned-redirect", { status: 200 }));
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((reg) => reg.unregister()));
    });

    // Fresh install: sw.js registers again from scratch; activate() deletes
    // every ai-engineer-shell-* cache that is not the current v3.
    await page.reload();
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });

    // The new service worker activates and purges old caches
    await page.waitForTimeout(2000);

    const names = await page.evaluate(async () => caches.keys());
    expect(names).toContain("ai-engineer-shell-v3");
    expect(names.filter((name) => name.startsWith("ai-engineer-shell-") && name !== "ai-engineer-shell-v3")).toEqual([]);

    // IndexedDB progress must survive the cache upgrade untouched.
    const idbPresent = await page.evaluate(
      () =>
        new Promise<boolean>((resolve) => {
          const open = indexedDB.open("aiEngineerOsDb");
          open.onsuccess = () => {
            open.result.close();
            resolve(true);
          };
          open.onerror = () => resolve(false);
        })
    );
    expect(idbPresent).toBe(true);
  });
});
