# AI Engineer OS

> **The Open-Source Developer Operating System & Learning Platform for AI Engineering**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Phases: 20](https://img.shields.io/badge/Curriculum%20Phases-20-cyan.svg)](docs/CURRICULUM_SPECIFICATION.md)
[![Upstream Commit](https://img.shields.io/badge/Upstream%20SHA-c81651a-purple.svg)](https://github.com/rohitg00/ai-engineering-from-scratch/commit/c81651a83aff5f7bf307ffe4392f0d97f3b27ad6)
[![Status: Phase 8 MCP Adapter](https://img.shields.io/badge/Status-Phase%208%20MCP%20Adapter-blueviolet.svg)](ROADMAP.md)

**AI Engineer OS** is a production-quality, open-source learning platform and interactive developer workspace designed to take software engineers and technical practitioners from fundamental mathematics and classical machine learning through deep learning, transformers, LLMs, RAG, tool-using agents, multimodal systems, and production infrastructure.

Powered by the canonical, MIT-licensed curriculum from [`rohitg00/ai-engineering-from-scratch`](https://github.com/rohitg00/ai-engineering-from-scratch), AI Engineer OS **will provide** a full-featured application with real data persistence, verified educational resources, interactive assessments, hands-on project milestones, and shareable developer portfolios upon completion of all 9 development phases.

---

## Current Project Status: Phase 8 Complete (Open-Source Collaboration & MCP Adapter)

This project executes in strict, verifiable engineering phases. Phases 0–8 are complete:

- **Curriculum:** 20 phases, 542 canonical lessons (542 curriculum occurrences), 2,087 quiz questions, 1,364 code files.
- **Resources:** 152 curated resources, 299 lesson mappings, 180/541 lessons covered.
- **Learner data:** offline-first IndexedDB (Dexie.js), optional PostgreSQL sync via Auth.js accounts.
- **Roadmap (Phase 5):** deterministic prerequisite-aware scheduler with 7 career tracks, onboarding with placement assessment, week-by-week plans with buffer weeks, backlog + reschedule, and capacity analysis — no LLM involved. See [`docs/ROADMAP_ENGINE.md`](docs/ROADMAP_ENGINE.md).
- **Verification Gate 6:** TypeScript 0 errors, ESLint 0 errors, Vitest 283/283, Playwright 30 passing (1 skipped without OAuth credentials), all data validators clean, production build passing.

See [`docs/PROGRESS_SYNC.md`](docs/PROGRESS_SYNC.md) for the local-first progress architecture.

---

## Realistic Phased Scope: MVP vs. Platform Roadmap

To guarantee high engineering quality and avoid over-engineering, features are structured into clear tiers:

### Core MVP (Phases 1–4)
- **20-Phase Curriculum Navigation**: Full phase and lesson browser with search, topic filtering, and difficulty indicators.
- **Lesson Workspace**: Markdown reader with KaTeX math rendering, syntax-highlighted code, Mermaid diagrams, and prominent upstream MIT attribution.
- **Curated Resource Drawer**: Verified YouTube embeds with chapter seek, GitHub repository cards, and official doc citations.
- **Project Studio**: filters (level/phase/skill/track), workspace with milestone completion gated on attached evidence,
  GitHub submissions, and rubric self-assessment driving completion (`completed`/`mastered`). Fair-use catalog of 24
  hand-curated projects covering all 20 phases; see [`docs/PROJECT_STUDIO.md`](docs/PROJECT_STUDIO.md).
- **Offline Guest Mode & Progress Tracking**: Zero-login persistence via IndexedDB (Dexie.js), discrete study session tracking, and versioned JSON backup/restore.
- **Authentication**: Auth.js with GitHub and Google OAuth, plus idempotent sync engine.

### Enhanced Platform (Phases 5–7)
- **Personalized Roadmap Engine**: Deterministic prerequisite-aware topological scheduler generating week-by-week study plans.
- **Interactive Quiz Engine**: integrated lesson quizzes plus 5 platform phase checkpoints on `/practice` (single/multiple
  choice, true/false, ordering, self-checked short answers) with immediate feedback, immutable attempts, and skill
  mastery evidence; see [`docs/ASSESSMENT_ENGINE.md`](docs/ASSESSMENT_ENGINE.md).
- **Learning Analytics & Public Portfolio**: Verified study time logging, skill mastery radars, and shareable public profile URLs.

### Ecosystem & Hardening (Phases 8–9)
- **Community Resource Review Workflow**: Automated GitHub Actions validating PRs, and maintainer review dashboard.
- **Local Model Context Protocol (MCP) Server**: Exposing curriculum search and learner progress tools for AI coding agents.
- **Production Hardening**: Full Playwright E2E suite, Docker Compose self-hosting, and security audits.
- **Open-source collaboration**: Contributor validation, issue/PR templates, deterministic CI, attribution guidance, and a read-only local MCP adapter.

---

## Technical Stack

- **Frontend & App Framework**: Next.js 15 (App Router), React 19, TypeScript
- **Styling & Components**: Tailwind CSS, Radix UI, shadcn/ui, Lucide Icons
- **Database & Query Layer**: PostgreSQL 17, Drizzle ORM, postgres-js
- **Authentication**: Auth.js (NextAuth v5) supporting GitHub, Google, and Guest sessions
- **Client Offline Storage**: Dexie.js (IndexedDB)
- **Testing & Verification**: Vitest, React Testing Library, Playwright
- **Deployment**: Docker, Docker Compose, Caddy / Reverse Proxy

---

## Architecture & Documentation Index

Comprehensive design and specification documents are located in [`docs/`](docs/):

- [`docs/PRD.md`](docs/PRD.md): Product Requirements, user personas, and core functional specifications.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md): System architecture, decoupled identities, sync protocol, and tech stack rationales.
- [`docs/DATABASE_DESIGN.md`](docs/DATABASE_DESIGN.md): PostgreSQL schemas, Drizzle ORM models, relations, and indexes.
- [`docs/CURRICULUM_SPECIFICATION.md`](docs/CURRICULUM_SPECIFICATION.md): Upstream Git ingestion rules, AST parsing, and idempotency guarantees.
- [`docs/RESOURCE_CURATION.md`](docs/RESOURCE_CURATION.md): Resource registry schemas, YouTube player specs, and link verification.
- [`docs/PROGRESS_SYNC.md`](docs/PROGRESS_SYNC.md): IndexedDB schema, sync protocol, idempotency, conflicts, tombstones, guest→account migration, backup format, and privacy model.
- [`docs/ROADMAP_ENGINE.md`](docs/ROADMAP_ENGINE.md): Roadmap engine reference — career tracks, occurrence vs. canonical identity, prerequisite graph, scheduling, capacity, buffers, rescheduling, and placement.
- [`docs/UI_SITEMAP.md`](docs/UI_SITEMAP.md): Complete route map, wireframe layouts, and WCAG 2.2 AA accessibility standards.
- [`docs/DEVELOPMENT_CHECKLIST.md`](docs/DEVELOPMENT_CHECKLIST.md): Phase-by-phase engineering checklist with verification gates.
- [`docs/RISKS_AND_ASSUMPTIONS.md`](docs/RISKS_AND_ASSUMPTIONS.md): Risk matrix, mitigation strategies, and system dependencies.
- [`docs/CONTRIBUTOR_GUIDE.md`](docs/CONTRIBUTOR_GUIDE.md): Contribution boundaries and validation workflow.
- [`docs/MCP_ADAPTER.md`](docs/MCP_ADAPTER.md): Local MCP tools, policies, and privacy boundaries.

---

## Upstream Curriculum Attribution

The curriculum content in this project is imported from [AI Engineering from Scratch](https://github.com/rohitg00/ai-engineering-from-scratch) by Rohit Ghumare, licensed under the [MIT License](THIRD_PARTY_NOTICES.md).

AI Engineer OS maintains strict separation between upstream original curriculum content and platform application code, ensuring full attribution and compliance with open-source licensing requirements.

---

## Development Setup

### Prerequisites
- Node.js `20.x` or `24.x` (verified with `v24.19.0`)
- `pnpm` (v10.x) or `npm` (v11.x)
- Docker & Docker Compose (optional, for local PostgreSQL)

### Setup Steps
```bash
# 1. Clone the repository
git clone <repository-url>
cd ai-engineer-os

# 2. Configure environment variables
cp .env.example .env.local

# 3. Start the development server
npm install
npm run dev
```

---

## License

AI Engineer OS application code is released under the [MIT License](LICENSE).
Curriculum content attribution is detailed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

### Phase 7 — Learning Analytics & Shareable Portfolio

- `/analytics` derives every metric from stored records (canonical curriculum
  identities, study sessions, assessment attempts, project evidence) — never
  from estimates or placeholders.
- Deterministic review queue with spaced schedule, explanations, and snooze.
- Opt-in public portfolio at `/portfolio/[username]` with per-section visibility
  controls; everything is private by default. See
  [docs/ANALYTICS.md](docs/ANALYTICS.md) and
  [docs/PORTFOLIO_PRIVACY.md](docs/PORTFOLIO_PRIVACY.md).
- Analytics scale benchmark: `npx tsx src/scripts/benchmark-analytics.ts`.
