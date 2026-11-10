# Changelog

## 0.1.0

Initial release candidate.

- 20-phase MIT-licensed AI engineering curriculum with 542 distinct lesson identities.
- 152 curated learning resources and 24 project-workspace entries.
- Offline Guest Mode with IndexedDB progress and versioned JSON export/import.
- Optional Auth.js GitHub/Google authentication and PostgreSQL synchronization.
- Deterministic roadmap planning with seven career tracks.
- Interactive assessments, project evidence, analytics, and privacy-reviewed public portfolios.
- Read-only local MCP adapter for curriculum and learner-context tools.
- Contributor validation, CI workflows, Docker self-hosting, health checks, security headers,
  identity migrations, and backup/recovery guidance.

Known limitations:

- Cloud account deletion removes application-owned data, but does not delete the learner's external
  OAuth provider account.
- OAuth E2E checks require maintainer-provided credentials.
- Runtime dependency advisories remain for Auth.js, PostCSS/Next.js, and the KaTeX dependency
  chain; see the release audit report.
