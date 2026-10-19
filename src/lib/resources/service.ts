import { db } from "@/db";
import {
  resources,
  lessonResources,
  resourceYoutubeMetadata,
  resourceGithubMetadata,
  resourcePaperMetadata,
  canonicalLessons,
  canonicalPhases,
} from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import type {
  EditorialStatus,
  ResourceDifficulty,
  ResourceRole,
  ResourceType,
  VerificationStatus,
} from "./types";
import { scoreResourceSignals } from "./ranking";
import { hashCanonicalUrl, normalizeCanonicalUrl } from "./canonical";

export interface ResourceLessonLink {
  lessonId: string;
  lessonSlug: string;
  lessonTitle: string;
  phaseNumber: number;
  phaseSlug: string;
  role: ResourceRole;
  relevanceScore: number;
  orderIndex: number;
  recommended: boolean;
  notes: string | null;
  score: number;
}

export interface ResourceView {
  id: string;
  key: string;
  type: ResourceType;
  title: string;
  canonicalUrl: string;
  canonicalUrlHash: string;
  description: string | null;
  authorName: string | null;
  organization: string | null;
  language: string;
  difficulty: ResourceDifficulty;
  estimatedDurationMinutes: number | null;
  license: string | null;
  sourcePlatform: string | null;
  tags: string[];
  editorialStatus: EditorialStatus;
  verificationStatus: VerificationStatus;
  verificationNotes: string | null;
  lastVerifiedAt: string | null;
  youtube: {
    videoId: string | null;
    playlistId: string | null;
    channelName: string | null;
    thumbnailUrl: string | null;
    durationSeconds: number | null;
    chapters: { timestamp_seconds: number; title: string }[];
    embedAllowed: boolean | null;
    regionStatus: string;
    directWatchUrl: string | null;
  } | null;
  github: {
    owner: string;
    repository: string;
    defaultBranch: string | null;
    repositoryPath: string | null;
    description: string | null;
    primaryLanguage: string | null;
    license: string | null;
    archived: boolean;
    fork: boolean;
    lastCheckedAt: string | null;
  } | null;
  paper: {
    title: string;
    authors: string[];
    publicationYear: number | null;
    arxivId: string | null;
    doi: string | null;
    paperUrl: string | null;
    pdfUrl: string | null;
  } | null;
  lessons: ResourceLessonLink[];
  bestScore: number;
}

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value;
}

/**
 * Fetch every resource with its provider metadata and lesson mappings, then
 * assemble in memory. The catalog is intentionally small (hundreds of rows at
 * most), so this avoids fragile multi-join SQL while keeping queries bounded.
 */
export async function getAllResourceViews(): Promise<ResourceView[]> {
  try {
    const [resourceRows, ytRows, ghRows, paperRows, mappingRows] = await Promise.all([
      db.select().from(resources).orderBy(asc(resources.title)),
      db.select().from(resourceYoutubeMetadata),
      db.select().from(resourceGithubMetadata),
      db.select().from(resourcePaperMetadata),
      db
        .select({
          lessonId: lessonResources.lessonId,
          resourceId: lessonResources.resourceId,
          role: lessonResources.resourceRole,
          relevanceScore: lessonResources.relevanceScore,
          orderIndex: lessonResources.orderIndex,
          recommended: lessonResources.recommended,
          notes: lessonResources.notes,
          currentSlug: canonicalLessons.currentSlug,
          lessonTitle: canonicalLessons.defaultTitle,
          phaseNumber: canonicalPhases.phaseNumber,
          phaseSlug: canonicalPhases.defaultSlug,
        })
        .from(lessonResources)
        .innerJoin(canonicalLessons, eq(lessonResources.lessonId, canonicalLessons.id))
        .innerJoin(canonicalPhases, eq(canonicalLessons.canonicalPhaseId, canonicalPhases.id)),
    ]);

    const ytById = new Map(ytRows.map((r) => [r.resourceId, r]));
    const ghById = new Map(ghRows.map((r) => [r.resourceId, r]));
    const paperById = new Map(paperRows.map((r) => [r.resourceId, r]));
    const mappingsByResource = new Map<string, typeof mappingRows>();
    for (const m of mappingRows) {
      const bucket = mappingsByResource.get(m.resourceId) ?? [];
      bucket.push(m);
      mappingsByResource.set(m.resourceId, bucket);
    }

    const views: ResourceView[] = resourceRows.map((row) => {
      const yt = ytById.get(row.id);
      const gh = ghById.get(row.id);
      const paper = paperById.get(row.id);

      const links: ResourceLessonLink[] = (mappingsByResource.get(row.id) ?? []).map((m) => {
        const score = scoreResourceSignals(
          {
            id: row.resourceKey,
            type: row.resourceType as ResourceType,
            title: row.title,
            canonical_url: row.canonicalUrl,
            editorial_status: row.editorialStatus as EditorialStatus,
            verification_status: row.verificationStatus as VerificationStatus,
            author: row.authorName
              ? { name: row.authorName, organization: row.organization ?? undefined }
              : undefined,
            associated_lessons: [],
          },
          {
            role: m.role as ResourceRole,
            relevanceScore: m.relevanceScore,
            editorialStatus: row.editorialStatus,
            verificationStatus: row.verificationStatus as VerificationStatus,
            lastVerifiedAt: row.lastVerifiedAt,
          }
        ).total;

        return {
          lessonId: m.lessonId,
          lessonSlug: m.currentSlug,
          lessonTitle: m.lessonTitle,
          phaseNumber: m.phaseNumber,
          phaseSlug: m.phaseSlug,
          role: m.role as ResourceRole,
          relevanceScore: m.relevanceScore,
          orderIndex: m.orderIndex,
          recommended: m.recommended,
          notes: m.notes,
          score,
        };
      });

      const bestScore = links.reduce((max, l) => Math.max(max, l.score), 0);

      return {
        id: row.id,
        key: row.resourceKey,
        type: row.resourceType as ResourceType,
        title: row.title,
        canonicalUrl: row.canonicalUrl,
        canonicalUrlHash: row.canonicalUrlHash,
        description: row.description,
        authorName: row.authorName,
        organization: row.organization,
        language: row.language,
        difficulty: row.difficulty as ResourceDifficulty,
        estimatedDurationMinutes: row.estimatedDurationMinutes,
        license: row.license,
        sourcePlatform: row.sourcePlatform,
        tags: row.tags ?? [],
        editorialStatus: row.editorialStatus as EditorialStatus,
        verificationStatus: row.verificationStatus as VerificationStatus,
        verificationNotes: row.verificationNotes,
        lastVerifiedAt: toIso(row.lastVerifiedAt),
        youtube: yt
          ? {
              videoId: yt.videoId,
              playlistId: yt.playlistId,
              channelName: yt.channelName,
              thumbnailUrl: yt.thumbnailUrl,
              durationSeconds: yt.durationSeconds,
              chapters: (yt.chapters as { timestamp_seconds: number; title: string }[]) ?? [],
              embedAllowed: yt.embedAllowed,
              regionStatus: yt.regionStatus,
              directWatchUrl: yt.directWatchUrl,
            }
          : null,
        github: gh
          ? {
              owner: gh.owner,
              repository: gh.repository,
              defaultBranch: gh.defaultBranch,
              repositoryPath: gh.repositoryPath,
              description: gh.description,
              primaryLanguage: gh.primaryLanguage,
              license: gh.license,
              archived: gh.archived,
              fork: gh.fork,
              lastCheckedAt: toIso(gh.lastCheckedAt),
            }
          : null,
        paper: paper
          ? {
              title: paper.title,
              authors: paper.authors ?? [],
              publicationYear: paper.publicationYear,
              arxivId: paper.arxivId,
              doi: paper.doi,
              paperUrl: paper.paperUrl,
              pdfUrl: paper.pdfUrl,
            }
          : null,
        lessons: links,
        bestScore,
      } satisfies ResourceView;
    });

    return views;
  } catch (error) {
    console.warn("Failed to load resources from database:", error);
    return [];
  }
}

/** Fetch the ranked resources attached to a single lesson. */
export async function getResourcesForLesson(
  lessonId: string
): Promise<ResourceView[]> {
  const all = await getAllResourceViews();
  return all
    .filter((r) => r.lessons.some((l) => l.lessonId === lessonId))
    .map((r) => {
      const link = r.lessons.find((l) => l.lessonId === lessonId);
      return { ...r, bestScore: link?.score ?? 0 };
    })
    .sort((a, b) => {
      const aLink = a.lessons.find((l) => l.lessonId === lessonId);
      const bLink = b.lessons.find((l) => l.lessonId === lessonId);
      if (aLink?.recommended !== bLink?.recommended) return aLink?.recommended ? -1 : 1;
      return (bLink?.score ?? 0) - (aLink?.score ?? 0);
    });
}

export interface ResourceStats {
  total: number;
  byType: Record<string, number>;
  byVerification: Record<string, number>;
  byEditorial: Record<string, number>;
  verified: number;
  pending: number;
}

export async function getResourceStats(): Promise<ResourceStats> {
  const views = await getAllResourceViews();
  const byType: Record<string, number> = {};
  const byVerification: Record<string, number> = {};
  const byEditorial: Record<string, number> = {};
  for (const v of views) {
    byType[v.type] = (byType[v.type] ?? 0) + 1;
    byVerification[v.verificationStatus] = (byVerification[v.verificationStatus] ?? 0) + 1;
    byEditorial[v.editorialStatus] = (byEditorial[v.editorialStatus] ?? 0) + 1;
  }
  return {
    total: views.length,
    byType,
    byVerification,
    byEditorial,
    verified: byEditorial.verified ?? 0,
    pending: byEditorial.pending_review ?? 0,
  };
}

export { hashCanonicalUrl, normalizeCanonicalUrl };
