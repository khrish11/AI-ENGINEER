import { db } from "@/db";
import {
  resources,
  lessonResources,
  resourceYoutubeMetadata,
  resourceGithubMetadata,
  resourcePaperMetadata,
  resourceVerifications,
  canonicalLessons,
} from "@/db/schema";
import { eq, inArray, and } from "drizzle-orm";
import { loadCatalog } from "./catalog";
import { resolveCanonical } from "./canonical";
import { mapWithRateLimit, probeResource } from "./providers";
import type { CatalogResource, ResourceType } from "./types";

export interface ImportSummary {
  resources: number;
  mappings: number;
  youtube: number;
  github: number;
  papers: number;
  created: number;
  updated: number;
  skipped: string[];
  unknownLessonKeys: string[];
  warnings: string[];
}

function asBoolean(value: "allowed" | "disallowed" | "unknown" | undefined): boolean | null {
  if (value === "allowed") return true;
  if (value === "disallowed") return false;
  return null;
}

function resourceRow(resource: CatalogResource, canonicalUrl: string, canonicalUrlHash: string) {
  return {
    resourceKey: resource.id,
    resourceType: resource.type,
    title: resource.title,
    canonicalUrl,
    canonicalUrlHash,
    description: resource.description ?? null,
    authorName: resource.author?.name ?? null,
    organization: resource.author?.organization ?? null,
    language: resource.language ?? "en",
    difficulty: resource.difficulty ?? "all_levels",
    estimatedDurationMinutes: resource.estimated_duration_minutes ?? null,
    license: resource.license ?? null,
    sourcePlatform: resource.source_platform ?? null,
    tags: resource.tags ?? [],
    editorialStatus: resource.editorial_status,
    verificationStatus: resource.verification_status ?? "unverified",
    verificationNotes: resource.verification_notes ?? null,
    lastVerifiedAt: resource.last_verified_at ? new Date(resource.last_verified_at) : null,
    updatedAt: new Date(),
  };
}

export interface ImportOptions {
  /** When true, external provider metadata is refreshed via live probes. */
  refresh?: boolean;
  /** Restrict to a subset of resource keys (for targeted re-imports). */
  only?: string[];
}

/**
 * Import the declarative catalog into Postgres.
 *
 * Idempotent: upserts resources by `resource_key`, replaces provider metadata,
 * and syncs `lesson_resources` mappings (adding new, removing stale) so that
 * the database always mirrors the catalog.
 */
export async function importCatalog(options: ImportOptions = {}): Promise<ImportSummary> {
  const { resources: loaded, issues } = loadCatalog();
  if (issues.length > 0) {
    const preview = issues
      .slice(0, 10)
      .map((i) => `  ${i.file} [${i.path}]: ${i.message}`)
      .join("\n");
    throw new Error(
      `Refusing to import: catalog has ${issues.length} schema error(s):\n${preview}`
    );
  }

  const summary: ImportSummary = {
    resources: 0,
    mappings: 0,
    youtube: 0,
    github: 0,
    papers: 0,
    created: 0,
    updated: 0,
    skipped: [],
    unknownLessonKeys: [],
    warnings: [],
  };

  const lessonRows = await db
    .select({ id: canonicalLessons.id, slug: canonicalLessons.currentSlug })
    .from(canonicalLessons);
  const lessonIdByKey = new Map(lessonRows.map((r) => [r.slug, r.id]));

  const selected = options.only
    ? loaded.filter((l) => options.only!.includes(l.resource.id))
    : loaded;

  for (const { resource } of selected) {
    let canonicalUrl: string;
    let canonicalUrlHash: string;
    try {
      ({ canonicalUrl, canonicalUrlHash } = resolveCanonical(resource.canonical_url));
    } catch (error) {
      summary.skipped.push(resource.id);
      summary.warnings.push(
        `${resource.id}: invalid canonical_url (${error instanceof Error ? error.message : String(error)})`
      );
      continue;
    }

    const existing = await db
      .select({ id: resources.id })
      .from(resources)
      .where(eq(resources.resourceKey, resource.id))
      .limit(1);

    // Guard against two different keys claiming the same canonical URL.
    const colliding = await db
      .select({ id: resources.id, resourceKey: resources.resourceKey })
      .from(resources)
      .where(and(eq(resources.canonicalUrlHash, canonicalUrlHash)))
      .limit(1);
    if (colliding[0] && colliding[0].resourceKey !== resource.id) {
      summary.skipped.push(resource.id);
      summary.warnings.push(
        `${resource.id}: canonical URL already claimed by "${colliding[0].resourceKey}"`
      );
      continue;
    }

    const row = resourceRow(resource, canonicalUrl, canonicalUrlHash);

    let resourceId: string;
    if (existing[0]) {
      const [updated] = await db
        .update(resources)
        .set(row)
        .where(eq(resources.id, existing[0].id))
        .returning({ id: resources.id });
      resourceId = updated.id;
      summary.updated += 1;
    } else {
      const [inserted] = await db
        .insert(resources)
        .values(row)
        .returning({ id: resources.id });
      resourceId = inserted.id;
      summary.created += 1;
    }
    summary.resources += 1;

    // Provider metadata (1:1).
    if (resource.youtube) {
      const yt = resource.youtube;
      const values = {
        resourceId,
        videoId: yt.video_id ?? null,
        playlistId: yt.playlist_id ?? null,
        channelName: yt.channel_name ?? null,
        thumbnailUrl: yt.thumbnail_url ?? null,
        durationSeconds: yt.duration_seconds ?? null,
        chapters: yt.chapters ?? [],
        embedAllowed: asBoolean(yt.embed_allowed),
        regionStatus: yt.region_status ?? "unknown",
        directWatchUrl: yt.direct_watch_url ?? null,
        updatedAt: new Date(),
      };
      await db
        .insert(resourceYoutubeMetadata)
        .values(values)
        .onConflictDoUpdate({ target: resourceYoutubeMetadata.resourceId, set: values });
      summary.youtube += 1;
    }

    if (resource.github) {
      const gh = resource.github;
      const values = {
        resourceId,
        owner: gh.owner,
        repository: gh.repository,
        defaultBranch: gh.default_branch ?? "main",
        repositoryPath: gh.repository_path ?? null,
        description: gh.description ?? null,
        primaryLanguage: gh.primary_language ?? null,
        license: gh.license ?? null,
        archived: gh.archived ?? false,
        fork: gh.fork ?? false,
        lastCheckedAt: new Date(),
      };
      await db
        .insert(resourceGithubMetadata)
        .values(values)
        .onConflictDoUpdate({ target: resourceGithubMetadata.resourceId, set: values });
      summary.github += 1;
    }

    if (resource.paper) {
      const paper = resource.paper;
      const values = {
        resourceId,
        title: paper.title,
        authors: paper.authors,
        publicationYear: paper.publication_year ?? null,
        arxivId: paper.arxiv_id ?? null,
        doi: paper.doi ?? null,
        paperUrl: paper.paper_url,
        pdfUrl: paper.pdf_url ?? null,
      };
      await db
        .insert(resourcePaperMetadata)
        .values(values)
        .onConflictDoUpdate({ target: resourcePaperMetadata.resourceId, set: values });
      summary.papers += 1;
    }

    // Lesson mappings.
    const desiredLessonIds = new Set<string>();
    for (const link of resource.associated_lessons) {
      const lessonId = lessonIdByKey.get(link.lesson);
      if (!lessonId) {
        summary.unknownLessonKeys.push(`${resource.id} -> ${link.lesson}`);
        continue;
      }
      desiredLessonIds.add(lessonId);
      const mappingValues = {
        lessonId,
        resourceId,
        relevanceScore: link.relevance_score,
        resourceRole: link.role,
        orderIndex: link.order_index,
        recommended: link.recommended,
        notes: link.notes ?? null,
      };
      await db
        .insert(lessonResources)
        .values(mappingValues)
        .onConflictDoUpdate({
          target: [lessonResources.lessonId, lessonResources.resourceId],
          set: {
            relevanceScore: mappingValues.relevanceScore,
            resourceRole: mappingValues.resourceRole,
            orderIndex: mappingValues.orderIndex,
            recommended: mappingValues.recommended,
            notes: mappingValues.notes,
          },
        });
      summary.mappings += 1;
    }

    // Remove stale mappings for this resource.
    const existingMappings = await db
      .select({ lessonId: lessonResources.lessonId })
      .from(lessonResources)
      .where(eq(lessonResources.resourceId, resourceId));
    const stale = existingMappings
      .map((m) => m.lessonId)
      .filter((id) => !desiredLessonIds.has(id));
    if (stale.length > 0) {
      await db
        .delete(lessonResources)
        .where(
          and(
            eq(lessonResources.resourceId, resourceId),
            inArray(lessonResources.lessonId, stale)
          )
        );
    }
  }

  if (options.refresh) {
    await verifyResources(selected.map((s) => s.resource.id), summary);
  }

  return summary;
}

/**
 * Probe the given resource keys against their providers, writing verification
 * rows and refreshing cached metadata. Never called by the web app — only by
 * `npm run resources:audit` or an explicit import flag.
 */
export async function verifyResources(
  resourceKeys: string[],
  summary: ImportSummary = {
    resources: 0,
    mappings: 0,
    youtube: 0,
    github: 0,
    papers: 0,
    created: 0,
    updated: 0,
    skipped: [],
    unknownLessonKeys: [],
    warnings: [],
  }
): Promise<ImportSummary> {
  if (resourceKeys.length === 0) return summary;
  const rows = await db
    .select({
      id: resources.id,
      resourceKey: resources.resourceKey,
      type: resources.resourceType,
      url: resources.canonicalUrl,
    })
    .from(resources)
    .where(inArray(resources.resourceKey, resourceKeys));

  const results = await mapWithRateLimit(
    rows,
    async (row) => ({
      row,
      probe: await probeResource(row.url, row.type as ResourceType),
    }),
    3,
    300
  );

  for (const { row, probe } of results) {
    await db
      .update(resources)
      .set({ verificationStatus: probe.status, verificationNotes: probe.notes, updatedAt: new Date() })
      .where(eq(resources.id, row.id));

    if (probe.github) {
      await db
        .update(resourceGithubMetadata)
        .set({
          defaultBranch: probe.github.defaultBranch,
          description: probe.github.description,
          primaryLanguage: probe.github.primaryLanguage,
          license: probe.github.license,
          archived: probe.github.archived,
          fork: probe.github.fork,
          lastCheckedAt: new Date(),
        })
        .where(eq(resourceGithubMetadata.resourceId, row.id));
    }

    if (probe.channelName || probe.videoTitle || probe.thumbnailUrl) {
      await db
        .update(resourceYoutubeMetadata)
        .set({
          channelName: probe.channelName ?? undefined,
          thumbnailUrl: probe.thumbnailUrl ?? undefined,
          regionStatus: probe.regionStatus ?? "unknown",
          updatedAt: new Date(),
        })
        .where(eq(resourceYoutubeMetadata.resourceId, row.id));
    }

    await db.insert(resourceVerifications).values({
      resourceId: row.id,
      checkType: probe.details.provider === "youtube" ? "oembed" : probe.details.provider === "github" ? "github_api" : "http_head",
      status: probe.status,
      httpStatus: probe.httpStatus ?? null,
      details: probe.details,
    });
  }
  summary.warnings.push(`Refreshed live metadata for ${results.length} resource(s).`);
  return summary;
}
