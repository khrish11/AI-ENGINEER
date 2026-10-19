import { z } from "zod";
import {
  DIFFICULTIES,
  EDITORIAL_STATUSES,
  RESOURCE_ROLES,
  RESOURCE_TYPES,
  VERIFICATION_STATUSES,
  type CatalogLessonLink,
  type CatalogResource,
} from "./types";
import { isValidLessonKey } from "./canonical";

const kebabId = z
  .string()
  .min(3)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "id must be lower-case kebab-case");

const resourceTypeSchema = z.enum(RESOURCE_TYPES);
const editorialStatusSchema = z.enum(EDITORIAL_STATUSES);
const verificationStatusSchema = z.enum(VERIFICATION_STATUSES);
const resourceRoleSchema = z.enum(RESOURCE_ROLES);
const difficultySchema = z.enum(DIFFICULTIES);

const lessonLinkObjectSchema = z.object({
  lesson: z.string().refine(isValidLessonKey, "lesson must be '<phase-slug>/<lesson-folder>'"),
  role: resourceRoleSchema.default("supplementary"),
  relevance_score: z.number().int().min(0).max(100).default(50),
  order_index: z.number().int().min(0).default(0),
  recommended: z.boolean().default(false),
  notes: z.string().max(1000).optional(),
});

const associatedLessonSchema = z.union([
  z
    .string()
    .refine(isValidLessonKey, "lesson must be '<phase-slug>/<lesson-folder>'"),
  lessonLinkObjectSchema,
]);

const chapterSchema = z.object({
  timestamp_seconds: z.number().int().nonnegative(),
  title: z.string().min(1).max(300),
});

const youtubeMetadataSchema = z.object({
  video_id: z.string().regex(/^[A-Za-z0-9_-]{11}$/, "invalid YouTube video id").optional(),
  playlist_id: z.string().regex(/^[A-Za-z0-9_-]{10,64}$/, "invalid YouTube playlist id").optional(),
  channel_name: z.string().max(200).optional(),
  thumbnail_url: z.string().url().optional(),
  duration_seconds: z.number().int().positive().nullable().optional(),
  chapters: z.array(chapterSchema).default([]),
  embed_allowed: z.enum(["allowed", "disallowed", "unknown"]).default("unknown"),
  region_status: z.enum(["global", "regional", "unknown"]).default("unknown"),
  direct_watch_url: z.string().url().optional(),
});

const githubMetadataSchema = z.object({
  owner: z.string().min(1).max(120),
  repository: z.string().min(1).max(120),
  default_branch: z.string().max(80).default("main"),
  repository_path: z.string().max(500).optional(),
  description: z.string().max(1000).optional(),
  primary_language: z.string().max(60).optional(),
  license: z.string().max(100).nullable().optional(),
  archived: z.boolean().default(false),
  fork: z.boolean().default(false),
});

const paperMetadataSchema = z.object({
  title: z.string().min(3).max(300),
  authors: z.array(z.string().min(1)).min(1),
  publication_year: z.number().int().min(1900).max(2100).optional(),
  arxiv_id: z.string().max(32).optional(),
  doi: z.string().max(120).optional(),
  paper_url: z.string().url(),
  pdf_url: z.string().url().optional(),
});

const authorSchema = z.object({
  name: z.string().min(1).max(200),
  organization: z.string().max(200).optional(),
  profile_url: z.string().url().optional(),
});

export const catalogResourceSchema = z
  .object({
    id: kebabId,
    type: resourceTypeSchema,
    title: z.string().min(3).max(255),
    canonical_url: z.string().url("canonical_url must be a valid URL"),
    description: z.string().max(2000).optional(),
    author: authorSchema.optional(),
    language: z.string().min(2).max(16).default("en"),
    difficulty: difficultySchema.default("all_levels"),
    estimated_duration_minutes: z.number().int().positive().nullable().optional(),
    license: z.string().max(100).nullable().optional(),
    source_platform: z.string().max(100).optional(),
    editorial_status: editorialStatusSchema.default("pending_review"),
    verification_status: verificationStatusSchema.default("unverified"),
    verification_notes: z.string().max(2000).optional(),
    last_verified_at: z.string().datetime().optional(),
    tags: z.array(z.string().min(1).max(60)).default([]),
    associated_lessons: z.array(associatedLessonSchema).default([]),
    youtube: youtubeMetadataSchema.optional(),
    github: githubMetadataSchema.optional(),
    paper: paperMetadataSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if ((value.type === "youtube_video" || value.type === "youtube_playlist") && !value.youtube) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `type "${value.type}" requires a "youtube" metadata block`,
        path: ["youtube"],
      });
    }
    if (value.type === "youtube_video" && value.youtube && !value.youtube.video_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'type "youtube_video" requires youtube.video_id',
        path: ["youtube", "video_id"],
      });
    }
    if (value.type === "youtube_playlist" && value.youtube && !value.youtube.playlist_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'type "youtube_playlist" requires youtube.playlist_id',
        path: ["youtube", "playlist_id"],
      });
    }
    if ((value.type === "github_repo" || value.type === "project_starter") && !value.github) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `type "${value.type}" requires a "github" metadata block`,
        path: ["github"],
      });
    }
    if (value.type === "research_paper" && !value.paper) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'type "research_paper" requires a "paper" metadata block',
        path: ["paper"],
      });
    }
  })
  .transform((value): CatalogResource => {
    const links: CatalogLessonLink[] = (value.associated_lessons ?? []).map((entry) => {
      if (typeof entry === "string") {
        return {
          lesson: entry,
          role: "supplementary",
          relevance_score: 50,
          order_index: 0,
          recommended: false,
        };
      }
      return {
        lesson: entry.lesson,
        role: entry.role,
        relevance_score: entry.relevance_score,
        order_index: entry.order_index,
        recommended: entry.recommended,
        notes: entry.notes,
      };
    });
    return { ...value, associated_lessons: links } as CatalogResource;
  });

export type CatalogResourceInput = z.input<typeof catalogResourceSchema>;

/** A catalog file may contain a single resource object or an array of them. */
export const catalogFileSchema = z.union([
  catalogResourceSchema,
  z.array(catalogResourceSchema),
]);

export interface SchemaIssue {
  file: string;
  path: string;
  message: string;
}

/**
 * Zod reports a discriminated failure as a single `invalid_union` with the
 * real messages hidden inside `unionErrors`. Flatten recursively, keeping the
 * branch that is closest to valid so contributors get actionable paths.
 */
function flattenIssues(
  issues: z.ZodIssue[],
  file: string,
  out: SchemaIssue[] = []
): SchemaIssue[] {
  for (const issue of issues) {
    const unionErrors = (
      issue as { unionErrors?: { issues: z.ZodIssue[] }[] }
    ).unionErrors;
    if (issue.code === "invalid_union" && unionErrors && unionErrors.length > 0) {
      const best = unionErrors.reduce((a, b) =>
        b.issues.length < a.issues.length ? b : a
      );
      flattenIssues(best.issues, file, out);
    } else {
      out.push({
        file,
        path: issue.path.join("."),
        message: issue.message,
      });
    }
  }
  return out;
}

/** Validate raw parsed JSON from a catalog file, returning issues instead of throwing. */
export function validateCatalogFile(
  file: string,
  data: unknown
): { resources: CatalogResource[]; issues: SchemaIssue[] } {
  const result = catalogFileSchema.safeParse(data);
  if (!result.success) {
    return {
      resources: [],
      issues: flattenIssues(result.error.issues, file),
    };
  }
  const resources = Array.isArray(result.data) ? result.data : [result.data];
  return { resources, issues: [] };
}
