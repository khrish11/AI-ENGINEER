# Contributing to AI Engineer OS

Thank you for your interest in contributing to **AI Engineer OS**! As an open-source platform, we welcome contributions ranging from bug fixes and design polish to resource curation, project authoring, and documentation improvements.

---

### Code of Conduct

All contributors and participants are expected to adhere to our [Code of Conduct](CODE_OF_CONDUCT.md). Please treat all community members with respect, patience, and kindness.

---

### Ways to Contribute

#### 1. Curating Educational Resources (No Code Changes Needed!)
You can curate high-quality YouTube tutorials, GitHub reference implementations, official documentation, or research papers by adding declarative JSON files:
1. Locate or create a category folder under `resources/catalog/{phase-slug}/`.
2. Add a new `{resource-id}.json` conforming to our resource schema.
3. Verify that URLs are live and properly attributed.
4. Run validation:
   ```bash
   npm run resources:validate
   ```
5. Submit a Pull Request. GitHub Actions will validate your file automatically!

#### 2. Enhancing Projects & Evaluation Rubrics
Suggest new practical milestones, starter code, or rubric evaluation checklists for any of the 20 curriculum phases in `projects/`.

#### 3. Core Application Development
Help improve the Next.js frontend, deterministic roadmap scheduling algorithms, Dexie.js offline persistence, or database sync engine.

---

### Local Development Setup

#### Prerequisites
- Node.js `20.x` or `24.x` (LTS recommended)
- `pnpm` (v10.x) or `npm` (v11.x)
- Docker & Docker Compose (optional, for local PostgreSQL instance)

#### Setup Steps
```bash
# 1. Clone your fork
git clone https://github.com/<your-username>/ai-engineer-os.git
cd ai-engineer-os

# 2. Install dependencies
npm install

# 3. Configure environment variables
cp .env.example .env.local

# 4. Start local development server
npm run dev
```

---

### Verification & Testing Gates

Before opening a pull request, ensure all local validation gates pass:
```bash
# TypeScript compilation check
npm run typecheck

# ESLint code style check
npm run lint

# Unit & integration tests
npm run test

# Full production build verification
npm run build
```

For the lightweight contributor gate, run:

```bash
npm run validate
```

For the CI-equivalent build and browser gate, run `npm run validate:full`.
The local read-only MCP adapter is available with `npm run mcp:start`; its
registry and privacy policies are checked by `npm run mcp:validate`.

---

### Pull Request Guidelines

1. Create a descriptive branch name: `feature/curate-rag-videos`, `fix/roadmap-reschedule-bug`, or `docs/update-setup-guide`.
2. Keep pull requests focused on a single logical change.
3. Include references to any related issue numbers (e.g., `Closes #42`).
4. Ensure all CI checks pass cleanly before requesting review.

## Adding projects or assessments (Phase 6)

1. Drop a JSON file into `projects/catalog/<phase-slug>/` (schema:
   `src/lib/projects/schema.ts`) or `assessments/catalog/` (schema:
   `src/lib/assessments/schema.ts`).
2. Run the validators before committing - they fail loudly on unknown phase
   slugs, occurrences, skill ids, track ids, malformed rubric weights, or
   broken answer keys:

   ```bash
   npm run projects:validate
   npm run projects:coverage   # also refreshes reports/project-coverage.{json,md}
   npm run assessments:validate
   ```

3. Every non-beginner project must carry a rubric whose weights total exactly
   100, and milestones may only reference evidence kinds from the shared
   allowlist. Never include API keys or private key material in a definition:
   the validator scans for common secret patterns and rejects them.
4. Attribution: upstream/community projects must set `source` and `sourceUrl`
   so the UI can always credit the origin.

   ## Contribution boundaries

   Do not add private learner data, credentials, arbitrary SQL, shell execution,
   or server-side execution of learner repositories. Resource records remain
   `pending_review` until a maintainer verifies attribution, license, URL, and
   lesson relevance. See the [Contributor Guide](docs/CONTRIBUTOR_GUIDE.md) and
   [MCP Adapter](docs/MCP_ADAPTER.md) documentation.
