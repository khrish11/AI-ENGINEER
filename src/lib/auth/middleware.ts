import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "./api-keys-service";
import { checkRateLimitByApiKey, checkRateLimitByIp } from "./rate-limit";
import { headers } from "next/headers";

export function extractApiKey(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization");
  const bearerKey = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : null;
  return bearerKey || request.headers.get("x-api-key");
}

export async function withApiKeyAuth(request: NextRequest) {
  const apiKey = extractApiKey(request);

  if (!apiKey) {
    // Fall back to IP-based rate limiting
    const headersList = await headers();
    const ip = headersList.get("x-forwarded-for") || headersList.get("x-real-ip") || "unknown";
    const rateLimit = await checkRateLimitByIp(ip, request.nextUrl.pathname);

    if (!rateLimit.allowed) {
      return {
        authorized: false,
        response: NextResponse.json(
          {
            success: false,
            error: "Rate limit exceeded",
            code: "RATE_LIMIT_EXCEEDED",
            retryAfter: Math.ceil((rateLimit.resetAt.getTime() - Date.now()) / 1000),
          },
          {
            status: 429,
            headers: {
              "X-RateLimit-Limit": "60",
              "X-RateLimit-Remaining": "0",
              "X-RateLimit-Reset": rateLimit.resetAt.toISOString(),
            },
          }
        ),
      };
    }

    return {
      authorized: false,
      response: NextResponse.json(
        {
          success: false,
          error: "API key required",
          code: "MISSING_API_KEY",
        },
        { status: 401 }
      ),
    };
  }

  const validation = await validateApiKey(apiKey);

  if (!validation.valid) {
    return {
      authorized: false,
      response: NextResponse.json(
        {
          success: false,
          error: "Invalid API key",
          code: "INVALID_API_KEY",
        },
        { status: 401 }
      ),
    };
  }

  // Check rate limit for API key
  const rateLimit = await checkRateLimitByApiKey(apiKey, request.nextUrl.pathname);

  if (!rateLimit.allowed) {
    return {
      authorized: false,
      response: NextResponse.json(
        {
          success: false,
          error: "Rate limit exceeded",
          code: "RATE_LIMIT_EXCEEDED",
          retryAfter: Math.ceil((rateLimit.resetAt.getTime() - Date.now()) / 1000),
        },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": "1000",
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": rateLimit.resetAt.toISOString(),
          },
        }
      ),
    };
  }

  return {
    authorized: true,
    apiKey: validation.apiKey,
    rateLimit,
  };
}
