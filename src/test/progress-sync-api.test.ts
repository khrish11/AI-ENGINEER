import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { randomUUID } from "crypto";
import { existsSync, readFileSync } from "fs";
import { and, eq } from "drizzle-orm";

const TEST_USER_ID = "00000000-0000-4000-8000-0000000000aa";

const authState = vi.hoisted(() => ({ userId: null as string | null }));

vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedUserId: async () => authState.userId,
}));

/**
 * These tests exercise the real `/api/sync/v1` handler against PostgreSQL to
 * prove sync_batches idempotency end-to-end. They are skipped when no database
 * is configured (e.g. a CI job without PostgreSQL).
 */
function hasDatabaseUrl(): boolean {
  if (process.env.DATABASE_URL) return true;
  // src/db/index.ts loads .env.local, but this guard runs before import.
  try {
    if (!existsSync(".env.local")) return false;
    return /^DATABASE_URL=/m.test(readFileSync(".env.local", "utf8"));
  } catch {
    return false;
  }
}

const HAS_DATABASE = hasDatabaseUrl();

const describeWithDb = HAS_DATABASE ? describe : describe.skip;

describeWithDb("sync API (PostgreSQL)", () => {
  let POST: (request: unknown) => Promise<Response>;
  let GET: () => Promise<Response>;
  let dbModule: typeof import("@/db");
  let schema: typeof import("@/db/schema");

  beforeAll(async () => {
    authState.userId = TEST_USER_ID;
    dbModule = await import("@/db");
    schema = await import("@/db/schema");
    const route = await import("@/app/api/sync/v1/route");
    POST = route.POST as unknown as (request: unknown) => Promise<Response>;
    GET = route.GET as unknown as () => Promise<Response>;

    await dbModule.db
      .insert(schema.users)
      .values({ id: TEST_USER_ID, email: "phase4-sync-test@example.invalid" })
      .onConflictDoNothing();
  });

  afterAll(async () => {
    if (!dbModule) return;
    await dbModule.db.delete(schema.users).where(eq(schema.users.id, TEST_USER_ID));
    dbModule.getDbClient().end();
  });

  const lessonId = "11111111-1111-4111-8111-1111111111aa";

  it("returns the identical response for a repeated client batch", async () => {
    const clientBatchId = randomUUID();
    const request = {
      clientBatchId,
      deviceId: randomUUID(),
      lastSyncCursor: null,
      mutations: [
        {
          mutationId: randomUUID(),
          entityType: "lesson_progress",
          entityId: lessonId,
          operation: "update",
          payload: {
            lessonId,
            status: "completed",
            readingComplete: true,
            completedAt: "2026-10-17T09:00:00.000Z",
          },
          baseRevision: 0,
        },
      ],
    };

    const makeRequest = () => ({ json: async () => request });

    const first = await POST(makeRequest());
    expect(first.status).toBe(200);
    const firstBody = await first.json();

    const second = await POST(makeRequest());
    expect(second.status).toBe(200);
    const secondBody = await second.json();

    expect(secondBody).toEqual(firstBody);
    expect(firstBody.accepted).toEqual([lessonId]);

    const batches = await dbModule.db
      .select()
      .from(schema.syncBatches)
      .where(
        and(
          eq(schema.syncBatches.userId, TEST_USER_ID),
          eq(schema.syncBatches.clientBatchId, clientBatchId)
        )
      );
    expect(batches).toHaveLength(1);

    const lessons = await dbModule.db
      .select()
      .from(schema.userLessonProgress)
      .where(
        and(
          eq(schema.userLessonProgress.userId, TEST_USER_ID),
          eq(schema.userLessonProgress.lessonKey, lessonId)
        )
      );
    expect(lessons).toHaveLength(1);
    expect(lessons[0].status).toBe("completed");
  });

  it("never downgrades lesson status from a stale client", async () => {
    const request = {
      clientBatchId: randomUUID(),
      deviceId: randomUUID(),
      lastSyncCursor: null,
      mutations: [
        {
          mutationId: randomUUID(),
          entityType: "lesson_progress",
          entityId: lessonId,
          operation: "update",
          payload: {
            lessonId,
            status: "in_progress",
            readingComplete: false,
            completedAt: "2026-10-18T09:00:00.000Z",
          },
          baseRevision: 1,
        },
      ],
    };

    const response = await POST({ json: async () => request });
    expect(response.status).toBe(200);

    const lessons = await dbModule.db
      .select()
      .from(schema.userLessonProgress)
      .where(
        and(
          eq(schema.userLessonProgress.userId, TEST_USER_ID),
          eq(schema.userLessonProgress.lessonKey, lessonId)
        )
      );
    expect(lessons[0].status).toBe("completed");
    expect(lessons[0].readingComplete).toBe(true);
    expect(lessons[0].completedAt?.toISOString()).toBe("2026-10-17T09:00:00.000Z");
  });

  it("returns a private cloud snapshot for the authenticated user", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    const snapshot = await response.json();
    expect(Array.isArray(snapshot.lessons)).toBe(true);
    expect(snapshot.lessons.some((row: { lessonId: string }) => row.lessonId === lessonId)).toBe(
      true
    );
  });

  it("rejects requests without a session instead of trusting a client userId", async () => {
    authState.userId = null;
    const response = await POST({ json: async () => ({}) });
    expect(response.status).toBe(401);
    authState.userId = TEST_USER_ID;
  });
});
