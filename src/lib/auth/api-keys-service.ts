import { randomBytes, createHash } from "node:crypto";
import { db } from "@/db";
import { apiKeys } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";

export interface ApiKey {
  id: string;
  userId: string;
  name: string;
  keyPrefix: string;
  scopes: string;
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  isRevoked: boolean;
  revokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApiKeyWithSecret extends ApiKey {
  secretKey: string;
}

export async function generateApiKey(userId: string, name: string, scopes: string = "read", expiresAt?: Date): Promise<ApiKeyWithSecret> {
  const secretKey = `aios_${randomBytes(32).toString("hex")}`;
  const keyHash = createHash("sha256").update(secretKey).digest("hex");
  const keyPrefix = secretKey.substring(0, 16);

  const [apiKey] = await db
    .insert(apiKeys)
    .values({
      userId,
      name,
      keyHash,
      keyPrefix,
      scopes,
      expiresAt: expiresAt || null,
    })
    .returning();

  return {
    ...apiKey,
    secretKey,
  };
}

export async function validateApiKey(key: string): Promise<{ valid: boolean; apiKey?: ApiKey }> {
  const keyHash = createHash("sha256").update(key).digest("hex");

  const [apiKey] = await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.keyHash, keyHash), eq(apiKeys.isRevoked, false)))
    .limit(1);

  if (!apiKey) {
    return { valid: false };
  }

  // Check expiration
  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
    return { valid: false };
  }

  // Update last used
  const lastUsedAt = new Date();
  await db
    .update(apiKeys)
    .set({ lastUsedAt, updatedAt: lastUsedAt })
    .where(eq(apiKeys.id, apiKey.id));

  return { valid: true, apiKey: { ...apiKey, lastUsedAt, updatedAt: lastUsedAt } };
}

export async function listApiKeys(userId: string): Promise<ApiKey[]> {
  return db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.userId, userId))
    .orderBy(desc(apiKeys.createdAt));
}

export async function revokeApiKey(userId: string, keyId: string): Promise<boolean> {
  // .returning() is required: without it postgres-js resolves to an empty
  // RowList, so result.length is always 0 and revocation looked like a miss.
  const result = await db
    .update(apiKeys)
    .set({
      isRevoked: true,
      revokedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(apiKeys.id, keyId), eq(apiKeys.userId, userId)))
    .returning({ id: apiKeys.id });

  return result.length > 0;
}

export async function rotateApiKey(userId: string, keyId: string): Promise<ApiKeyWithSecret | null> {
  const [existing] = await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.id, keyId), eq(apiKeys.userId, userId)))
    .limit(1);

  if (!existing) {
    return null;
  }

  // Revoke old key
  await db
    .update(apiKeys)
    .set({
      isRevoked: true,
      revokedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(apiKeys.id, keyId));

  // Generate new key with same properties
  return generateApiKey(userId, existing.name, existing.scopes, existing.expiresAt || undefined);
}
