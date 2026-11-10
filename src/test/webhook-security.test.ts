import { describe, it, expect } from "vitest";
import { isValidWebhookUrl } from "../lib/webhooks/sender";

describe("Webhook Security", () => {
  describe("URL Validation", () => {
    it("should reject HTTP URLs", () => {
      expect(isValidWebhookUrl("http://example.com/webhook")).toBe(false);
    });

    it("should reject private IPv4 addresses", () => {
      expect(isValidWebhookUrl("https://10.0.0.1/webhook")).toBe(false);
      expect(isValidWebhookUrl("https://192.168.1.1/webhook")).toBe(false);
      expect(isValidWebhookUrl("https://172.16.0.1/webhook")).toBe(false);
      expect(isValidWebhookUrl("https://172.31.255.255/webhook")).toBe(false);
    });

    it("should accept localhost for development", () => {
      // Localhost is allowed for development convenience
      expect(isValidWebhookUrl("https://localhost/webhook")).toBe(true);
      expect(isValidWebhookUrl("https://127.0.0.1/webhook")).toBe(true);
    });

    it("should reject metadata endpoints", () => {
      expect(isValidWebhookUrl("https://metadata.google.internal/webhook")).toBe(false);
      expect(isValidWebhookUrl("https://169.254.169.254/webhook")).toBe(false);
    });

    it("should reject internal DNS", () => {
      expect(isValidWebhookUrl("https://example.internal/webhook")).toBe(false);
      expect(isValidWebhookUrl("https://example.local/webhook")).toBe(false);
      expect(isValidWebhookUrl("https://example.corp/webhook")).toBe(false);
    });

    it("should accept valid HTTPS URLs", () => {
      expect(isValidWebhookUrl("https://example.com/webhook")).toBe(true);
      expect(isValidWebhookUrl("https://api.example.com/hooks")).toBe(true);
    });

    it("should reject malformed URLs", () => {
      expect(isValidWebhookUrl("not-a-url")).toBe(false);
      expect(isValidWebhookUrl("")).toBe(false);
    });
  });
});
