# AI Engineer OS

<div align="center">

**A structured learning platform for developing practical AI engineering skills**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node Version](https://img.shields.io/badge/Node-%3E%3D20.9.0-green.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org)
[![Status: v0.1.0](https://img.shields.io/badge/Status-v0.1.0-success.svg)](https://ai-engineer-os-inky.vercel.app)

[📖 Documentation](#-quick-navigation) · [🚀 Getting Started](#-getting-started) · [🔧 MCP Integration](#-mcp-integration) · [📚 Curriculum](#-interactive-learning-roadmap)

</div>

---

AI Engineer OS is a production-quality learning platform and interactive developer workspace built around the canonical curriculum from [AI Engineering from Scratch](https://github.com/rohitg00/ai-engineering-from-scratch) by Rohit Ghumare.

It provides structured learning phases, project-based exercises, progress tracking, and MCP-powered integrations for developers building practical AI engineering skills.

**Live Demo**: https://ai-engineer-os-inky.vercel.app (Vercel Authentication required)

---

## 📌 Quick Navigation

- [Overview](#-overview)
- [Features](#-feature-exploration)
- [Learning Roadmap](#-interactive-learning-roadmap)
- [Architecture](#-architecture)
- [MCP Integration](#-mcp-integration)
- [Getting Started](#-getting-started)
- [Environment Variables](#-environment-variables)
- [Development Commands](#-development-commands)
- [Project Structure](#-project-structure)
- [Testing & Quality](#-testing-and-quality)
- [Contributing](#-contributing)
- [Roadmap](#-roadmap-and-planned-features)
- [FAQ](#-faq-and-troubleshooting)

---

## 🎯 Overview

### Why AI Engineer OS Exists

Most AI educational material is scattered across blog posts, papers, and tutorials without a cohesive structure. Developers struggle to find a linear path from foundational concepts to advanced applications.

AI Engineer OS addresses this by:

- **Structured Curriculum**: 20 phases of progressive learning from linear algebra to autonomous swarms
- **Hands-on Practice**: Every lesson includes math derivation, code implementation, and artifact preservation
- **Resource Curation**: Verified YouTube embeds, GitHub repositories, and official documentation
- **Progress Tracking**: Guest mode with local persistence and authenticated cloud sync
- **MCP Integration**: Standard Model Context Protocol server for AI agent tooling

### Who It's For

- Developers learning AI engineering fundamentals
- Students building practical ML/AI skills
- Engineers transitioning into AI development
- Teams needing structured AI engineering training

### Learning Workflow

1. **Browse Phases**: Navigate 20 curriculum phases from setup to advanced topics
2. **Study Lessons**: Read lesson content with math, code, and exercises
3. **Complete Projects**: Build practical projects with milestone tracking
4. **Track Progress**: Monitor learning journey with roadmap visualization
5. **Sync Progress**: Cloud sync with Google OAuth or local guest mode

---

## ✨ Feature Exploration

<details>
<summary><strong>🗺️ Structured Learning Roadmap</strong></summary>

**What it does**: Provides a visual, prerequisite-aware learning path across 20 curriculum phases.

**How you interact with it**:
- Browse phases from setup to advanced AI topics
- View lesson counts and estimated completion time
- Generate personalized week-by-week study plans
- Track progress with milestone checkpoints

**Implementation**: Located in `src/lib/roadmap/` with deterministic scheduling algorithm.

**Related Documentation**: [`docs/ROADMAP_ENGINE.md`](docs/ROADMAP_ENGINE.md)

</details>

<details>
<summary><strong>📚 Curriculum Management</strong></summary>

**What it does**: Manages 542 lessons across 20 phases with Markdown rendering, KaTeX math, and syntax-highlighted code.

**How you interact with it**:
- Navigate phases and lessons with search and filtering
- Read lesson content with embedded math and diagrams
- Access learning objectives and code examples
- View upstream attribution and licensing

**Implementation**: PostgreSQL-backed curriculum with Drizzle ORM in `src/lib/curriculum/`.

**Related Documentation**: [`docs/CURRICULUM_SPECIFICATION.md`](docs/CURRICULUM_SPECIFICATION.md)

</details>

<details>
<summary><strong>🔍 Resource Discovery</strong></summary>

**What it does**: Curated registry of learning resources with verification status and lesson associations.

**How you interact with it**:
- Browse YouTube videos, GitHub repos, and documentation
- Filter by type, verification status, and tags
- Access resources directly from lesson pages
- Contribute new resources through editorial review

**Implementation**: Resource registry in `src/lib/resources/` with three-tier verification.

**Related Documentation**: [`docs/RESOURCE_CURATION.md`](docs/RESOURCE_CURATION.md)

</details>

<details>
<summary><strong>🛠️ Project Studio</strong></summary>

**What it does**: Hands-on project workspace with milestone tracking and self-assessment rubrics.

**How you interact with it**:
- Browse projects by phase, level, and skill track
- Complete milestone requirements with evidence submission
- Self-assess against defined rubrics
- Track project completion in portfolio

**Implementation**: Project catalog in `src/lib/projects/` with evidence tracking.

**Related Documentation**: [`docs/PROJECT_STUDIO.md`](docs/PROJECT_STUDIO.md)

</details>

<details>
<summary><strong>📊 Progress Tracking</strong></summary>

**What it does**: Dual-mode persistence with local IndexedDB (guest) and cloud sync (authenticated).

**How you interact with it**:
- Track lesson completion and study time
- Guest mode: Local persistence via Dexie.js
- Authenticated mode: Cloud sync with conflict resolution
- Migrate guest progress to account seamlessly

**Implementation**: Sync protocol in `src/lib/progress/` with idempotent batch operations.

**Related Documentation**: [`docs/PROGRESS_SYNC.md`](docs/PROGRESS_SYNC.md)

</details>

<details>
<summary><strong>🤖 MCP Integration</strong></summary>

**What it does**: Standard Model Context Protocol server exposing 9 public tools for AI agent integration.

**How you interact with it**:
- Connect MCP clients to `/api/mcp` endpoint
- Query curriculum, lessons, resources, and projects
- Generate learning path suggestions
- Access structured curriculum data programmatically

**Implementation**: MCP adapter in `src/mcp/` with public/private policy filtering.

**Related Documentation**: [`docs/MCP_GUIDE.md`](docs/MCP_GUIDE.md)

</details>

<details>
<summary><strong>🔐 Authentication</strong></summary>

**What it does**: Google OAuth sign-in with cloud progress sync and guest mode fallback.

**How you interact with it**:
- Sign in with Google OAuth for cloud sync
- Use guest mode for local-only learning
- Migrate guest progress to account on first sign-in
- Session management with NextAuth v5

**Implementation**: Auth.js adapter in `src/app/api/auth/` with standard OAuth flow.

**Related Documentation**: [`docs/PRIVACY.md`](docs/PRIVACY.md)

</details>

---

## 📚 Interactive Learning Roadmap

The curriculum consists of **20 phases** covering foundational math to advanced AI systems.

<details>
<summary><strong>Phase 0: Setup & Tooling</strong></summary>

- **Objectives**: Development environment, Git workflow, reproducibility
- **Topics**: Environment setup, version control, dependency management
- **Skills**: Command-line proficiency, debugging workflows
- **Project**: Reproducible AI development environment

</details>

<details>
<summary><strong>Phase 1: Foundations of Linear Algebra</strong></summary>

- **Objectives**: Vectors, matrices, transformations, eigenvalues
- **Topics**: Vector spaces, matrix operations, SVD, eigendecomposition
- **Skills**: Numerical computing with NumPy/PyTorch
- **Project**: Linear algebra operations from scratch

</details>

<details>
<summary><strong>Phase 2: Probability & Statistics</strong></summary>

- **Objectives**: Distributions, estimation, hypothesis testing
- **Topics**: Bayes' theorem, MLE, statistical inference
- **Skills**: Statistical modeling and analysis
- **Project**: Statistical experiments and simulations

</details>

<details>
<summary><strong>Phase 3: Calculus for Machine Learning</strong></summary>

- **Objectives**: Gradients, optimization, chain rule
- **Topics**: Partial derivatives, gradient descent, Hessian
- **Skills**: Automatic differentiation implementation
- **Project**: Autograd from first principles

</details>

<details>
<summary><strong>Phase 4: Data & Preprocessing</strong></summary>

- **Objectives**: Data cleaning, feature engineering, normalization
- **Topics**: Tokenization, embeddings, data pipelines
- **Skills**: PyTorch Dataset/Loaders, data augmentation
- **Project**: End-to-end data pipeline

</details>

<details>
<summary><strong>Phase 5: Neural Network Foundations</strong></summary>

- **Objectives**: Perceptrons, MLPs, backpropagation
- **Topics**: Activation functions, loss functions, optimization
- **Skills**: Building networks from scratch
- **Project**: MNIST classifier from first principles

</details>

<details>
<summary><strong>Phase 6: Computer Vision Architectures</strong></summary>

- **Objectives**: CNNs, attention mechanisms, vision transformers
- **Topics**: Convolutions, pooling, residual connections
- **Skills**: Image classification and object detection
- **Project**: Custom CNN architecture

</details>

<details>
<summary><strong>Phase 7: Sequence Models & NLP</strong></summary>

- **Objectives**: RNNs, LSTMs, attention, transformers
- **Topics**: Tokenization, positional encoding, self-attention
- **Skills**: Text classification and generation
- **Project**: Transformer from scratch

</details>

<details>
<summary><strong>Phase 8: Training Techniques</strong></summary>

- **Objectives**: Regularization, optimization, distributed training
- **Topics**: Dropout, batch norm, learning rate schedules
- **Skills**: Training stability and efficiency
- **Project**: Advanced training pipeline

</details>

<details>
<summary><strong>Phase 9: Large Language Models</strong></summary>

- **Objectives**: Transformer scaling, pre-training, fine-tuning
- **Topics**: GPT architecture, training objectives, LoRA
- **Skills**: LLM fine-tuning and evaluation
- **Project**: Instruction-tuned model

</details>

<details>
<summary><strong>Phase 10: Generation Techniques</strong></summary>

- **Objectives**: Sampling, decoding, control
- **Topics**: Temperature, top-k, top-p, RLHF
- **Skills**: Controlled text generation
- **Project**: Custom generation strategies

</details>

<details>
<summary><strong>Phase 11: Agents & Tool Use</strong></summary>

- **Objectives**: ReAct, function calling, planning
- **Topics**: Agent loops, tool integration, memory
- **Skills**: Building AI agents
- **Project**: Custom agent framework

</details>

<details>
<summary><strong>Phase 12: RAG & Retrieval</strong></summary>

- **Objectives**: Vector databases, embeddings, retrieval
- **Topics**: Chunking, indexing, reranking
- **Skills**: Building RAG systems
- **Project**: Production RAG pipeline

</details>

<details>
<summary><strong>Phase 13: Multi-Modal Systems</strong></summary>

- **Objectives**: Vision-language models, cross-modal attention
- **Topics**: CLIP, BLIP, multimodal generation
- **Skills**: Image-text tasks
- **Project**: Multimodal application

</details>

<details>
<summary><strong>Phase 14: Reinforcement Learning</strong></summary>

- **Objectives**: MDPs, Q-learning, policy gradients
- **Topics**: Value functions, exploration, PPO
- **Skills**: RL algorithm implementation
- **Project**: RL agent training

</details>

<details>
<summary><strong>Phase 15: Distributed Systems</strong></summary>

- **Objectives**: Scalability, fault tolerance, orchestration
- **Topics**: Kubernetes, Ray, distributed training
- **Skills**: Production ML systems
- **Project**: Distributed training setup

</details>

<details>
<summary><strong>Phase 16: MLOps & Deployment</strong></summary>

- **Objectives**: Model serving, monitoring, experimentation
- **Topics**: MLflow, Docker, CI/CD, monitoring
- **Skills**: Production ML lifecycle
- **Project**: MLOps pipeline

</details>

<details>
<summary><strong>Phase 17: AI Safety & Alignment</strong></summary>

- **Objectives**: Alignment, safety measures, evaluation
- **Topics**: Constitutional AI, red teaming, benchmarks
- **Skills**: Safe AI development
- **Project**: Safety evaluation framework

</details>

<details>
<summary><strong>Phase 18: Specialized Architectures</strong></summary>

- **Objectives**: Diffusion models, graph neural networks
- **Topics**: Stable Diffusion, GNNs, specialized applications
- **Skills**: Advanced architecture design
- **Project**: Specialized model implementation

</details>

<details>
<summary><strong>Phase 19: Production Engineering</strong></summary>

- **Objectives**: Latency optimization, cost management, scaling
- **Topics**: Quantization, distillation, caching
- **Skills**: Production AI engineering
- **Project**: Optimization project

</details>

<details>
<summary><strong>Phase 20: Advanced Topics</strong></summary>

- **Objectives**: Research frontiers, open problems
- **Topics**: Current research, emerging techniques
- **Skills**: Research-oriented development
- **Project**: Research reproduction

</details>

---

## 🏗️ Architecture

```mermaid
graph TB
    subgraph Client
        Browser[Browser]
        GuestMode[Guest Mode<br/>IndexedDB]
    end

    subgraph Vercel
        NextJS[Next.js App Router]
        API[API Routes]
        MCP[MCP Endpoint<br/>/api/mcp]
    end

    subgraph Services
        Curriculum[Curriculum Service]
        Roadmap[Roadmap Engine]
        Resources[Resource Service]
        Projects[Project Catalog]
        Progress[Progress Sync]
        Auth[Auth.js/NextAuth]
    end

    subgraph Database
        PostgreSQL[(PostgreSQL)]
        Drizzle[Drizzle ORM]
    end

    subgraph External
        Google[Google OAuth]
        Upstream[Upstream Curriculum<br/>GitHub]
    end

    Browser -->|HTTP| NextJS
    GuestMode -->|Local| Progress
    NextJS --> API
    NextJS --> MCP
    API --> Curriculum
    API --> Roadmap
    API --> Resources
    API --> Projects
    API --> Progress
    API --> Auth
    Auth -->|OAuth| Google
    Curriculum --> Drizzle
    Roadmap --> Drizzle
    Resources --> Drizzle
    Projects --> Drizzle
    Progress --> Drizzle
    Auth --> Drizzle
    Drizzle --> PostgreSQL
    Curriculum -->|Ingest| Upstream

    style NextJS fill:#3b82f6
    style PostgreSQL fill:#10b981
    style MCP fill:#8b5cf6
    style GuestMode fill:#f59e0b
```

**Request Flow**:
1. Client requests hit Next.js App Router
2. API routes delegate to service layer
3. Services use Drizzle ORM for PostgreSQL queries
4. MCP endpoint exposes public tools via JSON-RPC
5. Guest mode uses IndexedDB for local persistence
6. Authenticated mode uses cloud sync with PostgreSQL

---

## 🤖 MCP Integration

AI Engineer OS exposes a standard Model Context Protocol (MCP) server at `/api/mcp` with **9 public tools** for AI agent integration.

### Public Tools

<details>
<summary><strong>get_system_status</strong></summary>

**Purpose**: Return safe adapter capability and version information

**Arguments**: None

**Read-only**: Yes

**Example Request**:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "get_system_status",
    "arguments": {}
  }
}
```

**Expected Response**:
```json
{
  "adapter": "ai-engineer-os",
  "mcpAdapterVersion": 1,
  "transport": "stdio",
  "readOnly": true
}
```

</details>

<details>
<summary><strong>search_curriculum</strong></summary>

**Purpose**: Search the canonical curriculum by title, phase, or keyword

**Arguments**:
- `query` (string, optional): Search query
- `phase` (number, optional): Phase number (0-20)
- `limit` (number, default 10): Max results (1-50)

**Read-only**: Yes

**Example Request**:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "search_curriculum",
    "arguments": {
      "query": "transformer",
      "phase": 7,
      "limit": 5
    }
  }
}
```

</details>

<details>
<summary><strong>get_lesson</strong></summary>

**Purpose**: Get metadata for one lesson, with content only when explicitly requested

**Arguments**:
- `phaseSlug` (string, required): Phase slug
- `lessonSlug` (string, required): Lesson slug
- `includeContent` (boolean, default false): Include full content

**Read-only**: Yes

**Example Request**:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "get_lesson",
    "arguments": {
      "phaseSlug": "00-setup-and-tooling",
      "lessonSlug": "01-dev-environment",
      "includeContent": true
    }
  }
}
```

</details>

<details>
<summary><strong>get_learning_resources</strong></summary>

**Purpose**: List curated resources and their verification metadata

**Arguments**:
- `query` (string, optional): Search query
- `type` (string, optional): Resource type filter
- `lessonId` (string, optional): Filter by lesson
- `limit` (number, default 10): Max results (1-50)

**Read-only**: Yes

</details>

<details>
<summary><strong>search_projects</strong></summary>

**Purpose**: Search public project definitions without learner evidence

**Arguments**:
- `query` (string, optional): Search query
- `phase` (number, optional): Phase filter
- `limit` (number, default 10): Max results (1-50)

**Read-only**: Yes

</details>

<details>
<summary><strong>get_project</strong></summary>

**Purpose**: Get a public project definition and milestone requirements

**Arguments**:
- `slug` (string, required): Project slug

**Read-only**: Yes

</details>

<details>
<summary><strong>get_all_phases</strong></summary>

**Purpose**: Get all curriculum phases with lesson counts and metadata

**Arguments**: None

**Read-only**: Yes

**Example Response**:
```json
{
  "totalPhases": 20,
  "phases": [...]
}
```

</details>

<details>
<summary><strong>get_phase_details</strong></summary>

**Purpose**: Get detailed information about a specific phase including all lessons

**Arguments**:
- `phaseSlug` (string, required): Phase slug

**Read-only**: Yes

</details>

<details>
<summary><strong>suggest_learning_path</strong></summary>

**Purpose**: Suggest a learning path based on learner's current progress and goals

**Arguments**:
- `goal` (string, required): Learning goal
- `currentPhase` (number, optional): Current phase number
- `timeAvailable` (string, optional): Time availability (e.g., "10 hours/week")

**Read-only**: Yes

</details>

### Private Tools (Not Available Remotely)

The following tools are only available in the local stdio MCP adapter and require learner context:

- `get_current_week`: Get current learner roadmap week
- `get_review_queue`: Get learner review queue
- `get_analytics_overview`: Get learner analytics overview

These tools return `NOT_AUTHORIZED` when called via the remote HTTP endpoint.

### Resources

- `ai-engineer://curriculum/phases`: Public curriculum phase index
- `ai-engineer://curriculum/lesson-counts`: Lesson counts per phase
- `ai-engineer://stats/overview`: Overall curriculum statistics
- `ai-engineer://resources/catalog`: All curated learning resources

### Prompts

- `explain_current_lesson`: Explain a lesson using only supplied public curriculum context

### Client Configuration

**Remote Endpoint**: `https://ai-engineer-os-inky.vercel.app/api/mcp`

**Protocol Version**: 2025-06-18

**Note**: The production endpoint requires Vercel Authentication. For local development, use the stdio MCP adapter via `npm run mcp:start`.

**Documentation**: [`docs/MCP_CLIENT_CONFIG.md`](docs/MCP_CLIENT_CONFIG.md)

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: >= 20.9.0
- **PostgreSQL**: Local installation or cloud database (Neon recommended)
- **Package Manager**: npm, yarn, or pnpm
- **Git**: For cloning the repository

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/khrish11/AI-ENGINEER.git
cd AI-ENGINEER

# 2. Install dependencies
npm install

# 3. Configure environment variables
cp .env.example .env.local
# Edit .env.local with your configuration

# 4. Run database migrations
npm run db:migrate

# 5. Import curriculum (optional, for local development)
npm run curriculum:import
npm run resources:import

# 6. Start development server
npm run dev
```

**Access**: Open http://localhost:3000 in your browser

### Production Build

```bash
npm run build
npm start
```

---

## 🔧 Environment Variables

Copy `.env.example` to `.env.local` and configure the following:

### Required Variables

| Variable | Description | Notes |
|----------|-------------|-------|
| `DATABASE_URL` | PostgreSQL connection string | Format: `postgresql://user:password@host:port/database` |
| `AUTH_SECRET` | NextAuth secret key | Generate with `openssl rand -base64 32` |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `AUTH_GOOGLE_ID` | Google OAuth client ID | Leave blank for guest mode |
| `AUTH_GOOGLE_SECRET` | Google OAuth client secret | Leave blank for guest mode |
| `CURRICULUM_GIT_REPO` | Upstream curriculum repository | Pre-configured |
| `CURRICULUM_PINNED_SHA` | Upstream commit SHA | Pre-configured |
| `NEXT_PUBLIC_ENABLE_GUEST_MODE` | Enable guest mode | `true` |

**Security**: Never commit `.env.local` or expose secrets in code.

---

## 💻 Development Commands

```bash
# Development
npm run dev              # Start Next.js dev server
npm run build            # Production build
npm run start            # Start production server

# Quality Checks
npm run typecheck        # TypeScript validation
npm run lint             # ESLint
npm test                 # Run Vitest tests
npm run test:ui          # Vitest UI
npm run test:e2e         # Playwright E2E tests

# Database
npm run db:generate      # Generate Drizzle migrations
npm run db:migrate       # Run database migrations
npm run db:audit         # Audit database schema

# Curriculum
npm run curriculum:import           # Import curriculum from upstream
npm run curriculum:identity-audit   # Audit curriculum identities
npm run resources:import           # Import resources
npm run resources:validate          # Validate resources

# Roadmap
npm run roadmap:metadata   # Generate roadmap metadata
npm run roadmap:validate    # Validate roadmap configuration
npm run roadmap:coverage    # Check roadmap coverage

# MCP
npm run mcp:start          # Start local MCP stdio server
npm run mcp:validate       # Validate MCP configuration

# Validation
npm run validate           # Quick validation
npm run validate:full      # Full validation suite
```

---

## 📁 Project Structure

```
AI-ENGINEER/
├── src/
│   ├── app/                 # Next.js App Router
│   │   ├── api/            # API routes
│   │   │   ├── auth/       # NextAuth endpoints
│   │   │   ├── mcp/        # MCP HTTP endpoint
│   │   │   └── health/     # Health checks
│   │   ├── curriculum/     # Curriculum pages
│   │   ├── projects/       # Project pages
│   │   └── roadmap/       # Roadmap pages
│   ├── components/         # React components
│   ├── db/                 # Database schema and client
│   ├── lib/                # Core services
│   │   ├── curriculum/     # Curriculum service
│   │   ├── resources/      # Resource service
│   │   ├── projects/       # Project catalog
│   │   ├── roadmap/        # Roadmap engine
│   │   └── progress/      # Progress sync
│   ├── mcp/                # MCP adapter
│   │   ├── registry.ts     # Tool definitions
│   │   ├── schemas.ts      # Input schemas
│   │   └── server.ts       # MCP server
│   └── test/               # Test files
├── docs/                   # Documentation
├── scripts/                # Utility scripts
├── .env.example            # Environment template
├── package.json            # Dependencies
├── tsconfig.json           # TypeScript config
├── next.config.ts          # Next.js config
└── drizzle.config.ts       # Drizzle ORM config
```

---

## ✅ Testing & Quality

### Test Framework
- **Unit Tests**: Vitest 5.0.5
- **E2E Tests**: Playwright 1.64.1
- **Integration Tests**: PostgreSQL with disposable databases

### Running Tests

```bash
# Unit tests
npm test

# E2E tests
npm run test:e2e

# Type checking
npm run typecheck

# Linting
npm run lint

# Production build
npm run build
```

### Quality Gates

- **TypeScript**: 0 errors
- **ESLint**: 0 errors (20 pre-existing warnings)
- **Tests**: 355/355 passing
- **Build**: Successful (47 static pages)

### MCP Protocol Verification

The MCP endpoint has been verified with the official MCP SDK:

- **Initialization**: ✅ PASS
- **Tools Discovery**: ✅ 9/9 public tools
- **Tool Execution**: ✅ 9/9 verified
- **Resources**: ✅ 4 resources accessible
- **Prompts**: ✅ 1 prompt available
- **Error Handling**: ✅ Invalid input rejected
- **Response Limits**: ✅ 500KB enforced

**Report**: [`FINAL_PRODUCTION_SIGNOFF_REPORT.md`](FINAL_PRODUCTION_SIGNOFF_REPORT.md)

---

## 🤝 Contributing

We welcome contributions! Please see [`CONTRIBUTING.md`](CONTRIBUTING.md) for guidelines.

### How to Contribute

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests (`npm test && npm run typecheck && npm run lint`)
5. Commit your changes
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### Contribution Guidelines

- Follow the existing code style
- Add tests for new features
- Update documentation as needed
- Ensure all tests pass
- No breaking changes without discussion

---

## 🗺️ Roadmap and Planned Features

### Completed Features ✅

- [x] 20-phase curriculum structure
- [x] Lesson workspace with Markdown and KaTeX
- [x] Resource discovery and curation
- [x] Guest mode with IndexedDB persistence
- [x] Google OAuth authentication
- [x] Progress sync with conflict resolution
- [x] Roadmap engine with scheduling
- [x] Project catalog and milestone tracking
- [x] MCP stdio adapter (local)
- [x] MCP HTTP endpoint (remote)
- [x] MCP security hardening
- [x] Production deployment on Vercel

### Planned Features 📋

- [ ] Interactive quiz engine with mastery tracking
- [ ] Learning analytics dashboard
- [ ] Shareable public portfolios
- [ ] Community resource contributions
- [ ] Advanced search and filtering
- [ ] Mobile app (React Native)
- [ ] Offline-first curriculum caching
- [ ] Internationalization (i18n)
- [ ] Video embeds in lessons
- [ ] Code playground integration

---

## ❓ FAQ and Troubleshooting

<details>
<summary><strong>How do I run the application locally?</strong></summary>

1. Clone the repository
2. Run `npm install`
3. Copy `.env.example` to `.env.local` and configure `DATABASE_URL`
4. Run `npm run db:migrate`
5. Run `npm run dev`
6. Open http://localhost:3000

</details>

<details>
<summary><strong>How do I configure PostgreSQL?</strong></summary>

**Local Installation**:
- Install PostgreSQL 17 locally
- Create a database: `createdb ai_engineer_os`
- Set `DATABASE_URL` in `.env.local`

**Cloud (Neon)**:
- Create a free Neon project
- Copy the connection string to `.env.local`

</details>

<details>
<summary><strong>How do I access the learning roadmap?</strong></summary>

Navigate to `/roadmap` in the application. The roadmap engine generates personalized study plans based on your available time and current progress.

</details>

<details>
<summary><strong>How do I use the MCP endpoint?</strong></summary>

**Local (stdio)**:
```bash
npm run mcp:start
```

**Remote (HTTP)**:
- Endpoint: `https://ai-engineer-os-inky.vercel.app/api/mcp`
- Protocol: JSON-RPC 2.0
- Authentication: Vercel Auth required for production

**Documentation**: [`docs/MCP_GUIDE.md`](docs/MCP_GUIDE.md)

</details>

<details>
<summary><strong>Why might the production demo require authentication?</strong></summary>

The production deployment uses Vercel Authentication to protect the application. This is a security measure to prevent unauthorized access. For local development, guest mode is available without authentication.

</details>

<details>
<summary><strong>How can I contribute?</strong></summary>

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for guidelines. We welcome bug reports, feature requests, and pull requests.

</details>

<details>
<summary><strong>How do I report a bug?</strong></summary>

Open an issue on GitHub with:
- Description of the bug
- Steps to reproduce
- Expected behavior
- Actual behavior
- Environment details (Node version, OS, browser)

</details>

---

## 📄 License

AI Engineer OS application code is released under the [MIT License](LICENSE).

Curriculum content is imported from [AI Engineering from Scratch](https://github.com/rohitg00/ai-engineering-from-scratch) by Rohit Ghumare, licensed under the MIT License. Full attribution details in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

---

## 🙏 Acknowledgments

- **Upstream Curriculum**: [AI Engineering from Scratch](https://github.com/rohitg00/ai-engineering-from-scratch) by Rohit Ghumare
- **Framework**: [Next.js](https://nextjs.org/)
- **Database**: [PostgreSQL](https://www.postgresql.org/) and [Drizzle ORM](https://orm.drizzle.team/)
- **Authentication**: [Auth.js / NextAuth](https://authjs.dev/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) and [shadcn/ui](https://ui.shadcn.com/)
- **MCP**: [Model Context Protocol](https://modelcontextprotocol.io/)

---

## 📞 Support

- **Documentation**: [`docs/`](docs/)
- **Issues**: [GitHub Issues](https://github.com/khrish11/AI-ENGINEER/issues)
- **Discussions**: [GitHub Discussions](https://github.com/khrish11/AI-ENGINEER/discussions)

---

<div align="center">

**Built with ❤️ for AI Engineers**

[⭐ Star on GitHub](https://github.com/khrish11/AI-ENGINEER)

</div>
