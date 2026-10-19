import { describe, it, expect } from "vitest";
import {
  isAllowedEvidenceUrl,
  checkEvidenceUrl,
  validateGithubSubmission,
  looksLikeCommitUrl,
} from "@/lib/projects/evidence";

describe("isAllowedEvidenceUrl", () => {
  it("allows https URLs", () => {
    expect(isAllowedEvidenceUrl("https://github.com/u/repo")).toBe(true);
  });

  it("allows http only for localhost (development)", () => {
    expect(isAllowedEvidenceUrl("http://localhost:3000/demo")).toBe(true);
    expect(isAllowedEvidenceUrl("http://127.0.0.1:8080/x")).toBe(true);
  });

  it("rejects plain http against external hosts", () => {
    expect(isAllowedEvidenceUrl("http://example.com")).toBe(false);
  });

  it("rejects non-http(s) protocols", () => {
    expect(isAllowedEvidenceUrl("javascript:alert(1)")).toBe(false);
    expect(isAllowedEvidenceUrl("data:text/html;base64,AAAA")).toBe(false);
    expect(isAllowedEvidenceUrl("file:///etc/passwd")).toBe(false);
  });

  it("permits plain reflective notes without angle brackets (non-url kinds)", () => {
    expect(isAllowedEvidenceUrl("Wrote my reflection about retrieval drift.")).toBe(true);
  });

  it("rejects notes containing raw HTML", () => {
    expect(isAllowedEvidenceUrl("<script>alert(1)</script>")).toBe(false);
  });

  it("rejects oversized notes", () => {
    expect(isAllowedEvidenceUrl("x".repeat(2001))).toBe(false);
  });
});

describe("checkEvidenceUrl", () => {
  it("explains failures", () => {
    expect(checkEvidenceUrl("http://example.com").ok).toBe(false);
    expect(checkEvidenceUrl("http://example.com").reason).toContain("https");
  });
});

describe("validateGithubSubmission", () => {
  const base = { repositoryUrl: "https://github.com/owner/repo" };

  it("accepts repository + optional metadata", () => {
    expect(
      validateGithubSubmission({
        ...base,
        branch: "feat/rag",
        commitSha: "abc1234",
        prUrl: "https://github.com/owner/repo/pull/42",
        directory: "src/rag",
      }).ok
    ).toBe(true);
  });

  it("rejects malformed repository URLs", () => {
    expect(validateGithubSubmission({ repositoryUrl: "https://github.com/owneronly" }).ok).toBe(false);
    expect(validateGithubSubmission({ repositoryUrl: "http://github.com/owner/repo" }).ok).toBe(false);
  });

  it("rejects malformed PR URLs", () => {
    expect(
      validateGithubSubmission({ ...base, prUrl: "https://github.com/owner/repo/pulls/42" }).ok
    ).toBe(false);
  });

  it("rejects malformed commit SHAs", () => {
    expect(validateGithubSubmission({ ...base, commitSha: "not-a-sha" }).ok).toBe(false);
  });
});

describe("looksLikeCommitUrl", () => {
  it("detects commit URLs", () => {
    expect(looksLikeCommitUrl("https://github.com/o/r/commit/abcdef1234567890")).toBe(true);
    expect(looksLikeCommitUrl("https://github.com/o/r/pull/12")).toBe(false);
  });
});
