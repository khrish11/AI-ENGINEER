# AI Engineer OS

> **The Open-Source Developer Operating System & Learning Platform for AI Engineering**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Phases: 20](https://img.shields.io/badge/Curriculum%20Phases-20-cyan.svg)](docs/CURRICULUM_SPECIFICATION.md)
[![Upstream Commit](https://img.shields.io/badge/Upstream%20SHA-c81651a-purple.svg)](https://github.com/rohitg00/ai-engineering-from-scratch/commit/c81651a83aff5f7bf307ffe4392f0d97f3b27ad6)
[![Deployed: Vercel](https://img.shields.io/badge/Deployed-Vercel-black.svg)](https://ai-engineer-os-inky.vercel.app)
[![Status: v0.1.0](https://img.shields.io/badge/Status-v0.1.0-success.svg)](https://ai-engineer-os-inky.vercel.app)

**AI Engineer OS** is a production-quality, open-source learning platform and interactive developer workspace powered by the canonical curriculum from [AI Engineering from Scratch](https://github.com/rohitg00/ai-engineering-from-scratch) by Rohit Ghumare.

It provides a full-featured application with real data persistence, verified educational resources, interactive assessments, hands-on project milestones, and shareable developer portfolios.

[🚀 Start Learning](https://ai-engineer-os-inky.vercel.app/curriculum)
[📖 Upstream Curriculum](https://github.com/rohitg00/ai-engineering-from-scratch)
[⭐ Star on GitHub](https://github.com/khrish11/AI-ENGINEER)

---

## Features

- **20-Phase Curriculum Navigation**: Full phase and lesson browser with search, topic filtering, and difficulty indicators
- **Lesson Workspace**: Markdown reader with KaTeX math rendering, syntax-highlighted code, and Mermaid diagrams
- **Curated Resource Drawer**: Verified YouTube embeds, GitHub repository cards, and official doc citations
- **Project Studio**: Filters (level/phase/skill/track), workspace with milestone completion, GitHub submissions, and rubric self-assessment
- **Authentication**: Google OAuth sign-in with cloud progress sync
- **Guest Mode**: Zero-login persistence via IndexedDB (Dexie.js) for offline learning
- **Personalized Roadmap Engine**: Deterministic prerequisite-aware scheduler generating week-by-week study plans
- **Interactive Quiz Engine**: Integrated lesson quizzes with immediate feedback and skill mastery evidence
- **Learning Analytics**: Verified study time logging, skill mastery radars, and shareable public profiles

---

## How It Works

Most AI material teaches in scattered pieces. A paper here, a fine-tuning post there, a flashy agent demo somewhere else. The pieces rarely line up.

This curriculum is the spine. Every phase, every published lesson, four languages: Python, TypeScript, Rust, Julia. Linear algebra at one end, autonomous swarms at the other. Every algorithm gets built from raw math first. Backprop. Tokenizer. Attention. Agent loop. By the time PyTorch shows up, you already know what it's doing under the hood.

Each lesson runs the same loop: read the problem, derive the math, write the code, run the test, keep the artifact. No five-minute videos, no copy-paste deploys, no hand-holding. Free, open source, and built to run on your own laptop.

---

## Live Deployment

**Production**: https://ai-engineer-os-inky.vercel.app

---

## Development Setup

### Prerequisites
- Node.js >= 20.9.0
- PostgreSQL (for local development, or use Neon for cloud)
- Google OAuth credentials (for sign-in)

### Setup Steps
```bash
# 1. Clone the repository
git clone https://github.com/khrish11/AI-ENGINEER.git
cd AI-ENGINEER

# 2. Install dependencies
npm install

# 3. Configure environment variables
cp .env.example .env.local
# Add your DATABASE_URL, AUTH_SECRET, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET

# 4. Run migrations
npm run db:migrate

# 5. Import curriculum
npm run curriculum:import
npm run resources:import

# 6. Start development server
npm run dev
```

---

## Upstream Curriculum Attribution

The curriculum content in this project is imported from [AI Engineering from Scratch](https://github.com/rohitg00/ai-engineering-from-scratch) by Rohit Ghumare, licensed under the [MIT License](THIRD_PARTY_NOTICES.md).

AI Engineer OS maintains strict separation between upstream original curriculum content and platform application code, ensuring full attribution and compliance with open-source licensing requirements.

---

## Architecture & Documentation

Comprehensive design and specification documents are located in [`docs/`](docs/):

- [`docs/PRD.md`](docs/PRD.md): Product Requirements, user personas, and core functional specifications
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md): System architecture, decoupled identities, sync protocol, and tech stack rationales
- [`docs/DATABASE_DESIGN.md`](docs/DATABASE_DESIGN.md): PostgreSQL schemas, Drizzle ORM models, relations, and indexes
- [`docs/CURRICULUM_SPECIFICATION.md`](docs/CURRICULUM_SPECIFICATION.md): Upstream Git ingestion rules, AST parsing, and idempotency guarantees
- [`docs/RESOURCE_CURATION.md`](docs/RESOURCE_CURATION.md): Resource registry schemas, YouTube player specs, and link verification
- [`docs/PROGRESS_SYNC.md`](docs/PROGRESS_SYNC.md): IndexedDB schema, sync protocol, idempotency, conflicts, tombstones, guest→account migration
- [`docs/ROADMAP_ENGINE.md`](docs/ROADMAP_ENGINE.md): Roadmap engine reference — career tracks, prerequisite graph, scheduling, capacity, buffers, rescheduling
- [`docs/UI_SITEMAP.md`](docs/UI_SITEMAP.md): Complete route map, wireframe layouts, and WCAG 2.2 AA accessibility standards
- [`docs/DEVELOPMENT_CHECKLIST.md`](docs/DEVELOPMENT_CHECKLIST.md): Phase-by-phase engineering checklist with verification gates
- [`docs/RISKS_AND_ASSUMPTIONS.md`](docs/RISKS_AND_ASSUMPTIONS.md): Risk matrix, mitigation strategies, and system dependencies
- [`docs/CONTRIBUTOR_GUIDE.md`](docs/CONTRIBUTOR_GUIDE.md): Contribution boundaries and validation workflow
- [`docs/MCP_ADAPTER.md`](docs/MCP_ADAPTER.md): Local MCP tools, policies, and privacy boundaries

---

## Technical Stack

- **Frontend & App Framework**: Next.js 16.4.2 (App Router), React 19, TypeScript 5.7
- **Styling & Components**: Tailwind CSS 3.4.17, Radix UI, shadcn/ui, Lucide Icons
- **Database & Query Layer**: PostgreSQL 17, Drizzle ORM 0.45.4, postgres-js 3.4.5
- **Authentication**: Auth.js (NextAuth v5) with Google OAuth
- **Client Offline Storage**: Dexie.js 4.4.6 (IndexedDB)
- **Testing & Verification**: Vitest 5.0.5, React Testing Library, Playwright 1.64.1
- **Deployment**: Vercel

---

## License

AI Engineer OS application code is released under the [MIT License](LICENSE).

Curriculum content attribution is detailed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
