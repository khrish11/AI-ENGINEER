# Technical Risks, Assumptions & Mitigation Strategies
## AI Engineer OS — Risk Management & Architectural Assumptions (Corrected)

---

### 1. Architectural & Operational Assumptions

1. **Upstream Source Format Stability**: It is assumed that the upstream repository [`rohitg00/ai-engineering-from-scratch`](https://github.com/rohitg00/ai-engineering-from-scratch) maintains its standard directory structure (`phases/NN-slug/NN-lesson/docs/en.md`, `code/`, `quiz.json`, `projects/`). If new fields are added upstream, the importer will gracefully ignore unrecognized properties while capturing core markdown and metadata into `lesson_revisions`.
2. **Deterministic Recommendation Viability**: It is assumed that career roadmaps can be generated with high pedagogical accuracy using deterministic topological sorting and role-weighted importance tags, eliminating the need for expensive, non-deterministic LLM calls during core onboarding and scheduling.
3. **Client-Side Storage Reliability**: Modern browsers support IndexedDB with at least 50MB–1GB of origin storage, which is more than sufficient to store offline progress, discrete study sessions, notes, and cached lessons for a learner.
4. **Permitted External Media Usage**: YouTube embed players (`youtube-nocookie.com`) and GitHub public API endpoints remain accessible under standard web standards without requiring third-party video re-hosting.

---

### 2. Comprehensive Risk Matrix

| Risk ID | Risk Description | Severity | Likelihood | Mitigation Strategy |
| :--- | :--- | :---: | :---: | :--- |
| **RSK-01** | **Upstream Lesson Renaming or Relocation**<br>Upstream reorganizes phases or renames lesson folders, potentially orphaning existing progress. | High | Medium | **Canonical Lesson Decoupling & Aliases**: User progress binds strictly to immutable `canonical_lessons(id)`. New Git imports simply create new `lesson_revisions` snapshots. If an upstream slug moves, `lesson_aliases` maps the historical slug to the canonical ID, completely preserving user progress. |
| **RSK-02** | **External Link Degradation (Rotting URLs)**<br>Curated YouTube videos or GitHub repositories are deleted or made private by third parties. | Medium | High | **3-Tier Verification & Health CI**: Resources pass schema checks, oEmbed/API network reachability probes, and maintainer editorial review. Weekly automated link auditing flags rotting URLs before they impact learners. |
| **RSK-03** | **Offline/Online Sync Conflicts & Duplication**<br>Learner studies offline across multiple devices, risking duplicate study hours, lost notes, or status regressions. | High | Medium | **Idempotent Batches, Discrete Sessions & Monotonic Ranks**: Study time is logged as discrete, immutable `study_sessions` with client-generated UUIDs (`ON CONFLICT DO NOTHING`). Status transitions follow monotonic rank rules (no status regressions). Notes use revision tracking with non-destructive conflict preservation. Requests include client batch IDs for idempotent retries. |
| **RSK-04** | **Browser Storage Eviction**<br>Mobile Safari or Chrome cleans IndexedDB when device disk space is constrained, threatening guest learner data. | High | Low | **Persistent Storage API Request & Backup Reminder**: The platform requests `navigator.storage.persist()`. Unregistered guest users receive a non-intrusive reminder after 5 completed lessons to either download a JSON backup or link a free GitHub/Google account. |
| **RSK-05** | **Large Bundle Size & Memory Bloat**<br>500+ markdown lessons and KaTeX mathematical formulas cause slow client bundle initialization. | Medium | Medium | **Next.js Static Generation & Dynamic Code-Splitting**: Lessons are statically generated on-demand. Heavy rendering engines (KaTeX, Mermaid, Monaco editor) are dynamically imported (`next/dynamic`) only when the corresponding tab is activated. |
| **RSK-06** | **Arbitrary Code Execution Vulnerabilities**<br>Users submitting project code or lab solutions could attempt remote code execution (RCE) on the server. | Critical | Low | **Strict Server Isolation**: The application server never executes user-submitted code. Automated verification uses deterministic client-side assertion checks or GitHub Actions in isolated runners. |
| **RSK-07** | **YouTube Player Content-Security-Policy (CSP) Blocks**<br>Strict security headers prevent YouTube iframe embedding or script execution. | Medium | Low | **Tailored CSP Directives**: Content-Security-Policy header explicitly allows `frame-src https://www.youtube-nocookie.com https://www.youtube.com; img-src 'self' data: https://i.ytimg.com https://avatars.githubusercontent.com`. |

---

### 3. Expected System & Runtime Dependencies

#### 3.1 Server Environment
- **Node.js**: `v20.x` or `v24.x` LTS (Active verified version: `v24.19.0`).
- **Package Manager**: `pnpm` (v10.x) or `npm` (v11.x).
- **PostgreSQL**: `v16.x` or `v17.x` with support for `gen_random_uuid()`, `JSONB`, and `TIMESTAMPTZ`.
- **Docker & Docker Compose**: Docker 24+ / Compose v2.20+ for containerized builds and self-hosted deployments.

#### 3.2 Client Browser Support
- **Chrome / Chromium**: Version 115+
- **Firefox**: Version 115+
- **Safari**: Version 16.4+ (Full IndexedDB and modern CSS support)
- **Edge**: Version 115+
