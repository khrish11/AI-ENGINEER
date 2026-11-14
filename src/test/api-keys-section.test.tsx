import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiKeysSection } from "@/components/settings/api-keys-section";

const KEYS_RESPONSE = {
  success: true,
  data: [
    {
      id: "key-1",
      name: "chatbot",
      keyPrefix: "aios_abc123",
      scopes: "read",
      expiresAt: null,
      lastUsedAt: null,
      isRevoked: false,
      createdAt: "2026-11-01T00:00:00.000Z",
    },
    {
      id: "key-2",
      name: "old-key",
      keyPrefix: "aios_def456",
      scopes: "read write",
      expiresAt: "2020-01-01T00:00:00.000Z",
      lastUsedAt: "2026-10-01T00:00:00.000Z",
      isRevoked: true,
      createdAt: "2026-09-01T00:00:00.000Z",
    },
  ],
  total: 2,
};

function mockFetch(handler: (url: string, init?: RequestInit) => unknown) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const result = handler(url, init);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });
}

describe("ApiKeysSection", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch(() => KEYS_RESPONSE));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("lists existing keys with status badges", async () => {
    render(<ApiKeysSection />);
    expect(await screen.findByText("chatbot")).toBeTruthy();
    expect(screen.getByText("old-key")).toBeTruthy();
    expect(screen.getByText("aios_abc123…")).toBeTruthy();
    expect(screen.getAllByText("active").length).toBeGreaterThan(0);
    expect(screen.getAllByText("revoked").length).toBeGreaterThan(0);
    // Expired+revoked key shows revoked status; revoke button only on active key
    expect(screen.getAllByRole("button", { name: /revoke/i })).toHaveLength(1);
  });

  it("creates a key and shows the secret exactly once", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "POST") {
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              id: "key-3",
              name: "new-key",
              keyPrefix: "aios_new999",
              scopes: "read",
              expiresAt: null,
              lastUsedAt: null,
              isRevoked: false,
              createdAt: "2026-11-14T00:00:00.000Z",
              secretKey: "aios_SECRET_SHOWN_ONCE",
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response(JSON.stringify(KEYS_RESPONSE), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ApiKeysSection />);
    await screen.findByText("chatbot");

    await user.type(screen.getByTestId("api-key-name"), "new-key");
    await user.click(screen.getByTestId("api-key-create"));

    expect(await screen.findByTestId("api-key-secret")).toBeTruthy();
    expect(screen.getByText("aios_SECRET_SHOWN_ONCE")).toBeTruthy();
    expect(screen.getByText(/will not be shown again/i)).toBeTruthy();

    // Dismiss clears the secret from the DOM
    await user.click(screen.getByTestId("dismiss-secret"));
    await waitFor(() => expect(screen.queryByText("aios_SECRET_SHOWN_ONCE")).toBeNull());
  });

  it("revokes a key after confirmation", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "DELETE") {
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify(KEYS_RESPONSE), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<ApiKeysSection />);
    await screen.findByText("chatbot");

    await user.click(screen.getByTestId("revoke-key-key-1"));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/user/api-keys",
        expect.objectContaining({ method: "DELETE" })
      )
    );
  });

  it("does not revoke when confirmation is cancelled", async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetch(() => KEYS_RESPONSE);
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(window, "confirm").mockReturnValue(false);

    render(<ApiKeysSection />);
    await screen.findByText("chatbot");

    await user.click(screen.getByTestId("revoke-key-key-1"));
    const deleteCalls = fetchMock.mock.calls.filter(
      ([, init]) => (init as RequestInit | undefined)?.method === "DELETE"
    );
    expect(deleteCalls).toHaveLength(0);
  });

  it("shows an error state when loading fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ success: false, error: "Auth required" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        })
      )
    );
    render(<ApiKeysSection />);
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByText(/Auth required/i)).toBeTruthy();
  });

  it("renders copyable Bearer and x-api-key examples", async () => {
    render(<ApiKeysSection />);
    await screen.findByText("chatbot");
    expect(screen.getByTestId("curl-bearer")).toBeTruthy();
    expect(screen.getByTestId("curl-x-api-key")).toBeTruthy();
    expect(screen.getAllByText(/Authorization: Bearer/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/x-api-key:/).length).toBeGreaterThan(0);
  });
});
