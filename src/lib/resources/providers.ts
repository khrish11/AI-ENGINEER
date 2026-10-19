import type { VerificationStatus } from "./types";
import {
  detectProvider,
  extractGitHubRepo,
  extractYouTubePlaylistId,
  extractYouTubeVideoId,
  normalizeCanonicalUrl,
} from "./canonical";

/**
 * External provider probes used by `npm run resources:audit`.
 *
 * These functions are intentionally only invoked from scripts/jobs — never from
 * ordinary page requests. Results are cached in the `resource_verifications`
 * table so the app reads verified metadata locally.
 *
 * A simple HTTP 200 is NOT treated as proof of pedagogical quality; it is only
 * a reachability signal. Editorial status is always decided by a human.
 */

export interface ProbeResult {
  status: VerificationStatus;
  httpStatus?: number;
  channelName?: string;
  videoTitle?: string;
  thumbnailUrl?: string;
  embedAllowed?: "allowed" | "disallowed" | "unknown";
  regionStatus?: "global" | "regional" | "unknown";
  github?: {
    owner: string;
    repository: string;
    defaultBranch: string;
    description: string | null;
    primaryLanguage: string | null;
    license: string | null;
    archived: boolean;
    fork: boolean;
  };
  notes: string;
  details: Record<string, unknown>;
}

const DEFAULT_TIMEOUT_MS = 15000;
const USER_AGENT = "ai-engineer-os-resource-auditor/1.0 (+https://github.com/rohitg00/ai-engineer-from-scratch)";

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "*/*",
        ...(init.headers ?? {}),
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Verify a YouTube video or playlist.
 * Tier 1: oEmbed (public, no key required) — existence + embeddability.
 * Tier 2: YouTube Data API v3 when YOUTUBE_API_KEY is configured — region + privacy.
 */
export async function probeYouTube(url: string): Promise<ProbeResult> {
  const videoId = extractYouTubeVideoId(url);
  const playlistId = extractYouTubePlaylistId(url);
  const oembedUrl = videoId
    ? `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
    : playlistId
    ? `https://www.youtube.com/oembed?url=https://www.youtube.com/playlist?list=${playlistId}&format=json`
    : null;

  if (!oembedUrl) {
    return {
      status: "unknown",
      notes: "Could not derive a valid YouTube video or playlist identifier from URL.",
      details: { provider: "youtube" },
    };
  }

  let response: Response;
  try {
    response = await fetchWithTimeout(oembedUrl);
  } catch (error) {
    return {
      status: "unknown",
      notes: `oEmbed request failed (network): ${error instanceof Error ? error.message : String(error)}`,
      details: { provider: "youtube", oembedUrl },
    };
  }

  if (response.status === 429) {
    return {
      status: "unknown",
      httpStatus: 429,
      notes: "oEmbed rate-limited. Re-run the audit later; manual review still required.",
      details: { provider: "youtube", rateLimited: true },
    };
  }

  if (response.status === 401 || response.status === 403) {
    return {
      status: "regional",
      httpStatus: response.status,
      embedAllowed: "disallowed",
      regionStatus: "regional",
      notes: "oEmbed denied (private, embedding disabled, or region-restricted). Manual review required.",
      details: { provider: "youtube", oembedUrl },
    };
  }

  if (response.status === 404) {
    return {
      status: "unavailable",
      httpStatus: 404,
      notes: "YouTube resource unavailable or deleted (oEmbed 404).",
      details: { provider: "youtube", oembedUrl },
    };
  }

  if (!response.ok) {
    return {
      status: "unknown",
      httpStatus: response.status,
      notes: `Unexpected oEmbed response (${response.status}).`,
      details: { provider: "youtube", oembedUrl },
    };
  }

  let payload: {
    title?: string;
    author_name?: string;
    thumbnail_url?: string;
  } = {};
  try {
    payload = (await response.json()) as typeof payload;
  } catch {
    payload = {};
  }

  // Optional Tier 2: Data API for privacy/region information.
  let regionStatus: "global" | "regional" | "unknown" = "unknown";
  let privacy = "unknown";
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (apiKey && videoId) {
    try {
      const apiRes = await fetchWithTimeout(
        `https://www.googleapis.com/youtube/v3/videos?part=status,contentDetails&id=${videoId}&key=${apiKey}`
      );
      if (apiRes.ok) {
        const apiJson = (await apiRes.json()) as {
          items?: {
            status?: { privacyStatus?: string; embeddable?: boolean };
            contentDetails?: { regionRestriction?: { blocked?: string[]; allowed?: string[] } };
          }[];
        };
        const item = apiJson.items?.[0];
        privacy = item?.status?.privacyStatus ?? "unknown";
        const restriction = item?.contentDetails?.regionRestriction;
        if (restriction && restriction.blocked && restriction.blocked.length > 0) {
          regionStatus = "regional";
        } else {
          regionStatus = "global";
        }
      }
    } catch {
      regionStatus = "unknown";
    }
  }

  return {
    status: "reachable",
    httpStatus: response.status,
    channelName: payload.author_name,
    videoTitle: payload.title,
    thumbnailUrl: payload.thumbnail_url,
    embedAllowed: "unknown",
    regionStatus,
    notes:
      "oEmbed reachable. Reachability is not a guarantee of global playback or pedagogical quality; maintainer editorial review is authoritative.",
    details: {
      provider: "youtube",
      privacy,
      oembedUrl,
    },
  };
}

/** Verify a GitHub repository exists, is public, and is not archived. */
export async function probeGitHub(url: string): Promise<ProbeResult> {
  const repo = extractGitHubRepo(url);
  if (!repo) {
    return {
      status: "unknown",
      notes: "Could not derive owner/repository from URL.",
      details: { provider: "github" },
    };
  }

  let response: Response;
  try {
    response = await fetchWithTimeout(
      `https://api.github.com/repos/${repo.owner}/${repo.repository}`,
      { headers: { Accept: "application/vnd.github+json" } }
    );
  } catch (error) {
    return {
      status: "unknown",
      notes: `GitHub API request failed: ${error instanceof Error ? error.message : String(error)}`,
      details: { provider: "github", repo },
    };
  }

  if (response.status === 404) {
    return {
      status: "unavailable",
      httpStatus: 404,
      notes: "Repository not found or private.",
      details: { provider: "github", repo },
    };
  }

  if (response.status === 403 || response.status === 429) {
    return {
      status: "unknown",
      httpStatus: response.status,
      notes: "GitHub API rate limit reached. Re-run later; manual review still required.",
      details: { provider: "github", repo, rateLimited: true },
    };
  }

  if (!response.ok) {
    return {
      status: "unknown",
      httpStatus: response.status,
      notes: `Unexpected GitHub API response (${response.status}).`,
      details: { provider: "github", repo },
    };
  }

  let json: {
    default_branch?: string;
    description?: string | null;
    language?: string | null;
    license?: { spdx_id?: string | null } | null;
    archived?: boolean;
    fork?: boolean;
    private?: boolean;
  } = {};
  try {
    json = (await response.json()) as typeof json;
  } catch {
    json = {};
  }

  if (json.private) {
    return {
      status: "unavailable",
      httpStatus: 200,
      notes: "Repository is private.",
      details: { provider: "github", repo },
    };
  }

  const archived = Boolean(json.archived);

  return {
    status: archived ? "partially_verified" : "reachable",
    httpStatus: response.status,
    notes: archived
      ? "Repository exists but is archived; verify it is still maintained if maintenance matters."
      : "Repository exists and is public. Popularity is not used as a quality signal.",
    github: {
      owner: repo.owner,
      repository: repo.repository,
      defaultBranch: json.default_branch ?? "main",
      description: json.description ?? null,
      primaryLanguage: json.language ?? null,
      license: json.license?.spdx_id ?? null,
      archived,
      fork: Boolean(json.fork),
    },
    details: { provider: "github", repo },
  };
}

/**
 * Verify a generic documentation / web URL.
 * Follows redirects but flags redirects that leave the original registrable
 * domain, since those should not be silently treated as valid.
 */
export async function probeHttp(url: string): Promise<ProbeResult> {
  let response: Response;
  try {
    response = await fetchWithTimeout(url, { redirect: "follow" });
  } catch (error) {
    return {
      status: "unknown",
      notes: `HTTP probe failed: ${error instanceof Error ? error.message : String(error)}`,
      details: { provider: "web" },
    };
  }

  if (response.status === 404 || response.status === 410) {
    return {
      status: "unavailable",
      httpStatus: response.status,
      notes: `Documentation unavailable (HTTP ${response.status}).`,
      details: { provider: "web", finalUrl: response.url },
    };
  }

  if (response.status === 403 || response.status === 401) {
    return {
      status: "partially_verified",
      httpStatus: response.status,
      notes: `Server returned ${response.status}; likely bot protection. Manual review required.`,
      details: { provider: "web", finalUrl: response.url },
    };
  }

  if (!response.ok) {
    return {
      status: "unknown",
      httpStatus: response.status,
      notes: `Unexpected HTTP status ${response.status}.`,
      details: { provider: "web", finalUrl: response.url },
    };
  }

  let originalHost = "";
  let finalHost = "";
  try {
    originalHost = new URL(normalizeCanonicalUrl(url)).hostname;
    finalHost = new URL(response.url).hostname;
  } catch {
    /* ignore */
  }

  const hostMatches =
    !originalHost ||
    !finalHost ||
    finalHost === originalHost ||
    finalHost.endsWith(`.${originalHost}`) ||
    originalHost.endsWith(`.${finalHost}`);

  if (!hostMatches) {
    return {
      status: "partially_verified",
      httpStatus: response.status,
      notes: `Redirected to a different domain (${finalHost}). Verify manually before trusting.`,
      details: { provider: "web", finalUrl: response.url, originalHost, finalHost },
    };
  }

  return {
    status: "reachable",
    httpStatus: response.status,
    notes: "HTTP reachable. Treat 200 as availability only, not an editorial endorsement.",
    details: { provider: "web", finalUrl: response.url },
  };
}

/** Dispatch a single resource to the correct provider probe. */
export async function probeResource(
  url: string,
  type: string
): Promise<ProbeResult> {
  if (type === "youtube_video" || type === "youtube_playlist") {
    return probeYouTube(url);
  }
  if (type === "github_repo" || type === "project_starter") {
    return probeGitHub(url);
  }
  const provider = detectProvider(url);
  if (provider === "github") return probeGitHub(url);
  if (provider === "youtube") return probeYouTube(url);
  return probeHttp(url);
}

/**
 * Run an async map with a bounded concurrency and a fixed inter-request delay,
 * to keep audit traffic polite and avoid provider rate limits.
 */
export async function mapWithRateLimit<T, R>(
  items: T[],
  mapper: (item: T, index: number) => Promise<R>,
  concurrency = 3,
  delayMs = 250
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await mapper(items[index], index);
      if (delayMs > 0) await sleep(delayMs);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () =>
    worker()
  );
  await Promise.all(workers);
  return results;
}
