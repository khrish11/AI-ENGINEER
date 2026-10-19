const HTTP_URL_RE = /^https?:\/\//i;

export interface EvidenceUrlCheck {
  ok: boolean;
  reason?: string;
}

/**
 * §52 — evidence links use allowlisted protocols only:
 *  - https: always allowed
 *  - http: only for localhost development
 * Screenshot / reflection / evaluation-result kinds may also be plain text notes,
 * which callers decide; this validator enforces *URL fields* only.
 */
export function isAllowedEvidenceUrl(value: string): boolean {
  if (!HTTP_URL_RE.test(value)) {
    // Non-URL values (notes, in-repo paths) are permitted only for non-link kinds.
    // Scheme-like prefixes (javascript:, data:, file:) are never treated as notes.
    return (
      !/[<>]/.test(value) &&
      !/^[a-z][a-z0-9+.-]*:/i.test(value) &&
      value.length <= 2000
    );
  }
  try {
    const url = new URL(value);
    if (url.protocol === "https:") return true;
    if (url.protocol === "http:") {
      const host = url.hostname;
      return host === "localhost" || host === "127.0.0.1";
    }
    return false;
  } catch {
    return false;
  }
}

export function checkEvidenceUrl(value: string): EvidenceUrlCheck {
  return isAllowedEvidenceUrl(value)
    ? { ok: true }
    : { ok: false, reason: "URLs must use https: (http is allowed only for localhost)." };
}

const GITHUB_REPO_URL_RE = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/?$/;
const GITHUB_COMMIT_RE = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/commit\/[0-9a-f]{7,40}\/?$/;
const GITHUB_PR_RE = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/pull\/\d+\/?$/;

export interface GithubSubmission {
  repositoryUrl: string;
  branch?: string;
  commitSha?: string;
  prUrl?: string;
  directory?: string;
}

/**
 * §9 — GitHub submission fields validate by URL format; no claims about code
 * quality are ever derived from repository existence or stars.
 */
export function validateGithubSubmission(submission: GithubSubmission): EvidenceUrlCheck {
  if (!GITHUB_REPO_URL_RE.test(submission.repositoryUrl)) {
    return { ok: false, reason: "Repository URL must be https://github.com/owner/repo" };
  }
  if (submission.prUrl && !GITHUB_PR_RE.test(submission.prUrl)) {
    return { ok: false, reason: "Pull request URL must match https://github.com/owner/repo/pull/N" };
  }
  if (submission.commitSha && !/^[0-9a-f]{7,40}$/i.test(submission.commitSha)) {
    return { ok: false, reason: "Commit SHA must be 7-40 hex characters." };
  }
  return { ok: true };
}

export function looksLikeCommitUrl(url: string): boolean {
  return GITHUB_COMMIT_RE.test(url);
}
