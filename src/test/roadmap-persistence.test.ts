import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/progress/db";
import {
  defaultSettings,
  emptyStore,
  generateAndSave,
  loadRoadmapStore,
  rescheduleAndSave,
  saveRoadmapStore,
} from "@/lib/roadmap/store";
import { exportProgress, importProgressFromObject } from "@/lib/progress/export-import";
import { resetProgressDb } from "./progress-test-utils";

const settings = {
  ...defaultSettings(),
  trackId: "rag" as const,
  availableHoursPerWeek: 8,
  startDate: "2026-01-05",
  targetDate: null,
  studyDays: [1, 3, 5] as number[],
  bufferPreference: "monthly" as const,
  includeOptionalTopics: false,
};

describe("roadmap persistence (guest mode)", () => {
  beforeEach(async () => {
    await resetProgressDb();
  });

  it("generates a plan and persists it locally", async () => {
    const { store } = await generateAndSave(emptyStore(), settings, { completed: [] });
    expect(store.plan).not.toBeNull();
    expect(store.plan!.weeks.length).toBeGreaterThan(1);
    expect(store.settings!.trackId).toBe("rag");

    const loaded = await loadRoadmapStore();
    expect(loaded.plan?.weeks).toHaveLength(store.plan!.weeks.length);
    expect(loaded.plan?.summary.totalOccurrences).toBe(store.plan!.summary.totalOccurrences);
    expect(loaded.settings?.availableHoursPerWeek).toBe(8);
  });

  it("survives a simulated reload", async () => {
    const { store } = await generateAndSave(emptyStore(), settings, { completed: [] });
    db.close();
    await db.open();
    const loaded = await loadRoadmapStore();
    expect(loaded.plan?.weeks).toEqual(store.plan?.weeks);
    expect(loaded.settings).toEqual(store.settings);
  });

  it("queues roadmap state for account sync after every change", async () => {
    await generateAndSave(emptyStore(), settings, { completed: [] });
    const queued = await db.syncQueue.toArray();
    expect(queued.some((item) => item.entityType === "roadmap_state")).toBe(true);
  });

  it("reschedules and records history without dropping the plan", async () => {
    const { store } = await generateAndSave(emptyStore(), settings, { completed: [] });
    const result = await rescheduleAndSave(store, { completed: [] }, { hoursPerWeek: 16 });
    expect(result.result.plan.hoursPerWeek).toBe(16);
    expect(result.store.history.some((entry) => entry.action === "reschedule")).toBe(true);
    expect(result.store.plan?.weeks.length).toBeGreaterThan(0);

    const loaded = await loadRoadmapStore();
    expect(loaded.plan?.hoursPerWeek).toBe(16);
    expect(loaded.history.length).toBeGreaterThanOrEqual(2);
  });

  it("round-trips through export and import", async () => {
    const { store } = await generateAndSave(emptyStore(), settings, { completed: [] });
    await saveRoadmapStore({
      ...store,
      profile: {
        background: "cs-student",
        programming: { python: "comfortable", javascript: "none", git: "basic", linux: "none", sql: "none", docker: "none" },
        math: { "linear-algebra": "okay", calculus: "weak", probability: "weak", statistics: "weak" },
        ai: {
          "classical-ml": "basic",
          "neural-networks": "none",
          pytorch: "none",
          transformers: "none",
          "llm-applications": "basic",
          rag: "basic",
          agents: "none",
          deployment: "none",
        },
        knownTopicSkillIds: ["python"],
        goalTrackId: "rag",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    });

    const exported = await exportProgress();
    expect(exported.schemaVersion).toBe(1);
    expect(exported.app).toBe("ai-engineer-os");
    expect(exported.data.roadmapState?.length).toBe(1);
    expect(JSON.stringify(exported)).not.toMatch(/access_token|refresh_token|client_secret/i);

    await resetProgressDb();
    expect(await loadRoadmapStore()).toMatchObject({ plan: null });

    const result = await importProgressFromObject(exported, "replace");
    expect(result.success).toBe(true);

    const restored = await loadRoadmapStore();
    expect(restored.plan?.weeks).toEqual(store.plan?.weeks);
    expect(restored.plan?.summary).toEqual(store.plan?.summary);
    expect(restored.profile?.goalTrackId).toBe("rag");
    expect(restored.profile?.knownTopicSkillIds).toEqual(["python"]);
  });

  it("keeps an empty store readable before onboarding", async () => {
    const loaded = await loadRoadmapStore();
    expect(loaded.version).toBe(1);
    expect(loaded.plan).toBeNull();
    expect(loaded.settings).toBeNull();
    expect(loaded.overrides.excluded).toEqual([]);
  });
});
