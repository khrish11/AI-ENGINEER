import { expect, test, type Browser, type Page } from "@playwright/test";

/**
 * Phase-2 cross-device acceptance for the sync coordinator.
 *
 * A Playwright browser *context* is an isolated profile: separate IndexedDB
 * and Cache Storage, no shared local state. Two contexts therefore model two
 * physical devices. Which account each context signs in as is chosen by the
 * storageState (minted by e2e/global-setup.ts):
 *   - state.json    -> learner A ("device A" and, reused, "device B" of the
 *                      SAME account, which must restore shared progress)
 *   - state-b.json  -> learner B (a DIFFERENT account, which must never
 *                      import learner A's private progress)
 *
 * Isolated localhost DB + throwaway secret; real sync writes are safe here.
 *
 * Every claim is verified twice: once at the DATA layer (the restored lesson row
 * read straight out of the device's IndexedDB) and once through the UI. The
 * data-layer check is the load-resilient proof that the cloud merge actually
 * committed; the UI check proves the learner sees it.
 */

const STORAGE_A = "playwright/.auth/state.json";
const STORAGE_B = "playwright/.auth/state-b.json";

const PHASE = "/curriculum/00-setup-and-tooling";
// The database is reset once for the whole Playwright invocation, not once per
// browser project. Give each engine distinct monotonic records so Chromium's
// needsReview=true result cannot make Firefox/WebKit's later "toggle on" click
// toggle the already-restored value off instead.
const LESSONS_BY_BROWSER: Record<
  string,
  { restore: string; isolation: string }
> = {
  chromium: {
    restore: `${PHASE}/06-python-environments`,
    isolation: `${PHASE}/07-docker-for-ai`,
  },
  firefox: {
    restore: `${PHASE}/09-data-management`,
    isolation: `${PHASE}/11-linux-for-ai`,
  },
  webkit: {
    restore: `${PHASE}/12-debugging-and-profiling`,
    isolation: `${PHASE}/13-python-for-ai-engineering`,
  },
};

test.describe.configure({ timeout: 360_000 });
test.use({ serviceWorkers: "block" });

interface LocalLessonRow {
  lessonId?: string;
  lessonHref?: string | null;
  readingComplete?: boolean;
  needsReview?: boolean;
  status?: string;
}

type LocalLessonKey = "lessonHref" | "lessonId";

/**
 * Reads a lesson progress row out of the device's own IndexedDB. The row is
 * keyed by the caller-chosen handle, which is independent of React hook timing.
 *
 * `lessonId` is the only handle that survives a cloud round-trip: the snapshot
 * contract emits lessonId/status/flags only (no href/title), so a merged row
 * legitimately carries `lessonHref: null` on a restored device. `lessonHref`
 * is therefore only valid on the device that produced the mutation locally,
 * because the client writes it as progress metadata.
 */
async function readLocalLessonRow(
  page: Page,
  key: LocalLessonKey,
  value: string,
): Promise<LocalLessonRow | null> {
  return page.evaluate(
    (query) =>
      new Promise<LocalLessonRow | null>((resolve, reject) => {
        const open = indexedDB.open("aiEngineerOsDb");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const idb = open.result;
          const tx = idb.transaction("lessonProgress", "readonly");
          const getAll = tx.objectStore("lessonProgress").getAll();
          getAll.onerror = () => reject(getAll.error);
          getAll.onsuccess = () => {
            const rows = getAll.result as LocalLessonRow[];
            resolve(rows.find((row) => String(row[query.key]) === query.value) ?? null);
          };
        };
      }),
    { key, value }
  );
}

/**
 * Resolve the canonical lesson id from the origin device's own local row (which
 * does carry the href the workspace wrote) before that device is torn down.
 * Every downstream data-layer assertion is then keyed by that id rather than
 * by an href the cloud contract never transports.
 */
async function captureLessonId(page: Page, href: string): Promise<string> {
  const row = await readLocalLessonRow(page, "lessonHref", href);
  const lessonId = row?.lessonId;
  expect(lessonId, `expected a local progress row for ${href}`).toBeTruthy();
  if (!lessonId) throw new Error(`Unreachable: no lessonId for ${href}`);
  return lessonId;
}

async function openLesson(page: Page, url: string) {
  const hydrated = page
    .waitForResponse((res) => res.url().includes("/api/auth/status"), { timeout: 30_000 })
    .catch(() => {});
  await page.goto(url);
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  await expect(page.getByRole("main").getByTestId("mark-reading-complete")).toBeVisible({
    timeout: 30_000,
  });
  await hydrated;
  // The barrier now also waits for the lesson's own progress read, because a
  // restored lesson must never be asserted against a pre-read label. That makes
  // its duration the lesson page's full client hydration + read, which on WebKit
  // (markdown + KaTeX render of a long lesson, single-worker host) measures
  // 5-35s against 1-2s on Chromium. This is a budget sized to the slowest
  // supported engine, not a weaker assertion: the same truth must still hold.
  await expect(page.getByRole("main").locator("[data-progress-hydrated]")).toBeVisible({
    timeout: 90_000,
  });
}

const okSyncPost = (res: import("@playwright/test").Response) =>
  res.url().includes("/api/sync/v1") && res.request().method() === "POST" && res.status() === 200;

async function completeLesson(page: Page, url: string) {
  const posted = page.waitForResponse(okSyncPost, { timeout: 30_000 });
  await openLesson(page, url);
  await page.getByRole("main").getByTestId("mark-reading-complete").click();
  const response = await posted;
  expect(response.ok()).toBeTruthy();
  const ack = (await response.json()) as { accepted: string[] };
  expect(ack.accepted.length).toBeGreaterThan(0);
}

async function restoreOnFreshDevice(page: Page) {
  // The documented cloud-merge workflow: the Settings surface is the explicit
  // sign-in / restore screen and forces a cloud-snapshot GET on mount.
  const pulled = page.waitForResponse(
    (res) => res.url().includes("/api/sync/v1") && res.request().method() === "GET" && res.status() === 200,
    { timeout: 30_000 },
  );
  await page.goto("/settings");
  await pulled;
  await expect(page.getByTestId("sync-status").first()).toHaveText("Synced", { timeout: 30_000 });
}

test.describe("Cross-device synchronization", () => {
  test("restores a lesson completed on device A onto a fresh device B of the same account, then reconciles B's change back to A", async ({
    browser,
    browserName,
  }: {
    browser: Browser;
    browserName: string;
  }) => {
    const lessonRestore = LESSONS_BY_BROWSER[browserName].restore;
    // Device A: complete + persist a lesson to Postgres, then tear the device down.
    const ctxA = await browser.newContext({ storageState: STORAGE_A });
    const pageA = await ctxA.newPage();
    await completeLesson(pageA, lessonRestore);
    const lessonKey = await captureLessonId(pageA, lessonRestore);
    await ctxA.close();

    // Device B: completely empty IndexedDB + Cache Storage for the SAME account.
    const ctxB = await browser.newContext({ storageState: STORAGE_A });
    const pageB = await ctxB.newPage();
    await restoreOnFreshDevice(pageB);

    // DATA LAYER: A's progress is committed in B's own IndexedDB even though B
    // never marked the lesson locally.
    await expect
      .poll(async () => (await readLocalLessonRow(pageB, "lessonId", lessonKey))?.readingComplete, {
        timeout: 30_000,
      })
      .toBe(true);

    // UI: B now reflects A's progress through the restored control state. The
    // readiness marker only appears once the progress read has settled, so this
    // label is authoritative the moment it is asserted.
    await openLesson(pageB, lessonRestore);
    await expect(
      pageB.getByRole("button", { name: "Reading complete", exact: true }).first(),
    ).toBeVisible({ timeout: 30_000 });

    // A fresh local mutation on B syncs without disturbing A's restored row.
    const posted = pageB.waitForResponse(okSyncPost, { timeout: 30_000 });
    await pageB.getByTestId("toggle-needs-review").click();
    expect((await posted).ok()).toBeTruthy();

    await expect
      .poll(async () => (await readLocalLessonRow(pageB, "lessonId", lessonKey))?.needsReview, {
        timeout: 30_000,
      })
      .toBe(true);

    const snapshot = await pageB.evaluate(async () => {
      const res = await fetch("/api/sync/v1");
      return res.json() as Promise<{
        lessons: Array<{ lessonId?: string; readingComplete?: boolean; needsReview?: boolean }>;
      }>;
    });
    const restored = (snapshot.lessons ?? []).find(
      (l) => l.lessonId === lessonKey && l.readingComplete === true,
    );
    expect(restored, "A's reading-complete lesson must survive B's new mutation").toBeTruthy();
    await ctxB.close();

    // RECONCILE BACK: a third device signing in as A must receive B's change on
    // top of A's own row — proving two-way cloud reconciliation, not a one-shot
    // download, and that nothing silently reset A's progress.
    const ctxC = await browser.newContext({ storageState: STORAGE_A });
    const pageC = await ctxC.newPage();
    await restoreOnFreshDevice(pageC);

    await expect.poll(async () => await readLocalLessonRow(pageC, "lessonId", lessonKey), {
      timeout: 30_000,
    }).not.toBeNull();

    const reconciled = await readLocalLessonRow(pageC, "lessonId", lessonKey);
    expect(reconciled?.needsReview, "B's needs-review change must reach A").toBe(true);
    expect(reconciled?.readingComplete, "A's original reading-complete must not be reset").toBe(true);
    await ctxC.close();
  });

  test("signing into a different account never imports the previous account's private progress", async ({
    browser,
    browserName,
  }: {
    browser: Browser;
    browserName: string;
  }) => {
    const lessonIsolation = LESSONS_BY_BROWSER[browserName].isolation;
    // Account A completes a private lesson and syncs it to Postgres.
    const ctxA = await browser.newContext({ storageState: STORAGE_A });
    const pageA = await ctxA.newPage();
    await completeLesson(pageA, lessonIsolation);
    const lessonKey = await captureLessonId(pageA, lessonIsolation);

    // POSITIVE CONTROL: the lesson really is in A's cloud snapshot, so the
    // absence check against account B below proves scoping rather than an
    // empty/partial snapshot.
    const presentOnA = await pageA.evaluate(async (id) => {
      const res = await fetch("/api/sync/v1");
      const json = (await res.json()) as { lessons?: Array<{ lessonId?: string }> };
      return (json.lessons ?? []).some((l) => l.lessonId === id);
    }, lessonKey);
    expect(presentOnA, "device A's snapshot must hold the lesson being guarded").toBe(true);
    await ctxA.close();

    // Account B: a separate learner on a fresh device runs the restore merge.
    const ctxB = await browser.newContext({ storageState: STORAGE_B });
    const pageB = await ctxB.newPage();
    await restoreOnFreshDevice(pageB);

    // DATA LAYER: B's restored local store must contain no row for A's lesson.
    await expect
      .poll(async () => await readLocalLessonRow(pageB, "lessonId", lessonKey), { timeout: 15_000 })
      .toBeNull();

    // B's cloud snapshot is scoped to B (server per-user ownership), so A's
    // lesson is NOT present: the control still offers "Mark reading complete".
    await openLesson(pageB, lessonIsolation);
    await expect(
      pageB.getByRole("main").getByTestId("mark-reading-complete"),
    ).toBeVisible();
    await expect(
      pageB.getByRole("button", { name: "Reading complete", exact: true }).first(),
    ).toHaveCount(0);

    // And the local store B just restored contains no cloud row for A's lesson.
    const leaked = await pageB.evaluate(async (lessonId) => {
      const res = await fetch("/api/sync/v1");
      const json = (await res.json()) as { lessons?: Array<{ lessonId?: string }> };
      return (json.lessons ?? []).some((l) => l.lessonId === lessonId);
    }, lessonKey);
    expect(leaked, "account B must not receive account A's lesson").toBe(false);

    await ctxB.close();
  });
});
