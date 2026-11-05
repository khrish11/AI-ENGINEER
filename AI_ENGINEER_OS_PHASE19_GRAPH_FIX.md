# Phase 19 Dependency Graph Fix

## Result

Phase 19 no longer inherits the generic rule that every lesson depends on the previous numeric lesson. Its capstones are modeled as choices and its deep-build dependencies now follow the prerequisite declarations in the upstream English lesson documents.

## Evidence

- Authoritative upstream statement: `phases/19-capstone-projects/README.md` says projects are choices, not a required numeric sequence.
- Phase 19 contains 85 occurrences: 17 standalone products and 68 deep-build lessons.
- Before the fix, metadata contained 84 internal edges: one artificial chain from project 01 through lesson 87.
- After the fix, the 17 standalone products have zero capstone-to-capstone prerequisites.
- The corrected graph has 247 documented direct internal edges and 23 roots. The larger direct-edge count is intentional: prerequisite ranges such as “lessons 42–49” are represented explicitly instead of being approximated by one previous-number edge.
- Examples:
  - Agent verification lesson 25 directly requires lessons 20–24.
  - Research lessons 50–53 require the completed agent-harness track, represented by lesson 29.
  - Multimodal lessons 58–62 require the language-model foundation through lesson 37.
  - Distributed-training lessons 76–81 require lessons 42–49 and do not depend on the unrelated evaluation lesson 75.

## Compatibility

Only `19-capstone-projects` opts out of implicit sequencing. The existing sequence behavior for phases 00–18 is unchanged. Existing occurrence IDs, canonical lesson keys, progress records, durations, and track importance classifications are unchanged.

## Verification

- Metadata regenerated from the active local curriculum database: 542 occurrences, 20 phases, 0 fallback estimates.
- Targeted graph and metadata tests: 18 passed.
- `npm run roadmap:validate`: passed with no errors.
- Graph validation: no cycles, missing prerequisites, or duplicate occurrences.
