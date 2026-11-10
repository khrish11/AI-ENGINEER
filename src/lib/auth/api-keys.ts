import { crypto } from "node:crypto";

// Simple in-memory API key storage (for production, use database)
const API_KEYS = new Map<string, { name: string; createdAt: number; rateLimit: number }>();

// Generate a secure API key
export function generateApiKey(name: string): string {
  const key = `aios_${crypto.randomBytes(32).toString('hex')}`;
  API_KEYS.set(key, {
    name,
    createdAt: Date.now(),
    rateLimit: 1000, // requests per hour
  });
  return key;
}

// Validate an API key
export function validateApiKey(key: string): boolean {
  return API_KEYS.has(key);
}

// Get API key info
export function getApiKeyInfo(key: string) {
  return API_KEYS.get(key);
}

// Delete an API key
export function deleteApiKey(key: string): boolean {
  return API_KEYS.delete(key);
}

// List all API keys (for admin)
export function listApiKeys() {
  return Array.from(API_KEYS.entries()).map(([key, info]) => ({
    key: key.slice(0, 8) + "...", // Only show prefix
    name: info.name,
    createdAt: info.createdAt,
    rateLimit: info.rateLimit,
  }));
}

// Check rate limit for API key
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

export function checkApiKeyRateLimit(key: string): boolean {
  const info = API_KEYS.get(key);
  if (!info) return false;

  const now = Date.now();
  const record = rateLimitMap.get(key);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + 3600000 }); // 1 hour
    return true;
  }

  if (record.count >= info.rateLimit) {
    return false;
  }

  record.count++;
  return true;
}
