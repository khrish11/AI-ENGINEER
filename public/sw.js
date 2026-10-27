// Offline shell service worker.
//
// Cache admission rules (BUG-01 hardening):
// - NEVER cache a redirected response. The old precache stored the unauth
//   307 -> /settings redirect under key "/" and then served that cross-URL
//   entry on document navigations, which browsers reject (net::ERR_FAILED).
// - NEVER cache non-ok (4xx/5xx) responses — unauthorized content stays out.
// - /api/* and /auth/* are never cached or served from cache (auth callbacks,
//   private API JSON, and user-specific payloads must not persist offline).
// - User-facing account paths (/settings...) are network-only: their HTML is
//   session-sensitive and must never be replayed across sign-ins.
// - Documents are network-first while online; the cached copy is only an
//   offline fallback, and only a fresh non-redirected 200 is ever stored.
// - Cache name bumped to v3: activation deletes all older ai-engineer-shell-*
//   caches, purging any poisoned entries from existing installations. IndexedDB
//   (progress, sync queue) is untouched by this upgrade.
const CACHE_PREFIX = "ai-engineer-shell";
const CACHE_NAME = `${CACHE_PREFIX}-v3`;
const SAFE_DESTINATIONS = new Set(["document", "script", "style", "image", "font"]);
const SAFE_DOCUMENT_PATHS = ["/", "/curriculum", "/roadmap", "/projects", "/resources"];
const NEVER_CACHE_PREFIXES = ["/api", "/auth", "/settings"];

function isSafeDocument(pathname) {
  return SAFE_DOCUMENT_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
}

function isCacheable(response) {
  return Boolean(
    response &&
      response.ok &&
      response.status === 200 &&
      !response.redirected &&
      response.type === "basic"
  );
}

self.addEventListener("install", (event) => {
  // Precache only the public landing shell, and only when the response is a
  // genuine non-redirected 200. A signed-out visitor's "/" redirects to
  // /settings; that response is deliberately NOT cached (the network-first
  // document flow keeps "/" working regardless of cache state).
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        fetch("/", { credentials: "same-origin" })
          .then((response) => {
            if (isCacheable(response)) cache.put("/", response.clone());
            return undefined;
          })
          .catch(() => undefined)
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

async function handleDocument(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const network = await fetch(request);
    if (isCacheable(network)) {
      cache.put(request, network.clone());
    } else if (network.status >= 400 || network.redirected) {
      // Stale or unsafe entry for this exact URL must not linger as an
      // offline fallback (e.g. a shell cached while signed in, requested
      // later by a different session).
      cache.delete(request);
    }
    return network;
  } catch (offline) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw offline;
  }
}

async function handleAsset(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const networkPromise = fetch(request)
    .then((response) => {
      if (isCacheable(response)) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);
  if (cached) {
    // Cache-first, background-refresh; never let the revalidation rejection
    // surface as an unhandled error once the cached copy was returned.
    void networkPromise;
    return cached;
  }
  const network = await networkPromise;
  if (network) return network;
  throw new Error("Offline and asset not in cache");
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (NEVER_CACHE_PREFIXES.some((p) => url.pathname === p || url.pathname.startsWith(`${p}/`))) return;
  if (!SAFE_DESTINATIONS.has(request.destination)) return;
  if (request.destination === "document" && !isSafeDocument(url.pathname)) return;

  if (request.destination === "document") {
    event.respondWith(handleDocument(request));
  } else {
    event.respondWith(handleAsset(request));
  }
});
