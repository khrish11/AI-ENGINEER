import { describe, it, expect, vi, beforeEach } from "vitest";
import { isValidWebhookUrl } from "../lib/webhooks/sender";

// Mock DNS lookup for deterministic testing
vi.mock("node:dns/promises", () => ({
  lookup: vi.fn(async (hostname: string) => {
    // Mock DNS responses for test domains
    const mockResponses: Record<string, { address: string; family: number }[]> = {
      "example.com": [{ address: "93.184.216.34", family: 4 }],
      "api.example.com": [{ address: "93.184.216.35", family: 4 }],
      "webhook.site": [{ address: "52.29.185.226", family: 4 }],
      "private.example.com": [{ address: "10.0.0.1", family: 4 }], // Should be rejected
    };

    if (mockResponses[hostname]) {
      return mockResponses[hostname];
    }

    // Simulate DNS failure for unknown domains
    const error = new Error("ENOTFOUND") as NodeJS.ErrnoException;
    error.code = "ENOTFOUND";
    throw error;
  }),
}));

describe("Webhook Security", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("URL Validation", () => {
    it("should reject HTTP URLs", async () => {
      await expect(isValidWebhookUrl("http://example.com/webhook")).resolves.toBe(false);
    });

    it("should reject private IPv4 addresses", async () => {
      await expect(isValidWebhookUrl("https://10.0.0.1/webhook")).resolves.toBe(false);
      await expect(isValidWebhookUrl("https://192.168.1.1/webhook")).resolves.toBe(false);
      await expect(isValidWebhookUrl("https://172.16.0.1/webhook")).resolves.toBe(false);
      await expect(isValidWebhookUrl("https://172.31.255.255/webhook")).resolves.toBe(false);
    });

    it("should accept localhost for development", async () => {
      await expect(isValidWebhookUrl("https://localhost/webhook")).resolves.toBe(true);
      await expect(isValidWebhookUrl("https://127.0.0.1/webhook")).resolves.toBe(true);
    });

    it("should reject metadata endpoints", async () => {
      await expect(isValidWebhookUrl("https://metadata.google.internal/webhook")).resolves.toBe(false);
      await expect(isValidWebhookUrl("https://169.254.169.254/webhook")).resolves.toBe(false);
    });

    it("should reject internal DNS", async () => {
      await expect(isValidWebhookUrl("https://example.internal/webhook")).resolves.toBe(false);
      await expect(isValidWebhookUrl("https://example.local/webhook")).resolves.toBe(false);
      await expect(isValidWebhookUrl("https://example.corp/webhook")).resolves.toBe(false);
    });

    it("should accept valid HTTPS URLs with public IPs", async () => {
      await expect(isValidWebhookUrl("https://example.com/webhook")).resolves.toBe(true);
      await expect(isValidWebhookUrl("https://api.example.com/hooks")).resolves.toBe(true);
      await expect(isValidWebhookUrl("https://webhook.site/endpoint")).resolves.toBe(true);
    });

    it("should reject URLs resolving to private IPs", async () => {
      await expect(isValidWebhookUrl("https://private.example.com/webhook")).resolves.toBe(false);
    });

    it("should reject malformed URLs", async () => {
      await expect(isValidWebhookUrl("not-a-url")).resolves.toBe(false);
      await expect(isValidWebhookUrl("")).resolves.toBe(false);
    });
  });
});
