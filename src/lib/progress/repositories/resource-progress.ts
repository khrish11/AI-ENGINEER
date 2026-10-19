import { db, type ResourceProgress } from "../db";
import { bumpRevision, createBase, nowIso } from "../records";
import { syncQueue } from "../sync-queue";
import type { GithubResourceState } from "../resource-rules";
import { mergeGithubState } from "../resource-rules";

export interface UpsertResourceProgressInput {
  resourceId: string;
  resourceType?: string | null;
  resourceTitle?: string | null;
  href?: string | null;
  started?: boolean;
  completed?: boolean;
  bookmarked?: boolean;
  githubState?: GithubResourceState | null;
  notes?: string | null;
  lastOpenedAt?: string | null;
}

export class ResourceProgressRepository {
  async getByResource(resourceId: string): Promise<ResourceProgress | null> {
    return (await db.resourceProgress.where("resourceId").equals(resourceId).first()) ?? null;
  }

  async upsert(input: UpsertResourceProgressInput): Promise<ResourceProgress> {
    const existing = await this.getByResource(input.resourceId);
    const now = nowIso();
    const started = Boolean(input.started ?? existing?.started ?? input.completed);
    const completed = Boolean(existing?.completed || input.completed);
    const record: ResourceProgress = {
      ...(existing ?? {
        ...createBase(),
        resourceId: input.resourceId,
        resourceType: null,
        resourceTitle: null,
        href: null,
        started: false,
        completed: false,
        bookmarked: false,
        githubState: null,
        completedAt: null,
        lastOpenedAt: null,
        notes: null,
      }),
      resourceId: input.resourceId,
      resourceType: input.resourceType ?? existing?.resourceType ?? null,
      resourceTitle: input.resourceTitle ?? existing?.resourceTitle ?? null,
      href: input.href ?? existing?.href ?? null,
      started: completed ? true : started,
      completed,
      bookmarked: input.bookmarked ?? existing?.bookmarked ?? false,
      githubState: mergeGithubState(existing?.githubState ?? null, input.githubState ?? null),
      notes: input.notes === undefined ? existing?.notes ?? null : input.notes,
      lastOpenedAt: input.lastOpenedAt ?? existing?.lastOpenedAt ?? now,
      completedAt: completed ? existing?.completedAt ?? now : null,
      ...(existing ? bumpRevision(existing.localRevision) : {}),
    };

    await db.resourceProgress.put(record);
    await syncQueue.enqueue({
      entityType: "resource_progress",
      entityId: record.id,
      operation: existing ? "update" : "create",
      payload: record,
      baseRevision: existing?.localRevision ?? 0,
    });
    return record;
  }

  async markStarted(
    resourceId: string,
    githubState?: GithubResourceState,
    metadata?: Pick<UpsertResourceProgressInput, "resourceType" | "resourceTitle" | "href">
  ) {
    return this.upsert({
      resourceId,
      started: true,
      githubState: githubState ?? "opened",
      lastOpenedAt: nowIso(),
      ...metadata,
    });
  }

  async markCompleted(
    resourceId: string,
    metadata?: Pick<UpsertResourceProgressInput, "resourceType" | "resourceTitle" | "href">
  ) {
    return this.upsert({ resourceId, started: true, completed: true, ...metadata });
  }

  async markGithubState(
    resourceId: string,
    githubState: GithubResourceState,
    metadata?: Pick<UpsertResourceProgressInput, "resourceType" | "resourceTitle" | "href">
  ) {
    return this.upsert({
      resourceId,
      started: true,
      githubState,
      completed: githubState === "completed_exercise",
      ...metadata,
    });
  }

  async toggleBookmark(resourceId: string) {
    const existing = await this.getByResource(resourceId);
    return this.upsert({
      resourceId,
      bookmarked: !existing?.bookmarked,
      started: existing?.started ?? true,
    });
  }

  async getAll(): Promise<ResourceProgress[]> {
    return db.resourceProgress.toArray();
  }
}

export const resourceProgressRepo = new ResourceProgressRepository();
