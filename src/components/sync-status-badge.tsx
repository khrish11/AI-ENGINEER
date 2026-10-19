"use client";

import { useSyncStatus } from "@/hooks/useSyncStatus";

const LABELS: Record<string, string> = {
  offline: "Offline",
  local_only: "Local only",
  syncing: "Syncing",
  synced: "Synced",
  conflict: "Conflict",
  sync_error: "Sync error",
};

export function SyncStatusBadge() {
  const { status } = useSyncStatus();
  return (
    <div
      data-testid="sync-status"
      className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted border border-border text-[11px] text-muted-foreground font-medium"
    >
      <span
        className={
          status === "synced"
            ? "h-2 w-2 rounded-full bg-status-success"
            : status === "offline" || status === "sync_error"
              ? "h-2 w-2 rounded-full bg-status-error"
              : status === "conflict"
                ? "h-2 w-2 rounded-full bg-status-warning"
                : "h-2 w-2 rounded-full bg-accent-cyan"
        }
      />
      <span>{LABELS[status]}</span>
    </div>
  );
}
