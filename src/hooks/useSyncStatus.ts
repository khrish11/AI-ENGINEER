"use client";

import { useCallback, useEffect, useState } from "react";
import { useOfflineStatus } from "./useOfflineStatus";
import { db } from "@/lib/progress/db";
import { syncQueue } from "@/lib/progress/sync-queue";
import { getLocalProfile } from "@/lib/progress/device";
import { flushSyncQueue } from "@/lib/progress/sync/client";

export type SyncStatusUI =
  | "offline"
  | "local_only"
  | "syncing"
  | "synced"
  | "conflict"
  | "sync_error";

export function useSyncStatus() {
  const { offline } = useOfflineStatus();
  const [status, setStatus] = useState<SyncStatusUI>("local_only");
  const [pendingCount, setPendingCount] = useState(0);
  const [conflictCount, setConflictCount] = useState(0);
  const [lastSuccessfulSync, setLastSuccessfulSync] = useState<string | null>(null);
  const [authenticated, setAuthenticated] = useState(false);

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
    setAuthenticated(Boolean(profile?.isAuthenticated));

    if (offline) {
      setStatus("offline");
      return;
    }
    if (conflicts > 0) {
      setStatus("conflict");
      return;
    }
    if (!profile?.isAuthenticated) {
      setStatus("local_only");
      return;
    }
    if (pending > 0) {
      setStatus("local_only");
      return;
    }
    if (metadata?.lastSuccessfulSync) {
      setStatus("synced");
      return;
    }
    setStatus("local_only");
  }, [offline]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const syncNow = useCallback(async () => {
    if (offline) {
      setStatus("offline");
      return;
    }
    setStatus("syncing");
    try {
      const result = await flushSyncQueue();
      if ("skipped" in result) {
        setStatus(result.skipped === "offline" ? "offline" : "local_only");
      } else if (result.conflicts.length > 0) {
        setStatus("conflict");
      } else {
        setStatus("synced");
      }
    } catch {
      setStatus("sync_error");
    } finally {
      await refresh();
    }
  }, [offline, refresh]);

  return {
    status,
    pendingCount,
    conflictCount,
    lastSuccessfulSync,
    authenticated,
    refresh,
    syncNow,
  };
}
