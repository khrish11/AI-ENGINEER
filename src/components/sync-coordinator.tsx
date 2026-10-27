"use client";

import { useEffect } from "react";
import { initSyncCoordinator } from "@/lib/progress/sync/coordinator";

/**
 * Headless global sync engine host. Mounted once in the root layout so the
 * queue is pumped on every page, not just Settings. Renders nothing.
 */
export function SyncCoordinator() {
  useEffect(() => initSyncCoordinator(), []);
  return null;
}
