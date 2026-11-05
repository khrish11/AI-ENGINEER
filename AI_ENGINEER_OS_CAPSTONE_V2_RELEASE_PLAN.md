# Capstone V2 Release Plan

## Preconditions

- Review the two local commits independently: graph correction first, V2 selection/UI second.
- Confirm CI repeats typecheck, unit tests, build, and Playwright coverage.
- Do not migrate or rewrite saved roadmap records. The optional settings field is the compatibility mechanism.

## Deployment

1. Push only after separate approval.
2. Deploy the exact reviewed V2 commit.
3. Verify `/api/health/live`, `/api/health/ready`, and `/api/version` before functional smoke testing.
4. Test with a disposable account; do not regenerate an existing production roadmap without authorization.

## Production Smoke Test

- Load an existing V1 roadmap and confirm its saved weeks and progress remain visible.
- Reschedule an existing V1 roadmap and confirm it keeps legacy capstone behavior.
- Start onboarding for a new disposable user and confirm the four required projects are fixed.
- Select one optional product and one deep-build track; verify the live estimate changes.
- Generate, reload, and confirm the selections and scheduled nodes persist.
- Verify documented prerequisites are added and unrelated capstone tracks are absent.
- Mark one disposable lesson complete and confirm local progress and cloud synchronization still acknowledge it.
- Confirm Google authentication and service-worker offline shell behavior remain functional.

## Rollback

- Roll back the deployment to the current production commit; do not rewrite Git history.
- Because no database migration is introduced, stored V2 settings remain parseable only by V2. Before rollback, avoid generating new V2 plans or retain the V2 deployment until a forward fix is ready.
- If rollback is required after V2 settings exist, deploy a compatibility patch that ignores the optional field before reverting UI behavior.

## Release Boundary

No GitHub push, Vercel deployment, production database write, roadmap reset, or account mutation is part of this local implementation mission.
