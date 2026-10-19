import { afterEach, describe, expect, it, vi } from "vitest";
import { checkRateLimit } from "@/lib/security/rate-limit";

describe("in-memory rate limiter", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows up to the limit and rejects the next request", () => {
    const key = `test-${crypto.randomUUID()}`;
    expect(checkRateLimit(key, { limit: 2, windowMs: 60_000 }).allowed).toBe(true);
    expect(checkRateLimit(key, { limit: 2, windowMs: 60_000 }).allowed).toBe(true);
    const rejected = checkRateLimit(key, { limit: 2, windowMs: 60_000 });
    expect(rejected.allowed).toBe(false);
    expect(rejected.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("keeps clients isolated and resets expired buckets", () => {
    vi.useFakeTimers();
    const first = `test-${crypto.randomUUID()}`;
    const second = `test-${crypto.randomUUID()}`;
    expect(checkRateLimit(first, { limit: 1, windowMs: 1 }).allowed).toBe(true);
    expect(checkRateLimit(first, { limit: 1, windowMs: 1 }).allowed).toBe(false);
    expect(checkRateLimit(second, { limit: 1, windowMs: 1 }).allowed).toBe(true);
    vi.advanceTimersByTime(5);
    expect(checkRateLimit(first, { limit: 1, windowMs: 1 }).allowed).toBe(true);
  });
});
