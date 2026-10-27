import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * BUG-02 regression suite: the sync coordinator is the orchestration layer
 * that actually pumps the IndexedDB mutation queue into /api/sync/v1.
 * Every test reloads the module graph (vi.resetModules) because the
 * coordinator is a module singleton; fake-indexeddb keeps the underlying
 * stores between reloads, so each test resets data explicitly.
 */

interface SyncCall {
  method: string;
  url: string;
  body?: {
    clientBatchId: string;
    deviceId: string;
    mutations: Array<{ entityType: string; entityId: string; operation: string }>;
  };
}

async function loadFresh() {
  vi.resetModules();
  const [coordinator, syncQueueMod, dbMod, device, utils] = await Promise.all([
    import("@/lib/progress/sync/coordinator"),
    import("@/lib/progress/sync-queue"),
    import("@/lib/progress/db"),
    import("@/lib/progress/device"),
    import("@/test/progress-test-utils"),
  ]);
  await utils.resetProgressDb();
  return { coordinator, syncQueue: syncQueueMod.syncQueue, db: dbMod.db, device, utils };
}

function authStatusFixture(authenticated: boolean) {
  return {
    configured: true,
    providers: ["google"],
    developmentHint: null,
    authenticated,
    user: authenticated ? { id: "u1", name: "Test", email: "u1@example.com" } : null,
  };
}

const CLOUD_SNAPSHOT = {
  lessons: [],
  resources: [],
  notes: [],
  bookmarks: [],
  studySessions: [],
  quizAttempts: [],
  projectProgress: [],
  roadmapState: null,
  tombstones: [],
};

function syncResponse(overrides: Record<string, unknown> = {}) {
  return {
    accepted: [],
    rejected: [],
    remoteChanges: [],
    conflicts: [],
    nextSyncCursor: "cursor-1",
    ...overrides,
  };
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

let calls: SyncCall[] = [];
let cloudSnapshot: Record<string, unknown> = CLOUD_SNAPSHOT;
let postHandler: (call: SyncCall) => Promise<Response> | Response = () =>
  jsonResponse(syncResponse({ accepted: ["lesson-1"] }));

function installFetch(authenticated = true) {
  calls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      const method = (init?.method ?? "GET").toUpperCase();
      if (url.includes("/api/auth/status")) {
        return jsonResponse(authStatusFixture(authenticated));
      }
      if (url.includes("/api/sync/v1") && method === "GET") {
        calls.push({ method: "GET", url });
        return jsonResponse(cloudSnapshot);
      }
      if (url.includes("/api/sync/v1") && method === "POST") {
        const call: SyncCall = {
          method,
          url,
          body: init?.body ? JSON.parse(String(init.body)) : undefined,
        };
        calls.push(call);
        return postHandler(call);
      }
      throw new Error(`Unexpected fetch: ${method} ${url}`);
    })
  );
}

const syncPosts = () => calls.filter((c) => c.method === "POST");

async function waitFor(condition: () => Promise<boolean> | boolean, timeoutMs = 3_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await condition()) return;
    await new Promise((resolve) => setTimeout(resolve, 15));
  }
  throw new Error("waitFor timed out");
}

function setOnline(online: boolean) {
  Object.defineProperty(window.navigator, "onLine", {
    value: online,
    configurable: true,
  });
}

beforeEach(() => {
  setOnline(true);
  cloudSnapshot = CLOUD_SNAPSHOT;
  postHandler = () => jsonResponse(syncResponse({ accepted: ["lesson-1"] }));
  installFetch();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("sync coordinator automatic drain", () => {
  it("flushes pending mutations for an authenticated profile", async () => {
    const f = await loadFresh();
    await f.device.markAuthenticated("u1@example.com", "Test");
    await f.syncQueue.enqueue({
      entityType: "lesson_progress",
      entityId: "lesson-1",
      operation: "update",
      payload: { lessonId: "lesson-1", status: "in_progress", readingComplete: true },
      baseRevision: 1,
    });

    await f.coordinator.pump();

    expect(syncPosts()).toHaveLength(1);
    expect(syncPosts()[0].body?.mutations[0].entityId).toBe("lesson-1");
    expect(await f.db.syncQueue.count()).toBe(0);
    const meta = await f.db.syncMetadata.get("sync_meta");
    expect(meta?.lastSuccessfulSync).toBeTruthy();
  });

  it("never contacts the network for a guest profile (account isolation)", async () => {
    const f = await loadFresh();
    await f.syncQueue.enqueue({
      entityType: "lesson_progress",
      entityId: "lesson-1",
      operation: "update",
      payload: { lessonId: "lesson-1" },
      baseRevision: 1,
    });

    await f.coordinator.pump();

    expect(syncPosts()).toHaveLength(0);
    expect(await f.db.syncQueue.count()).toBe(1);
  });

  it("preserves the queue while offline and skips the request", async () => {
    const f = await loadFresh();
    await f.device.markAuthenticated("u1@example.com", "Test");
    await f.syncQueue.enqueue({
      entityType: "lesson_progress",
      entityId: "lesson-1",
      operation: "update",
      payload: { lessonId: "lesson-1" },
      baseRevision: 1,
    });
    setOnline(false);

    await f.coordinator.pump();

    setOnline(true);
    expect(syncPosts()).toHaveLength(0);
    expect(await f.db.syncQueue.count()).toBe(1);
    expect(f.coordinator.getSyncCoordinatorSnapshot().lastError).toBeNull();
  });

  it("issues no sync request at all when the queue is empty", async () => {
    const f = await loadFresh();
    await f.device.markAuthenticated("u1@example.com", "Test");
    await f.coordinator.pump();
    expect(syncPosts()).toHaveLength(0);
  });

  it("triggers automatically after a local mutation lands in the queue", async () => {
    const f = await loadFresh();
    await f.device.markAuthenticated("u1@example.com", "Test");
    const teardown = f.coordinator.initSyncCoordinator();
    // Startup reconcile inside init is async; let it settle without pending rows.
    await waitFor(() => f.coordinator.getSyncCoordinatorSnapshot().reconciled);

    await f.syncQueue.enqueue({
      entityType: "lesson_progress",
      entityId: "lesson-1",
      operation: "update",
      payload: { lessonId: "lesson-1" },
      baseRevision: 1,
    });

    // Dexie change hook -> scheduleSync(700ms debounce) -> single POST -> acked.
    await waitFor(async () => syncPosts().length >= 1 && (await f.db.syncQueue.count()) === 0);
    teardown();
  });
});

describe("sync coordinator acknowledgement safety", () => {
  // Requirement #6/#7: a queued mutation may only be removed once the server
  // has acknowledged *that exact* mutation. The queue coalesces create+delete
  // for one entity into a single row, so an in-flight create whose delete
  // lands mid-request must not have the newer delete discarded by the create's
  // acknowledgement.
  it("does not drop a delete that coalesces into an in-flight create", async () => {
    const f = await loadFresh();
    await f.device.markAuthenticated("u1@example.com", "Test");

    let raced = false;
    postHandler = async (call) => {
      const first = call.body?.mutations[0];
      // While the create POST is being served, a delete for the same entity
      // is enqueued, turning the shared queue row into a fresh pending delete.
      if (!raced && first?.operation === "create") {
        raced = true;
        await f.syncQueue.enqueue({
          entityType: "bookmark",
          entityId: "bm-1",
          operation: "delete",
          payload: { id: "bm-1", deletedAt: new Date().toISOString() },
          baseRevision: 2,
        });
      }
      return jsonResponse(syncResponse({ accepted: ["bm-1"] }));
    };

    await f.syncQueue.enqueue({
      entityType: "bookmark",
      entityId: "bm-1",
      operation: "create",
      payload: { id: "bm-1" },
      baseRevision: 1,
    });

    await f.coordinator.pump();

    expect(raced).toBe(true);
    // Create + delete both reach the server; the delete is never lost.
    const posts = syncPosts();
    expect(posts).toHaveLength(2);
    expect(posts[0].body?.mutations[0].operation).toBe("create");
    expect(posts[1].body?.mutations[0].operation).toBe("delete");
    expect(await f.db.syncQueue.count()).toBe(0);
  });

  it("leaves a coalesced mutation pending when a stale batch is rejected", async () => {
    const f = await loadFresh();
    await f.device.markAuthenticated("u1@example.com", "Test");

    let raced = false;
    postHandler = async (call) => {
      const first = call.body?.mutations[0];
      if (!raced && first?.operation === "create") {
        raced = true;
        await f.syncQueue.enqueue({
          entityType: "bookmark",
          entityId: "bm-1",
          operation: "update",
          payload: { id: "bm-1", title: "edited" },
          baseRevision: 2,
        });
      }
      // A 5xx on the create batch must not push the freshly-edited row toward
      // failure — the newer mutation is left pending untouched.
      return new Response(JSON.stringify({ error: "boom" }), { status: 503 });
    };

    await f.syncQueue.enqueue({
      entityType: "bookmark",
      entityId: "bm-1",
      operation: "create",
      payload: { id: "bm-1" },
      baseRevision: 1,
    });

    await f.coordinator.pump();

    expect(raced).toBe(true);
    const pending = await f.syncQueue.getPending();
    expect(pending).toHaveLength(1);
    expect(pending[0].operation).toBe("update");
    expect(pending[0].syncStatus).toBe("pending");
    expect(pending[0].retryCount).toBe(0);
  });
});

describe("sync coordinator manual drain", () => {
  it("Sync now performs a genuine sync even when the local profile was stuck on guest", async () => {
    installFetch(true);
    const f = await loadFresh();
    // The exact BUG-02 shape: session authenticated, stale guest flag, stranded row.
    await f.syncQueue.enqueue({
      entityType: "lesson_progress",
      entityId: "lesson-1",
      operation: "update",
      payload: { lessonId: "lesson-1", readingComplete: true },
      baseRevision: 1,
    });

    const result = await f.coordinator.requestManualSync();

    expect(result.reconciled).toBe(true);
    expect(syncPosts().length).toBeGreaterThanOrEqual(1);
    await waitFor(() => f.coordinator.getSyncCoordinatorSnapshot().syncing === false);
    expect(await f.db.syncQueue.count()).toBe(0);
    const profile = await f.device.getLocalProfile();
    expect(profile?.isAuthenticated).toBe(true);
  });
});

describe("sync coordinator acknowledgement and retry", () => {
  it("keeps the mutation and records retry state on a server error, then clears it", async () => {
    const f = await loadFresh();
    await f.device.markAuthenticated("u1@example.com", "Test");
    await f.syncQueue.enqueue({
      entityType: "lesson_progress",
      entityId: "lesson-1",
      operation: "update",
      payload: { lessonId: "lesson-1" },
      baseRevision: 1,
    });

    postHandler = () => new Response("boom", { status: 503 });
    await f.coordinator.pump();

    expect(f.coordinator.getSyncCoordinatorSnapshot().lastError).toMatch(/Sync failed: 503/);
    const queued = await f.db.syncQueue.toArray();
    expect(queued).toHaveLength(1);
    expect(queued[0].retryCount).toBe(1);
    expect(queued[0].syncStatus).toBe("pending");

    // Backoff window elapsed (simulated by aging the row), second attempt succeeds.
    postHandler = () => jsonResponse(syncResponse({ accepted: ["lesson-1"] }));
    await f.db.syncQueue.update(queued[0].id, {
      updatedAt: new Date(Date.now() - 60_000).toISOString(),
    });
    await f.coordinator.pump();

    expect(await f.db.syncQueue.count()).toBe(0);
    expect(f.coordinator.getSyncCoordinatorSnapshot().lastError).toBeNull();
  });

  it("removes queued mutations only when the server acknowledged them", async () => {
    const f = await loadFresh();
    await f.device.markAuthenticated("u1@example.com", "Test");
    await f.syncQueue.enqueue({
      entityType: "lesson_progress",
      entityId: "lesson-1",
      operation: "update",
      payload: { lessonId: "lesson-1" },
      baseRevision: 1,
    });

    postHandler = () =>
      jsonResponse(
        syncResponse({
          accepted: [],
          rejected: [{ entityId: "lesson-1", reason: "server busy", retryable: true }],
        })
      );
    await f.coordinator.pump();

    const queued = await f.db.syncQueue.toArray();
    expect(queued).toHaveLength(1);
    expect(queued[0].retryCount).toBe(1);
  });

  it("serializes concurrent pumps (single-flight) without duplicate posts", async () => {
    const f = await loadFresh();
    await f.device.markAuthenticated("u1@example.com", "Test");
    await f.syncQueue.enqueue({
      entityType: "lesson_progress",
      entityId: "lesson-1",
      operation: "update",
      payload: { lessonId: "lesson-1" },
      baseRevision: 1,
    });

    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    postHandler = async () => {
      await gate;
      return jsonResponse(syncResponse({ accepted: ["lesson-1"] }));
    };

    const first = f.coordinator.pump();
    expect(f.coordinator.getSyncCoordinatorSnapshot().syncing).toBe(true);
    const second = f.coordinator.pump(); // must join the in-flight cycle, not re-fetch
    release();
    await Promise.all([first, second]);

    expect(syncPosts()).toHaveLength(1);
    expect(await f.db.syncQueue.count()).toBe(0);
  });

  it("re-runs to flush mutations enqueued mid-flight", async () => {
    const f = await loadFresh();
    await f.device.markAuthenticated("u1@example.com", "Test");
    await f.syncQueue.enqueue({
      entityType: "lesson_progress",
      entityId: "lesson-1",
      operation: "update",
      payload: { lessonId: "lesson-1" },
      baseRevision: 1,
    });

    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    postHandler = async (call) => {
      if (call.body?.mutations.some((m) => m.entityId === "lesson-2")) {
        return jsonResponse(syncResponse({ accepted: ["lesson-2"] }));
      }
      await gate;
      return jsonResponse(syncResponse({ accepted: ["lesson-1"] }));
    };

    const first = f.coordinator.pump();
    await f.syncQueue.enqueue({
      entityType: "lesson_progress",
      entityId: "lesson-2",
      operation: "update",
      payload: { lessonId: "lesson-2" },
      baseRevision: 1,
    });
    release();
    await first;

    await waitFor(async () => (await f.db.syncQueue.count()) === 0);
    expect(syncPosts().length).toBeGreaterThanOrEqual(2);
  });

  it("resumes draining when the browser reports reconnection", async () => {
    const f = await loadFresh();
    await f.device.markAuthenticated("u1@example.com", "Test");
    await f.syncQueue.enqueue({
      entityType: "lesson_progress",
      entityId: "lesson-1",
      operation: "update",
      payload: { lessonId: "lesson-1" },
      baseRevision: 1,
    });

    setOnline(false);
    await f.coordinator.pump();
    expect(await f.db.syncQueue.count()).toBe(1);

    setOnline(true);
    const teardown = f.coordinator.initSyncCoordinator();
    window.dispatchEvent(new Event("online"));
    await waitFor(async () => syncPosts().length >= 1 && (await f.db.syncQueue.count()) === 0);
    teardown();
  });
});

describe("sync coordinator profile reconciliation", () => {
  it("does not download account history on a device's first (bootstrap) sync", async () => {
    installFetch(true);
    const f = await loadFresh();
    await f.device.markAuthenticated("u1@example.com", "Test");

    // Ensure syncMetadata exists but has no cursor (bootstrap state)
    await f.db.syncMetadata.put({
      id: "sync_meta",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      localRevision: 1,
      syncStatus: "synced",
      lastSyncCursor: null,
      lastSuccessfulSync: null,
      pendingCount: 0,
      deviceId: "test-device",
    });

    // The server answers a null-cursor request with the entire account
    // history. On bootstrap the client must NOT merge those foreign rows
    // (account isolation, req #8); it only uploads local work.
    postHandler = () =>
      jsonResponse(
        syncResponse({
          accepted: ["bm-1"],
          remoteChanges: [
            {
              entityType: "bookmark",
              entityId: "foreign-bm",
              operation: "upsert",
              data: { id: "foreign-bm", lessonId: "other", title: "Foreign", targetType: "lesson" },
              updatedAt: new Date().toISOString(),
            },
          ],
        })
      );
    await f.syncQueue.enqueue({
      entityType: "bookmark",
      entityId: "bm-1",
      operation: "create",
      payload: { id: "bm-1", lessonId: "bm-1", title: "Mine", targetType: "lesson" },
      baseRevision: 0,
    });
    await f.coordinator.pump();
    expect(await f.db.bookmarks.get("foreign-bm")).toBeUndefined();

    // A later sync (cursor advanced) DOES apply real-time remote deltas.
    postHandler = () =>
      jsonResponse(
        syncResponse({
          accepted: [],
          remoteChanges: [
            {
              entityType: "bookmark",
              entityId: "delta-bm",
              operation: "upsert",
              data: { id: "delta-bm", lessonId: "l2", title: "Delta", targetType: "lesson" },
              updatedAt: new Date().toISOString(),
            },
          ],
        })
      );
    await f.syncQueue.enqueue({
      entityType: "bookmark",
      entityId: "bm-2",
      operation: "create",
      payload: { id: "bm-2", lessonId: "bm-2", title: "Mine2", targetType: "lesson" },
      baseRevision: 0,
    });
    await f.coordinator.pump();
    expect(await f.db.bookmarks.get("delta-bm")).toBeTruthy();
  });

  it("passively detecting an existing session promotes the profile without pulling the cloud snapshot", async () => {
    installFetch(true);
    const f = await loadFresh();
    // A local pending mutation exists, but a passive reconcile (page load that
    // merely notices an authenticated cookie) must NOT download the full cloud
    // snapshot — that would merge another device/session's rows into this
    // client and break account isolation (req #8). It only pushes local work.
    await f.syncQueue.enqueue({
      entityType: "lesson_progress",
      entityId: "lesson-1",
      operation: "update",
      payload: { lessonId: "lesson-1" },
      baseRevision: 1,
    });
    const result = await f.coordinator.ensureProfileReconciled();
    expect(result.authenticated).toBe(true);
    const profile = await f.device.getLocalProfile();
    expect(profile?.isAuthenticated).toBe(true);
    // No GET pull; the only traffic is the create->flush upload of local work.
    expect(calls.some((c) => c.method === "GET")).toBe(false);
    await waitFor(async () => (await f.db.syncQueue.count()) === 0);
    expect(syncPosts().length).toBeGreaterThanOrEqual(1);
  });

  it("an explicit merge (forceMerge) pulls the cloud snapshot on sign-in", async () => {
    installFetch(true);
    const f = await loadFresh();
    // The settings sign-in path keeps the genuine guest->account merge: it
    // downloads cloud state before flushing local mutations.
    await f.syncQueue.enqueue({
      entityType: "lesson_progress",
      entityId: "lesson-1",
      operation: "update",
      payload: { lessonId: "lesson-1" },
      baseRevision: 1,
    });
    const result = await f.coordinator.ensureProfileReconciled({ forceMerge: true });
    expect(result.authenticated).toBe(true);
    expect(calls.some((c) => c.method === "GET" && c.url.includes("/api/sync/v1"))).toBe(true);
  });

  it("restores the cloud snapshot on an explicit merge even after a passive reconcile promoted the profile (cross-device)", async () => {
    installFetch(true);
    const f = await loadFresh();
    // Real-world ordering (Device B, empty IndexedDB): the root-layout
    // coordinator runs a *passive* reconcile on mount which promotes the
    // profile but must never pull (account isolation), and only afterwards does
    // the Settings / Sync-now surface request an *explicit* merge. The explicit
    // merge must still restore the account's cloud progress on this empty
    // device — gating the pull solely on the guest->auth transition stranded
    // it once the passive reconcile had already promoted the profile.
    await f.coordinator.ensureProfileReconciled();
    expect(calls.some((c) => c.method === "GET")).toBe(false);
    expect((await f.device.getLocalProfile())?.isAuthenticated).toBe(true);

    calls = [];
    const result = await f.coordinator.ensureProfileReconciled({ forceMerge: true });
    expect(result.authenticated).toBe(true);
    expect(calls.some((c) => c.method === "GET" && c.url.includes("/api/sync/v1"))).toBe(true);
  });

  it("does not re-download the same account's cloud snapshot on a repeat explicit merge", async () => {
    installFetch(true);
    const f = await loadFresh();
    await f.coordinator.ensureProfileReconciled({ forceMerge: true });
    expect(calls.some((c) => c.method === "GET" && c.url.includes("/api/sync/v1"))).toBe(true);
    calls = [];
    await f.coordinator.ensureProfileReconciled({ forceMerge: true });
    expect(calls.some((c) => c.method === "GET")).toBe(false);
  });

  it("restores another device's cloud lesson into local IndexedDB on an explicit merge", async () => {
    // Device B content restore: the explicit merge downloads the account's
    // cloud snapshot and performGuestAccountMerge writes the lesson locally,
    // so Device A's progress is visible on Device B without B re-marking it.
    installFetch(true);
    cloudSnapshot = {
      ...CLOUD_SNAPSHOT,
      lessons: [
        {
          lessonId: "restored-lesson",
          status: "in_progress",
          readingComplete: true,
          localRevision: 1,
        },
      ],
    };
    const f = await loadFresh();
    await f.coordinator.ensureProfileReconciled(); // passive promote
    await f.coordinator.ensureProfileReconciled({ forceMerge: true }); // explicit restore
    const row = await f.db.lessonProgress
      .where("lessonId")
      .equals("restored-lesson")
      .first();
    expect(row?.readingComplete).toBe(true);
    expect(row?.syncStatus).toBe("synced");
    // A restored (cloud-newer) record must not be echoed straight back up.
    expect(await f.db.syncQueue.count()).toBe(0);
  });

  it("a fresh empty device produces zero sync traffic", async () => {
    installFetch(true);
    const f = await loadFresh();
    // Empty local store: nothing to protect or upload -> zero sync traffic.
    const result = await f.coordinator.ensureProfileReconciled();
    expect(result.authenticated).toBe(true);
    const profile = await f.device.getLocalProfile();
    expect(profile?.isAuthenticated).toBe(true);
    expect(calls.filter((c) => c.url.includes("/api/sync/v1"))).toHaveLength(0);
  });

  it("authenticated -> signed-out demotes the profile and stops syncing", async () => {
    installFetch(false);
    const f = await loadFresh();
    await f.device.markAuthenticated("u1@example.com", "Test");
    const result = await f.coordinator.ensureProfileReconciled();
    expect(result.authenticated).toBe(false);
    const profile = await f.device.getLocalProfile();
    expect(profile?.isAuthenticated).toBeFalsy();
    expect(syncPosts()).toHaveLength(0);
  });
});

describe("local storage retention (BUG-10)", () => {
  it("prunes stale local tombstones only after an acknowledged cycle", async () => {
    const f = await loadFresh();
    await f.device.markAuthenticated("u1@example.com", "Test");
    const oldIso = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString();
    const recentIso = new Date().toISOString();
    await f.db.tombstones.put({
      id: "tomb-old",
      createdAt: oldIso,
      updatedAt: oldIso,
      localRevision: 1,
      syncStatus: "synced",
      entityId: "note-old",
      entityType: "note",
      deletedAt: oldIso,
      revision: 1,
    });
    await f.db.tombstones.put({
      id: "tomb-new",
      createdAt: recentIso,
      updatedAt: recentIso,
      localRevision: 1,
      syncStatus: "synced",
      entityId: "note-new",
      entityType: "note",
      deletedAt: recentIso,
      revision: 1,
    });
    await f.syncQueue.enqueue({
      entityType: "lesson_progress",
      entityId: "lesson-1",
      operation: "update",
      payload: { lessonId: "lesson-1" },
      baseRevision: 1,
    });

    await f.coordinator.pump();

    expect(await f.db.tombstones.get("tomb-old")).toBeUndefined();
    expect(await f.db.tombstones.get("tomb-new")).toBeDefined();
  });

  it("does not prune tombstones when the cycle was never acknowledged", async () => {
    const f = await loadFresh();
    await f.device.markAuthenticated("u1@example.com", "Test");
    const oldIso = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString();
    await f.db.tombstones.put({
      id: "tomb-old",
      createdAt: oldIso,
      updatedAt: oldIso,
      localRevision: 1,
      syncStatus: "synced",
      entityId: "note-old",
      entityType: "note",
      deletedAt: oldIso,
      revision: 1,
    });

    postHandler = () => new Response("boom", { status: 503 });
    await f.coordinator.pump();

    expect(await f.db.tombstones.get("tomb-old")).toBeDefined();
  });
});
