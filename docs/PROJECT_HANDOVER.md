# AI Engineer OS — Project Handover

## Maintenance status

AI Engineer OS is feature-complete for the current scope. Treat `main` as the
production branch and use short-lived pull requests for maintenance. Do not
regenerate production roadmaps, migrate production data, or change deployment
credentials as part of routine maintenance.

- Production: https://ai-engineer-os-inky.vercel.app
- Repository: https://github.com/khrish11/AI-ENGINEER
- Vercel project: `ai-engineer-os` (`prj_5OdXDEDGdG5tXKtVqIaHWxpEdgYr`)
- Runtime: Node.js 24 (`package.json` pins `24.x`)

The production baseline before the onboarding-preview hotfix is merge commit
`5c396fd5b098607d61986adfdcaa071ea5ca807f`, Vercel deployment
`dpl_9t7gE7fAgdT8ouG2ZtkGPndPvnkg`, with production alias
`ai-engineer-os-inky.vercel.app`.

## Architecture and technology

- Next.js 16 App Router, React 19, and TypeScript 5.
- Tailwind CSS for styling and accessible React components.
- PostgreSQL with Drizzle ORM for curriculum, authentication, progress, notes,
  portfolios, roadmap state, synchronization batches, and conflicts.
- Dexie/IndexedDB for offline-first local progress, notes, roadmap state, and
  the synchronization queue.
- Auth.js/NextAuth v5 with Google OAuth and optional GitHub OAuth configuration.
- Deterministic roadmap scheduler under `src/lib/roadmap`, including placement,
  known-topic exclusion, prerequisites, capstone selection, workload preview,
  rescheduling, and persisted V1/V2 compatibility.
- Versioned synchronization API at `/api/sync/v1` with account isolation,
  coalesced mutations, acknowledgements, conflict handling, and cross-device
  restoration.
- Service worker v3 (`public/sw.js`) for the offline public shell. Private API,
  authentication, settings, and redirect responses are not cached.
- Model Context Protocol adapter under `src/mcp` and `/api/mcp`.
- Vitest, Testing Library, fake-indexeddb, Playwright, axe-core, TypeScript, and
  ESLint for verification.
- Vercel Git integration for previews and production deployment; GitHub Actions
  provisions isolated PostgreSQL 17 services for validation and E2E.

The browser is the local-first boundary. Authenticated clients synchronize
user-scoped entities through the API; they do not write directly to PostgreSQL.
Roadmap generation and preview use the same scheduler, and existing roadmaps are
not replaced until the learner explicitly generates or regenerates a plan.

## Implemented features

- Twenty-phase imported AI-engineering curriculum with lesson workspaces,
  Markdown, math, resources, quizzes, and project catalog.
- Guest and authenticated learning progress, notes, bookmarks, sessions,
  project evidence, assessments, analytics, review queues, and portfolios.
- Offline persistence, durable mutation queue, automatic/manual sync, conflict
  handling, account isolation, and cross-device restoration.
- Personalized General AI and specialist roadmaps with placement, seven tracks,
  known-topic exclusions, manual Add back, prerequisite closure, scheduling,
  workload/duration preview, rescheduling, and progress preservation.
- Roadmap V2 core/optional capstone selection with four required core projects,
  standalone products, deep-build bundles, deduplicated prerequisites, and
  backward-compatible V1 settings.
- Google OAuth, protected user routes, health/version endpoints, security
  headers, service-worker cache controls, and account deletion.
- Public/read-only MCP tools and local learner-context tools.

## Environment variables

Store values in Vercel environment settings or a local ignored environment
file. Never commit values.

Required or deployment-critical names:

- `DATABASE_URL`
- `AUTH_SECRET`
- `AUTH_URL`
- `AUTH_TRUST_HOST`
- `AUTH_GOOGLE_ID`
- `AUTH_GOOGLE_SECRET`
- `NEXT_PUBLIC_APP_URL`

Optional or workflow-specific names:

- `AUTH_GITHUB_ID`
- `AUTH_GITHUB_SECRET`
- `NEXT_PUBLIC_ENABLE_GUEST_MODE`
- `NEXT_PUBLIC_ENABLE_COMMUNITY_CURATION`
- `CURRICULUM_GIT_REPO`
- `CURRICULUM_PINNED_SHA`
- `CURRICULUM_LOCAL_PATH`
- `MCP_ALLOWED_ORIGINS`
- `YOUTUBE_API_KEY`
- `GIT_COMMIT_SHA`
- `NODE_ENV`
- `PORT`
- `HOSTNAME`
- `E2E_PORT`
- `E2E_AUTH_SECRET`

Use `.env.example` for local structure. Local and CI database URLs must point to
isolated non-production databases before migrations, imports, or E2E tests.

## Verification baseline

Hotfix local verification on Node `v24.19.0` and npm `11.17.0`:

- clean `npm ci`: passed;
- `npm run validate`: passed;
- Vitest: 418 passed across 50 files;
- TypeScript: passed;
- ESLint: zero errors, 20 existing warnings;
- resource, roadmap, project, assessment, and MCP validation: passed;
- production build: passed, 47 static pages generated;
- Playwright: 161 passed, 9 intentionally skipped, across Chromium, Firefox,
  WebKit, and the mobile Chromium subset;
- `npm audit --audit-level=high`: passed;
- focused regeneration safety suite: 13 passed;
- core-only roadmap oracle: 350 occurrences, 32,595 minutes, 55 weeks;
- core-only plus Why Transformers Add back: 351 occurrences, 32,640 minutes,
  55 weeks.

Hosted GitHub Actions and the Vercel preview attached to the final hotfix pull
request remain the authoritative release evidence. Require `audit`, `validate`,
`e2e`, and the Vercel deployment check before approving a merge.

## Deployment procedure

1. Create a short-lived branch from current `origin/main`.
2. Run `npm ci`, `npm run validate`, `npm run build`, `npm run test:e2e`, and
   `npm audit --audit-level=high` against isolated local infrastructure.
3. Push the branch and open a pull request against `main`.
4. Require green hosted `audit`, `validate`, `e2e`, and Vercel preview checks.
5. Perform read-only preview smoke checks. Do not copy production credentials or
   use a production user in a preview environment.
6. Obtain owner approval, merge through GitHub, and allow the connected Vercel
   project to deploy `main`. Do not deploy manually in the normal release path.
7. Verify `/api/health/live`, `/api/health/ready`, `/api/version`, OAuth,
   dashboard, curriculum, settings, roadmap, service worker v3, and application
   errors.
8. Use the dedicated disposable account for read-only roadmap/data checks.
   Production regeneration always requires separate explicit authorization.

## Hotfix production acceptance

Use the shortest safe sequence:

1. Record the production deployment ID, Git SHA, Node 24 runtime, and alias.
2. Run health/version and authenticated read-only page checks.
3. Run the existing regeneration harness in `--observe-preview` mode. It blocks
   roadmap/queue IndexedDB writes and all non-read production requests.
4. Require the exact test-account V1 state/plan hashes, two progress records,
   one note, and empty Device A/Device B queues to remain unchanged.
5. Require the corrected preview to show four core capstones, zero optional
   selections, zero added prerequisites, 350 occurrences, 32,595 minutes, and
   55 weeks.
6. Stop. Request a separate authorization before the one controlled
   regeneration and final sync/cross-device restoration test.

Never use or modify the primary account.

The authenticated production harness and its dedicated browser profiles are
local operator artifacts and are intentionally not committed. Preserve them in
the authorized operator workspace; never copy profile data, cookies, or tokens
into Git.

## Rollback

The hotfix changes no database schema, synchronization format, roadmap schema,
or persisted record. Its immediate rollback target is the current Roadmap V2
production baseline:

- Git commit: `5c396fd5b098607d61986adfdcaa071ea5ca807f`
- Vercel deployment: `dpl_9t7gE7fAgdT8ouG2ZtkGPndPvnkg`

For a serious regression:

1. Stop further release actions and capture deployment/request IDs and the
   sanitized symptom.
2. Use Vercel's supported rollback to the known-good deployment. Do not rebuild,
   migrate, restore, or delete user data.
3. Revert the hotfix merge commit with a normal Git revert; never reset or
   force-push `main`.
4. Recheck health, OAuth, service worker, V1/V2 roadmap readability, progress,
   notes, queue state, and local/server hashes.

Existing V1 and V2 roadmap records remain compatible with the rollback target.
Prefer a forward fix if later code introduces a new persisted schema version.

## Known noncritical limitations

- The repository has one maintainer, so independent approval may be unavailable.
  Keep a documented owner-review exception and require every automated check.
- Vercel runtime-log aggregation and project inspection require renewed team
  authorization for the connected Vercel MCP account; browser and GitHub status
  evidence do not replace platform-wide log inspection.
- `npm audit` currently reports 12 moderate advisories in development tooling.
  Available automatic fixes require breaking dependency changes; the hosted
  high-severity gate passes. Reassess during scheduled dependency maintenance.
- ESLint reports 20 existing warnings and no errors. They are maintenance debt,
  not hotfix blockers.
- Next.js reports that the `middleware` filename convention is deprecated in
  favor of `proxy`; migration is optional maintenance and was intentionally not
  mixed into the hotfix.
- Historical release reports are evidence snapshots and may describe older
  deployments, test counts, or pre-hotfix preview values.

## Maintenance and troubleshooting

- Start with `/api/health/live`, `/api/health/ready`, `/api/version`, the GitHub
  workflow run, and Vercel deployment/build logs.
- For sync incidents, capture account ID, device ID, queue rows, mutation IDs,
  acknowledgement/conflict response, and local/server fingerprints. Do not
  clear IndexedDB or delete server records during diagnosis.
- For roadmap incidents, reproduce with deterministic settings through
  `calculateCapstonePreview`/the scheduler tests before touching production.
  Never change correct scheduler behavior to match a UI assertion.
- For OAuth incidents, verify provider configuration, callback URL, `AUTH_URL`,
  `AUTH_TRUST_HOST`, and deployment protection without capturing credentials,
  codes, cookies, or tokens.
- For offline incidents, verify `ai-engineer-shell-v3`, service-worker scope,
  cache purge behavior, and that private/auth/API responses are not cached.
- Keep the curriculum pinned by SHA. Validate metadata and imports in an
  isolated database before changing the pin.
- Preserve production data by default. Account deletion, roadmap reset,
  regeneration, migrations, and rollback are explicit operations requiring
  their own approval and evidence.

Release blockers are failed correctness/security/build checks, data-format
incompatibility, unsafe preview configuration, or inability to identify a
rollback target. The noncritical limitations above are scheduled maintenance,
not reasons to reopen feature development.
