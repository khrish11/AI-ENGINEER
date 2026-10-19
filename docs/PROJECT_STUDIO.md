# Phase 6 — Project Studio

The Project Studio turns AI Engineer OS from a learning tracker into a proof-of-work
training platform. Completion of a project always requires real milestone work plus
attached evidence — opening a page is never enough.

## 1. Project schema

Every project is a declarative JSON file under `projects/catalog/<phase-slug>/`,
validated with Zod at load time (`src/lib/projects/schema.ts`) and cross-referenced
against the curriculum by `npm run projects:validate`:

```text
projects/catalog/
  00-setup-and-tooling/*.json        # one to many files per phase
  01-math-foundations/...
  ...
  19-capstone-projects/...           # 5 capstones
```

Definition fields (see the schema for the full contract):

- `id` (`proj-*`), `slug`, `title`, `description`
- `level`: `beginner | intermediate | advanced | capstone`
- `source`: `upstream | platform | community` (attribution-safe; `sourceUrl` required for upstream/community)
- `estimatedHours`, `phaseSlugs`, `associatedOccurrences`, `associatedCanonicalLessons`
- `skills` (Phase 5 taxonomy ids), `prerequisites` (project ids)
- `learningObjectives`, `deliverables`, `milestones`, `rubric`
- `suggestedStack`, `starterRepo`, `referenceResources`, `buildGuide`
- `requiredEvidence`, `status` (`active | draft | deprecated`), `relevantTracks`, `hasStarterTemplate`

Contributors add a project by dropping a JSON file in the right phase folder and
running `npm run projects:validate`. The runtime catalog re-validates on load; an
invalid definition fails the build loudly instead of silently shipping.

Validation enforces (among others):

- milestone ids unique; each milestone `requiredEvidence` id resolves to a project evidence requirement
- rubric category weights total exactly 100; non-beginner levels require a rubric
- phase slugs and occurrences exist in the curriculum; skill ids exist in the taxonomy; track ids exist in the track config
- URLs are https (localhost http allowed for development); secret-pattern scan on definitions

## 2. Milestones

Each milestone carries `id`, `title`, `objective`, `expectedOutput`,
`requiredEvidence` (evidence-requirement ids), `estimatedMinutes`, and
`required`. Progress persistence reuses the Phase 4 `project_progress` store
(both IndexedDB and PostgreSQL), so milestone completion is local-first and
synced. The UI `Mark complete` control stays disabled until every required
evidence kind the milestone references exists in the project-wide evidence set.

## 3. Deliverables and evidence

Deliverables (§7 spec) describe the *work artifacts* a project expects. Evidence
(§8) is what the learner attaches: `github_repo_url`, `pull_request_url`,
`commit_url`, `deployment_url`, `documentation_url`, `screenshot`,
`markdown_reflection`, `evaluation_result`, `test_result`, `benchmark_report`,
`notebook`, `repository_directory`.

- Evidence is stored locally (`projectEvidence` Dexie table) and synced to
  PostgreSQL (`project_evidence`).
- Every record carries `selfReported: true`. **Evidence is never labelled
  externally verified** — Phase 7 may add verified integrations, and that must
  be an explicit, opt-in flag.
- URL attachment validates protocols: `https:` always; `http:` only for
  localhost/127.0.0.1. Non-link kinds (reflections, benchmark results) may store
  plain text but reject scheme-like prefixes (`javascript:`, `data:`, `file:`),
  raw `<`/`>`, and oversized values.
- GitHub submissions validate repository/PR URL shapes and commit SHA format.
  Metadata inspection (name/description/branch/license) may be displayed when
  retrievable, but no claim about code quality is ever derived from repository
  existence, stars, or forks.

Privacy (spec §53): evidence is private by default. Nothing — GitHub URLs, demo
links, notes, self-evaluations — is ever published automatically; Phase 7 will
require explicit learner opt-in per item.

## 4. GitHub project submission

The evidence form accepts repository URL plus optional branch, commit SHA, PR
URL, and relevant directory. All fields are format-validated client-side
(`validateGithubSubmission`) and normalized before persistence. The server never
clones, fetches, or runs any referenced code.

## 5. Rubrics and self-assessment

Every intermediate/advanced/capstone project ships a rubric: 2-10 categories with
weights summing to 100, criteria, minimum and excellent expectations, plus
`completionThreshold` and `masteryThreshold`. Learners score themselves 0..weight
per category.

- Scores are clamped into range at persistence time, not trusted raw.
- The persisted summary stores `totalEarned`/`totalMax`; the UI always labels
  the result **"Self-assessed"** — never external certification.
- Merge semantics are additive: import/sync merges keep the learner's best
  self-assessed score per category (scores never silently shrink).

## 6. Completion rules

Status is computed by the pure function `computeProjectStatus`
(`src/lib/projects/completion.ts`) from persisted inputs only:

```
not_started → in_progress → submitted → completed → mastered
```

- `submitted` requires: every required milestone complete (and each of its
  required evidence kinds covered project-wide), every required project-level
  evidence kind provided, and (with a rubric) every category self-assessed.
- `completed` additionally requires the rubric total ≥ `completionThreshold`
  (no-rubric beginner projects complete on milestones + evidence alone).
- `mastered` additionally requires the rubric total ≥ `masteryThreshold` and,
  for advanced/capstone projects, a `markdown_reflection` evidence entry.

## 7. Prerequisites & capstones

`auditPrerequisites` deterministically splits a project's `prerequisites` into
completed vs missing against the learner's project statuses. Capstones surface
missing prerequisites in the catalog; starting remains possible (advisory, not a
block) but the UI nudges ordering.

## 8. Code-execution boundary

The platform **never executes learner-submitted code**. No cloning and running
repositories, no shell from submissions, no uploaded-Python/JS execution, no
arbitrary Dockerfiles. Project evaluation uses only: learner evidence,
deterministic milestone/rubric checks, assessment scores, safe URL validation,
and metadata display. The documented `ProjectEvaluator` contract
(`src/lib/projects/evaluator.ts`) ships with the safe `metadata` evaluator
(`MetadataProjectEvaluator`) that re-runs the deterministic completion checks
over structured evidence only; an `isolated` external-CI evaluator may slot in
later without changing the contract. See SECURITY.md for the boundary details.

## 9. Where things live

```text
src/lib/projects/          schema, catalog, completion, rubric, evidence, validation
src/lib/progress/repositories/project-evidence.ts | project-self-assessment.ts
src/hooks/                 useProjectProgress, useProjectEvidence, useProjectSelfAssessment
src/components/projects/   project-workspace.tsx (milestones, evidence, rubric, status)
src/app/projects/          catalog + [projectSlug] workspace pages
src/scripts/               projects-validate.ts, projects-coverage.ts (reports/project-coverage.{json,md})
```
