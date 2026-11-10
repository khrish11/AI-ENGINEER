# Security Policy

The maintainers of **AI Engineer OS** take the security of our application, our contributors, and our learners seriously.

---

### Supported Versions

Only the latest release on the primary branch is actively maintained with security patches:

| Version | Supported |
| :--- | :--- |
| `main` (Latest) | :white_check_mark: |
| Historical Tags | :x: |

---

### Reporting a Vulnerability

If you discover a potential security vulnerability within AI Engineer OS, please **DO NOT** disclose it publicly via public GitHub Issues, pull requests, or community discussions.

Instead, please submit a **Private Security Advisory** directly through GitHub:
1. Navigate to the **Security** tab of this repository.
2. Select **Advisories** and click **Report a vulnerability**.
3. Detail the nature of the vulnerability, affected components, steps to reproduce, and any suggested remediation.

If private security advisories are not available, contact the primary repository maintainer via their verified GitHub profile.

You will receive an acknowledgment within 48 hours, followed by regular updates until a patch is deployed.

---

### Security Boundaries & Architecture

1. **No Server-Side Code Execution**: The platform server never executes user-submitted Python, TypeScript, or shell code. All assessments and exercise checks use static validation or isolated client-side Web Workers. Phase 6 projects never clone, build, or run learner repositories — project evaluation uses learner-attached evidence, deterministic milestone/rubric checks, assessment scores, and metadata display only.
2. **Media Sandboxing**: Third-party video embeds (YouTube) run inside sandboxed iframes restricting script access to parent frames.
3. **Authentication Isolation**: Authentication tokens and sessions are stored in encrypted, `httpOnly`, `SameSite=Lax` cookies using Auth.js.
4. **Data Isolation**: User progress, personal notes, and bookmarks are strictly protected via row-level checks on all database queries and server actions.
5. **Evidence URL Allowlist**: Learner-attached proof-of-work evidence accepts `https:` only (`http:` restricted to localhost development); non-link evidence text rejects scheme-like prefixes (`javascript:`, `data:`, `file:`), raw HTML, and oversized values. Evidence is stored private by default and always labelled self-reported — it is never rendered as HTML or automatically published.
6. **MCP is read-only by default**: The local adapter exposes validated public metadata and requires an explicit local private context for learner summaries. It does not expose SQL, shell execution, arbitrary file writes, raw answers, notes, device identifiers, or unpublished evidence.

---

### Phase 4: Authentication & Sync Security (As Built)

1. **Identity comes from the session, never the client.** `getAuthenticatedUserId()`
   reads the Auth.js session. `/api/sync/v1` never accepts a `userId` field;
   payloads that carry one are rejected when it does not match the session user.
2. **Every learner-owned query is scoped.** Server reads and writes for lessons,
   resources, notes, bookmarks, sessions, quiz attempts, projects, tombstones and
   conflicts filter by `user_id`. Entity ids owned by another user are ignored
   rather than overwritten (notes/bookmarks check ownership before upsert).
3. **OAuth credentials are environment-only.** `.env.example` ships blank
   `AUTH_GITHUB_ID/SECRET` and `AUTH_GOOGLE_ID/SECRET`, plus `AUTH_SECRET`.
   Nothing is hardcoded. When they are missing, auth routes return a clear
   `501`/unconfigured status and Guest Mode continues to work.
4. **No OAuth tokens in the browser.** Access/refresh tokens live only in the
   server-side `accounts` table managed by Auth.js. IndexedDB stores progress
   only, and exports strip token/secret-shaped fields recursively.
5. **Sync is scoped and validated.** `/api/sync/v1` validates requests with Zod
   (UUID batch/device ids, ≤500 mutations), requires authentication, and replays
   stored responses for duplicate batch ids. Rejections are reported without
   leaking internal state.
6. **Personalized responses are not cacheable.** Sync responses are sent with
   `Cache-Control: no-store, private`.
7. **Device identity is non-invasive.** A random UUID is generated locally;
   no hardware, browser, IP, or screen fingerprinting is performed.
8. **Deletion is explicit.** Tombstones carry the deletion signal so a missing
   record is never treated as an instruction to delete cloud data.
9. **Known limitation.** Concurrent text edits are preserved as conflicts rather
   than rendered into a single lossless merge; resolution is a deliberate learner
   action, and `sync_conflicts` retains both payloads for audit.

### Phase 7 — portfolio & analytics privacy

1. **Everything is private by default.** The public portfolio exists only for
   learners who explicitly enable it, choose a slug, and select fields.
2. **Allow-list public serializer.** The public portfolio object is built by an
   explicit allow-list; a regression test feeds private records (emails,
   provider ids, notes, quiz answers, device ids, conflicts, internal user
   ids, unpublished and deleted evidence) through the builder and asserts none
   appear in output.
3. **Identity comes from the session.** Portfolio write APIs derive the user
   from Auth.js; arbitrary user ids in requests are never honoured for writes,
   and slug availability checks are server-side.
4. **Unpublished never leaks.** Disabled/unpublished portfolios (and owners who
   exist but never published) return 404; page metadata does not exist for
   private trees.
5. **Provenance is honest.** Evidence is labelled learner-submitted; nothing is
   shown as verified/certified, and self-assessed rubric scores are always
   labeled as learner-entered and only published via an explicit toggle.
