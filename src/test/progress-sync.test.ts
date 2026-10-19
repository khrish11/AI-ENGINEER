import { describe, it, expect } from "vitest";
import {
  MemorySyncStore,
  processSyncBatch,
  dedupeStudySessions,
  mergeGuestAndCloud,
  mergeMasteryScore,
} from "@/lib/progress/sync/engine";
import type { SyncMutation, SyncRequest } from "@/lib/progress/sync/protocol";
import { mergeLessonRecords } from "@/lib/progress/merge";
import { SyncRequestSchema } from "@/lib/progress/sync/protocol";

const USER = "user-1";
const BATCH = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const DEVICE = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function request(mutations: SyncMutation[], clientBatchId = BATCH): SyncRequest {
  return {
    clientBatchId,
    deviceId: DEVICE,
    lastSyncCursor: null,
    mutations,
  };
}

function lessonMutation(
  entityId: string,
  payload: Record<string, unknown>,
  baseRevision = 0
): SyncMutation {
  return {
    entityType: "lesson_progress",
    entityId,
    operation: "update",
    payload: { lessonId: entityId, ...payload },
    baseRevision,
  };
}

describe("sync protocol schema", () => {
  it("rejects a batch without clientBatchId", () => {
    const result = SyncRequestSchema.safeParse({
      deviceId: DEVICE,
      mutations: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-uuid batch ids", () => {
    const result = SyncRequestSchema.safeParse({
      clientBatchId: "not-a-uuid",
      deviceId: DEVICE,
      mutations: [],
    });
    expect(result.success).toBe(false);
  });
});

describe("sync engine idempotency", () => {
  it("returns the identical prior response for a repeated batch", () => {
    const store = new MemorySyncStore();
    const batch = request([lessonMutation("lesson-1", { status: "in_progress", readingComplete: true })]);

    const first = processSyncBatch(store, USER, batch);
    const revisionAfterFirst = store.getUser(USER).lessons.get("lesson-1")?.localRevision;
    const second = processSyncBatch(store, USER, batch);
    const revisionAfterSecond = store.getUser(USER).lessons.get("lesson-1")?.localRevision;

    expect(second).toEqual(first);
    expect(revisionAfterSecond).toBe(revisionAfterFirst);
    expect(first.accepted).toEqual(["lesson-1"]);
  });

  it("processes a new batch id exactly once", () => {
    const store = new MemorySyncStore();
    const mutation = lessonMutation("lesson-1", { status: "in_progress" });
    const first = processSyncBatch(store, USER, request([mutation]));
    const second = processSyncBatch(
      store,
      USER,
      request([mutation], "cccccccc-cccc-4ccc-8ccc-cccccccccccc")
    );
    expect(first.nextSyncCursor).toBeTruthy();
    expect(second.nextSyncCursor).toBeTruthy();
    expect(store.getUser(USER).lessons.size).toBe(1);
  });
});

describe("lesson progress monotonic sync", () => {
  it("never lets a stale client downgrade a completed lesson", () => {
    const store = new MemorySyncStore();
    processSyncBatch(
      store,
      USER,
      request([
        lessonMutation("lesson-1", {
          status: "completed",
          readingComplete: true,
          completedAt: "2026-10-01T00:00:00.000Z",
        }),
      ])
    );
    processSyncBatch(
      store,
      USER,
      request(
        [
          lessonMutation(
            "lesson-1",
            {
              status: "in_progress",
              readingComplete: false,
              completedAt: "2026-10-02T00:00:00.000Z",
            },
            1
          ),
        ],
        "dddddddd-dddd-4ddd-8ddd-dddddddddddd"
      )
    );

    const record = store.getUser(USER).lessons.get("lesson-1");
    expect(record?.status).toBe("completed");
    expect(record?.readingComplete).toBe(true);
    // Completion timestamps keep the earliest proven completion.
    expect(record?.completedAt).toBe("2026-10-01T00:00:00.000Z");
  });

  it("keeps the best mastery score", () => {
    expect(mergeMasteryScore(60, 85)).toBe(85);
    expect(mergeMasteryScore(85, 60)).toBe(85);
    expect(mergeMasteryScore(null, 70)).toBe(70);
    expect(mergeMasteryScore(70, null)).toBe(70);
    expect(mergeMasteryScore(undefined, "bad")).toBeNull();
  });

  it("merges independent completion fields with OR logic", () => {
    const merged = mergeLessonRecords(
      {
        lessonId: "l",
        status: "in_progress",
        readingComplete: true,
        practiceComplete: false,
      },
      {
        lessonId: "l",
        status: "in_progress",
        readingComplete: false,
        practiceComplete: true,
      }
    );
    expect(merged.readingComplete).toBe(true);
    expect(merged.practiceComplete).toBe(true);
  });
});

describe("resource progress monotonic sync", () => {
  it("never regresses a completed resource", () => {
    const store = new MemorySyncStore();
    processSyncBatch(store, USER, {
      ...request([
        {
          entityType: "resource_progress",
          entityId: "res-1",
          operation: "update",
          payload: { resourceId: "res-1", started: true, completed: true },
          baseRevision: 0,
        },
      ]),
    });
    processSyncBatch(store, USER, {
      ...request(
        [
          {
            entityType: "resource_progress",
            entityId: "res-1",
            operation: "update",
            payload: { resourceId: "res-1", started: true, completed: false },
            baseRevision: 1,
          },
        ],
        "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"
      ),
    });
    const record = store.getUser(USER).resources.get("res-1");
    expect(record?.completed).toBe(true);
    expect(record?.started).toBe(true);
  });
});

describe("bookmark tombstones", () => {
  it("records a tombstone and keeps the bookmark deleted", () => {
    const store = new MemorySyncStore();
    processSyncBatch(store, USER, {
      ...request([
        {
          entityType: "bookmark",
          entityId: "bm-1",
          operation: "create",
          payload: { lessonId: "lesson-1", targetType: "lesson" },
          baseRevision: 0,
        },
      ]),
    });
    processSyncBatch(store, USER, {
      ...request(
        [
          {
            entityType: "bookmark",
            entityId: "bm-1",
            operation: "delete",
            payload: { localRevision: 2 },
            baseRevision: 1,
          },
        ],
        "ffffffff-ffff-4fff-8fff-ffffffffffff"
      ),
    });

    const user = store.getUser(USER);
    expect(user.bookmarks.get("bm-1")?.deletedAt).toBeTruthy();
    expect(user.tombstones.get("bookmark:bm-1")?.entityType).toBe("bookmark");
  });

  it("ignores an add for an already deleted bookmark", () => {
    const store = new MemorySyncStore();
    processSyncBatch(store, USER, {
      ...request([
        {
          entityType: "bookmark",
          entityId: "bm-1",
          operation: "delete",
          payload: {},
          baseRevision: 0,
        },
      ]),
    });
    processSyncBatch(store, USER, {
      ...request(
        [
          {
            entityType: "bookmark",
            entityId: "bm-1",
            operation: "create",
            payload: { lessonId: "lesson-1" },
            baseRevision: 1,
          },
        ],
        "99999999-9999-4999-8999-999999999999"
      ),
    });
    expect(store.getUser(USER).bookmarks.get("bm-1")?.deletedAt).toBeTruthy();
  });
});

describe("study sessions", () => {
  it("deduplicates by client session id and sums unique durations", () => {
    const store = new MemorySyncStore();
    processSyncBatch(store, USER, {
      ...request([
        {
          entityType: "study_session",
          entityId: "s-1",
          operation: "create",
          payload: { clientSessionId: "client-1", deviceId: DEVICE, durationSeconds: 600 },
          baseRevision: 0,
        },
        {
          entityType: "study_session",
          entityId: "s-2",
          operation: "create",
          payload: { clientSessionId: "client-1", deviceId: DEVICE, durationSeconds: 600 },
          baseRevision: 0,
        },
      ]),
    });

    const sessions = [...store.getUser(USER).studySessions.values()];
    expect(sessions).toHaveLength(1);
    expect(
      dedupeStudySessions(sessions.map((s) => ({
        clientSessionId: s.clientSessionId,
        durationSeconds: s.durationSeconds,
      }))).totalSeconds
    ).toBe(600);
  });
});

describe("quiz attempts", () => {
  it("preserves the first immutable attempt for a given attempt id", () => {
    const store = new MemorySyncStore();
    processSyncBatch(store, USER, {
      ...request([
        {
          entityType: "quiz_attempt",
          entityId: "attempt-1",
          operation: "create",
          payload: { attemptId: "attempt-1", lessonId: "l", score: 8, percentage: 80 },
          baseRevision: 0,
        },
      ]),
    });
    processSyncBatch(store, USER, {
      ...request(
        [
          {
            entityType: "quiz_attempt",
            entityId: "attempt-1",
            operation: "create",
            payload: { attemptId: "attempt-1", lessonId: "l", score: 1, percentage: 10 },
            baseRevision: 1,
          },
        ],
        "12121212-1212-4212-8212-121212121212"
      ),
    });

    const attempts = [...store.getUser(USER).quizAttempts.values()];
    expect(attempts).toHaveLength(1);
    expect(attempts[0].percentage).toBe(80);
  });
});

describe("note conflicts", () => {
  it("preserves both copies when local and remote changed from the same base", () => {
    const store = new MemorySyncStore();
    processSyncBatch(store, USER, {
      ...request([
        {
          entityType: "note",
          entityId: "note-1",
          operation: "update",
          payload: { content: "base" },
          baseRevision: 0,
        },
      ]),
    });
    processSyncBatch(store, USER, {
      ...request(
        [
          {
            entityType: "note",
            entityId: "note-1",
            operation: "update",
            payload: { content: "remote version" },
            baseRevision: 2,
          },
        ],
        "13131313-1313-4313-8313-131313131313"
      ),
    });
    const result = processSyncBatch(store, USER, {
      ...request(
        [
          {
            entityType: "note",
            entityId: "note-1",
            operation: "update",
            payload: { content: "local version" },
            baseRevision: 1,
          },
        ],
        "14141414-1414-4414-8414-141414141414"
      ),
    });

    expect(result.conflicts).toHaveLength(1);
    const note = store.getUser(USER).notes.get("note-1");
    expect(note?.conflictState).toBe("unresolved");
    // The conflicting local content is preserved as a backup, not discarded.
    expect(note?.conflictBackup).toBe("local version");
  });
});

describe("mergeGuestAndCloud", () => {
  it("counts local-only and cloud-only records while unioning ids", () => {
    const merged = mergeGuestAndCloud(
      [
        { id: "a", localRevision: 1 },
        { id: "b", localRevision: 1 },
      ],
      [
        { id: "b", localRevision: 2 },
        { id: "c", localRevision: 1 },
      ],
      (local, cloud) => local ?? cloud!
    );
    expect(merged.merged).toHaveLength(3);
    expect(merged.localUploaded).toBe(1);
    expect(merged.cloudPreserved).toBe(2);
  });
});
