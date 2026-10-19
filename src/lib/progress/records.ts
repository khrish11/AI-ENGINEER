import { v4 as uuidv4 } from "uuid";
import type { SyncStatus } from "./db";

export function nowIso(): string {
  return new Date().toISOString();
}

export function newId(): string {
  return uuidv4();
}

export function createBase(overrides?: {
  id?: string;
  createdAt?: string;
  updatedAt?: string;
  localRevision?: number;
  syncStatus?: SyncStatus;
}) {
  const ts = nowIso();
  return {
    id: overrides?.id ?? newId(),
    createdAt: overrides?.createdAt ?? ts,
    updatedAt: overrides?.updatedAt ?? ts,
    localRevision: overrides?.localRevision ?? 1,
    syncStatus: overrides?.syncStatus ?? ("pending" as SyncStatus),
  };
}

export function bumpRevision(localRevision: number) {
  return {
    updatedAt: nowIso(),
    localRevision: localRevision + 1,
    syncStatus: "pending" as const,
  };
}
