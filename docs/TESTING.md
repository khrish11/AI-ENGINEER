# Testing

Use the smallest relevant gate while developing:

- `npm run resources:validate` for resource records
- `npm run roadmap:validate` for roadmap metadata
- `npm run projects:validate` for projects
- `npm run assessments:validate` for assessments
- `npm run mcp:validate` for MCP registry and manifest drift
- `npx vitest run <file>` for focused behavior

Run `npm run validate` before a pull request. Run `npm run validate:full` for
the build and Playwright gate. OAuth-dependent browser tests may skip when
credentials are not configured, but unrelated failures are not acceptable.
