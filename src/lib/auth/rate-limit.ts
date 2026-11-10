import { db } from "@/db";
import { rateLimits } from "@/db/schema";
import { eq, and, gt, lt } from "drizzle-orm";

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

export async function checkRateLimit(
  identifier: string,
  endpoint: string,
  config: RateLimitConfig = DEFAULT_CONFIG
): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - config.windowMs);
  const windowEnd = new Date(now.getTime() + config.windowMs);

  // Clean up old entries
  await db
    .delete(rateLimits)
    .where(lt(rateLimits.windowEnd, now));

  // Get or create rate limit record
  const [existing] = await db
    .select()
    .from(rateLimits)
    .where(
      and(
        eq(rateLimits.identifier, identifier),
        eq(rateLimits.endpoint, endpoint),
        gt(rateLimits.windowEnd, now)
      )
    )
    .limit(1);

  if (!existing) {
    await db.insert(rateLimits).values({
      identifier,
      endpoint,
      count: 1,
      windowStart: now,
      windowEnd,
    });

    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetAt: windowEnd,
    };
  }

  if (existing.count >= config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: existing.windowEnd,
    };
  }

  // Increment count
  await db
    .update(rateLimits)
    .set({ count: existing.count + 1 })
    .where(eq(rateLimits.id, existing.id));

  return {
    allowed: true,
    remaining: config.maxRequests - existing.count - 1,
    resetAt: existing.windowEnd,
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
