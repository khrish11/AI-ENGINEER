# Learning Analytics (Phase 7)

Analytics derive every metric from stored learner records — never from sampled
or invented data. There are no placeholder numbers, fake streaks, or staged
achievements.

## Metric definitions

| Metric | Definition | Source |
| --- | --- | --- |
| Lessons completed / mastered | Canonical lesson identities (`lessonProgress.lessonId`) with status completed / mastered; duplicates across occurrences count ONCE. | `lessonProgress` |
| Curriculum progress | Occurrence counts (542 occurrences / 541 canonical identities). Phase-level displays use OCCURRENCES; learner completion totals use CANONICAL identities so the shared Vision-Transformer identity is never double-counted. | `roadmap/config occurrences` + `lessonProgress` |
| Study time | Sum of valid, immutable study-session durations. Sessions shorter than 60 s, with negative/invalid durations or duplicate `clientSessionId`s are excluded. Page-open duration is never counted. | `studySessions` |
| Study days | Calendar days in the learner timezone containing at least one valid session ≥ 10 minutes (STREAK_MIN_SESSION_MINUTES in `analytics/types.ts`). | `studySessions` |
| Current/longest streak | Longest consecutive run of study days; "current" walks back from today, and today without a qualifying session falls back to yesterday only. Timezone is explicit and identical for both. | `studySessions` |
| Roadmap pace | Expected share (elapsed study weeks / total study weeks) vs. actual share (completed/scheduled occurrences). Statuses: ahead (≥ +10%), on_track (±10%), slightly_behind (−10…−30%), significantly_behind (≥ −30%). Never worded judgementally. | `roadmapState` + `studySessions` |
| Projected completion | Deterministic: remaining plan hours ÷ observed 28-day average weekly hours (fallback: planned capacity). Shows its assumptions inline or "Not enough activity to estimate reliably." | `roadmapState` + `studySessions` |
| Skill evidence | Lesson mastery (canonical dedupe), valid assessment attempts mapped to the skill, completed project milestone evidence, spaced-review history. | All of the above + `reviewHistory` |
| Mastery bands | Documented Phase 6 weights: lessons 0.4, assessments 0.4, projects 0.2 → developing < 50, proficient 50–74, strong ≥ 75. Evidence components are always displayed separately. | Phase 6 model |
| Evidence coverage | LOW / MEDIUM / HIGH from how many of the three evidence sources exist. Named "evidence coverage", never "confidence" (it is not a statistical confidence). | derived |
| Weak skills | Latest 3 valid attempts averaging < 70 %, or the same skill answered incorrectly in ≥ 2 attempts. A single wrong answer never marks a skill weak. | `quizAttempts` |
| Achievements | Real events only, with earliest earned timestamp derived from source records: first lesson, first phase, first 10 study hours, first project milestone, first project completed, first capstone, first assessment improvement. Not manually creatable; fully reconstructable. | all learner records |

## Review engine

`src/lib/analytics/review.ts` builds a deterministic, bounded queue (max 8).

Priority factors: prerequisite load (planned lessons depending on the skill),
repeated assessment weakness, active-project dependency, overdue spaced review,
learner "Review later" flags. Each item answers **"Why review this now?"** with
the concrete signals (e.g. *"Latest attempts average 48% (below the 70% review
threshold)"*).

Spaced schedule (centralized in `REVIEW_INTERVALS_DAYS`): 3 → 7 → 21 → 45 days,
adjustable by review success and snoozeable ("Snooze 7 days" persists to
`reviewHistory`).

## Period filters

7 days / 30 days / 90 days / 1 year / All time. Filters slice reads only —
source records are never mutated. All day-bucketing is timezone-aware through
`Intl.DateTimeFormat` with the learner timezone (UTC default).

## Architecture

```
src/lib/analytics/     pure, deterministic metrics (no React, no I/O)
src/hooks/useAnalytics.ts  loads records (Dexie) once and memoizes derivations
src/app/analytics/     UI shell; sections: Overview, Learning activity,
                       Skills, Roadmap, Projects, Assessments, Review,
                       Achievements
```

Charts are lightweight HTML/CSS with `role="img"` labels and `figcaption`
alternatives — keyboard accessible, and every chart has a data summary.

Empty states never fake data: "Complete your first lesson to begin building
your learning history", "No study sessions recorded yet", etc.

## Scale & performance (§54/§55/§58)

`npx tsx src/scripts/benchmark-analytics.ts` on a synthetic dataset
(500 lessons · 1,000 resource interactions · 5,000 sessions · 1,000 attempts ·
100 milestones) measures, per module:

- overview ≈ 116 ms, assessments ≈ 107 ms, skills ≈ 72 ms, review queue ≈ 49 ms
- portfolio serialization ≈ 0.2 ms
- slowest single operation: overview (~116 ms)

Individual derivations target < 200 ms; the whole-aggregate figure above is for
a dataset deliberately larger than typical learner histories. Values are
measured by the script — do not quote numbers without rerunning it.

## Validation (§45)

Impossible metrics fail loudly via `analytics/validation.ts`: completed > total,
mastered > completed, negative durations, invalid/backwards timestamps,
milestones completed > project milestone count, rubric scores outside 0..weight.

## Data deletion (§43)

Analytics are derived live from records. Resetting learning data empties every
derived metric and publicly referenced evidence disappears from the portfolio
(public views re-read stored data when rendered).
