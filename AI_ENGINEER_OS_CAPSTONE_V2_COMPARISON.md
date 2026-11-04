# Capstone V1 vs V2 Comparison

All figures use the General AI track, 10 hours per week, no target date, no buffer weeks, no completed or known lessons, and the real scheduler.

| Scenario | Total lessons | Total minutes | Weeks | Phase 19 nodes | Phase 19 minutes |
| --- | ---: | ---: | ---: | ---: | ---: |
| Legacy V1 (missing selection field) | 441 | 63,615 | 107 | 85 | 37,620 |
| V2 required baseline | 360 | 33,195 | 56 | 4 | 7,200 |
| V2 + Real-Time Voice Assistant | 361 | 34,995 | 59 | 5 | 9,000 |
| V2 + Advanced RAG bundle | 376 | 34,635 | 58 | 20 | 8,640 |

The Advanced RAG result contains six selected RAG lessons plus the ten-lesson agent-harness prerequisite track and the four required projects. It does not pull unrelated evaluation, distributed-training, or safety tracks.

Compared with V1, the default V2 plan removes 81 unselected Phase 19 nodes and 30,420 minutes of capstone workload. Existing stored settings without `capstoneSelection` retain the V1 result exactly by design.
