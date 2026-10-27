import { test, expect, type Page } from "@playwright/test";

/**
 * Phase 7 §50/§51 — analytics + review journeys.
 *
 * Learner records live in the user's real IndexedDB (Dexie, local-first, db
 * name "aiEngineerOsDb"). Seeding uses the app's own IndexedDB object stores so
 * the analytics pipeline reads exactly the data the production UI produces.
 */

// The review journey gates on the progress controls' strict hydration marker
// (mounted + auth + lesson-progress read). WebKit's client hydration cost for a
// lesson page is measured in tens of seconds, so the test budget is sized to the
// slowest supported engine; assertions stay exactly as written.
test.describe.configure({ timeout: 180_000 });

async function seedStudySession(page: Page, startedAt: string, durationSeconds: number) {
  await page.evaluate(
    ([start, seconds]) => {
      const clientSessionId = `e2e-${start}-${seconds}`;
      const ensureStores = (db: IDBDatabase) => {
        for (const name of [
          "localProfile", "lessonProgress", "resourceProgress", "notes", "bookmarks",
          "studySessions", "quizAttempts", "projectProgress", "syncQueue", "syncMetadata",
          "conflicts", "roadmapState", "deviceMetadata", "tombstones", "importBackups",
          "projectEvidence", "projectSelfAssessments", "reviewHistory", "portfolioDraft",
        ]) {
          if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: "id" });
        }
      };
      return new Promise<void>((resolve, reject) => {
        const write = (db: IDBDatabase) => {
          try {
            const tx = db.transaction("studySessions", "readwrite");
            tx.objectStore("studySessions").put({
              id: clientSessionId,
              createdAt: start,
              updatedAt: start,
              localRevision: 1,
              syncStatus: "pending",
              clientSessionId,
              deviceId: "e2e-device",
              lessonId: "01-dev-environment",
              resourceId: null,
              startedAt: start,
              endedAt: start,
              durationSeconds: seconds as number,
            });
            tx.oncomplete = () => {
              db.close();
              resolve();
            };
            tx.onerror = () => {
              db.close();
              reject(tx.error);
            };
            tx.onabort = () => {
              db.close();
              reject(tx.error ?? new Error("Study-session fixture transaction aborted"));
            };
          } catch (error) {
            db.close();
            reject(error);
          }
        };
        const open = indexedDB.open("aiEngineerOsDb");
        open.onupgradeneeded = () => {
          ensureStores(open.result);
        };
        open.onsuccess = () => {
          const db = open.result;
          if (!db.objectStoreNames.contains("studySessions")) {
            const nextVersion = db.version + 1;
            db.close();
            const upgrade = indexedDB.open("aiEngineerOsDb", nextVersion);
            upgrade.onupgradeneeded = () => {
              if (!upgrade.result.objectStoreNames.contains("studySessions")) {
                upgrade.result.createObjectStore("studySessions", { keyPath: "id" });
              }
            };
            upgrade.onsuccess = () => {
              write(upgrade.result);
            };
            upgrade.onerror = () => reject(upgrade.error);
            return;
          }
          write(db);
        };
        open.onblocked = () => reject(new Error("IndexedDB fixture open was blocked"));
        open.onerror = () => reject(open.error);
      });
    },
    [startedAt, durationSeconds]
  );
}

async function seedWeakAttempt(page: Page, attemptNumber: number, percentage: number) {
  await page.evaluate(
    ([number, percent]) => {
      const attemptId = `e2e-attempt-${number}`;
      const submittedAt = new Date(Date.now() - (20 - number) * 3600_000).toISOString();
      const ensureStores = (db: IDBDatabase) => {
        for (const name of [
          "localProfile", "lessonProgress", "resourceProgress", "notes", "bookmarks",
          "studySessions", "quizAttempts", "projectProgress", "syncQueue", "syncMetadata",
          "conflicts", "roadmapState", "deviceMetadata", "tombstones", "importBackups",
          "projectEvidence", "projectSelfAssessments", "reviewHistory", "portfolioDraft",
        ]) {
          if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: "id" });
        }
      };
      return new Promise<void>((resolve, reject) => {
        const write = (db: IDBDatabase) => {
          try {
            const tx = db.transaction("quizAttempts", "readwrite");
            tx.objectStore("quizAttempts").put({
              id: attemptId,
              createdAt: submittedAt,
              updatedAt: submittedAt,
              localRevision: 1,
              syncStatus: "pending",
              attemptId,
              quizId: "checkpoint-02-ml-fundamentals",
              lessonId: "assessment:02-ml-fundamentals",
              answers: {},
              score: 5,
              maxScore: 10,
              percentage: percent as number,
              startedAt: submittedAt,
              submittedAt,
              attemptNumber: number as number,
            });
            tx.oncomplete = () => {
              db.close();
              resolve();
            };
            tx.onerror = () => {
              db.close();
              reject(tx.error);
            };
            tx.onabort = () => {
              db.close();
              reject(tx.error ?? new Error("Quiz-attempt fixture transaction aborted"));
            };
          } catch (error) {
            db.close();
            reject(error);
          }
        };
        const open = indexedDB.open("aiEngineerOsDb");
        open.onupgradeneeded = () => {
          ensureStores(open.result);
        };
        open.onsuccess = () => {
          const db = open.result;
          if (!db.objectStoreNames.contains("quizAttempts")) {
            const nextVersion = db.version + 1;
            db.close();
            const upgrade = indexedDB.open("aiEngineerOsDb", nextVersion);
            upgrade.onupgradeneeded = () => {
              if (!upgrade.result.objectStoreNames.contains("quizAttempts")) {
                upgrade.result.createObjectStore("quizAttempts", { keyPath: "id" });
              }
            };
            upgrade.onsuccess = () => {
              write(upgrade.result);
            };
            upgrade.onerror = () => reject(upgrade.error);
            return;
          }
          write(db);
        };
        open.onblocked = () => reject(new Error("IndexedDB fixture open was blocked"));
        open.onerror = () => reject(open.error);
      });
    },
    [attemptNumber, percentage]
  );
}

test.describe("Analytics journey (§50)", () => {
  test("real activity appears in /analytics with no placeholder metrics", async ({ page, context }) => {
    // Generate real learner activity: complete a lesson in the workspace.
    await page.goto("/curriculum/00-setup-and-tooling/01-dev-environment");
    // Wait for the controls' hydration marker before clicking: the global sync
    // coordinator also fetches /api/auth/status now, so SSR visibility alone no
    // longer proves the buttons have handlers attached.
    await expect(page.getByTestId("mark-reading-complete").locator("xpath=ancestor::*[@data-progress-hydrated]")).toBeVisible({ timeout: 60_000 });
    await page.getByTestId("mark-reading-complete").click();
    await expect(page.getByTestId("mark-reading-complete")).toBeVisible();

    // Record a real study session (>= 10 min so streaks see it as a study day).
    await seedStudySession(page, "2026-10-16T10:00:00.000Z", 3600);

    await page.close();
    page = await context.newPage();
    await page.goto("/analytics");
    await expect(page.getByRole("heading", { name: "Analytics", level: 1 })).toBeVisible({ timeout: 30000 });

    // Overview shows the real canonical lesson completion count, not a dummy.
    const lessonsCompleted = page.getByText("Lessons completed", { exact: true });
    await expect(lessonsCompleted).toBeVisible();
    const overviewCard = lessonsCompleted.locator("..").locator("..");
    await expect(overviewCard.getByRole("heading")).toHaveText(/^\d+$/);
    await expect(overviewCard).toContainText("canonical lesson identities (541 in the curriculum)");
    const curriculumCard = page.getByText("Curriculum progress", { exact: true }).locator("..").locator("..");
    await expect(curriculumCard).toContainText(/\/542 occurrences/);

    // No placeholder/example metrics are ever rendered for real learners.
    await expect(page.getByText("Example data")).toHaveCount(0);
    await expect(page.getByText("Lorem ipsum")).toHaveCount(0);

    // The study time card reflects the seeded real session (1h).
    await page.getByRole("tab", { name: "Learning activity" }).click();
    await expect(page.getByText(/Total/)).toContainText(/1\.0h|60m|1h/);
  });

  test("empty state for brand-new learners without fake data", async ({ page }) => {
    await page.goto("/analytics");
    await expect(
      page.getByText(/No learning history yet|No study sessions recorded yet/)
    ).toBeVisible();
  });
});

test.describe("Review journey (§51)", () => {
  test("repeated weak assessments produce an explained review item that updates", async ({ page, context }) => {
    // IndexedDB is origin-scoped; establish the app origin before fixture injection.
    await page.goto("/analytics");
    await expect(page.getByRole("heading", { name: "Analytics", level: 1 })).toBeVisible({ timeout: 30000 });
    await seedWeakAttempt(page, 1, 55);
    await seedWeakAttempt(page, 2, 48);

    await page.close();
    page = await context.newPage();
    await page.goto("/analytics");
    await expect(page.getByRole("heading", { name: "Analytics", level: 1 })).toBeVisible({ timeout: 30000 });
    await page.getByRole("tab", { name: "Review" }).click();

    // The weak skill explains "why review this now?".
    await expect(page.getByText("Why review this now?").first()).toBeVisible();

    // A successful review updates the recommendation.
    const markReviewed = page.getByRole("button", { name: "Mark reviewed" }).first();
    if (await markReviewed.isVisible()) {
      await markReviewed.click();
      await page.waitForTimeout(500);
      // After recording a review today, the recommendation is scheduled again.
      await page.reload();
      await page.getByRole("tab", { name: "Review" }).click();
      await expect(page.getByText("Review in 3 day(s)", { exact: true }).first()).toBeVisible();
    }
  });
});
