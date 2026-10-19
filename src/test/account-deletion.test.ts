import { describe, expect, it, vi } from "vitest";

const { getAuthenticatedUserId } = vi.hoisted(() => ({
  getAuthenticatedUserId: vi.fn(),
}));
vi.mock("@/lib/auth/session", () => ({ getAuthenticatedUserId }));
vi.mock("@/db", () => ({ db: {} }));
import { DELETE } from "@/app/api/account/delete/route";

describe("account deletion API", () => {
  it("rejects unauthenticated deletion", async () => {
    getAuthenticatedUserId.mockResolvedValue(null);
    const response = await DELETE();
    expect(response.status).toBe(401);
  });
});
