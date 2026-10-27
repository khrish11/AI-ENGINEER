import { syncQueue } from "../sync-queue";
import { getLocalProfile, markAuthenticated, markCloudSnapshotPulled, markGuest } from "../device";
import { flushSyncQueue, mergeOnSignIn } from "./client";
import { fetchAuthStatus, type ClientAuthStatus } from "@/lib/auth/client-status";
import type { MergeSummary } from "../merge";

/**
 * Sync coordinator: the orchestration layer between IndexedDB mutation queues
 * and `flushSyncQueue()`. Repositories enqueue; nothing in the app decided to
 * *pump* the queue, so authenticated learners accumulated mutations forever.
 *
 * Responsibilities:
 * - Reconcile the local profile with the server session exactly once per
 *   transition (guest -> account merge + first flush; account -> guest stop).
 * - Drain the queue automatically: after local mutations (enqueue hook), when
 *   connectivity returns, when the tab becomes visible, and on
 *   startup for already-authenticated devices.
 * - Guarantee single-flight: never two concurrent flushes from this tab, and
 *   re-run when a mutation landed mid-flight instead of dropping it.
 * - Surface `syncing` / `lastError` so the UI can tell the truth (BUG-03/09).
 *
 * Queued mutations are only removed on verified server acknowledgement —
 * that happens inside `flushSyncQueue` (`acknowledgeCommitted` after a parsed
 * 2xx response, guarded by mutationId so a re-mutated row survives); the
 * coordinator never deletes queue rows itself.
 */

export interface CoordinatorSnapshot {
  syncing: boolean;
  lastError: string | null;
  reconciled: boolean;
}

type Listener = (snapshot: CoordinatorSnapshot) => void;

const listeners = new Set<Listener>();

const DEBOUNCE_MS = 700;
const RETRY_MS = 5_000;
const MAX_PASSES = 12;

let syncing = false;
let rerunRequested = false;
let lastError: string | null = null;
let reconciled = false;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let reconcilePromise: Promise<ReconcileResult> | null = null;
let initSyncCoordinatorCleanup: (() => void) | null = null;
let initRefCount = 0;

export interface ReconcileResult {
  summary: MergeSummary | null;
  authenticated: boolean;
  status: ClientAuthStatus;
}

function snapshot(): CoordinatorSnapshot {
  return { syncing, lastError, reconciled };
}

function emit(): void {
  const state = snapshot();
  for (const listener of listeners) listener(state);
}

export function subscribeSyncCoordinator(listener: Listener): () => void {
  listeners.add(listener);
  listener(snapshot());
  return () => listeners.delete(listener);
}

export function getSyncCoordinatorSnapshot(): CoordinatorSnapshot {
  return snapshot();
}

function clearDebounce(): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
}

function clearRetry(): void {
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
}

/** Schedule a queue drain. Coalesces bursts of mutations into one flush. */
export function scheduleSync(delay = DEBOUNCE_MS): void {
  clearDebounce();
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    void pump();
  }, delay);
}

function scheduleRetry(): void {
  if (retryTimer) return;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    scheduleSync(0);
  }, RETRY_MS);
}

/**
 * Single-flight queue drain. A call while a cycle is running sets a re-run
 * flag so mutations enqueued mid-flight are still flushed, then resolves
 * with the same in-flight cycle.
 */
export function pump(): Promise<void> {
  if (syncing) {
    rerunRequested = true;
    return new Promise((resolve) => {
      const unsub = subscribeSyncCoordinator((state) => {
        if (!state.syncing) {
          unsub();
          resolve();
        }
      });
    });
  }
  return runCycle();
}

async function runCycle(): Promise<void> {
  syncing = true;
  emit();
  try {
    for (let pass = 0; pass < MAX_PASSES; pass += 1) {
      const result = await flushSyncQueue();
      if ("skipped" in result) {
        // "offline" | "guest" | "unauthenticated" | "backoff"
        if (result.skipped === "backoff") scheduleRetry();
        else clearRetry();
        lastError = null;
        break;
      }
      lastError = null;
      clearRetry();
      if ((await syncQueue.getPendingCount()) === 0) break;
    }
  } catch (err) {
    lastError = err instanceof Error ? err.message : "Sync failed";
    scheduleRetry();
  } finally {
    syncing = false;
    emit();
    if (rerunRequested) {
      rerunRequested = false;
      scheduleSync(0);
    }
  }
}

/**
 * Reconcile local profile state with the server session and kick the queue.
 * Concurrent callers share one in-flight pass; repeat calls after completion
 * re-check cheaply and are idempotent (markAuthenticated merges on change).
 * `forceMerge` (settings sign-in / Sync now) runs the cloud snapshot pull for
 * any account this device has not yet restored — even on an empty local store
 * and even when a passive reconcile already promoted the profile.
 */
export function ensureProfileReconciled(options?: {
  forceMerge?: boolean;
}): Promise<ReconcileResult> {
  if (reconcilePromise && !options?.forceMerge) return reconcilePromise;
  const run = async (): Promise<ReconcileResult> => {
    const status = await fetchAuthStatus();
    const profile = await getLocalProfile();
    if (status.authenticated) {
      const email = status.user?.email ?? null;
      const promote = !profile?.isAuthenticated;
      // Cloud-snapshot restore is an *explicit* merge action (settings sign-in
      // / Sync now), never a side effect of passively noticing a session.
      // Downloading history on every authentication-detected page load would
      // merge another device/session's cloud rows and break account isolation
      // (req #8). But gating the pull on the guest->authenticated transition
      // made cross-device restore racy: the root-layout init reconcile promotes
      // the profile first, so a later explicit merge would skip the pull and
      // strand Device B on an empty store. Track the pulled account instead:
      // pull whenever the user explicitly asks and this device has not yet
      // restored *the current* account's snapshot. The server scopes the GET to
      // the session's own user, so a different account only ever imports its
      // own data.
      const pull = Boolean(options?.forceMerge) && (profile?.lastMergedEmail ?? null) !== email;
      if (promote || pull) {
        if (promote) await markAuthenticated(email, status.user?.name ?? null);
        let summary: MergeSummary | null = null;
        if (pull) {
          try {
            const result = await mergeOnSignIn();
            if (!("skipped" in result)) {
              summary = result;
              await markCloudSnapshotPulled(email);
            }
          } catch (err) {
            lastError = err instanceof Error ? err.message : "Cloud merge failed";
          }
        }
        reconciled = true;
        emit();
        scheduleSync(0);
        return { summary, authenticated: true, status };
      }
    }
    if (!status.authenticated && profile?.isAuthenticated) {
      await markGuest();
      reconciled = true;
      emit();
      return { summary: null, authenticated: false, status };
    }
    reconciled = true;
    if (status.authenticated) scheduleSync(200);
    emit();
    return { summary: null, authenticated: Boolean(status.authenticated), status };
  };
  if (options?.forceMerge) return run();
  reconcilePromise = run().finally(() => {
    reconcilePromise = null;
  });
  return reconcilePromise;
}

/** Manual "Sync now": genuine two-way attempt — reconcile (with the
 * cloud-snapshot pull, so an explicit click can also restore state on this
 * device), then drain the queue. */
export async function requestManualSync(): Promise<CoordinatorSnapshot> {
  await ensureProfileReconciled({ forceMerge: true });
  clearDebounce();
  await pump();
  return snapshot();
}

/** Global listeners + startup reconcile. Refcounted so React StrictMode
 * double-mounts (and multi-instance usage) attach exactly one listener set. */
export function initSyncCoordinator(): () => void {
  initRefCount += 1;
  if (initRefCount === 1) {
    const onOnline = () => scheduleSync(0);
    const onVisibility = () => {
      if (document.visibilityState === "visible") scheduleSync(300);
    };
    // Dexie 4 removed table-level `on("changes")` events, so the coordinator
    // decorates the one funnel every local mutation passes through
    // (`syncQueue.enqueue`). Retry/markFailed/ack updates are queue state
    // transitions, not new work, so they correctly do not re-trigger.
    const prototypeEnqueue = syncQueue.enqueue;
    const wrappedEnqueue: typeof syncQueue.enqueue = async function (
      this: unknown,
      input
    ) {
      const item = await prototypeEnqueue.call(this, input);
      scheduleSync();
      return item;
    };
    syncQueue.enqueue = wrappedEnqueue;
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisibility);
    void ensureProfileReconciled().catch((err) => {
      // A failed reconcile must not surface as an unhandled rejection; the
      // truth is shown through the coordinator's error channel instead.
      lastError = err instanceof Error ? err.message : "Profile reconciliation failed";
      emit();
    });
    initSyncCoordinatorCleanup = () => {
      if (syncQueue.enqueue === wrappedEnqueue) {
        syncQueue.enqueue = prototypeEnqueue;
      }
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisibility);
      clearDebounce();
      clearRetry();
    };
  }
  return () => {
    initRefCount -= 1;
    if (initRefCount === 0 && initSyncCoordinatorCleanup) {
      initSyncCoordinatorCleanup();
      initSyncCoordinatorCleanup = null;
    }
  };
}
