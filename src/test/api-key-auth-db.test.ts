import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { existsSync, readFileSync } from "fs";

/**
 * Real PostgreSQL coverage for the authenticated /api/v1 path:
 * API-key lifecycle (create/validate/expire/revoke) and the atomic
 * rate-limit upsert that previously 500'd on Date parameters.
 * Skipped unless DATABASE_URL points at the disposable test database.
 */
function hasTestDatabase(): boolean {
  const url = process.env.DATABASE_URL;
  if (url) return url.includes("ai_engineer_os_test");
  try {
    if (!existsSync(".env.local")) return false;
    const m = readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.+)$/m);
    return Boolean(m && m[1].includes("ai_engineer_os_test"));
  } catch {
    return false;
  }
}

const describeWithDb = hasTestDatabase() ? describe : describe.skip;

describeWithDb("API key auth against PostgreSQL", () => {
  let dbModule: typeof import("@/db");
  let schema: typeof import("@/db/schema");
  let svc: typeof import("@/lib/auth/api-keys-service");
  let rl: typeof import("@/lib/auth/rate-limit");
  let userId: string;
  const createdKeyIds: string[] = [];

  beforeAll(async () => {
    dbModule = await import("@/db");
    schema = await import("@/db/schema");
    svc = await import("@/lib/auth/api-keys-service");
    rl = await import("@/lib/auth/rate-limit");

    userId = randomUUID();
    await dbModule.db.insert(schema.users).values({
      id: userId,
      name: "apikey-test",
      email: `apikey-${userId}@test.local`,
    });
  });

  afterAll(async () => {
    for (const id of createdKeyIds) {
      await dbModule.db.delete(schema.apiKeys).where(eq(schema.apiKeys.id, id));
    }
    await dbModule.db.delete(schema.users).where(eq(schema.users.id, userId));
  });

  it("creates, validates, and revokes a key end-to-end", async () => {
    const created = await svc.generateApiKey(userId, "test-key", "read");
    createdKeyIds.push(created.id);

    const valid = await svc.validateApiKey(created.secretKey);
    expect(valid.valid).toBe(true);
    expect(valid.apiKey?.userId).toBe(userId);
    expect(valid.apiKey?.lastUsedAt).not.toBeNull();

    const wrong = await svc.validateApiKey("aios_" + "0".repeat(64));
    expect(wrong.valid).toBe(false);

    const revoked = await svc.revokeApiKey(userId, created.id);
    expect(revoked).toBe(true);
    const afterRevoke = await svc.validateApiKey(created.secretKey);
    expect(afterRevoke.valid).toBe(false);
  });

  it("rejects expired keys", async () => {
    const past = new Date(Date.now() - 1000);
    const created = await svc.generateApiKey(userId, "expired-key", "read", past);
    createdKeyIds.push(created.id);
    const result = await svc.validateApiKey(created.secretKey);
    expect(result.valid).toBe(false);
  });

  it("enforces ownership isolation on list and revoke", async () => {
    const otherUser = randomUUID();
    await dbModule.db.insert(schema.users).values({
      id: otherUser,
      name: "other",
      email: `other-${otherUser}@test.local`,
    });
    try {
      const created = await svc.generateApiKey(userId, "owner-key", "read");
      createdKeyIds.push(created.id);

      const otherList = await svc.listApiKeys(otherUser);
      expect(otherList.find((k) => k.id === created.id)).toBeUndefined();

      const stolen = await svc.revokeApiKey(otherUser, created.id);
      expect(stolen).toBe(false);
    } finally {
      await dbModule.db.delete(schema.users).where(eq(schema.users.id, otherUser));
    }
  });

  it("rate limiter increments atomically and denies past the limit", async () => {
    const identifier = `test-${randomUUID().slice(0, 8)}`;
    const endpoint = "/api/v1/phases";
    const config = { maxRequests: 3, windowMs: 60000 };

    const results = await Promise.all(
      Array.from({ length: 6 }, () => rl.checkRateLimit(identifier, endpoint, config))
    );
    const allowed = results.filter((r) => r.allowed).length;
    const denied = results.filter((r) => !r.allowed).length;

    // With an atomic upsert, exactly maxRequests succeed regardless of
    // concurrency; the old read-then-write path could over-admit.
    expect(allowed).toBeLessThanOrEqual(config.maxRequests);
    expect(denied).toBeGreaterThanOrEqual(6 - config.maxRequests);
    expect(results[0].resetAt).toBeInstanceOf(Date);
  });
});
