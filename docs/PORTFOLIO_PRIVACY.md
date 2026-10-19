# Portfolio Privacy (Phase 7)

The public portfolio (`/portfolio/[username]`) is **opt-in**. Every field is
private until the learner explicitly publishes it.

## Public/private boundaries (default: PRIVATE)

Permanently private (never serializable to the public view): email, OAuth
provider ids, internal user UUIDs, notes, quiz answers, attempt history,
raw study sessions, device identifiers, sync conflicts, weakness signals,
bookmark/conflict records.

Publication toggles (all default OFF): career track, skills, projects,
achievements, curriculum progress, study-time totals, assessment summary.
Additional switches: expose self-assessed rubric scores, expose repository/demo
links.

## Publication model (§26)

Portfolio tables store publication CONFIGURATION only — progress data is read
live at render time, so data deletion instantly empties the public view.
`portfolio_profiles` holds: `published`, `username`, `displayName`, `bio`,
`publicity` JSONB (visibility map, selected project/evidence/achievement/skill
ids, career track).

- An unpublished or disabled portfolio returns **404** from the public route and
  page; metadata never leaks existence (§31).
- Guests keep a local Dexie draft only and can never publish (§34).
- A slug is required to publish: lowercase, 3–40 chars, `[a-z0-9_-]`, reserved
  names blocked (`admin`, `portfolio`, `settings`, …), unique across users.
- Publishing/unpublishing is a server API (`/api/portfolio/settings`) that
  derives the learner identity from the Auth.js session; arbitrary user ids are
  never accepted, and slug availability is checked server-side
  (`/api/portfolio/slug`).

## Evidence provenance (§29/§30)

Evidence items carry provenance and precise labels:

- `learner-submitted` (current default for everything) — displayed as
  "Learner-submitted"
- `platform-derived`
- `externally verified` — never used today; if a GitHub integration later
  confirms repository ownership it would be labelled specifically, e.g.
  "GitHub metadata verified", and never as code-quality certification

Project labels used today: Self-reported, Self-assessed, Repository linked,
Platform completion criteria met. Prohibited labels: Certified, Verified
engineer, Industry verified — no certification infrastructure exists.

Self-assessed rubric scores render with the wording
"Self-assessed rubric score (learner-entered, not a verified grade)" and appear
publicly only with the explicit toggle.

## Project descriptions (§33)

Published descriptions may use the real catalog description or a learner-written
summary. Claims about production users, revenue, or scale are not synthesized;
only what the learner enters and supports with evidence is shown.

## Export (§32)

`/api/portfolio/export` (authenticated) returns structured JSON of the
publication settings plus the exact public view that would be rendered. No
fabricated resume claims are generated.

## Public serializer security (§44/§48)

`src/lib/portfolio/public-view.ts` is an **allow-list** serializer: private data
cannot reach the public object except through explicit, per-section gates. It is
covered by a required regression gate
(`src/test/portfolio-privacy.test.ts`) that feeds every private record kind into
the inputs — email, provider ids, internal user ids, note content, quiz
answers, device ids, conflict content, unpublished evidence — and asserts none
of them or their identifiers appear in the serialized output. The gate also
asserts `published` state itself is not part of the output and that deleted
evidence is filtered out at build time even if referenced.

## Data deletion (§43)

Because the public view reads live records, deleting learning data (including
evidence) makes the derived public content disappear on the next render; a
public element whose source record was deleted is hidden safely, never shown
stale.
