# Contributor Guide

## Boundaries

Structured curriculum, resources, projects, assessments, and career-track data are declarative contributions. The corresponding validators are the source of truth; do not bypass them with ad hoc runtime defaults.

Frontend, sync, analytics, portfolio, and MCP changes must preserve domain ownership and privacy boundaries. MCP is an adapter, not a second business-logic layer.

## Contribution workflow

1. Create a focused branch.
2. Change the smallest relevant catalog, source, or documentation file.
3. Preserve attribution and do not include secrets or private learner data.
4. Run `npm run validate`.
5. Run the focused validator and tests for the changed domain.
6. Describe verification and privacy impact in the pull request.

Resource contributions remain `pending_review` until maintainers verify the URL, attribution, license, lesson mapping, and educational relevance.

## Good first issues

Good beginner work includes adding a verified resource, improving a project explanation, adding assessment explanations, improving skill mappings, and correcting documentation. Database migrations, auth, sync, privacy serializers, and MCP policy changes require maintainer review.
