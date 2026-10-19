/**
 * Shared enums and TypeScript types for the Phase 3 learning resource registry.
 *
 * These string unions are the single source of truth for both the declarative
 * catalog schema (validated with Zod) and the Drizzle persistence layer.
 */

export const RESOURCE_TYPES = [
  "youtube_video",
  "youtube_playlist",
  "github_repo",
  "official_documentation",
  "research_paper",
  "dataset",
  "written_tutorial",
  "interactive_lab",
  "project_starter",
  "book",
  "course",
] as const;
export type ResourceType = (typeof RESOURCE_TYPES)[number];

export const EDITORIAL_STATUSES = [
  "pending_review",
  "verified",
  "rejected",
  "deprecated",
] as const;
export type EditorialStatus = (typeof EDITORIAL_STATUSES)[number];

export const VERIFICATION_STATUSES = [
  "unverified",
  "reachable",
  "partially_verified",
  "verified",
  "unavailable",
  "regional",
  "unknown",
] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const RESOURCE_ROLES = [
  "primary",
  "supplementary",
  "reference",
  "practical",
  "advanced",
  "prerequisite",
] as const;
export type ResourceRole = (typeof RESOURCE_ROLES)[number];

export const DIFFICULTIES = [
  "beginner",
  "intermediate",
  "advanced",
  "all_levels",
] as const;
export type ResourceDifficulty = (typeof DIFFICULTIES)[number];

/** Resource types that require provider-specific metadata blocks. */
export const YOUTUBE_TYPES: ReadonlySet<ResourceType> = new Set([
  "youtube_video",
  "youtube_playlist",
]);

export const GITHUB_TYPES: ReadonlySet<ResourceType> = new Set([
  "github_repo",
  "project_starter",
]);

/**
 * A single lesson mapping inside a declarative catalog record. A resource may
 * be mapped to many lessons, each potentially with its own role and score.
 */
export interface CatalogLessonLink {
  lesson: string;
  role: ResourceRole;
  relevance_score: number;
  order_index: number;
  recommended: boolean;
  notes?: string;
}

export interface CatalogResource {
  id: string;
  type: ResourceType;
  title: string;
  canonical_url: string;
  description?: string;
  author?: {
    name: string;
    organization?: string;
    profile_url?: string;
  };
  language?: string;
  difficulty?: ResourceDifficulty;
  estimated_duration_minutes?: number | null;
  license?: string | null;
  source_platform?: string;
  editorial_status: EditorialStatus;
  verification_status?: VerificationStatus;
  verification_notes?: string;
  last_verified_at?: string;
  tags?: string[];
  associated_lessons: CatalogLessonLink[];
  youtube?: {
    video_id?: string;
    playlist_id?: string;
    channel_name?: string;
    thumbnail_url?: string;
    duration_seconds?: number | null;
    chapters?: { timestamp_seconds: number; title: string }[];
    embed_allowed?: "allowed" | "disallowed" | "unknown";
    region_status?: "global" | "regional" | "unknown";
    direct_watch_url?: string;
  };
  github?: {
    owner: string;
    repository: string;
    default_branch?: string;
    repository_path?: string;
    description?: string;
    primary_language?: string;
    license?: string | null;
    archived?: boolean;
    fork?: boolean;
  };
  paper?: {
    title: string;
    authors: string[];
    publication_year?: number;
    arxiv_id?: string;
    doi?: string;
    paper_url: string;
    pdf_url?: string;
  };
}

/** Fully resolved catalog record paired with provenance for reporting. */
export interface LoadedResource {
  resource: CatalogResource;
  sourceFile: string;
}
