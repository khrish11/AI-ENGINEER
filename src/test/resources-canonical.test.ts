import { describe, it, expect } from "vitest";
import {
  normalizeCanonicalUrl,
  hashCanonicalUrl,
  resolveCanonical,
  detectProvider,
  extractYouTubeVideoId,
  extractYouTubePlaylistId,
  extractGitHubRepo,
  extractArxivId,
  isValidLessonKey,
} from "@/lib/resources/canonical";

describe("Resource canonicalization", () => {
  it("normalizes youtu.be short links to the watch URL", () => {
    expect(normalizeCanonicalUrl("https://youtu.be/kCc8FmEb1nY")).toBe(
      "https://www.youtube.com/watch?v=kCc8FmEb1nY"
    );
  });

  it("normalizes youtube embed/shorts/live paths", () => {
    for (const path of ["embed", "shorts", "live"]) {
      expect(
        normalizeCanonicalUrl(`https://www.youtube.com/${path}/kCc8FmEb1nY`)
      ).toBe("https://www.youtube.com/watch?v=kCc8FmEb1nY");
    }
  });

  it("preserves a playlist id alongside a video id", () => {
    const result = normalizeCanonicalUrl(
      "https://www.youtube.com/watch?v=kCc8FmEb1nY&list=PL1234567890abcdef&t=42s"
    );
    expect(result).toBe(
      "https://www.youtube.com/watch?v=kCc8FmEb1nY&list=PL1234567890abcdef"
    );
  });

  it("normalizes playlist-only URLs", () => {
    expect(
      normalizeCanonicalUrl("https://www.youtube.com/playlist?list=PL1234567890abcdef")
    ).toBe("https://www.youtube.com/playlist?list=PL1234567890abcdef");
  });

  it("canonicalizes GitHub repos with .git suffix and trailing slash", () => {
    expect(normalizeCanonicalUrl("https://github.com/huggingface/transformers.git")).toBe(
      "https://github.com/huggingface/transformers"
    );
    expect(normalizeCanonicalUrl("https://www.github.com/openai/gym/")).toBe(
      "https://github.com/openai/gym"
    );
  });

  it("canonicalizes arxiv pdf links to the abs page", () => {
    expect(normalizeCanonicalUrl("https://arxiv.org/pdf/1706.03762.pdf")).toBe(
      "https://arxiv.org/abs/1706.03762"
    );
    expect(normalizeCanonicalUrl("https://arxiv.org/abs/1810.04805")).toBe(
      "https://arxiv.org/abs/1810.04805"
    );
  });

  it("strips tracking params, sorts query, drops hash, lowercases host", () => {
    expect(
      normalizeCanonicalUrl(
        "https://Example.com/Docs/?utm_source=news&b=2&a=1#section"
      )
    ).toBe("https://example.com/Docs?a=1&b=2");
  });

  it("throws on non-http(s) protocols and invalid URLs", () => {
    expect(() => normalizeCanonicalUrl("ftp://example.com/file")).toThrow();
    expect(() => normalizeCanonicalUrl("not-a-url")).toThrow();
  });

  it("detectProvider identifies hosts", () => {
    expect(detectProvider("https://youtu.be/x")).toBe("youtube");
    expect(detectProvider("https://www.youtube-nocookie.com/embed/x")).toBe("youtube");
    expect(detectProvider("https://github.com/a/b")).toBe("github");
    expect(detectProvider("https://arxiv.org/abs/1234.5678")).toBe("arxiv");
    expect(detectProvider("https://huggingface.co/docs")).toBe("huggingface");
    expect(detectProvider("https://example.com")).toBe("web");
    expect(detectProvider("nonsense")).toBe("web");
  });

  it("extracts provider identifiers", () => {
    expect(extractYouTubeVideoId("https://www.youtube.com/watch?v=kCc8FmEb1nY")).toBe(
      "kCc8FmEb1nY"
    );
    expect(extractYouTubeVideoId("https://www.youtube.com/watch?v=short")).toBeNull();
    expect(
      extractYouTubePlaylistId("https://www.youtube.com/playlist?list=PL1234567890abcdef")
    ).toBe("PL1234567890abcdef");
    expect(extractGitHubRepo("https://github.com/openai/gym.git")).toEqual({
      owner: "openai",
      repository: "gym",
    });
    expect(extractGitHubRepo("https://github.com/openai")).toBeNull();
    expect(extractArxivId("https://arxiv.org/pdf/1706.03762v5.pdf")).toBe("1706.03762v5");
  });

  it("produces a stable sha256 hash for a canonical URL", () => {
    const hash = hashCanonicalUrl("https://example.com/a");
    expect(hash).toHaveLength(64);
    expect(hash).toBe(hashCanonicalUrl("https://example.com/a"));
    expect(hash).not.toBe(hashCanonicalUrl("https://example.com/b"));
  });

  it("resolveCanonical returns url, hash and provider", () => {
    const resolved = resolveCanonical("https://youtu.be/kCc8FmEb1nY");
    expect(resolved.canonicalUrl).toBe("https://www.youtube.com/watch?v=kCc8FmEb1nY");
    expect(resolved.provider).toBe("youtube");
    expect(resolved.canonicalUrlHash).toHaveLength(64);
  });

  it("validates lesson keys", () => {
    expect(isValidLessonKey("00-setup-and-tooling/01-dev-environment")).toBe(true);
    expect(isValidLessonKey("07-transformers-deep-dive/03-attention-mechanism")).toBe(true);
    expect(isValidLessonKey("00-setup-tooling")).toBe(false);
    expect(isValidLessonKey("00-Setup-Tooling/01-dev")).toBe(false);
    expect(isValidLessonKey("setup/01-dev")).toBe(false);
  });
});
