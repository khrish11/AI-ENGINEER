"use client";

import { useCallback, useEffect, useState } from "react";
import { useOfflineStatus } from "./useOfflineStatus";
import { db } from "@/lib/progress/db";
import { syncQueue } from "@/lib/progress/sync-queue";
import { getLocalProfile } from "@/lib/progress/device";
import {
  requestManualSync,
  subscribeSyncCoordinator,
  type CoordinatorSnapshot,
} from "@/lib/progress/sync/coordinator";

export type SyncStatusUI =
  | "offline"
  | "local_only"
  | "syncing"
  | "pending"
  | "synced"
  | "conflict"
  | "sync_error";

/**
 * Sync state for the UI. Status semantics (post BUG-02/03):
 * - guests: `local_only` (by design — nothing syncs without an account)
 * - authenticated: reflects the real coordinator — in-flight flush → `syncing`,
 *   queued-but-idle (backoff) → `pending`, drained → `synced`,
 *   failure → `sync_error` with the message surfaced from the coordinator.
 */
export function useSyncStatus() {
  const { offline } = useOfflineStatus();
  const [status, setStatus] = useState<SyncStatusUI>("local_only");
  const [pendingCount, setPendingCount] = useState(0);
  const [conflictCount, setConflictCount] = useState(0);
  const [lastSuccessfulSync, setLastSuccessfulSync] = useState<string | null>(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [pending, conflicts, metadata, profile] = await Promise.all([
      syncQueue.getPendingCount(),
      db.conflicts.where("conflictState").equals("unresolved").count(),
      db.syncMetadata.get("sync_meta"),
      getLocalProfile(),
    ]);
    setPendingCount(pending);
    setConflictCount(conflicts);
    setLastSuccessfulSync(metadata?.lastSuccessfulSync ?? profile?.lastSyncAt ?? null);
    const authed = Boolean(profile?.isAuthenticated);
    setAuthenticated(authed);

    const coordinator = subscribeOnceSnapshot();

    if (offline) {
      setStatus("offline");
      return;
    }
    if (!authed) {
      setStatus("local_only");
      return;
    }
    if (conflicts > 0) {
      setStatus("conflict");
      return;
    }
    if (coordinator.syncing) {
      setStatus("syncing");
      return;
    }
    if (coordinator.lastError) {
      setLastError(coordinator.lastError);
      setStatus("sync_error");
      return;
    }
    if (pending > 0) {
      setStatus("pending");
      return;
    }
    setStatus("synced");
  }, [offline]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Re-render on every coordinator transition (flush start/finish, reconcile,
  // error changes) so the badge and Settings panel tell the truth immediately.
  useEffect(() => {
    return subscribeSyncCoordinator(() => {
      // Profile reconciliation can change authenticated -> guest without
      // changing syncing/error (for example, after an expired or cleared
      // session). Re-read IndexedDB for every coordinator emission so the
      // badge cannot retain a stale "Synced" state after demotion.
      void refresh();
    });
  }, [refresh]);

  const syncNow = useCallback(async () => {
    if (offline) {
      setStatus("offline");
      return;
    }
    setStatus("syncing");
    const result = await requestManualSync();
    if (result.lastError) {
      setLastError(result.lastError);
    } else {
      setLastError(null);
    }
    await refresh();
  }, [offline, refresh]);

  return {
    status,
    pendingCount,
    conflictCount,
    lastSuccessfulSync,
    authenticated,
    lastError,
    refresh,
    syncNow,
  };
}

// Module-level latest snapshot so refresh() can read coordinator state
// without hook plumbing; kept warm by the subscription below.
let snapshotCache: CoordinatorSnapshot = { syncing: false, lastError: null, reconciled: false };
subscribeSyncCoordinator((next) => {
  snapshotCache = next;
});
function subscribeOnceSnapshot(): CoordinatorSnapshot {
  return snapshotCache;
}
