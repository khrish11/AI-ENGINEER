import type { CatalogResource, ResourceRole, VerificationStatus } from "./types";

/**
 * Deterministic resource ranking. No LLM is involved in the base ranking.
 *
 * Scores follow the Phase 3 specification. Editors retain an explicit override
 * through `recommended` and `order_index` on the lesson mapping, which always
 * outranks the computed score.
 */

export const ORIGINAL_AUTHOR_ORGS = new Set(
  [
    "Andrej Karpathy",
    "3Blue1Brown",
    "Jeremy Howard",
    "fast.ai",
    "Stanford Online",
    "StatQuest with Josh Starmer",
    "Google Research",
    "Google DeepMind",
    "OpenAI",
    "Anthropic",
    "Meta AI",
    "Meta",
    "Microsoft",
    "Hugging Face",
    "PyTorch",
    "NVIDIA",
    "Google",
    "MIT",
    "Kaggle",
    "freeCodeCamp.org",
    "IBM Technology",
    "Weights & Biases",
    "LangChain",
    "LlamaIndex",
    "vLLM Project",
    "Ray Project",
  ].map((s) => s.toLowerCase())
);

export interface RankingSignals {
  role: ResourceRole;
  relevanceScore: number;
  editorialStatus: string;
  verificationStatus: VerificationStatus;
  lastVerifiedAt?: string | Date | null;
}

export interface ScoreBreakdown {
  primary: number;
  officialDocumentation: number;
  originalAuthor: number;
  verified: number;
  highRelevance: number;
  recentlyVerified: number;
  practical: number;
  deprecated: number;
  unverified: number;
  total: number;
}

const RECENT_VERIFICATION_WINDOW_DAYS = 180;

function isPractical(type: string, role: ResourceRole): boolean {
  if (role === "practical") return true;
  return (
    type === "github_repo" ||
    type === "project_starter" ||
    type === "interactive_lab"
  );
}

function isOriginalAuthor(resource: CatalogResource): boolean {
  const candidates = [
    resource.author?.name,
    resource.author?.organization,
    resource.youtube?.channel_name,
    resource.github?.owner,
  ];
  return candidates.some(
    (candidate) => candidate && ORIGINAL_AUTHOR_ORGS.has(candidate.toLowerCase())
  );
}

function isRecentlyVerified(lastVerifiedAt?: string | Date | null): boolean {
  if (!lastVerifiedAt) return false;
  const date = lastVerifiedAt instanceof Date ? lastVerifiedAt : new Date(lastVerifiedAt);
  if (Number.isNaN(date.getTime())) return false;
  const ageMs = Date.now() - date.getTime();
  return ageMs >= 0 && ageMs <= RECENT_VERIFICATION_WINDOW_DAYS * 24 * 60 * 60 * 1000;
}

export function scoreResourceSignals(
  resource: CatalogResource,
  signals: RankingSignals
): ScoreBreakdown {
  const breakdown: ScoreBreakdown = {
    primary: signals.role === "primary" ? 40 : 0,
    officialDocumentation: resource.type === "official_documentation" ? 35 : 0,
    originalAuthor: isOriginalAuthor(resource) ? 30 : 0,
    verified: signals.verificationStatus === "verified" ? 25 : 0,
    highRelevance: signals.relevanceScore >= 80 ? 20 : 0,
    recentlyVerified: isRecentlyVerified(signals.lastVerifiedAt) ? 10 : 0,
    practical: isPractical(resource.type, signals.role) ? 15 : 0,
    deprecated: signals.editorialStatus === "deprecated" ? -100 : 0,
    unverified: signals.verificationStatus === "unverified" ? -20 : 0,
    total: 0,
  };
  breakdown.total =
    breakdown.primary +
    breakdown.officialDocumentation +
    breakdown.originalAuthor +
    breakdown.verified +
    breakdown.highRelevance +
    breakdown.recentlyVerified +
    breakdown.practical +
    breakdown.deprecated +
    breakdown.unverified;
  return breakdown;
}

export function scoreResource(
  resource: CatalogResource,
  signals: RankingSignals
): number {
  return scoreResourceSignals(resource, signals).total;
}

export interface RankableItem<T = unknown> {
  resource: T;
  role: ResourceRole;
  relevanceScore: number;
  orderIndex: number;
  recommended: boolean;
  score: number;
  title: string;
}

/**
 * Rank resources for a single lesson. Manual editorial overrides
 * (`recommended`, then explicit `order_index`) take precedence over score.
 */
export function rankItems<T extends { title: string }>(
  items: RankableItem<T>[]
): RankableItem<T>[] {
  return [...items].sort((a, b) => {
    if (a.recommended !== b.recommended) return a.recommended ? -1 : 1;
    const aOrder = a.orderIndex === 0 ? Number.POSITIVE_INFINITY : a.orderIndex;
    const bOrder = b.orderIndex === 0 ? Number.POSITIVE_INFINITY : b.orderIndex;
    if (aOrder !== bOrder) return aOrder - bOrder;
    if (b.score !== a.score) return b.score - a.score;
    return a.title.localeCompare(b.title);
  });
}
