/**
 * Regression tests for the site-wide authentication middleware.
 *
 * Bug class prevented: the middleware used to treat /sw.js as a protected
 * route, so unauthenticated requests got a 307 redirect. Service workers
 * cannot be registered behind a redirect (browser SecurityError), which
 * broke offline/PWA support on the sign-in page.
 *
 * The NextAuth session wrapper is stubbed to emulate an unauthenticated
 * request; the routing/protection logic under test is the real middleware.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("@/auth", () => ({
  auth:
    (handler: (req: unknown) => Response) =>
    (request: Request) => {
      const req = request as Request & { nextUrl: URL; auth: null };
      req.nextUrl = new URL(request.url);
      req.auth = null; // unauthenticated session
      return handler(req);
    },
}));

const { default: middleware } = await import("@/middleware");

function makeRequest(path: string) {
  return new Request(`http://localhost:3000${path}`, { redirect: "manual" });
}

async function runMiddleware(path: string): Promise<Response> {
  const res = await middleware(makeRequest(path) as never, {} as never);
  if (!res) throw new Error(`middleware returned no response for ${path}`);
  return res as Response;
}

describe("auth middleware route protection", () => {
  it("serves /sw.js without redirect for unauthenticated requests", async () => {
    const res = await runMiddleware("/sw.js");
    expect(res.status).toBeLessThan(300);
  });

  it("redirects unauthenticated protected pages to the sign-in page", async () => {
    const res = await runMiddleware("/dashboard");
    expect(res.status).toBe(307);
    const location = res.headers.get("location") ?? "";
    expect(location).toContain("/settings");
    expect(location).toContain("callbackUrl=%2Fdashboard");
  });

  it("returns JSON 401 for unauthenticated private API requests", async () => {
    const res = await runMiddleware("/api/sync/v1");
    expect(res.status).toBe(401);
    expect(res.headers.get("content-type")).toContain("application/json");
    const body = (await res.json()) as { error?: string };
    expect(body.error).toBe("Unauthorized");
  });

  it("keeps health and version endpoints public", async () => {
    for (const path of ["/api/health/live", "/api/health/ready", "/api/version"]) {
      const res = await runMiddleware(path);
      expect(res.status, path).toBeLessThan(300);
    }
  });
});
