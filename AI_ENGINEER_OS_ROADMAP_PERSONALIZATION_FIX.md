# AI Engineer OS — Knowledge-Aware Roadmap Personalization Fix

**Final local verification:** 2026-11-01
**Mission:** Respect declared learner knowledge across the curriculum without over-crediting partial or parent-topic knowledge.
**State:** Implemented and verified locally; Mission B remains uncommitted. No deployment or production-data change was performed.

## Verdict

**MISSION B: PASS.** The initial known-topic data-flow defect and the later-phase placement defect are fixed. Persistence, regeneration, prerequisites, manual re-inclusion, duration recalculation, and browser behavior are verified.

## Root causes

### Known knowledge was dropped before scheduling

`recommendPlacement()` produced `skimOccurrenceIds`, but onboarding generation did not carry those IDs through settings into `SchedulerInput`. The placement summary could say content was safe to skip while the generated plan still scheduled it.

The fix threads `knownOccurrenceIds` through onboarding, `RoadmapSettings`, store generation, scheduler input, persistence, and rescheduling. The scheduler excludes known occurrence IDs, records a human-readable reason, treats known prerequisites as satisfied, and lets an explicit manual include win.

### Explicit later-phase knowledge was phase-limited

Placement then had a second defect: the same phase boundary used for inferred proficiency also restricted explicitly selected known topics. A Phase 0 learner who explicitly selected Transformers and Attention therefore never passed matching Phase 7 IDs to the scheduler.

The smallest correct architectural change was to separate two concepts in placement:

- **Inferred proficiency:** remains phase-bounded and conservative.
- **Explicit knowledge:** can match the entire curriculum before the phase boundary is applied.

`explicitlyKnownAcrossCurriculum()` now accepts exact skill coverage anywhere in the curriculum. Phase introductions may also be covered when every phase gate skill is explicitly known, even if the introduction carries a historical prerequisite tag. Project/capstone work is never auto-skipped. Parent-source expansion is deliberately not used for this global explicit-knowledge path, so knowing `transformers` does not imply pretraining, inference optimization, vision, audio, or every advanced transformer topic. The former 60-item truncation was removed.

## Required regression scenario

For a General AI learner placed in Phase 0 who explicitly declares Transformers and Attention:

- `07-transformers-deep-dive/01-why-transformers` is included in `skimOccurrenceIds` and excluded from scheduled work.
- The skipped entry records `You already know this — kept out of your plan.`
- Unrelated later work remains scheduled.
- Advanced transformer work with additional unknown skills, including KV-cache/Flash Attention and Scaling Laws, remains scheduled.
- The transformer capstone remains scheduled.
- A dependent advanced topic retains its unknown prerequisite.
- `plan.summary.totalMinutes` is lower than the baseline.
- A manual include restores the known occurrence.
- Repeated placement is deterministic.

## Data flow

```text
LearnerProfile.knownTopicSkillIds
  -> recommendPlacement().skimOccurrenceIds
  -> onboarding generate({ knownOccurrenceIds })
  -> RoadmapSettings (persisted, default [])
  -> store.generateForSettings()
  -> SchedulerInput.knownOccurrenceIds
  -> selectOccurrences()
  -> plan items + explained skipped entries + recomputed duration
```

Rescheduling passes the persisted known IDs back into generation. Settings edits and track changes preserve the field unless explicitly replaced. Existing completion/mastery records and saved plan history are not rewritten.

## Selection invariants

- Canonical occurrence IDs are used; no title/slug fuzzy matching was added.
- Aliases remain governed by existing canonical deduplication.
- Known content is excluded only from the personalized plan, not from the curriculum catalog or progress records.
- Manual re-inclusion overrides knowledge exclusion.
- Known prerequisites count as satisfied and are not force-added.
- Unknown prerequisites continue through normal closure and ordering.
- Exact inputs produce exact deterministic outputs.
- Duration is recomputed from surviving items; no filler is invented.
- The additive Zod setting defaults to `[]`, so old persisted stores require no migration.

## Exact Mission B file boundary

The authoritative reviewed list is in [`AI_ENGINEER_OS_MISSION_B_RELEASE_MANIFEST.md`](AI_ENGINEER_OS_MISSION_B_RELEASE_MANIFEST.md).

Implementation and tests:

- `src/lib/roadmap/placement.ts`
- `src/lib/roadmap/scheduler.ts`
- `src/lib/roadmap/types.ts`
- `src/lib/roadmap/store.ts`
- `src/lib/roadmap/rescheduler.ts`
- `src/components/roadmap/onboarding-wizard.tsx`
- `src/test/roadmap-scheduler.test.ts`
- `src/test/roadmap-persistence.test.ts`
- `src/test/roadmap-reschedule.test.ts`
- `src/test/roadmap-known-later-phase.test.ts`
- `e2e/roadmap-personalization.spec.ts`

## Verification

| Gate | Final result |
| --- | --- |
| Focused roadmap matrix | **38/38 passed** |
| Full Vitest | **393/393 passed**, 47 files |
| Roadmap personalization E2E | **Passed** on Chromium, Firefox, and WebKit inside the full matrix |
| Full Playwright | **157 passed / 0 failed / 9 skipped** |
| TypeScript | **PASS**, 0 errors |
| ESLint | **PASS**, 0 errors / 20 warnings |
| Production build | **PASS** |

The later-phase regression file contains three high-value scenarios: corrected Phase 7 exclusion/duration, partial-and-advanced knowledge protection, and deterministic manual re-inclusion. Existing scheduler and persistence suites supply the equivalent known-prerequisite, regeneration, reload, and reschedule coverage.

## Release dependencies and separation

- Mission B is currently a clean roadmap-only dirty diff plus its report/spec files.
- It has no source-file overlap with Mission A commit `de1a32e`.
- `e2e/roadmap-personalization.spec.ts` uses helpers already present at HEAD.
- No database schema, auth, sync, service-worker, curriculum JSON, or public README change belongs in Mission B.
- Scratch diagnostics, browser storage, secrets, logs, and test results are excluded.

## Remaining limitations

- Declared knowledge is a planning optimization, not a mastery credential.
- Conservative exact-skill matching can leave a lesson scheduled when metadata includes an additional unknown advanced skill; this is intentional.
- If a learner overstates knowledge, the content remains available in the catalog and can be manually re-included.
- Existing ESLint warnings and responsive duplicate DOM are outside Mission B.

## Rollback

Revert the Mission B file set. The optional persisted `knownOccurrenceIds` field defaults to an empty array and can remain in old stores harmlessly. No data cleanup or schema rollback is needed; completion and mastery records are untouched.

## Production smoke-test plan

After a separately approved commit and deployment:

1. Start onboarding as a Phase 0 General AI learner.
2. select Transformers and Attention as known.
3. Generate the roadmap and verify covered Phase 7 introductions are absent with explained skipped entries.
4. Verify KV-cache/Flash Attention, Scaling Laws, the capstone, and unrelated later topics remain.
5. Compare total duration with the no-known-topic baseline.
6. Manually re-include one known lesson and regenerate.
7. Reload, change capacity, reschedule, and confirm the known set persists without altering completion history.

## Approval recommendation

**Recommend separate approval for Mission B.** The implementation is uncommitted, fully verified, migration-free, and isolated from Mission A.
