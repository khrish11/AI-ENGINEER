# AI Engineer OS — Engineering Roadmap (Corrected)

This document tracks the phased development lifecycle of AI Engineer OS. Each phase must satisfy its verification gates before progressing to the next.

---

## Progress Overview

| Phase | Description | Scope Tier | Status | Completion Gate |
| :---: | :--- | :---: | :---: | :---: |
| **0** | **Planning, Architecture & Verification** | Foundations | **COMPLETE** :white_check_mark: | Approved |
| **1** | **Frontend Foundation & Design System** | MVP Tier | **COMPLETE** :white_check_mark: | Gate 1 Passed |
| **2** | **Curriculum Importer & Lesson Workspace** | MVP Tier | **COMPLETE** :white_check_mark: | Gate 2 Passed |
| **3** | **Learning Resources & Discovery Registry** | MVP Tier | **COMPLETE** :white_check_mark: | Gate 3 Passed |
| **4** | **Progress Tracking, Guest Mode & Auth** | MVP Tier | **COMPLETE** :white_check_mark: | Gate 4 Passed |
| **5** | **Personalized Learning Roadmap Engine** | Enhanced Tier | **COMPLETE** :white_check_mark: | Gate 5 Passed |
| **6** | **Project Studio & Interactive Assessments**| Enhanced Tier | Planned :heavy_minus_sign: | Gate 6 |
| **7** | **Learning Analytics & Shareable Portfolio**| Enhanced Tier | Planned :heavy_minus_sign: | Gate 7 |
| **8** | **Open-Source Collaboration & MCP Adapter** | Ecosystem Tier | Planned :heavy_minus_sign: | Gate 8 |
| **9** | **Production Hardening & Verification** | Hardening Tier | Planned :heavy_minus_sign: | Gate 9 |

---

## Detailed Phase Breakdown

### [x] Phase 0 — Planning, Architecture & Verification (COMPLETE)
- [x] Ingest and audit upstream curriculum repository ([`rohitg00/ai-engineering-from-scratch`](https://github.com/rohitg00/ai-engineering-from-scratch)).
- [x] Verified 20 phases and directory structure across all 500+ lesson directories.
- [x] Authored comprehensive [Product Requirements Document (`docs/PRD.md`)](docs/PRD.md).
- [x] Authored [System Architecture Blueprint (`docs/ARCHITECTURE.md`)](docs/ARCHITECTURE.md).
- [x] Authored [Relational Database Specification (`docs/DATABASE_DESIGN.md`)](docs/DATABASE_DESIGN.md).
- [x] Authored [Curriculum Ingestion Specification (`docs/CURRICULUM_SPECIFICATION.md`)](docs/CURRICULUM_SPECIFICATION.md).
- [x] Authored [Resource Discovery & Curation Registry (`docs/RESOURCE_CURATION.md`)](docs/RESOURCE_CURATION.md).
- [x] Authored [UI Sitemap & Accessibility Standards (`docs/UI_SITEMAP.md`)](docs/UI_SITEMAP.md).
- [x] Authored [Risks, Assumptions & Mitigations (`docs/RISKS_AND_ASSUMPTIONS.md`)](docs/RISKS_AND_ASSUMPTIONS.md).
- [x] Authored [Phased Development Checklist (`docs/DEVELOPMENT_CHECKLIST.md`)](docs/DEVELOPMENT_CHECKLIST.md).
- [x] Established open-source governance: `README.md`, `LICENSE`, `THIRD_PARTY_NOTICES.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, `.env.example`.
- [x] Phase 0 Architectural Corrections Completed:
  - [x] Decoupled `canonical_lessons` from version-specific `lesson_revisions`.
  - [x] Redesigned offline sync (discrete `study_sessions`, revision-aware note merges, monotonic status state machine, idempotent batch IDs).
  - [x] Added standard Auth.js adapter tables (`users`, `accounts`, `sessions`, `verification_tokens`).
  - [x] Established 3-tier resource verification with mandatory editorial review.
  - [x] Audited metadata, security policy, and README claims.
  - [x] Defined upstream Live API and MCP server integration strategy.
  - [x] Established focused MVP scope (Phases 1–4) vs Post-MVP tiers.
- [x] User review and formal gate sign-off. (Phase 1 approved).

### [x] Phase 1 — Frontend Foundation & Design System (COMPLETE)
- [x] Initialize Next.js 15 project with TypeScript, Tailwind CSS, Lucide icons, and shadcn/ui components.
- [x] Configure Tailwind theme tokens (slate canvas, card surfaces, cyan/violet accents, dark/light mode CSS variables).
- [x] Implement responsive Global Navigation Shell:
  - [x] Collapsible left sidebar for desktop.
  - [x] Bottom navigation bar and slide-out drawer for mobile/tablet.
  - [x] Top action bar with breadcrumbs, theme toggle, search trigger, and learner status.
- [x] Create core accessible UI primitives (Cards, Badges, Buttons).
- [x] Build empty states for all page shells (Landing, Dashboard, Curriculum, Resources, Projects, Roadmap, Settings).
- [x] Setup Vitest and React Testing Library configuration for component testing.
- [x] **Verification Gate 1**:
  - [x] `npm run lint` passes with 0 errors.
  - [x] `npm run typecheck` (`tsc --noEmit`) passes with 0 errors.
  - [x] Screen reader & contrast audit configured (WCAG 2.2 AA target compliance).
  - [x] Responsive test across 320px, 768px, 1024px, and 1440px viewports without horizontal scroll.
  - [x] Unit tests pass (2/2 tests passing).
  - [x] E2E Playwright tests pass (7/7 tests passing).
  - [x] Production build succeeds with zero errors.

### [x] Phase 2 — Curriculum Importer & Lesson Workspace (COMPLETE)
- [x] Built repeatable Git importer pinned to upstream commit SHA `c81651a83aff5f7bf307ffe4392f0d97f3b27ad6`.
- [x] Populated PostgreSQL schema via Drizzle ORM (20 phases, 542 lessons, 2087 quizzes, 1392 code files).
- [x] Preserved canonical lesson UUIDs decoupled from mutable slugs or paths.
- [x] Implemented rich dynamic Curriculum Explorer (`/curriculum`) with phase grid, search, and tier filters.
- [x] Implemented interactive Phase Details page (`/curriculum/[phaseSlug]`) with lesson filtering and progress indicators.
- [x] Implemented 7-tab Lesson Workspace (`/curriculum/[phaseSlug]/[lessonSlug]`) with KaTeX math rendering, syntax-highlighted code viewer, quiz runner, interactive notes workspace, and upstream MIT attribution.
- [x] **Verification Gate 2**:
  - [x] `npm run lint` passes with 0 errors.
  - [x] `npm run typecheck` passes with 0 errors.
  - [x] `npx vitest run` passes (23/23 tests passing).
  - [x] Production build succeeds with zero errors.
  - [x] Importer runs idempotently with zero duplicate canonical lessons.

### [x] Phase 3 — Learning Resources & Discovery Registry (MVP Tier)
- [x] Implement structured resource registry schema (9 types) with editorial/verification status flags and canonical URL deduplication.
- [x] Built canonicalization, schema validation, deterministic ranking, and coverage analysis modules (`src/lib/resources/*`).
- [x] Populated verified seed catalog for all 20 phases (152 resources, 299 lesson mappings) with cross-phase reuse.
- [x] Generated and applied Drizzle migration (`0001_even_shriek.sql`) and imported catalog (`npm run resources:import`).
- [x] Implemented resource discovery UI at `/resources` with search, type/phase filters, and sort (recommended first).
- [x] Added Videos/GitHub/Resources tabs to lesson workspace (`/curriculum/[phaseSlug]/[lessonSlug]`) backed by DB.
- [x] Added unit tests (64 passing) for resources modules; added `e2e/resources.spec.ts`; fixed curriculum slug bug (`00-setup-and-tooling`).
- [x] Created `docs/RESOURCE_GUIDE.md` and updated scripts (`npm run resources:validate|audit|coverage|import`).

### [x] Phase 4 — Progress Tracking, Guest Mode & Authentication (COMPLETE)
- [x] Implemented Dexie.js/IndexedDB persistence (16 tables) with a repository layer and reusable React hooks.
- [x] Added first-class Guest Mode: lessons, resources, notes, bookmarks, quizzes, projects, study sessions, export/import and reload persistence without sign-in.
- [x] Configured Auth.js (NextAuth v5) with GitHub and Google OAuth; app and Guest Mode run unconfigured, with a clear dev-only configuration hint.
- [x] Built idempotent, versioned sync engine (`POST/GET /api/sync/v1`) with PostgreSQL hydration, `sync_batches` replay and timestamp cursors.
- [x] Implemented non-destructive conflict resolution: monotonic lesson/resource merges, immutable unions, note conflict preservation with learner UI, tombstones for deletions.
- [x] Added guest→account migration with cloud snapshot merge, queued uploads and a merge summary.
- [x] Replaced fake dashboard statistics with real derived stats (started/completed/mastered, resources, videos, quizzes, study time, streak, projects, review queue).
- [x] Added per-phase curriculum progress and lesson status filters (All, Not Started, In Progress, Completed, Mastered, Needs Review).
- [x] Rebuilt `/saved` with type filters, search, navigation and tombstoned removal.
- [x] Implemented versioned JSON export/import with Zod validation, pre-change backups and transactional apply.
- [x] **Verification Gate 4**: typecheck 0 errors; ESLint 0 errors; Vitest 139/139; Playwright 19 passed + 1 skipped (OAuth not configured); production build passing.

### [x] Phase 5 — Personalized Learning Roadmap Engine (Enhanced Tier) (COMPLETE)
- [x] 7-step onboarding flow at `/onboarding`: background, programming, math, AI/ML self-assessment, career track, schedule (hours/week, study days, start and target dates, buffer preference), existing experience with optional deterministic placement assessment.
- [x] Deterministic topological DAG scheduler producing week-by-week plans with lesson part-splitting; fixed weekly capacity, never silently overfilled.
- [x] Seven career tracks as configuration (`roadmaps/tracks/*.json`) with per-lesson importance (core/important/optional/skip) in `roadmaps/metadata/lesson-metadata.json`.
- [x] Occurrence vs canonical identity: both Vision-Transformer curriculum occurrences stay in the graph while sharing one canonical progress key.
- [x] Capacity analysis (comfortable / achievable / tight / unrealistic) with explicit options — never silent compression.
- [x] Buffer weeks (automatic monthly, manual), backlog for missed lessons ordered by prerequisite impact, reschedule dialog that rebuilds only work from today forward and keeps historical completion.
- [x] Explainability ("Why is this in my plan?"), `/roadmap` UI with current-week card, timeline, calendar/skills/curriculum tabs, and `/roadmap/paths` track comparison.
- [x] **Verification Gate 5**: typecheck 0 errors; ESLint 0 errors; Vitest 160/160; Playwright 24 passed + 1 skipped (OAuth not configured); `roadmap:validate` and `roadmap:coverage` clean; production build passing.
- See [`docs/ROADMAP_ENGINE.md`](docs/ROADMAP_ENGINE.md) for the engine reference.

### [x] Phase 6 — Project Studio & Interactive Assessments (Enhanced Tier) (COMPLETE)
- [x] 24 curated engineering projects covering all 20 curriculum phases (2 beginner, 11 intermediate, 6 advanced, 5 capstones) as Zod-validated JSON in `projects/catalog/`; contributors add projects with `npm run projects:validate`, coverage report via `npm run projects:coverage` (`reports/project-coverage.{json,md}`, 60 skills, 7 tracks covered).
- [x] Structured milestone model (objective, expected output, required evidence ids, effort, required flag) persisted through the Phase 4 `project_progress` store (IndexedDB + PostgreSQL).
- [x] Proof-of-work evidence system: 12 evidence kinds with https-only URL allowlisting (`http:` localhost only), GitHub submission validation (repo/PR/commit formats), soft-deletes with sync tombstones; evidence is always labelled self-reported — never externally verified.
- [x] Rubrics for every non-beginner project with weights totaling 100, clamped learner self-assessment per category, and explicit "Self-assessed" labelling — completion/mastery thresholds are project-defined.
- [x] Completion state machine `not_started → in_progress → submitted → completed → mastered` computed only from persisted milestones + evidence + self-assessment (opening a page is never enough); mastery additionally caps reflection evidence for advanced/capstone.
- [x] Assessment engine with 5 phase checkpoints (10 questions each; 40 across the catalog) supporting single choice, multiple choice, true/false, ordering, and self-checked short answers; immutable attempts; invalid shapes never crash and never pass.
- [x] Skill mastery model with documented capped formula (lessons 0.4 / assessments 0.4 / projects 0.2) and deterministic weak-skill detection (recent-average window + repeat-incorrect rules) feeding `/practice` review recommendations.
- [x] `/projects` catalog with level/phase/skill/track filters and `/practice` accessible checkpoint runner (keyboard support, live feedback, attempt history).
- [x] Sync + export/import extended for `project_evidence` and `project_self_assessment` entity types (protocol, server persistence, remote-change apply, merge keeps best category scores).
- [x] **Verification Gate 6**: TypeScript 0 errors; ESLint 0 errors; Vitest 283/283 (68 new); Playwright 30 passed + 1 skipped (OAuth not configured); `projects:validate`, `projects:coverage`, `assessments:validate`, `roadmap:validate` clean; production build passing.
- See [`docs/PROJECT_STUDIO.md`](docs/PROJECT_STUDIO.md) and [`docs/ASSESSMENT_ENGINE.md`](docs/ASSESSMENT_ENGINE.md).

### [ ] Phase 7 — Learning Analytics & Shareable Portfolio (Enhanced Tier)
- Real-time study analytics tracking genuine learner activity (no mock data).
- Spaced repetition review queue for topics needing refresher.
- Shareable public portfolio with privacy controls and verified achievements.

### [x] Phase 8 — Open-Source Collaboration & MCP Adapter (Ecosystem Tier)
- GitHub Actions for CI, schema validation, and broken link auditing.
- Community contribution workflows for adding resources with editorial approval gates.
- Implement local MCP server adapter (`src/mcp/`) exposing curriculum search and progress tools for AI coding agents.
- Contributor validation and deterministic pull-request CI are available through `npm run validate` and `.github/workflows/pull-request.yml`.

### [ ] Phase 9 — Production Hardening & Verification (Hardening Tier)
- Comprehensive Playwright end-to-end tests across full learner journeys.
- Docker multi-stage build and self-hosting documentation.
- Security hardening (CSP, SQL injection, sanitized markdown).

### [x] Phase 7 — Learning Analytics & Shareable Portfolio (Trust Tier)
- Analytics domain (`src/lib/analytics/`): overview, study time, streaks,
  curriculum (canonical vs occurrence counting), skills evidence + mastery
  bands, roadmap pace + projection, project analytics, assessment trends,
  weak-skill detection, prioritized review queue, achievements — all pure,
  deterministic functions deriving from stored records.
- `/analytics` page with period filters (7d/30d/90d/1y/all), accessible charts,
  review actions (mark reviewed / snooze), and honest empty states.
- Opt-in portfolio: `/settings/portfolio` publication controls, portfolio
  profiles table, slug validation + reserved names, public serializer with
  allow-list privacy gates and learner-submitted provenance, JSON export,
  and a required public-serializer security regression test.
