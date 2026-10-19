# Progress Tracking, Sync & Privacy

**AI Engineer OS — Phase 4 implementation reference**

Phase 4 makes learner activity local-first. Every learner can use the platform
without an account. IndexedDB is the source of truth for the current device;
PostgreSQL is an optional durable mirror that enables cross-device progress.

---

## 1. Design principles

1. **Guest mode is first-class.** No onboarding gate, no login wall; every
   progress feature works offline and survives reloads.
2. **Local writes never block on the network.** UI actions commit to IndexedDB
   first and enqueue a sync mutation.
3. **Sync is additive and idempotent.** Retried batches never double-apply.
4. **Status progression is monotonic.** Stale clients cannot erase earned
   progress.
5. **Text conflicts are preserved, never silently overwritten.**
6. **Pages never touch Dexie directly.** Repositories own persistence rules and
   React hooks expose them.

---

## 2. IndexedDB schema (Dexie)

Database name: `aiEngineerOsDb` (Dexie schema version 3).

Every mutable record carries:

```ts
{
  id: string;              // client-generated UUID (or deterministic remote id)
  createdAt: string;       // ISO-8601
  updatedAt: string;       // ISO-8601
  localRevision: number;   // increments on every local mutation
  syncStatus: "synced" | "pending" | "conflict" | "failed";
}
```

| Table | Key / indexes | Purpose |
| --- | --- | --- |
| `localProfile` | `id` | Guest/authenticated profile, last sync timestamp |
| `lessonProgress` | `id, lessonId, status, needsReview, phaseSlug, phaseNumber` | Lesson status, completion flags, mastery |
| `resourceProgress` | `id, resourceId, resourceType` | Videos, repos, docs, datasets |
| `notes` | `id, lessonId, resourceId, projectId, conflictState` | Debounced local notes |
| `bookmarks` | `id, lessonId, resourceId, projectId, targetType, deletedAt` | Saved items with soft deletes |
| `studySessions` | `id, clientSessionId, deviceId, lessonId, resourceId, projectId` | Immutable time records |
| `quizAttempts` | `id, attemptId, quizId, lessonId` | Immutable attempt history |
| `projectProgress` | `id, projectId, milestoneId` | Milestone completion + evidence |
| `syncQueue` | `id, mutationId, [entityType+entityId], syncStatus` | Pending upload mutations |
| `syncMetadata` | `id` | Last cursor, last success, pending count |
| `conflicts` | `id, entityType, entityId, conflictState` | Preserved conflict copies |
| `roadmapState` | `id` | Future roadmap engine state |
| `deviceMetadata` | `id, deviceId` | Persistent random device UUID |
| `tombstones` | `id, entityId, entityType` | Synchronized deletions |
| `importBackups` | `id` | Pre-import / pre-reset snapshots |

### Repository layer

`src/lib/progress/repositories/*` is the only code that writes tables:
`lesson-progress`, `resource-progress`, `notes`, `bookmarks`, `study-sessions`,
`quiz-attempts`, `project-progress`, `roadmap-state`. Each mutation also
enqueues a `syncQueue` entry.

React hooks (`src/hooks/useLessonProgress.ts`, `useNotes.ts`,
`useBookmarks.ts`, `useStudySession.ts`, `useQuizAttempts.ts`,
`useProjectProgress.ts`, `useResourceProgress.ts`, `useSyncStatus.ts`,
`useOfflineStatus.ts`, `useLearnerStats.ts`, `useProgressOverview.ts`,
`useConflicts.ts`) are the only interface pages use.

---

## 3. Device identity

On first use, `getOrCreateDeviceId()` generates a UUID v4 and stores it in
`deviceMetadata` (`device_001`). It is reused for:

- sync request provenance (`deviceId`),
- study session ownership,
- conflict diagnostics and deduplication.

No hardware, browser, IP, screen, locale, or timing fingerprinting is used.
Clearing site data deletes the identity; signing in on a new device creates a
new one.

---

## 4. Lesson progress and completion rules

Statuses: `not_started < in_progress < completed < mastered`.

Independent fields: `readingComplete`, `requiredResourcesComplete`,
`practiceComplete`, `projectComplete`, plus `masteryScore` and the separate
`needsReview` flag.

`src/lib/progress/completion.ts` implements the completion engine. Required
activities adapt to the lesson:

- reading is always required,
- resources are required only when the lesson has curated resources,
- practice is required only when a quiz exists,
- projects are required only when the lesson maps to a milestone project.

Opening a lesson never marks it complete. Status only advances when the required
flags are satisfied. `mastered` requires `masteryScore >= 80` **and** a
completed lesson.

Timestamps are evidence: `startedAt` / `completedAt` / `masteredAt` keep the
earliest proven moment during merges.

---

## 5. Resource progress

Lifecycle: `not_started < started < completed` (`src/lib/progress/resource-rules.ts`).

- **YouTube** uses a manual `Mark as watched` action. No watch-duration API is
  claimed and estimated playback is never treated as completion.
- **GitHub** uses explicit states `opened → explored → completed_exercise`.
  Opening a repository records interest; it never completes the exercise.
- Docs, papers, datasets and courses use `Mark complete`.
- `completedAt` is set on first completion and never regresses.

---

## 6. Notes

Notes attach to a lesson, resource, or project. Autosave is debounced (800 ms)
in `useNotes()` so keystrokes do not create sync traffic; each save increments
`contentRevision` and `localRevision`.

When local and cloud copies both changed from the same base revision, the local
text is kept, the remote text is stored in `conflictBackup`, `conflictState`
becomes `unresolved`, and a `conflicts` row is created. The learner can choose
**Keep local**, **Keep cloud**, or **Merge both** in Settings. Last-write-wins is
never used for concurrent text edits.

---

## 7. Bookmarks and tombstones

Bookmarks support lessons, videos, GitHub repositories, documentation, papers,
datasets, and projects (`targetType`). `/saved` filters by type, searches
titles/URLs, links back to content, and removes items.

Deletion is a **tombstone**, not absence:

```ts
{ entityId, entityType, deletedAt, revision }
```

Bookmarks are soft-deleted locally (`deletedAt`) and a tombstone row is written
plus queued for sync. Re-bookmarking after removal creates a new record; the old
tombstone is retained so other devices delete rather than resurrect it.

---

## 8. Study sessions

Sessions are immutable:

```ts
{
  clientSessionId: string,
  deviceId: string,
  lessonId: string | null,
  resourceId: string | null,
  projectId: string | null,
  startedAt: string,
  endedAt: string,
  durationSeconds: number
}
```

Deduplication key: `client_session_id` for guests, `(user_id,
client_session_id)` on the server. Total study time is always derived by summing
unique sessions; cumulative totals are never synchronized.

---

## 9. Quiz attempts

Attempts are immutable history: `attemptId`, `quizId`, `lessonId`, `answers`,
`score`, `maxScore`, `percentage`, `startedAt`, `submittedAt`, `attemptNumber`.
Existing `attemptId`s are never overwritten. Best percentage drives mastery;
all attempts remain visible.

---

## 10. PostgreSQL learner tables

Additive Phase 4 migrations: `src/db/migrations/0003_phase4_sync.sql` and
`0004_phase4_sync_columns.sql` (idempotent repair for databases that journaled
0003 before its column changes landed).

| Table | Notes |
| --- | --- |
| `users`, `accounts`, `sessions`, `verification_tokens` | Auth.js v5 tables |
| `devices` | Optional device registry |
| `user_lesson_progress` | Unique `(user_id, lesson_key)`; flags, mastery, timestamps |
| `user_resource_progress` | Unique `(user_id, resource_id)`; status + metadata |
| `notes` | `lesson_key` nullable, `resource_id`, `project_id`, `content_revision`, `conflict_backup` |
| `bookmarks` | `target_type`, `title`, `href`, `deleted_at` |
| `study_sessions` | Unique `(user_id, client_session_id)` |
| `quiz_attempts` | Unique `(user_id, attempt_id)` |
| `project_progress` | `project_id`, `milestone_id`, evidence URL |
| `roadmap_state` | One row per user |
| `sync_batches` | `client_batch_id` unique, `response_json` for idempotent replay |
| `tombstones` | Unique `(user_id, entity_type, entity_id)` |
| `sync_conflicts` | Preserved local/remote payloads |

`lesson_key` stores the canonical lesson UUID. All queries are scoped by the
session user; no client-supplied `userId` is trusted.

---

## 11. Sync API

### `POST /api/sync/v1`

Request (Zod-validated, max 500 mutations):

```json
{
  "clientBatchId": "uuid",
  "deviceId": "uuid",
  "lastSyncCursor": "2026-10-17T12:00:00.000Z | null",
  "mutations": [
    {
      "mutationId": "uuid",
      "entityType": "lesson_progress",
      "entityId": "uuid",
      "operation": "update",
      "payload": {},
      "baseRevision": 3
    }
  ]
}
```

Response:

```json
{
  "accepted": ["entity-id"],
  "rejected": [{ "entityId": "...", "reason": "...", "retryable": false }],
  "remoteChanges": [
    {
      "entityType": "lesson_progress",
      "entityId": "...",
      "operation": "upsert",
      "data": {},
      "updatedAt": "..."
    }
  ],
  "conflicts": [],
  "nextSyncCursor": "2026-10-17T12:00:05.000Z"
}
```

- Unauthenticated requests return `401` with a guest hint; the client keeps local
  data and reports `Local only`.
- The server hydrates its merge state from PostgreSQL before processing, so
  conflict detection is deterministic across restarts and instances.
- Cursor semantics: ISO-8601 server timestamp. `remoteChanges` contains rows
  updated after `lastSyncCursor` and at or before the batch start, preventing a
  client from echoing its own writes.
- `nextSyncCursor` equals the batch start; a retry returns the stored response.

### `GET /api/sync/v1`

Returns the authenticated learner's full cloud snapshot (lessons, resources,
notes, bookmarks, study sessions, quiz attempts, projects, roadmap) for the
guest→account merge. `Cache-Control: no-store, private`.

### Idempotency

`sync_batches` stores `client_batch_id` (unique per user) and the full
`response_json`. If a batch is retried, the route returns the stored response and
never re-applies mutations or creates duplicate rows. Unit tests in
`src/test/progress-sync.test.ts` prove repeated batches return identical
responses and leave revisions unchanged.

---

## 12. Conflict handling

| Entity | Strategy |
| --- | --- |
| Lesson progress | Monotonic status merge; completion flags OR; best mastery score |
| Resource progress | Monotonic lifecycle; completion never regresses |
| Notes | Preserve both, mark `unresolved`, learner resolves |
| Study sessions | Immutable union by `clientSessionId` |
| Quiz attempts | Immutable union by `attemptId` |
| Bookmarks | Union of additions, tombstones for deletions |
| Projects | `completed` OR, earliest completion time |

`sync_conflicts` and the local `conflicts` table hold unresolved pairs. The
Settings screen lists them with resolution actions; resolutions enqueue a fresh
mutation.

---

## 13. Sync queue and retries

Each queued mutation stores `mutationId`, `entityType`, `entityId`, `operation`,
`payload`, `baseRevision`, `createdAt`, and `retryCount`.

- Online flush: batch pending → `POST /api/sync/v1` → apply `remoteChanges` →
  acknowledge accepted mutations → record cursor.
- Transient failures (HTTP 5xx) schedule exponential backoff
  (500 ms × 2^retry, capped at 30 s, 6 attempts).
- Permanent rejections and 4xx responses mark the mutation `failed`; it is not
  retried forever.
- Offline flushes are skipped and the UI reports `Offline`.

Dexie auto-open makes mutation writes synchronous with UI actions, so an offline
session continues to work and uploads when connectivity returns.

---

## 14. Guest → account migration

When a guest signs in (Settings → GitHub/Google):

1. The IndexedDB database is left untouched.
2. Auth.js authenticates and the profile is marked authenticated.
3. `GET /api/sync/v1` downloads the cloud snapshot.
4. `performGuestAccountMerge()` compares local and cloud records.
5. Merge is deterministic: monotonic statuses/flags, union of immutable history,
   note conflicts preserved, cloud tombstones applied.
6. Local records that differ from cloud are queued.
7. The queue is flushed.
8. The Settings page renders a merge summary:

```text
Synced from this device
Lessons: 34   Resources: 21   Notes: 12
Bookmarks: 8  Study sessions: 27

Cloud records preserved
Lessons: 5    Notes: 2
```

Guest data is never deleted by this flow. If the first upload fails, local data
remains and the queue retries later.

---

## 15. Backup format

`src/lib/progress/export-import.ts` defines the versioned export:

```json
{
  "schemaVersion": 1,
  "app": "ai-engineer-os",
  "exportedAt": "2026-10-17T12:00:00.000Z",
  "data": {
    "localProfile": {},
    "lessonProgress": [],
    "resourceProgress": [],
    "notes": [],
    "bookmarks": [],
    "studySessions": [],
    "quizAttempts": [],
    "projectProgress": [],
    "roadmapState": []
  }
}
```

Forbidden fields are stripped recursively (`access_token`, `refresh_token`,
`id_token`, `session_token`, `provider_account_id`, secrets, database URLs,
passwords). Record shapes are validated with Zod; malformed or unsupported
versions are rejected before any write.

### Import flow

1. Choose a JSON file.
2. Parse and validate; invalid files never touch local data.
3. Preview record counts and schema version.
4. Choose **Merge** or **Replace local learning data**, or cancel.
5. A snapshot is written to `importBackups` before any change.
6. Changes apply inside one Dexie transaction.

Merge mode is monotonic (imports cannot downgrade), unions immutable history, and
treats differing note text as a conflict. Replace mode clears learning tables
and restores the backup.

---

## 16. Dashboard and curriculum progress

All dashboard numbers come from `getLearnerStats()` over IndexedDB: lessons
started/completed/mastered, resources completed, videos watched, quiz attempts,
study sessions, total time, streak, active projects and review queue. A new
learner sees an empty state rather than invented metrics.

Curriculum views compute progress against canonical lesson IDs: phase cards show
`completed / lessonCount`, and phase pages expose filters for **All**, **Not
Started**, **In Progress**, **Completed**, **Mastered**, and **Needs Review**.

---

## 17. Privacy model

- **Guest mode:** learning data stays in the browser's IndexedDB on this device.
  It is not transmitted anywhere unless the learner exports it or signs in.
- **Authenticated mode:** learning data is synchronized to the project's own
  PostgreSQL database. No third-party analytics or advertising service receives
  progress data.
- **OAuth tokens** from GitHub/Google stay in the Auth.js session/account tables
  on the server. They are never written to IndexedDB or included in exports.
- **Device identity** is a random UUID only; no fingerprinting is performed.
- **Export files** are created locally in the browser and contain only the
  learner's own progress records.

---

## 18. Verification

- Unit/integration tests: `src/test/progress-*.test.ts` cover completion rules,
  monotonic merges, mastery, resource progression, tombstones, study session
  deduplication, quiz immutability, note conflicts, sync idempotency, merge
  logic, export/import validation and device ID persistence using
  `fake-indexeddb`.
- Playwright: `e2e/progress.spec.ts` covers guest persistence across reloads,
  saved-item removal, export/reset/import, and offline→online behavior.
  Authentication journeys are skipped automatically when OAuth credentials are
  not configured.
