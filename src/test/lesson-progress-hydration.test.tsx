import { describe, it, expect, vi, beforeEach } from "vitest";
import * as React from "react";
import { render, act } from "@testing-library/react";

/**
 * Readiness-contract regression for the lesson progress controls.
 *
 * Every Playwright progress/cross-device spec gates clicks and content checks on
 * `[data-progress-hydrated]`, treating it as "the controls are authoritative".
 * The control LABEL ("Mark reading complete" vs "Reading complete") is derived
 * from the IndexedDB progress record, which resolves asynchronously — so the
 * marker must not appear while that read is still in flight. If it does, an
 * observer can see a ready control that is still showing a pre-read label,
 * which is the race that made the WebKit cross-device restore assertion fail
 * under full-suite load.
 */

type ProgressRecord = {
  lessonId: string;
  readingComplete: boolean;
  status: string;
  needsReview: boolean;
  masteryScore: number | null;
};

const repoHolder = vi.hoisted(() => ({
  pending: null as null | ProgressRecord,
  gate: null as null | { promise: Promise<ProgressRecord | null>; resolve: (v: ProgressRecord | null) => void },
}));

vi.mock("@/lib/progress/repositories/lesson-progress", () => ({
  lessonProgressRepo: {
    getByLesson: vi.fn(() => {
      if (repoHolder.gate) return repoHolder.gate.promise;
      return Promise.resolve(repoHolder.pending);
    }),
    upsert: vi.fn(),
  },
}));

vi.mock("@/hooks/useAuthStatus", () => ({
  useAuthStatus: () => ({ authStatus: { authenticated: true }, loading: false }),
}));

vi.mock("@/hooks/useBookmarks", () => ({
  useBookmarks: () => ({ bookmarks: [], toggleBookmark: vi.fn() }),
}));

vi.mock("@/hooks/useStudySession", () => ({
  useStudySession: () => undefined,
}));

import { LessonProgressControls } from "@/components/curriculum/lesson-progress-controls";

const availability = { hasVideo: false, hasQuiz: false, hasProject: false, hasResources: false };

function renderControls() {
  return render(
    React.createElement(LessonProgressControls, {
      lessonId: "/curriculum/00-setup-and-tooling/06-python-environments",
      title: "Python environments",
      phaseSlug: "00-setup-and-tooling",
      phaseNumber: 0,
      href: "/curriculum/00-setup-and-tooling/06-python-environments",
      availability,
    })
  );
}

function deferred() {
  let resolve!: (value: ProgressRecord | null) => void;
  const promise = new Promise<ProgressRecord | null>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

beforeEach(() => {
  repoHolder.pending = null;
  repoHolder.gate = null;
});

describe("lesson progress controls readiness contract", () => {
  it("does not advertise hydration while the progress record read is still pending", async () => {
    const gate = deferred();
    repoHolder.gate = { promise: gate.promise, resolve: gate.resolve };

    const { container } = renderControls();

    // The read has not settled, so the controls are NOT authoritative yet.
    expect(container.querySelector("[data-progress-hydrated]")).toBeNull();

    const record: ProgressRecord = {
      lessonId: "/curriculum/00-setup-and-tooling/06-python-environments",
      readingComplete: true,
      status: "completed",
      needsReview: false,
      masteryScore: null,
    };
    await act(async () => {
      gate.resolve(record);
      await gate.promise;
    });

    // Once the record lands, the marker appears and the label is already the
    // authoritative restored state — one atomic signal, no stale-label window.
    const hydrated = container.querySelector("[data-progress-hydrated]");
    expect(hydrated).not.toBeNull();
    const button = container.querySelector('[data-testid="mark-reading-complete"]');
    expect(button?.textContent).toContain("Reading complete");
  });

  it("marks ready for a lesson with no progress record at all", async () => {
    repoHolder.pending = null;
    const { container } = renderControls();
    await act(async () => {
      await Promise.resolve();
    });
    expect(container.querySelector("[data-progress-hydrated]")).not.toBeNull();
    const button = container.querySelector('[data-testid="mark-reading-complete"]');
    expect(button?.textContent).toContain("Mark reading complete");
  });
});
