export type TombstoneEntityType =
  | "bookmark"
  | "note"
  | "project_evidence";

export interface Tombstone {
  id: string;
  entityId: string;
  entityType: TombstoneEntityType;
  deletedAt: string;
  revision: number;
}

export function createTombstone(
  entityId: string,
  entityType: TombstoneEntityType,
  revision: number,
  deletedAt = new Date().toISOString()
): Omit<Tombstone, "id"> {
  return {
    entityId,
    entityType,
    deletedAt,
    revision,
  };
}

export function applyTombstones<T extends { id: string }>(
  records: T[],
  tombstones: Array<{ entityId: string; entityType: string }>,
  entityType: string
): T[] {
  const deleted = new Set(
    tombstones.filter((t) => t.entityType === entityType).map((t) => t.entityId)
  );
  return records.filter((record) => !deleted.has(record.id));
}

export function bookmarkVisible<T extends { id: string; deletedAt?: string | null }>(
  bookmark: T
): boolean {
  return !bookmark.deletedAt;
}
