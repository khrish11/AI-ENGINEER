import { describe, it, expect } from "vitest";
import { isValidWebhookUrl } from "../lib/webhooks/sender";

describe("Webhook Security", () => {
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

    it("should accept valid HTTPS URLs", async () => {
      await expect(isValidWebhookUrl("https://example.com/webhook")).resolves.toBe(true);
      await expect(isValidWebhookUrl("https://api.example.com/hooks")).resolves.toBe(true);
    });

    it("should reject malformed URLs", async () => {
      await expect(isValidWebhookUrl("not-a-url")).resolves.toBe(false);
      await expect(isValidWebhookUrl("")).resolves.toBe(false);
    });
  });
});
