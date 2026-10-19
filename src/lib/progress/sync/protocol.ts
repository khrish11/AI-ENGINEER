import { z } from "zod";

export const MutationSchema = z.object({
  mutationId: z.string().uuid().optional(),
  entityType: z.enum([
    "lesson_progress",
    "resource_progress",
    "note",
    "bookmark",
    "study_session",
    "quiz_attempt",
    "project_progress",
    "project_evidence",
    "project_self_assessment",
    "review_history",
    "roadmap_state",
    "tombstone",
  ]),
  entityId: z.string().min(1),
  operation: z.enum(["create", "update", "delete"]),
  payload: z.record(z.string(), z.unknown()),
  baseRevision: z.number().int().nonnegative(),
});

export const SyncRequestSchema = z.object({
  clientBatchId: z.string().uuid(),
  deviceId: z.string().uuid(),
  lastSyncCursor: z.string().max(100).nullable().optional(),
  mutations: z.array(MutationSchema).max(500).default([]),
});

export const SyncRejectionSchema = z.object({
  entityId: z.string(),
  reason: z.string(),
  retryable: z.boolean().optional(),
});

export const SyncResponseSchema = z.object({
  accepted: z.array(z.string()),
  rejected: z.array(SyncRejectionSchema),
  remoteChanges: z.array(z.unknown()),
  conflicts: z.array(z.unknown()),
  nextSyncCursor: z.string(),
});

export type SyncMutation = z.infer<typeof MutationSchema>;
export type SyncRequest = z.infer<typeof SyncRequestSchema>;
export type SyncResponse = z.infer<typeof SyncResponseSchema>;
