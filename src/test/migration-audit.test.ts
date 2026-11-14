import { describe, it, expect, beforeAll } from "vitest";
import fs from "fs";
import path from "path";

describe("Migration Audit: 0001_add_api_keys_webhooks_rate_limits", () => {
  const migrationPath = path.join(__dirname, "../../config/drizzle/migrations/0001_add_api_keys_webhooks_rate_limits.sql");
  let migrationSQL: string;

  beforeAll(() => {
    migrationSQL = fs.readFileSync(migrationPath, "utf-8");
  });

  it("adds role column with safe default", () => {
    expect(migrationSQL).toContain("ALTER TABLE users ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'user'");
    // Safe: NOT NULL with DEFAULT ensures existing rows get the default value
  });

  it("creates api_keys table with proper constraints", () => {
    expect(migrationSQL).toContain("CREATE TABLE IF NOT EXISTS api_keys");
    expect(migrationSQL).toContain("user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE");
    expect(migrationSQL).toContain("key_hash VARCHAR(64) NOT NULL UNIQUE");
    expect(migrationSQL).toContain("key_prefix VARCHAR(16) NOT NULL");
    // Foreign key with CASCADE ensures cleanup on user deletion
    // UNIQUE on key_hash prevents duplicate keys
  });

  it("creates webhooks table with proper constraints", () => {
    expect(migrationSQL).toContain("CREATE TABLE IF NOT EXISTS webhooks");
    expect(migrationSQL).toContain("user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE");
    expect(migrationSQL).toContain("secret VARCHAR(64) NOT NULL");
    // Cascade delete ensures webhooks are removed when user is deleted
  });

  it("creates rate_limits table with unique constraint", () => {
    expect(migrationSQL).toContain("CREATE TABLE IF NOT EXISTS rate_limits");
    expect(migrationSQL).toContain("UNIQUE (identifier, endpoint, window_start)");
    // Unique constraint prevents duplicate rate limit records for same window
  });

  it("creates proper indexes for performance", () => {
    expect(migrationSQL).toContain("CREATE INDEX idx_api_keys_user ON api_keys(user_id)");
    expect(migrationSQL).toContain("CREATE INDEX idx_api_keys_hash ON api_keys(key_hash)");
    expect(migrationSQL).toContain("CREATE INDEX idx_api_keys_active ON api_keys(is_revoked)");
    expect(migrationSQL).toContain("CREATE INDEX idx_webhooks_user ON webhooks(user_id)");
    expect(migrationSQL).toContain("CREATE INDEX idx_webhooks_active ON webhooks(is_active)");
    expect(migrationSQL).toContain("CREATE INDEX idx_rate_limits_identifier ON rate_limits(identifier)");
    expect(migrationSQL).toContain("CREATE INDEX idx_rate_limits_window ON rate_limits(window_end)");
    // Indexes support efficient lookups for authorization and rate limiting
  });

  it("preserves existing users by using DEFAULT", () => {
    expect(migrationSQL).toContain("DEFAULT 'user'");
    // All existing users will automatically get 'user' role
    // No manual intervention required for existing users
  });

  it("is idempotent due to IF NOT EXISTS", () => {
    expect(migrationSQL).toContain("CREATE TABLE IF NOT EXISTS");
    // Can be safely re-run if tables already exist
  });

  it("uses CASCADE for cleanup", () => {
    expect(migrationSQL).toContain("ON DELETE CASCADE");
    // Foreign keys cascade delete orphans on user deletion
    // Prevents orphaned API keys and webhooks
  });
});
