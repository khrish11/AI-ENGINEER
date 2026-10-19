# Production Checklist

- [ ] Set and validate production environment variables.
- [ ] Back up PostgreSQL and apply migrations in an isolated verification database.
- [ ] Run `npm run db:audit`.
- [ ] Verify `/api/health/live` and `/api/health/ready`.
- [ ] Run typecheck, lint, unit tests, validators, build, and Playwright.
- [ ] Run dependency and secret scans.
- [ ] Verify public portfolio privacy and MCP privacy regressions.
- [ ] Confirm backup restore and learner export/import.
- [ ] Confirm account-deletion requirements are implemented or block release.
- [ ] Confirm OAuth credentials are supplied only through the deployment secret manager.
