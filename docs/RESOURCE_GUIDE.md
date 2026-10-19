# Resource Registry Guide (Phase 3)

The AI Engineer OS includes a first-class curated learning resource registry that maps high-signal videos, repositories, papers, documentation, and tutorials to every lesson in the curriculum. Phase 3 delivers the full pipeline: declarative catalog, schema validation, deterministic ranking, coverage analysis, database persistence, and the `/resources` discovery UI with lesson-level tabs.

## Architecture Overview

- **Database schema** (`src/db/schema.ts`): tables `resources`, `lessonResources`, `resourceYoutubeMetadata`, `resourceGithubMetadata`, `resourcePaperMetadata`, `resourceVerifications`. Resources have a stable `resourceKey` (catalog `id`) and a unique `canonical_url_hash`.
- **Types & validation** (`src/lib/resources/types.ts`, `schema.ts`): strict Zod schemas enforce resource types, editorial/verification statuses, lesson keys (`<phase-slug>/<lesson-folder>`), YouTube/GitHub/Paper metadata requirements, and transform shorthand lesson mappings.
- **Canonicalization** (`src/lib/resources/canonical.ts`): normalizes URLs (drops tracking params, sorts queries, normalizes YouTube short/playlist/embed, GitHub repo forms, arXiv PDF→abs), produces a deterministic SHA256 hash for deduplication, detects provider.
- **Catalog loader** (`src/lib/resources/catalog.ts`): reads `resources/catalog/**.json`, validates each file, detects duplicate IDs and duplicate canonical URLs across the entire catalog, and can build a lesson index from the upstream curriculum.
- **Ranking** (`src/lib/resources/ranking.ts`): deterministic scoring (no LLM). Signals include role (primary), official documentation, original-author organization/channel, verification status, high relevance, recency of verification, and practical type. Editorial `recommended` and `order_index` always take precedence.
- **Coverage** (`src/lib/resources/coverage.ts`): computes per-lesson and per-phase coverage (has video/practical/primary/reference, % with resources) and exports a machine-readable report.
- **Service layer** (`src/lib/resources/service.ts`): `getAllResourceViews()` assembles resources with provider metadata and lesson links (uses in-memory mapping after fetching rows), `getResourcesForLesson(lessonId)`, `getResourceStats()`.
- **Import pipeline** (`src/lib/resources/import.ts`, `src/scripts/resources-*.ts`): validate → (optional audit/probe) → import upserts resources/metadata/lesson mappings; `resources:coverage` writes `reports/resource-coverage.json` and `.md`.

## Catalog Format

Resources live in `resources/catalog/<phase-slug>/resources.json`. A file may contain a single object or an array. Required fields: `id` (kebab-case), `type`, `title`, `canonical_url`, `editorial_status`, `associated_lessons` (array of lesson keys `"<phase-slug>/<lesson-folder>"` or objects with role/relevance/order/recommended/notes).

Provider-specific metadata blocks are required by type:
- `youtube_video` / `youtube_playlist` → `youtube` (video_id or playlist_id required)
- `github_repo` / `project_starter` → `github` (owner, repository)
- `research_paper` → `paper` (title, authors[], paper_url)

Lesson key format must match the upstream curriculum layout (`phases/<phase-slug>/<lesson-folder>/README.md`). The validator cross-checks against `upstream/ai-engineering-from-scratch/phases` when available.

## npm Scripts

- `npm run resources:validate` — load and validate all catalog files; detect duplicates and unknown lesson keys.
- `npm run resources:audit` — probe canonical URLs (reachability) and populate verification signals (writes to DB via import/audit helpers).
- `npm run resources:coverage` — compute coverage from DB/catalog-derived mappings and write `reports/resource-coverage.json` and `reports/resource-coverage.md`.
- `npm run resources:import` — import/refresh catalog into the database (upserts resources, metadata, lessonResources; syncs mappings).

## UI

- `/resources` — server-rendered discovery page backed by `getAllResourceViews()`. Client-side `ResourceBrowser` supports full-text search (title/description/tags/author/lessons), type pills, phase filter, and sort (recommended first). URL params (`q`, `type`, `phase`) are preserved.
- Lesson workspace (`src/app/curriculum/[phaseSlug]/[lessonSlug]/page.tsx`) adds **Videos**, **GitHub Code** (includes referenced repos), and **Resources** tabs powered by `getResourcesForLesson(lesson.id)`.

## Verification & Editorial Policy

- `verification_status` reflects honest probe results: `reachable` (2xx/3xx), `partially_verified` (403/bot-protection), `unavailable`, `regional`, `unknown`, `unverified`, `verified`.
- `editorial_status`: `verified` only for clearly authoritative/original sources; otherwise `pending_review`. Never fabricate IDs/URLs/metadata.
- Deterministic ranking; no LLM used for base scoring.

## Testing

Unit tests cover canonicalization, schema validation (with union-error flattening), ranking, coverage, and catalog utilities (`src/test/resources-*.ts`). All 64 unit tests pass; `npm run test` runs Vitest. E2E specs (`e2e/resources.spec.ts`, `e2e/curriculum.spec.ts`) verify navigation, search/filtering, and lesson tabs.

## Development Notes

- Typecheck/lint clean. Schema union errors are flattened for actionable diagnostics.
- Windows PowerShell: use provided tools (`read/edit/write/bash`) rather than POSIX-only commands in shell blocks.
- Network probing uses `curl.exe` (avoids PowerShell `Invoke-WebRequest` interactive prompts). GitHub API unauthenticated is rate-limited.
- The catalog currently contains 152 resources mapped to 299 lesson links; coverage is reported in `reports/`.
