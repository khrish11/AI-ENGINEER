# Phased Development Checklist & Verification Gates
## AI Engineer OS — Engineering Execution Roadmap (Corrected)

---

### Phase Overview & Gates

| Phase | Title | Scope Tier | Primary Objective | Verification Gate |
| :---: | :--- | :---: | :--- | :--- |
| **Phase 0** | **Planning & Architecture** | Foundations | Specifications, schema, sitemap, repo analysis | All planning docs reviewed; architecture validated |
| **Phase 1** | **Frontend Foundation** | MVP Tier | Design system, responsive shell, accessible UI | Typecheck, responsive audits, WCAG 2.2 AA check |
| **Phase 2** | **Curriculum Importer** | MVP Tier | Canonical identities, Git ingestion, lesson views | Idempotency test, 100% phase parsing, stable keys |
| **Phase 3** | **Learning Resources** | MVP Tier | 3-tier validation, YouTube player, GitHub cards | oEmbed checks, zero broken links, editorial status |
| **Phase 4** | **Progress & Auth** | MVP Tier | Offline IndexedDB, Auth.js, idempotent sync | Offline-to-online sync test, deduplicated sessions |
| **Phase 5** | **Personalized Roadmap** | Enhanced Tier | Onboarding, topological scheduler, rescheduling | Deterministic DAG tests, schedule recalculation |
| **Phase 6** | **Projects & Assessments** | Enhanced Tier | Enhanced project studio with rubrics, quiz engine, submissions | Quiz scoring tests, submission validation tests |
| **Phase 7** | **Analytics & Portfolio** | Enhanced Tier | Real study metrics, mastery radar, public profile | Zero mock data audit, shareable portfolio tests |
| **Phase 8** | **Open-Source & MCP** | Ecosystem Tier | PR review workflows, CI actions, local MCP server | GitHub Actions passing, MCP tool test run |
| **Phase 9** | **Production Hardening** | Hardening Tier | Security audits, Docker build, perf optimization | Full E2E Playwright run, production Docker test |

---

### Phase 0: Planning & Technical Architecture (Current Phase — In Review)
- [x] Inspect upstream repository structure (`rohitg00/ai-engineering-from-scratch`).
- [x] Analyze license terms and attribution requirements (Upstream MIT License).
- [x] Author Product Requirements Document ([`docs/PRD.md`](file:///e:/AI%20ENGINEER/docs/PRD.md)).
- [x] Author Architecture Blueprint ([`docs/ARCHITECTURE.md`](file:///e:/AI%20ENGINEER/docs/ARCHITECTURE.md)).
- [x] Author Relational Database Design ([`docs/DATABASE_DESIGN.md`](file:///e:/AI%20ENGINEER/docs/DATABASE_DESIGN.md)).
- [x] Author Curriculum Ingestion Specification ([`docs/CURRICULUM_SPECIFICATION.md`](file:///e:/AI%20ENGINEER/docs/CURRICULUM_SPECIFICATION.md)).
- [x] Author Resource Curation & Validation Specification ([`docs/RESOURCE_CURATION.md`](file:///e:/AI%20ENGINEER/docs/RESOURCE_CURATION.md)).
- [x] Author UI Sitemap & Accessibility Standards ([`docs/UI_SITEMAP.md`](file:///e:/AI%20ENGINEER/docs/UI_SITEMAP.md)).
- [x] Author Risks, Assumptions & Mitigation Document ([`docs/RISKS_AND_ASSUMPTIONS.md`](file:///e:/AI%20ENGINEER/docs/RISKS_AND_ASSUMPTIONS.md)).
- [x] Setup baseline community files (`README.md`, `ROADMAP.md`, `LICENSE`, `THIRD_PARTY_NOTICES.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, `.env.example`).
- [x] Conduct Phase 0 review and architectural correction:
  - [x] Decouple canonical lesson identities from version revisions.
  - [x] Redesign offline sync (deduplicated study sessions, monotonic ranks, revision-aware notes, batch idempotency).
  - [x] Include standard Auth.js adapter tables (`users`, `accounts`, `sessions`, `verification_tokens`).
  - [x] Formulate 3-tier resource verification (schema, oEmbed/API network probe, editorial review).
  - [x] Audit metadata, security policy, and README claims.
  - [x] Define upstream live API and MCP strategy.
  - [x] Demarcate realistic MVP (Phases 1–4) vs Post-MVP.
- [ ] Maintainer / user review and formal gate approval of corrected Phase 0 artifacts before commencing Phase 1.

---

### Phase 1: Frontend Foundation & Design System (MVP Tier)
- [x] Initialize Next.js 15 project with TypeScript, Tailwind CSS, Lucide icons, and shadcn/ui components.
- [x] Configure Tailwind theme tokens (slate canvas, card surfaces, cyan/violet accents, dark/light mode CSS variables).
- [x] Implement responsive Global Navigation Shell:
  - [x] Collapsible left sidebar for desktop.
  - [x] Bottom navigation bar and slide-out drawer for mobile/tablet.
  - [x] Top action bar with breadcrumbs, theme toggle, search trigger, and learner status.
- [x] Create core accessible UI primitives (Cards, Badges, Tabs, Dialogs, Tooltips, Accordions, Buttons, Progress Bars, Skeleton, Input, Separator).
- [x] Build empty, loading (skeleton), and error states for all page shells.
- [x] Setup Vitest and React Testing Library configuration for component testing.
- [x] **Verification Gate 1**:
  - `npm run lint` passes with 0 errors.
  - `npm run typecheck` (`tsc --noEmit`) passes with 0 errors.
  - Screen reader & contrast audit (`axe-core`) confirms WCAG 2.2 AA target compliance.
  - Responsive test across 320px, 768px, 1024px, and 1440px viewports without horizontal scroll.

---

### Phase 2: Curriculum Importer & Lesson Workspace (MVP Tier)
- [x] Setup PostgreSQL database connection and Drizzle ORM models for `canonical_phases`, `canonical_lessons`, `curriculum_revisions`, `phase_revisions`, `lesson_revisions`, `lesson_aliases`, and `quizzes`.
- [x] Build automated curriculum parser CLI:
  - [x] Clones or reads pinned upstream commit `c81651a83aff5f7bf307ffe4392f0d97f3b27ad6`.
  - [x] Populates `canonical_lessons` and creates `lesson_revisions` snapshots.
  - [x] Ingests `quiz.json` questions into relational quiz records.
  - [x] Extracts and catalogs code examples across Python, TypeScript, Rust, and Julia.
- [x] Implement Curriculum Browser (`/curriculum`):
  - [x] Phase grid with badges, lesson counts, estimated duration, and completion progress.
  - [x] Full-text client search filter by phase, topic, and difficulty.
- [x] Implement Lesson Workspace (`/curriculum/[phaseSlug]/[lessonSlug]`):
  - [x] Sticky lesson navigation header with previous/next controls.
  - [x] Rich markdown reader with syntax highlighting and KaTeX math rendering.
  - [x] Prominent upstream MIT attribution banner with commit link.
  - [x] Code snippet viewer with language tabs and copy button.
- [x] **Verification Gate 2**:
  - [x] Importer runs idempotently (second run causes zero duplicate canonical lessons).
  - [x] All 20 phases and 542 lessons import with verified titles and content_hash signatures.
  - [x] Upstream commit SHA and import timestamp verified in `curriculum_revisions`.

---

### Phase 3: Learning Resources & Discovery Registry (MVP Tier)
- [ ] Setup Drizzle ORM models for `resources`, `lesson_resources`, and `resource_contributions`.
- [ ] Define Zod validation schemas for all 9 resource types with `editorial_review_status`.
- [ ] Create verified seed catalog (`resources/catalog/`) covering key foundational phases.
- [ ] Implement Resource Discovery Center (`/resources`):
  - [ ] Filterable registry by type (video, repo, paper, doc), difficulty, and topic.
  - [ ] Search bar with instant typeahead filter.
- [ ] Implement rich media components:
  - [ ] `YouTubePlayer` using privacy-enhanced embed, direct watch link, and chapter seeking.
  - [ ] `GitHubCard` displaying verified repository details, license, and stars.
  - [ ] `PaperCitationCard` with abstract snippet and arXiv link.
- [ ] Build Resource Audit Suite (`npm run resources:audit`):
  - [ ] Uses YouTube oEmbed and GitHub API probes.
  - [ ] Generates `RESOURCE_COVERAGE_REPORT.md`.
  - [ ] Validates 0 broken URLs or placeholder links.
- [ ] **Verification Gate 3**:
  - Resource audit script passes 100% with no 404s or invalid schemas.
  - Every lesson displays original upstream attribution even when supplementary resources are uncurated.

---

### Phase 4: Progress Tracking, Guest Mode & Authentication (MVP Tier) — COMPLETE
- [x] Implemented Dexie.js (IndexedDB) client persistence schema for offline guest learners (16 tables, schema v3, durable device UUID).
- [x] Created one database abstraction (`src/lib/progress/db.ts`), repositories per entity, and hooks consumed by pages (no Dexie access in components).
- [x] Setup Auth.js (NextAuth v5) supporting GitHub and Google OAuth with the PostgreSQL auth tables (`users`, `accounts`, `sessions`, `verification_tokens`); app runs in Guest Mode when unconfigured.
- [x] Built dual-layer state hooks (`useLessonProgress`, `useResourceProgress`, `useNotes`, `useBookmarks`, `useStudySession`, `useQuizAttempts`, `useProjectProgress`, `useSyncStatus`, `useOfflineStatus`) that read IndexedDB first and sync when authenticated.
- [x] Implemented reusable completion-rules engine that adapts to lessons without videos, quizzes, projects or resources; opening a lesson never completes it.
- [x] Implemented Differential Synchronization Engine (`/api/sync/v1`):
  - [x] Client pushes discrete `study_sessions` with unique client UUIDs (no duplicate accumulation).
  - [x] Monotonic status ranking: clients cannot regress completed/mastered status.
  - [x] Revision-aware note merging with preserved conflict backups and learner resolution UI.
  - [x] Client batch ID recording in `sync_batches` for idempotent retries and stored response replay.
  - [x] Tombstones for bookmark/note deletions; remote change pull with timestamp cursors.
- [x] Added guest→account migration: cloud snapshot fetch, deterministic merge, queued uploads, merge summary.
- [x] Built Progress Export / Import in Settings:
  - [x] Exports versioned JSON backup with sensitive field stripping.
  - [x] Imports with Zod validation, preview, merge/replace choice, pre-change backup and transactional apply.
- [x] Replaced placeholder dashboard metrics with stats derived from persisted activity; added per-phase progress and lesson status filters.
- [x] **Verification Gate 4** (verified 2026-10-17):
  - [x] `npm run typecheck` — 0 errors.
  - [x] `npm run lint` — 0 errors.
  - [x] `npm run test -- --run` — 139/139 passing (Phase 2/3 suites still green; 4 PostgreSQL-backed sync-API tests skip without a database).
  - [x] `npm run build` — production build passing.
  - [x] `npx playwright test` — 19 passed, 1 skipped (OAuth credentials absent).
  - [x] Guest learner can complete lessons, record study time, save notes and reload without data loss.
  - [x] Logging in performs a non-destructive account merge (cloud snapshot + summary) without losing guest progress.
  - [x] Progress export/import round-trip preserves lessons, notes and bookmarks.

---

### Phase 5: Personalized Learning Roadmap Engine (Enhanced Tier)
- [x] Build Onboarding Flow (`/onboarding`):
  - [x] Programming skill level, math background, career specialization selection.
  - [x] Weekly study time picker (1 to 40 hours) and target deadline picker.
- [x] Implement Deterministic DAG Scheduler:
  - [x] Topological sort of lesson dependency graph with cycle detection (validation fails named-node cycles; invalid graphs are never scheduled).
  - [x] Lesson classification: `Core` (must-learn), `Important` (role-specific), `Optional`, `Skip` — per career track from JSON configuration, never React code.
  - [x] Generates week-by-week study plan with buffer weeks and lesson part-splitting under fixed weekly capacity.
- [x] Implement Roadmap View (`/roadmap`):
  - [x] Weekly timeline view with estimated hours per task (~precision only).
  - [x] Reschedule modal with impact preview; forward-shift calculation that never rebuilds finished weeks or un-completes history; missed lessons collect in a prerequisite-ordered backlog.
  - [x] Explainability dialog: "Why this lesson is in your plan".
- [x] **Verification Gate 5**:
  - Unit tests verify topological dependency ordering (16 roadmap unit suites, 160/160 passing incl. twin Vision-Transformer occurrence identity).
  - Rescheduling recalculates remaining timeline without marking past lessons incomplete (unit + Playwright covered).

---

### Phase 6: Project Studio & Assessments (Enhanced Tier)— COMPLETE
- [x] Declarative project catalog (`projects/catalog/<phase>/*.json`, Zod schema) with cross-reference validation; upstream/platform/community sources carry attribution.
- [x] 24 projects covering all 20 phases (2 beginner / 11 intermediate / 6 advanced / 5 capstones); `npm run projects:validate` and `npm run projects:coverage` (writes `reports/project-coverage.{json,md}`).
- [x] Project Studio (`/projects`): level/phase/skill/track filters + search; workspace (`/projects/[projectSlug]`) with milestones, deliverables, build guide, suggested stack.
- [x] Proof-of-work evidence: 12 kinds, https allowlist + GitHub field validation, soft delete with sync; always labelled self-reported, never externally verified.
- [x] Rubrics (weights = 100) with per-category self-assessment, clamped persistence, "Self-assessed" labelling; per-project completion/mastery thresholds.
- [x] Interactive assessment engine (`assessments/catalog/*.json`; 5 checkpoints × 10 questions, 40 questions): single/multiple choice, true/false, ordering, self-checked short answer; immediate feedback; immutable attempts in `quiz_attempts`.
- [x] Skill mastery model (documented 0.4/0.4/0.2 caps) and deterministic weak-skill/review recommendations; accessible `/practice` runner.
- [x] Sync + export/import extended for `project_evidence` and `project_self_assessment` entity types end-to-end.
- [x] **Verification Gate 6**: typecheck 0 errors; ESLint 0 errors; Vitest 283/283; Playwright 30 passed / 1 skipped; validators clean; production build passing.
- Docs: [`docs/PROJECT_STUDIO.md`](PROJECT_STUDIO.md), [`docs/ASSESSMENT_ENGINE.md`](ASSESSMENT_ENGINE.md).

---

### Phase 7: Learning Analytics & Shareable Portfolio (Enhanced Tier)
- [ ] Implement Learning Analytics Dashboard (`/analytics`):
  - [ ] Cumulative study hours based on actual active time logs.
  - [ ] Skills mastery radar chart across 20 domains.
  - [ ] Spaced repetition review queue showing topics requiring refresher.
- [ ] Implement Public Shareable Portfolio (`/portfolio/[username]`):
  - [ ] Learner profile, specialization track, and completion certificate summary.
  - [ ] Verified project gallery with clickable GitHub links and milestones.
  - [ ] Privacy toggle: Public or Private portfolio.
- [ ] **Verification Gate 7**:
  - Analytics audit confirms 0 mock metrics; all figures match database records.
  - Public portfolio accessible without authentication when enabled by learner.

---

### Phase 8: Open-Source Collaboration & MCP Adapter (Ecosystem Tier)
- [ ] Setup GitHub Actions Workflows:
  - [ ] `ci.yml`: Typecheck, lint, unit tests, integration tests.
  - [ ] `resource-audit.yml`: Weekly link health checks on curated resources.
  - [ ] `pr-validation.yml`: Validates schema of community-submitted resource files.
- [ ] Configure Issue Templates (Bug Report, Resource Suggestion, Project Addition) and Pull Request Template.
- [ ] Implement local MCP server adapter (`src/mcp/`) exposing curriculum search and learner progress tools for AI coding agents.
- [ ] **Verification Gate 8**:
  - Simulated contributor PR passes schema validation workflow.
  - MCP tools return valid responses when queried by an AI client.

---

### Phase 9: Production Hardening, Security & Deployment (Hardening Tier)
- [ ] Conduct security audit:
  - [ ] Content Security Policy (CSP) headers configured for YouTube and KaTeX.
  - [ ] SQL injection, XSS, and CSRF tests.
- [ ] Docker configuration:
  - [ ] Multi-stage production `Dockerfile` (optimized standalone Next.js output).
  - [ ] `docker-compose.yml` orchestrating web app, PostgreSQL, and reverse proxy.
  - [ ] Documented local self-hosting instructions in `README.md`.
- [ ] Run full Playwright End-to-End Test Suite covering full learner journey.
- [ ] Production build verification (`npm run build`).
- [ ] **Verification Gate 9**:
  - Clean production build with zero warnings or errors.
  - All E2E Playwright tests pass in Docker container environment.

## Phase 7 — Learning Analytics & Shareable Portfolio

- [x] Analytics modules: overview, study-time, streaks, curriculum canonical
  dedupe, skills evidence + documented mastery weights (0.4/0.4/0.2) with
  evidence coverage, project analytics, assessment trends, weak-skill
  detection, deterministic review queue + spaced schedule (3/7/21/45),
  achievements from source records, roadmap pace + projection, validation for
  impossible metrics.
- [x] `/analytics` page: eight sections, period filters, accessible charts with
  text alternatives, review actions, no fake data in empty states.
- [x] Portfolio: settings page + APIs (settings/slug/export/public), database
  migration 0006 (review_history, portfolio_profiles), guest local drafts,
  public route 404 semantics, SEO-safe metadata.
- [x] Privacy + security: allow-list public serializer; §48 regression test
  proving no email/provider-id/notes/quiz-answers/device-id/conflict leakage
  and no unpublished/deleted evidence exposure.
- [x] Tests: analytics core (26), analytics skills (9), portfolio privacy (11),
  integration (8), plus existing Phase 0–6 suites.
- [x] Playwright: analytics journey, review journey, portfolio journey (auth
  environment skipped cleanly).
- [x] Performance benchmark script reporting measured aggregation times.

## Phase 8 — Open-Source Collaboration & MCP Adapter

- [x] Contributor guide, maintainer guide, issue/PR templates, CODEOWNERS,
  attribution guidance, and release checklist.
- [x] `npm run validate`, `npm run validate:full`, and `npm run mcp:validate`.
- [x] Deterministic pull-request and dependency-security workflows.
- [x] Read-only local stdio MCP adapter with strict Zod input validation,
  explicit policies, compact serializers, public resources, and privacy tests.
