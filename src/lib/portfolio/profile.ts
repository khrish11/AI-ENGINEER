/**
 * §35/§38 — portfolio settings persistence.
 *
 *  - Authenticated users: `portfolio_profiles` in PostgreSQL, written only via
 *    server routes that derive the identity from the session (never an
 *    arbitrary user id from the client).
 *  - Guests: a local Dexie draft only. Guests can preview locally but cannot
 *    publish a cloud-hosted portfolio (§34).
 */
import { and, eq, ne } from "drizzle-orm";
import { db as pg } from "@/db";
import { portfolioProfiles } from "@/db/schema";
import { RESERVED_USERNAMES, validateSlug } from "./slug";
import type { PublicityJson, PortfolioSettings } from "./types";
import { defaultPublicity } from "./types";

export interface ProfileRow {
  userId: string;
  published: boolean;
  username: string | null;
  displayName: string | null;
  bio: string | null;
  publicity: PublicityJson;
  updatedAtIso: string | null;
}

function toSettings(row: {
  userId: string;
  published: boolean;
  username: string | null;
  displayName: string | null;
  bio: string | null;
  publicity: unknown;
  updatedAt: Date | string | null;
}): PortfolioSettings {
  const fallback = defaultPublicity();
  const publicity = row.publicity as Partial<PublicityJson> | null;
  return {
    portfolioEnabled: Boolean(publicity?.visibility),
    username: row.username,
    displayName: row.displayName,
    bio: row.bio,
    careerTrackId: publicity?.careerTrackId ?? null,
    visibility: { ...fallback.visibility, ...(publicity?.visibility ?? {}) },
    publicProjectIds: publicity?.publicProjectIds ?? [],
    publicEvidenceIds: publicity?.publicEvidenceIds ?? [],
    publicAchievementIds: publicity?.publicAchievementIds ?? [],
    publicSkillIds: publicity?.publicSkillIds ?? [],
    published: row.published,
    showSelfAssessment: publicity?.visibility?.exposeSelfAssessment ?? false,
    showProjectLinks: publicity?.visibility?.exposeProjectLinks ?? false,
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : row.updatedAt ?? null,
  };
}

export async function loadPortfolioSettings(userId: string): Promise<PortfolioSettings | null> {
  const rows = await pg
    .select()
    .from(portfolioProfiles)
    .where(eq(portfolioProfiles.userId, userId))
    .limit(1);
  if (rows.length === 0) return null;
  return toSettings(rows[0]);
}

export async function usernameTakenByOther(username: string, userId: string): Promise<boolean> {
  const rows = await pg
    .select({ userId: portfolioProfiles.userId })
    .from(portfolioProfiles)
    .where(and(eq(portfolioProfiles.username, username), ne(portfolioProfiles.userId, userId)))
    .limit(1);
  return rows.length > 0;
}

const RESERVED_USERNAME_SET = RESERVED_USERNAMES;

/** Validates then persists; throws on invalid slug or taken username. */
export async function savePortfolioSettings(
  userId: string,
  patch: {
    portfolioEnabled?: boolean;
    username?: string | null;
    displayName?: string | null;
    bio?: string | null;
    publicity?: PublicityJson;
    published?: boolean;
  }
): Promise<PortfolioSettings> {
  const existing = await loadPortfolioSettings(userId);
  const resolved = {
    portfolioEnabled: patch.portfolioEnabled ?? existing?.portfolioEnabled ?? false,
    username: patch.username !== undefined ? patch.username : existing?.username ?? null,
    displayName: patch.displayName !== undefined ? patch.displayName : existing?.displayName ?? null,
    bio: patch.bio !== undefined ? patch.bio : existing?.bio ?? null,
    publicity: patch.publicity ?? existing ? mergePublicity(existing, patch.publicity) : defaultPublicity(),
    published: patch.published ?? existing?.published ?? false,
  };

  if (resolved.username) {
    const validation = validateSlug(resolved.username);
    if (!validation.valid) throw Object.assign(new Error(validation.reason ?? "Invalid slug"), { status: 400 });
    if (await usernameTakenByOther(resolved.username, userId)) {
      throw Object.assign(new Error("That username is already taken."), { status: 409 });
    }
  }

  // Publishing requires a slug; unpublished rows never expose one publicly.
  const publishing = resolved.published || resolved.portfolioEnabled;
  if (publishing && !resolved.username) {
    throw Object.assign(new Error("Choose a portfolio username before publishing."), { status: 400 });
  }

  if (resolved.username && RESERVED_USERNAME_SET.has(resolved.username)) {
    throw Object.assign(new Error("That username is reserved."), { status: 400 });
  }

  await pg
    .insert(portfolioProfiles)
    .values({
      userId,
      published: resolved.published,
      username: resolved.username,
      displayName: resolved.displayName,
      bio: resolved.bio !== null ? resolved.bio.slice(0, 400) : null,
      publicity: resolved.publicity as unknown as Record<string, unknown>,
    })
    .onConflictDoUpdate({
      target: portfolioProfiles.userId,
      set: {
        published: resolved.published,
        username: resolved.username,
        displayName: resolved.displayName,
        bio: resolved.bio !== null ? resolved.bio.slice(0, 400) : null,
        publicity: resolved.publicity as unknown as Record<string, unknown>,
        updatedAt: new Date(),
      },
    });
  return (await loadPortfolioSettings(userId)) as PortfolioSettings;
}

function mergePublicity(existing: PortfolioSettings | null, patch?: PublicityJson): PublicityJson {
  const base = defaultPublicity();
  if (!existing) return patch ?? base;
  return {
    ...base,
    ...(patch ?? {}),
    visibility: { ...base.visibility, ...(patch?.visibility ?? existing.visibility) },
    publicProjectIds: patch?.publicProjectIds ?? existing.publicProjectIds ?? [],
    publicEvidenceIds: patch?.publicEvidenceIds ?? existing.publicEvidenceIds ?? [],
    publicAchievementIds: patch?.publicAchievementIds ?? existing.publicAchievementIds ?? [],
    publicSkillIds: patch?.publicSkillIds ?? existing.publicSkillIds ?? [],
    careerTrackId: patch ? patch.careerTrackId : existing.careerTrackId,
  };
}

/** §35 — publishing/unpublishing derives identity from the session (auth wrapper). */
export function isProfilePublished(settings: PortfolioSettings | null): boolean {
  return Boolean(settings?.published && settings.portfolioEnabled);
}
