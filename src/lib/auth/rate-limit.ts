import { db } from "@/db";
import { rateLimits } from "@/db/schema";
import { lt } from "drizzle-orm";
import { getDbClient } from "@/db";

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  maxRequests: 1000,
  windowMs: 3600000, // 1 hour
};

const PUBLIC_CONFIG: RateLimitConfig = {
  maxRequests: 60,
  windowMs: 60000, // 1 minute
};

/**
 * Atomically check and increment a rate limit using a fixed-window counter.
 *
 * Windows are aligned to fixed boundaries (floor(now / windowMs) * windowMs)
 * so all requests in the same window share one row, making the
 * (identifier, endpoint, window_start) unique constraint effective.
 *
 * The INSERT ... ON CONFLICT DO UPDATE is a single atomic statement:
 * concurrent requests serialize on the row lock, so counts cannot be
 * lost or bypassed across serverless instances.
 */
export async function checkRateLimit(
  identifier: string,
  endpoint: string,
  config: RateLimitConfig = DEFAULT_CONFIG
): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
  const sql = getDbClient();
  const now = Date.now();
  const windowStartMs = Math.floor(now / config.windowMs) * config.windowMs;
  const windowStart = new Date(windowStartMs);
  const windowEnd = new Date(windowStartMs + config.windowMs);

  // Opportunistic cleanup of expired windows (cheap, indexed on window_end)
  await db.delete(rateLimits).where(lt(rateLimits.windowEnd, new Date(now)));

  // Atomic upsert: insert count=1 for a new window, or increment existing.
  // RETURNING gives the post-increment count in the same statement.
  const rows = await sql`
    INSERT INTO rate_limits (identifier, endpoint, count, window_start, window_end)
    VALUES (${identifier}, ${endpoint}, 1, ${windowStart}, ${windowEnd})
    ON CONFLICT (identifier, endpoint, window_start)
    DO UPDATE SET count = rate_limits.count + 1
    RETURNING count, window_end
  `;

  const row = rows[0] as { count: number; window_end: Date };
  const count = row.count;
  const resetAt = new Date(row.window_end);

  if (count > config.maxRequests) {
    return { allowed: false, remaining: 0, resetAt };
  }

  return {
    allowed: true,
    remaining: config.maxRequests - count,
    resetAt,
  };
}

export async function checkRateLimitByApiKey(
  apiKey: string,
  endpoint: string
): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
  const identifier = apiKey.substring(0, 16); // Use key prefix as identifier
  return checkRateLimit(identifier, endpoint, DEFAULT_CONFIG);
}

export async function checkRateLimitByIp(
  ip: string,
  endpoint: string
): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
  return checkRateLimit(ip, endpoint, PUBLIC_CONFIG);
}
