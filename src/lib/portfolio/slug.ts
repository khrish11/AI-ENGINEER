/**
 * §27 — portfolio slugs: lowercase, safe characters, unique, reserved blocked.
 * Never expose internal user UUIDs in public routes.
 */

export const RESERVED_USERNAMES = new Set([
  "admin",
  "administrator",
  "api",
  "app",
  "auth",
  "blog",
  "curriculum",
  "dashboard",
  "docs",
  "help",
  "login",
  "logout",
  "me",
  "onboarding",
  "portfolio",
  "practice",
  "projects",
  "resources",
  "roadmap",
  "root",
  "settings",
  "signin",
  "signup",
  "support",
  "sync",
  "system",
  "user",
  "users",
]);

export const SLUG_MAX_LENGTH = 40;
export const SLUG_MIN_LENGTH = 3;

export interface SlugValidation {
  valid: boolean;
  normalized: string | null;
  reason: string | null;
}

function normalizedSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX_LENGTH);
}

export function validateSlug(input: string): SlugValidation {
  const normalized = normalizedSlug(input);
  if (normalized.length < SLUG_MIN_LENGTH) {
    return {
      valid: false,
      normalized: null,
      reason: `Slug must be at least ${SLUG_MIN_LENGTH} characters (letters, numbers, hyphen or underscore).`,
    };
  }
  if (!/^[a-z0-9_-]+$/.test(normalized)) {
    return { valid: false, normalized: null, reason: "Only letters, numbers, hyphen and underscore are allowed." };
  }
  if (RESERVED_USERNAMES.has(normalized)) {
    return { valid: false, normalized, reason: `"${normalized}" is reserved.` };
  }
  if (normalized !== input.trim()) {
    return {
      valid: false,
      normalized,
      reason: "Slugs must already be lowercase with single separating hyphens.",
    };
  }
  return { valid: true, normalized, reason: null };
}
