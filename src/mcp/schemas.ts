import { z } from "zod";

export const SearchCurriculumInput = z.object({
  query: z.string().trim().min(1).max(200).optional(),
  phase: z.number().int().min(0).max(20).optional(),
  limit: z.number().int().min(1).max(50).default(10),
}).strict();

export const GetLessonInput = z.object({
  phaseSlug: z.string().trim().min(1).max(120),
  lessonSlug: z.string().trim().min(1).max(160),
  includeContent: z.boolean().default(false),
}).strict();

export const SearchResourcesInput = z.object({
  query: z.string().trim().min(1).max(200).optional(),
  lessonId: z.string().trim().min(1).max(160).optional(),
  type: z.string().trim().min(1).max(50).optional(),
  limit: z.number().int().min(1).max(50).default(10),
}).strict();

export const SearchProjectsInput = z.object({
  query: z.string().trim().min(1).max(200).optional(),
  phase: z.string().trim().min(1).max(120).optional(),
  limit: z.number().int().min(1).max(50).default(10),
}).strict();

export const GetProjectInput = z.object({
  slug: z.string().trim().min(1).max(160),
}).strict();

export type SearchCurriculumArgs = z.infer<typeof SearchCurriculumInput>;
