# Phase 6 — Assessment Engine

Interactive assessments complement the existing lesson quizzes. Checkpoints are
declarative JSON under `assessments/catalog/` and validated at load:

```text
assessments/catalog/
  checkpoint-02-ml-fundamentals.json
  checkpoint-07-transformers.json
  checkpoint-11-llm-engineering.json
  checkpoint-14-agent-engineering.json
  checkpoint-17-infrastructure.json
```

## 1. Assessment schema

`src/lib/assessments/schema.ts` (Zod):

- `id`, `title`, `kind`: `pre_assessment | lesson_quiz | phase_checkpoint | project_assessment | cumulative_review`
- `phaseSlug`, `description`, `passThreshold` (0..1, default 0.7), `status`
- `questions[]`, each with: `id`, `type`, `prompt`, `explanation`, `points`,
  `lessonRefs` (curriculum occurrences), `skills` (Phase 5 taxonomy ids), and
  type-specific answer keys.

## 2. Question types

| type | answer key | grading |
| --- | --- | --- |
| `single_choice` | `options` + `correctOptionIndex` | exact |
| `multiple_choice` | `correctOptionIndices` | order-insensitive set equality |
| `true_false` | `correctBoolean` | boolean equality (0/1 or true/false accepted) |
| `ordering` | `correctOrder` (permutation of option indices) | exact sequence |
| `short_answer` | `selfCheck` rubric (`criteria`, `fullPoints`, `partialPoints`, `guidance`) | self-checked — the learner marks which criteria they met; never AI-graded |

Invalid answer shapes never crash the grader and never earn points; they are
marked `invalid`, and any invalid submission cannot pass.

## 3. Attempts are immutable (§22)

Platform assessments persist into the Phase 4 `quiz_attempts` registry. Each
submission creates a **new** attempt row (`attemptId = <assessmentId>#<n>`,
monotonic `attemptNumber`). Past attempts are never mutated — review history is
trustworthy.

## 4. Scoring (§23)

`scoreAssessment` sums per-question earned/possible percentages using points.
`passed = percentage >= passThreshold * 100`. An attempt with any invalid answer
has `percentage = null` and fails.

## 5. Skill mastery evidence (§26)

`computeMasteryEvidence(skillId, lessonEvidence, assessmentEvidence, projectEvidence)`
combines three documented, capped inputs:

```
lessonPoints     = min(1, completedLessons / max(totalLessons, 1)) × 0.4
assessmentPoints = recentAverage == null ? 0 : (recentAverage/100) × 0.4
projectPoints    = totalProjects == 0 ? 0 : (completedProjects/totalProjects) × 0.2
score            = round(100 × (lessonPoints + assessmentPoints + projectPoints))
```

Bands: `< 50` developing · `50–74` proficient · `>= 75` strong.
No single source can create mastery by itself (each is capped: lessons 40,
assessments 40, projects 20). Labels report each contributing source.

## 6. Weak-skill detection (§28)

`weakSkillIds` (`src/lib/assessments/weak-skills.ts`) is deterministic:

- weak when the latest `WEAK_ATTEMPT_WINDOW` (3) valid attempts touching the
  skill average below `WEAK_AVERAGE_THRESHOLD` (70), **or**
- the skill was answered incorrectly in ≥ `REPEAT_INCORRECT_THRESHOLD` (2)
  separate attempts.

Never-submitted attempts contribute nothing. One isolated mistake is never a
flag. Per-question correctness is computed via the real scorer, so skills are
only marked incorrect when a question touching them was actually wrong.

## 7. Review recommendations (§29)

`reviewRecommendations` produces at most 5 items, ordered by reason:
`weak_average` (with the measured recent average), `repeated_incorrect` (with
the count), and `stale` (skill not assessed for > 45 days when the learner has
review history). The `/practice` surface feeds weak skills back to the learner;
roadmap integration can consume the same list.

## 8. Privacy roadmap

Assessments sync through the Phase 4 sync engine (`quiz_attempt` entity type) to
the learner's own account only. Nothing assessment-related is published; the
public-portfolio path in Phase 7 stays opt-in per item.

## 9. Where things live

```text
src/lib/assessments/        schema, catalog, scoring, attempts, mastery, weak-skills, validation
src/app/practice/page.tsx   checkpoint browser + runner (keyboard accessible)
src/scripts/assessments-validate.ts
```
