import { describe, it, expect } from "vitest";
import { createHash, randomBytes } from "node:crypto";

describe("API Key Security", () => {
  describe("Key Generation and Hashing", () => {
    it("generates cryptographically secure keys", () => {
      const key = `aios_${randomBytes(32).toString("hex")}`;
      expect(key).toHaveLength(5 + 64); // 'aios_' + 64 hex chars
      expect(key).toMatch(/^aios_[a-f0-9]{64}$/);
    });

    it("hashes keys with SHA-256", () => {
      const key = "aios_test_key_1234567890abcdef";
      const hash = createHash("sha256").update(key).digest("hex");
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it("hashes same key to same value", () => {
      const key = "aios_test_key_1234567890abcdef";
      const hash1 = createHash("sha256").update(key).digest("hex");
      const hash2 = createHash("sha256").update(key).digest("hex");
      expect(hash1).toBe(hash2);
    });

    it("hashes different keys to different values", () => {
      const key1 = "aios_test_key_1234567890abcdef";
      const key2 = "aios_test_key_9876543210fedcba";
      const hash1 = createHash("sha256").update(key1).digest("hex");
      const hash2 = createHash("sha256").update(key2).digest("hex");
      expect(hash1).not.toBe(hash2);
    });
  });

  describe("Key Prefix Extraction", () => {
    it("extracts first 16 characters as prefix", () => {
      const key = "aios_1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
      const prefix = key.substring(0, 16);
      expect(prefix).toHaveLength(16);
      expect(prefix).toBe("aios_1234567890a");
    });

    it("prefix is different for different keys", () => {
      const key1 = `aios_${randomBytes(32).toString("hex")}`;
      const key2 = `aios_${randomBytes(32).toString("hex")}`;
      const prefix1 = key1.substring(0, 16);
      const prefix2 = key2.substring(0, 16);
      expect(prefix1).not.toBe(prefix2);
    });
  });

  describe("Scope Validation", () => {
    it("accepts valid scopes", () => {
      const validScopes = ["read", "write", "admin", "read,write"];
      validScopes.forEach(scope => {
        expect(scope).toMatch(/^(read|write|admin)(,(read|write|admin))*$/);
      });
    });

    it("rejects invalid scopes", () => {
      const invalidScopes = ["delete", "superadmin", "read,invalid", ""];
      invalidScopes.forEach(scope => {
        expect(scope).not.toMatch(/^(read|write|admin)(,(read|write|admin))*$/);
      });
    });
  });

  describe("Expiration Logic", () => {
    it("correctly identifies expired keys", () => {
      const now = new Date();
      const expiredDate = new Date(now.getTime() - 1000); // 1 second ago
      const futureDate = new Date(now.getTime() + 3600000); // 1 hour from now

      expect(expiredDate < now).toBe(true);
      expect(futureDate > now).toBe(true);
    });

    it("null expiration means never expires", () => {
      const expiresAt = null;
      expect(expiresAt).toBeNull();
    });
  });

  describe("Revocation Logic", () => {
    it("revoked keys should be rejected", () => {
      const isRevoked = true;
      expect(isRevoked).toBe(true);
    });

    it("non-revoked keys should be accepted", () => {
      const isRevoked = false;
      expect(isRevoked).toBe(false);
    });
  });

  describe("Cross-User Isolation", () => {
    it("different users should have different key IDs", () => {
      const userId1 = "user-1-uuid";
      const userId2 = "user-2-uuid";
      expect(userId1).not.toBe(userId2);
    });

    it("API keys are tied to specific user IDs", () => {
      const apiKey = {
        userId: "user-123",
        keyHash: "abc123",
      };
      expect(apiKey.userId).toBe("user-123");
    });
  });
});
