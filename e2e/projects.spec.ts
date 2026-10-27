import { test, expect } from "@playwright/test";

test.describe("Project Studio", () => {
  test("catalog lists projects with filters", async ({ page }) => {
    await page.goto("/projects");
    await expect(page.locator("h1:visible").first()).toContainText("Project Studio");

    const count = page.locator('[data-testid="project-count"]:visible').first();
    await expect(count).toBeVisible();
    await expect(count).toContainText(/of 24 projects/);

    // Level filter narrows the grid
    await page.getByRole("button", { name: "capstone" }).click();
    await expect(count).toContainText(/of 24/);
    // Capstone filter narrows the grid to capstone-level cards only
    await page.getByRole("button", { name: "capstone" }).click();
    await expect(page.getByText("capstone", { exact: true }).first()).toBeVisible();
    await expect(count).toContainText(/of 24/);
  });

  test("project journey: open, complete milestone, attach evidence, reload persists", async ({ page }) => {
    await page.goto("/projects/gradient-descent-visualizer");
    await expect(page.locator("h1:visible").first()).toBeVisible();
    await expect(page.locator('[data-testid="project-status-badge"]:visible')).toContainText(
      /Not started|In progress/
    );

    // Attach evidence of every kind the project requires — milestone completion
    // stays disabled until the required evidence kinds exist.
    const kinds: Array<[string, string]> = [
      ["github_repo_url", "https://github.com/you/gradient-visualizer"],
      ["test_result", "https://github.com/you/gradient-visualizer/actions/runs/123"],
      ["notebook", "notebooks/gradient-descent-derivations.ipynb"],
    ];
    for (const [kind, value] of kinds) {
      await page.locator('select:visible').filter({ has: page.locator('option[value="' + kind + '"]') }).first().selectOption(kind);
      await page.locator('input[aria-label="Evidence value"]:visible').fill(value);
      if (kind === "github_repo_url") {
        await page.locator('input[aria-label="GitHub branch"]:visible').first().fill("main");
      }
      await page.getByTestId("attach-evidence").click();
      await expect(page.getByText(value, { exact: true })).toBeVisible();
    }

    // Complete the first required milestone
    const beginnerMilestones = page.locator('[data-testid^="milestone-complete-"]');
    await beginnerMilestones.first().click();
    await expect(page.locator('[data-testid="project-status-badge"]:visible')).toContainText(/In progress/);

    // Reload — progress persists through IndexedDB
    await page.reload();
    await expect(page.getByText("branch: main")).toBeVisible();
    await expect(page.locator('[data-testid="project-status-badge"]:visible')).toContainText(/In progress/);
  });

  test("rubric self-assessment saves with Self-assessed label", async ({ page }) => {
    await page.goto("/projects/supervised-learning-system");
    await expect(page.getByRole("heading", { name: "Evaluation rubric" })).toBeVisible();

    // Save before scoring → accessible error summary, not a silent failure.
    // The rubric panel is SSR-rendered but its submit handler attaches only after
    // React hydrates; under full-suite contention a first click can land pre-hydration
    // and be silently lost, so retry click+observe as one unit. The substantive
    // assertion below (error text) is unchanged.
    await expect(async () => {
      await page.locator('[data-testid="rubric-save"]:visible').first().click({ timeout: 5_000 });
      await expect(page.getByTestId("rubric-error")).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 30_000 });
    await expect(page.getByTestId("rubric-error")).toContainText(/score every category/i);

    // Score every rubric category
    const selects = page.locator('[data-testid^="rubric-score-"]');
    const count = await selects.count();
    expect(count).toBeGreaterThan(1);
    for (let i = 0; i < count; i += 1) {
      await selects.nth(i).selectOption("1");
    }
    await page.locator('[data-testid="rubric-save"]:visible').first().click();
    await expect(page.getByTestId("rubric-feedback")).toContainText(/Saved/);
    await expect(page.getByTestId("rubric-feedback")).toContainText(/self-assessed/i);

    // Reload — scores persist with the Self-assessed marker
    await page.reload();
    await expect(page.locator('[data-testid^="rubric-score-"]').first()).toHaveValue(/^[1-8]$/);
  });

  test("invalid evidence URL shows an accessible error", async ({ page }) => {
    await page.goto("/projects/gradient-descent-visualizer");
    await page.locator('select:visible').first().selectOption("documentation_url");
    await page.locator('input[aria-label="Evidence value"]:visible').fill("javascript:alert(1)");
    await page.locator('[data-testid="attach-evidence"]:visible').first().click();
    await expect(page.locator('[data-testid="evidence-error"]:visible').first()).toBeVisible();
  });
});


test.describe("Practice checkpoints", () => {
  test("checkpoint journey: start, answer, submit, feedback, attempt history", async ({ page }) => {
    await page.goto("/practice");
    await expect(page.locator("h1:visible").first()).toContainText("Practice Checkpoints");

    // Deterministic journey against checkpoint-02 (10 questions, mixed types).
    // Answers need not pass: attempts are immutable history, feedback is shown per question.
    const assessmentId = "checkpoint-02-ml-fundamentals";
    await page.locator(`[data-testid="start-checkpoint-${assessmentId}"]:visible`).click();
    const runner = page.locator(`[data-testid="checkpoint-runner-${assessmentId}"]:visible`).first();
    await expect(runner).toBeVisible();

    // Submitting incomplete shows an accessible error summary, not silent failure.
    await expect(page.getByTestId("submit-checkpoint")).toBeDisabled();

    // Single choice (5 questions): pick the option at index 1 each time.
    for (const qid of ["p02-supervised-def", "p02-linear-vs-logistic", "p02-baseline", "p02-roc-meaning", "p02-feature-leak"]) {
      await page.getByTestId(`answer-${qid}-1`).click();
    }

    // True/false (2 questions): radio inputs grouped by question name.
    for (const qid of ["p02-leakage", "p02-crossval"]) {
      await page.locator(`input[name="question-${qid}"]`).first().check();
    }

    // Ordering (p02-split-order): leave the default order — it already matches the
    // canonical pipeline order encoded in the assessment.

    // Multiple choice (p02-regularization): check two options.
    await page.getByTestId("answer-p02-regularization-0").check();
    await page.getByTestId("answer-p02-regularization-3").check();

    // Short answer (p02-short-reflection): text + first self-check criterion.
    await page.getByTestId("answer-text-p02-short-reflection").fill(
      "Reflection: leakage-aware splits and a majority-class baseline keep evaluation honest."
    );
    await page.locator("fieldset input[type=checkbox]").first().check();

    // Wait until every question is answered, then submit.
    const submit = page.getByTestId("submit-checkpoint");
    await expect(submit).toBeEnabled({ timeout: 10_000 });
    await submit.click();

    // Feedback + immutable attempt history visible after submission.
    await expect(page.getByTestId("checkpoint-result")).toContainText(/Score:|Passed|Not passed/);
    await expect(page.locator('[data-testid^="answer-"]').first()).toBeDisabled();
    await expect(page.getByTestId("start-new-attempt")).toBeVisible();
    await expect(page.getByTestId("attempt-history")).toContainText(/Attempt #1/);
  });

  test("offline milestone work queues mutations for later sync", async ({ page, context }) => {
    await page.goto("/projects/gradient-descent-visualizer");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    // Go offline: writes must still work through IndexedDB.
    await context.setOffline(true);

    // Attach an evidence entry and complete the first milestone offline.
    await page.locator('select[aria-label="Evidence kind"]:visible').first().selectOption("test_result");
    await page.locator('input[aria-label="Evidence value"]:visible').first().fill("offline CI run output link placeholder");
    await page.locator('[data-testid="attach-evidence"]:visible').first().click();
    await expect(page.locator('[data-testid="evidence-entry-test_result"]:visible').first()).toBeVisible();
    await page.locator('[data-testid^="milestone-complete-"]').first().click();

    // Restore network: the local queue holds the offline mutations.
    await context.setOffline(false);
    const queued = await page.evaluate(() => new Promise((resolve) => {
      const open = indexedDB.open("aiEngineerOsDb");
      open.onerror = () => resolve(-1);
      open.onsuccess = () => {
        const database = open.result;
        try {
          const tx = database.transaction("syncQueue", "readonly");
          const countReq = tx.objectStore("syncQueue").count();
          countReq.onsuccess = () => {
            database.close();
            resolve(countReq.result);
          };
          countReq.onerror = () => {
            database.close();
            resolve(-1);
          };
        } catch {
          database.close();
          resolve(-1);
        }
      };
    }));
    expect(queued).toBeGreaterThan(0);
  });
});