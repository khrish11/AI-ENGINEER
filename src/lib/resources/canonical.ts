import * as crypto from "crypto";

/**
 * Canonical URL normalization and provider detection.
 *
 * The registry guarantees that a given YouTube video, GitHub repository, paper
 * or documentation page exists exactly once. Contributors may submit either
 * the canonical form or a common variant (youtu.be short links, `/embed/`,
 * trailing slashes, tracking parameters); normalization folds all of them onto
 * a single canonical string that is hashed and enforced unique in Postgres.
 */

const TRACKING_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
  "fbclid",
  "gclid",
  "dclid",
  "msclkid",
  "mc_cid",
  "mc_eid",
  "si",
  "feature",
  "ref",
  "ref_src",
  "ab_channel",
  "pp",
  "spm",
  "igshid",
]);

/** Provider identifiers used for `source_platform` and audit dispatch. */
export type ResourceProvider =
  | "youtube"
  | "github"
  | "arxiv"
  | "huggingface"
  | "web";

export function detectProvider(url: string): ResourceProvider {
  let host = "";
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return "web";
  }
  if (host.endsWith("youtube.com") || host === "youtu.be" || host.endsWith("youtube-nocookie.com")) {
    return "youtube";
  }
  if (host === "github.com" || host === "www.github.com") return "github";
  if (host.endsWith("arxiv.org")) return "arxiv";
  if (host.endsWith("huggingface.co")) return "huggingface";
  return "web";
}

export function extractYouTubeVideoId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    if (host === "youtu.be") {
      const id = parsed.pathname.split("/").filter(Boolean)[0];
      return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
    }
    if (host.endsWith("youtube.com") || host.endsWith("youtube-nocookie.com")) {
      const v = parsed.searchParams.get("v");
      if (v && /^[A-Za-z0-9_-]{11}$/.test(v)) return v;
      const segments = parsed.pathname.split("/").filter(Boolean);
      const marker = segments[0];
      if ((marker === "embed" || marker === "shorts" || marker === "live") && segments[1]) {
        return /^[A-Za-z0-9_-]{11}$/.test(segments[1]) ? segments[1] : null;
      }
    }
  } catch {
    return null;
  }
  return null;
}

export function extractYouTubePlaylistId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const list = parsed.searchParams.get("list");
    return list && /^[A-Za-z0-9_-]{10,64}$/.test(list) ? list : null;
  } catch {
    return null;
  }
}

export function extractGitHubRepo(url: string): { owner: string; repository: string } | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    if (host !== "github.com") return null;
    const segments = parsed.pathname.split("/").filter(Boolean);
    if (segments.length < 2) return null;
    return { owner: segments[0], repository: segments[1].replace(/\.git$/, "") };
  } catch {
    return null;
  }
}

export function extractArxivId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    if (!host.endsWith("arxiv.org")) return null;
    const segments = parsed.pathname.split("/").filter(Boolean);
    const marker = segments[0];
    if (marker === "abs" || marker === "pdf") {
      return segments[1]?.replace(/\.pdf$/, "") ?? null;
    }
    return null;
  } catch {
    return null;
  }
}

function stripTrackingParams(parsed: URL): void {
  const removals: string[] = [];
  parsed.searchParams.forEach((_value, key) => {
    if (TRACKING_PARAMS.has(key.toLowerCase())) removals.push(key);
  });
  for (const key of removals) parsed.searchParams.delete(key);
}

function sortSearchParams(parsed: URL): void {
  const entries = Array.from(parsed.searchParams.entries()).sort(([a], [b]) =>
    a.localeCompare(b)
  );
  parsed.search = "";
  for (const [key, value] of entries) parsed.searchParams.append(key, value);
}

/**
 * Normalize a URL to its canonical, deduplicated form.
 * Throws if the input is not a valid absolute http(s) URL.
 */
export function normalizeCanonicalUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  const parsed = new URL(trimmed);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`Unsupported protocol: ${parsed.protocol}`);
  }

  parsed.protocol = "https:";
  parsed.hostname = parsed.hostname.toLowerCase().replace(/^www\./, "");
  // Drop default/non-default ports entirely for canonical stability.
  parsed.port = "";

  const provider = detectProvider(trimmed);

  if (provider === "youtube") {
    const videoId = extractYouTubeVideoId(trimmed);
    const playlistId = extractYouTubePlaylistId(trimmed);
    if (videoId) {
      const canonical = new URL("https://www.youtube.com/watch");
      canonical.searchParams.set("v", videoId);
      if (playlistId) canonical.searchParams.set("list", playlistId);
      return canonical.toString();
    }
    if (playlistId) {
      return `https://www.youtube.com/playlist?list=${playlistId}`;
    }
  }

  if (provider === "github") {
    const repo = extractGitHubRepo(trimmed);
    if (repo) {
      return `https://github.com/${repo.owner}/${repo.repository}`;
    }
  }

  if (provider === "arxiv") {
    const arxivId = extractArxivId(trimmed);
    if (arxivId) {
      return `https://arxiv.org/abs/${arxivId}`;
    }
  }

  if (parsed.pathname === "/") {
    parsed.pathname = "/";
  } else {
    parsed.pathname = parsed.pathname.replace(/\/+$/, "");
  }

  stripTrackingParams(parsed);
  sortSearchParams(parsed);
  parsed.hash = "";

  return parsed.toString();
}

export function hashCanonicalUrl(canonicalUrl: string): string {
  return crypto.createHash("sha256").update(canonicalUrl, "utf8").digest("hex");
}

/** Resolve the canonical URL + hash for a catalog record, validating the URL. */
export function resolveCanonical(rawUrl: string): {
  canonicalUrl: string;
  canonicalUrlHash: string;
  provider: ResourceProvider;
} {
  const canonicalUrl = normalizeCanonicalUrl(rawUrl);
  return {
    canonicalUrl,
    canonicalUrlHash: hashCanonicalUrl(canonicalUrl),
    provider: detectProvider(canonicalUrl),
  };
}

/** Lesson keys accepted by the catalog: `{phase-slug}/{lesson-folder}`. */
export function isValidLessonKey(key: string): boolean {
  return /^[0-9]{2}-[a-z0-9-]+\/[a-z0-9-]+$/.test(key);
}
