# Architecture Overview

AI Engineer OS separates declarative learning content, domain services, local
learner persistence, authenticated synchronization, and presentation.

- `src/lib/curriculum`, `resources`, `projects`, and `assessments` own catalog
  rules and validation.
- `src/lib/roadmap`, `analytics`, and `portfolio` own deterministic domain
  behavior.
- Dexie owns guest/local progress; PostgreSQL and Auth.js own optional
  authenticated sync.
- `src/mcp` is an adapter over public services and explicitly supplied local
  learner context. It does not become a second domain layer.

Changes should call an existing service rather than duplicating its rules.
