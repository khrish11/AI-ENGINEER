# Maintainer Guide

- Review resource URLs, attribution, licenses, lesson mappings, and editorial status before approval.
- Require project rubrics to validate to 100 and assessment answer keys to remain deterministic.
- Treat migrations, authentication, sync, portfolio serialization, and MCP policy changes as security-sensitive.
- Require the full release gate: typecheck, lint, unit tests, validators, MCP validation, build, Playwright, privacy regression, migration review, and clean Git state.
- Approve new MCP tools only when their policy, schema, response size, privacy behavior, and tests are explicit.
- Document breaking changes and update the adapter manifest when MCP capabilities change.
