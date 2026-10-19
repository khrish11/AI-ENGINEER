# Product Requirements Document (PRD)
## AI Engineer OS — An Open-Source AI Engineering Learning Platform (Corrected)

---

### 1. Executive Summary

**AI Engineer OS** is a production-grade, open-source educational platform and developer operating system designed to guide software engineers, data scientists, and technical practitioners from fundamental programming and mathematics to advanced AI engineering. 

The platform ingests the canonical, MIT-licensed open-source curriculum from [`rohitg00/ai-engineering-from-scratch`](https://github.com/rohitg00/ai-engineering-from-scratch) (500+ lessons across 20 phases), pairing each lesson with verified multimedia resources, executable coding labs, deterministic quizzes, comprehensive milestone projects, and a cryptographically verifiable proof-of-work portfolio.

---

### 2. Vision & Core Principles

1. **Production-Grade Reality, No Mock Data**: Every metric, roadmap timeline, quiz score, and project status reflects real, persisted learner action.
2. **Decoupled Canonical Identities**: Canonical lessons maintain permanent IDs independent of transient Git commit snapshots. Upstream curriculum updates never orphan or break user progress.
3. **Dual Persistence Paradigm**: Learner progress is immediately active and persistent in **Guest Mode** (via IndexedDB) without requiring an account. Authenticated accounts (GitHub and Google OAuth via Auth.js) provide encrypted multi-device synchronization with conflict-safe merge semantics.
4. **Prerequisite-Aware Intelligence**: Career roadmaps and week-by-week learning schedules are calculated using deterministic topological graph algorithms that respect prerequisites, study availability, and specialization goals.
5. **Verified Resource Integrity**: Curated videos, repositories, and documentation are strictly verified against schemas and network probes. Mandatory editorial approval ensures no broken or low-quality resources reach learners.
6. **Open-Source Maintainability**: Built with a modular architecture (Next.js, TypeScript, Tailwind CSS, PostgreSQL, Drizzle ORM) allowing community contributors to curate resources, submit lesson updates, and enhance project rubrics through reviewable pull requests.

---

### 3. Phased Product Scope: MVP vs. Post-MVP

To guarantee high engineering quality and avoid over-engineering before core learner value is established, the product scope is explicitly phased:

#### Phase 1–4: Core Learner MVP
- **Curriculum Navigation**: Browse all 20 phases and 500+ lessons with topic and difficulty filters.
- **Lesson Workspace**: Markdown reader with KaTeX math rendering, syntax highlighting, Mermaid diagrams, and prominent upstream MIT attribution.
- **Resource Drawer**: Verified YouTube video player (with chapter seek), GitHub repository cards, and official doc citations.
- **Project Catalog**: Basic directory of Beginner, Intermediate, and Advanced projects with milestone checklists and GitHub submission links (read-only reference).
- **Guest Mode & Progress Tracking**: Local persistence via IndexedDB (Dexie.js), lesson status tracking, and versioned JSON progress export/import.
- **Authentication**: Auth.js with GitHub/Google OAuth and account linking.

#### Phase 5–7: Enhanced Platform
- **Personalized Roadmap Engine**: Deterministic topological scheduler generating week-by-week plans with buffer weeks and rescheduling.
- **Interactive Quiz Engine**: Pre/post knowledge assessments extracted from upstream `quiz.json` with immediate feedback and 80% passing gates.
- **Project Studio (Enhanced)**: Complete project workspace with detailed rubrics, self-evaluation forms, proof-of-work submission (repo URL, demo URL, documentation), and milestone validation tracking.
- **Study Analytics & Public Portfolio**: Verified study time logging, skill mastery radars, and shareable public profile URLs.

#### Phase 8–9: Ecosystem & Hardening
- **Community Resource Review Workflow**: Automated GitHub Actions validating PRs, and maintainer review dashboard.
- **Local Model Context Protocol (MCP) Server**: Exposing curriculum search and learner progress tools for AI coding agents.
- **Production Hardening**: Full Playwright E2E suite, Docker Compose self-hosting, and security audits.

---

### 4. Specializations & Career Paths

The platform supports 7 specialized career tracks with deterministic prerequisite routing:

1. **General AI Engineer**: Full-spectrum foundation covering ML fundamentals, deep learning, LLMs, RAG, tool calling, and production deployment.
2. **LLM Application Engineer**: Focus on prompt engineering, structured outputs, embeddings, context management, semantic caching, and guardrails.
3. **RAG Engineer**: Deep dive into chunking strategies, vector databases, hybrid search, rerankers, semantic routing, and retrieval evaluation (Ragas).
4. **Agent Engineer**: Tool use, MCP (Model Context Protocol), planning loops, reflection, human-in-the-loop gates, and autonomous multi-agent coordination.
5. **ML Engineer**: Mathematical foundations, classical algorithms, neural architectures, training loops, optimization, and backpropagation from scratch.
6. **MLOps / AI Infrastructure Engineer**: GPU orchestration, model quantization, vLLM/Triton serving, tracing/observability, latency optimization, and CI/CD pipelines.
7. **Research-Focused AI Engineer**: Attention mechanisms, tokenizer internals, multi-token prediction, differential attention, and reproducing foundational papers.

---

### 5. Functional Requirements

#### 5.1 Curriculum Ingestion & Synchronization
- **FR-CUR-01**: Ingest all 20 curriculum phases (from Phase 00 "Setup & Tooling" to Phase 19 "Capstone Projects").
- **FR-CUR-02**: Pin to upstream Git revision (`c81651a83aff5f7bf307ffe4392f0d97f3b27ad6`), storing commit SHA and import timestamp.
- **FR-CUR-03**: Preserve phase names, lesson names, directory slugs, and markdown content verbatim under upstream MIT license attribution.
- **FR-CUR-04**: Maintain genuinely immutable UUIDs in `canonical_lessons.id` independent of upstream paths, titles, or ordering. Use `content_hash` (SHA-256) for stable identity mapping and maintain `lesson_aliases` for moved or renamed lessons. Handle splits, merges, and removals with manual review flags for ambiguous mapping.
- **FR-CUR-05**: Support automated, idempotent curriculum re-imports that create new `lesson_revisions` without modifying or corrupting existing `user_lesson_progress` records.

#### 5.2 Lesson Workspace & Learning Experience
- **FR-LSN-01**: Dedicated lesson page with title, difficulty badge, estimated reading time, prerequisites, and learning objectives.
- **FR-LSN-02**: Rich markdown rendering with syntax-highlighted code blocks, copy-to-clipboard, and interactive Mermaid diagrams.
- **FR-LSN-03**: Curated resource drawer featuring embedded YouTube players (with chapter jump links), GitHub repository cards, and official doc citations.
- **FR-LSN-04**: Interactive pre- and post-assessments imported from lesson `quiz.json` with immediate explanation feedback.
- **FR-LSN-05**: Interactive coding exercise prompts and links to reference implementations in Python, TypeScript, Rust, and Julia.
- **FR-LSN-06**: Integrated note-taking pad and bookmarking toggle with revision tracking.

#### 5.3 Resource Discovery & Verification Registry
- **FR-RES-01**: Catalog 9 resource types: YouTube Video, YouTube Playlist, GitHub Repository, Official Documentation, Written Tutorial, Research Paper, Dataset, Interactive Exercise, and Project Starter.
- **FR-RES-02**: Enforce strict 3-tier validation (schema check, oEmbed/API network probe, and human maintainer editorial review).
- **FR-RES-03**: Ban fabricated links, placeholder videos, or synthetic URLs.
- **FR-RES-04**: Provide an automated Link Integrity and Coverage Auditor (`npm run resources:audit`) that outputs health metrics.

#### 5.4 Personalized Learning Roadmap Engine
- **FR-RDM-01**: 5-step onboarding flow collecting: programming background, mathematics familiarity, target specialization, study hours/week, and target completion timeline.
- **FR-RDM-02**: Deterministic topological scheduler that assigns lessons as `Core`, `Important`, or `Optional`.
- **FR-RDM-03**: Generate week-by-week study calendar accounting for buffer weeks and learner-specified holidays.
- **FR-RDM-04**: Dynamic schedule recalculation that shifts uncompleted tasks forward without resetting completed work.
- **FR-RDM-05**: Explainability badges detailing why a lesson was included, prioritized, or deferred.

#### 5.5 Progress Tracking & Dual Persistence
- **FR-PRG-01**: Monotonic lesson lifecycle states: `Not Started` (0) -> `In Progress` (1) -> `Completed` (2) -> `Mastered` (3), with independent `needs_review` flag.
- **FR-PRG-02**: Independent tracking of reading completion, video watch completion, quiz passing (>=80%), exercise verification, and project submission.
- **FR-PRG-03**: Discrete `study_sessions` with client-generated UUIDs to prevent duplicate study time accumulation during offline retries.
- **FR-PRG-04**: Guest Mode persistence using IndexedDB (Dexie.js), requiring zero login to begin learning.
- **FR-PRG-05**: Two-way synchronization engine merging local IndexedDB state with PostgreSQL upon authentication, using idempotent batch IDs and non-destructive note merge.
- **FR-PRG-06**: Versioned JSON data export and import conforming to schema version 1.0.

#### 5.6 Project Catalog & Studio
- **FR-PRJ-01 (MVP)**: Basic project catalog organized into Beginner, Intermediate, and Advanced tiers covering all 20 phases with milestone checklists and GitHub submission links (read-only reference).
- **FR-PRJ-02 (Phase 6)**: Enhanced Project Studio with step-by-step milestone tracking, detailed deliverable rubrics, and self-evaluation checklists.
- **FR-PRJ-03 (Phase 6)**: Proof-of-work submission form capturing repository URL, live deployment URL, test logs, and architecture reflections.
- **FR-PRJ-04 (Phase 7)**: Shareable public portfolio showcasing completed projects, mastered skill badges, verified assessment scores, and study time logs.

---

### 6. Non-Functional Requirements

- **NFR-PERF-01 (Performance)**: First Contentful Paint (FCP) < 1.2s; Time to Interactive (TTI) < 2.0s on standard 4G networks. Fast full-text curriculum search in < 50ms.
- **NFR-A11Y-01 (Accessibility Target)**: Design and build toward full conformance with WCAG 2.2 Level AA, including contrast ratios (>= 4.5:1), keyboard navigation focus rings, ARIA landmarks, and screen-reader compatibility.
- **NFR-SEC-01 (Security)**: OAuth 2.0 / PKCE authentication via Auth.js, CSRF tokens, strict Content Security Policy (allowing YouTube embeds), SQL injection protection via parameterized ORM queries, and user data isolation. No arbitrary user code execution on server.
- **NFR-REL-01 (Reliability)**: Zero data loss during offline usage, idempotent API endpoints, and automatic schema migrations.
- **NFR-I18N-01 (Extensibility)**: Localization-ready data models supporting multilingual curriculum translations present in upstream repository (30+ locales).
