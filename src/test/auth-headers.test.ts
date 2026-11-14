import { describe, it, expect } from "vitest";
import { extractApiKey } from "@/lib/auth/middleware";
import { NextRequest } from "next/server";

function req(headers: Record<string, string>): NextRequest {
  return new NextRequest("http://localhost/api/v1/phases", { headers });
}

describe("extractApiKey", () => {
  it("reads x-api-key header", () => {
    expect(extractApiKey(req({ "x-api-key": "aios_abc" }))).toBe("aios_abc");
  });

  it("reads Authorization: Bearer header", () => {
    expect(extractApiKey(req({ authorization: "Bearer aios_xyz" }))).toBe("aios_xyz");
  });

  it("prefers Bearer over x-api-key when both present", () => {
    expect(
      extractApiKey(req({ authorization: "Bearer aios_bearer", "x-api-key": "aios_header" }))
    ).toBe("aios_bearer");
  });

  it("returns null when no credentials provided", () => {
    expect(extractApiKey(req({}))).toBeNull();
  });

  it("returns null for non-Bearer authorization schemes", () => {
    expect(extractApiKey(req({ authorization: "Basic dXNlcjpwYXNz" }))).toBeNull();
  });

  it("returns null for empty Bearer token", () => {
    expect(extractApiKey(req({ authorization: "Bearer " }))).toBeNull();
  });
});
