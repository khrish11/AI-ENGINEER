import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "./api-keys";

export function withApiKeyAuth(request: NextRequest) {
  const apiKey = request.headers.get("x-api-key");

  if (!apiKey) {
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

  if (!validateApiKey(apiKey)) {
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

  // Rate limiting disabled: In-memory rate limiting is unreliable in Vercel serverless
  // Production should implement Redis-based rate limiting (Upstash Redis on Vercel)
  // if (!checkApiKeyRateLimit(apiKey)) {
  //   return {
  //     authorized: false,
  //     response: NextResponse.json(
  //       {
  //         success: false,
  //         error: "Rate limit exceeded",
  //         code: "RATE_LIMIT_EXCEEDED",
  //       },
  //       { status: 429 }
  //     ),
  //   };
  // }

  return { authorized: true };
}
