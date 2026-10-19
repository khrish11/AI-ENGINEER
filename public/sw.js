const CACHE_PREFIX = "ai-engineer-shell";
const CACHE_NAME = `${CACHE_PREFIX}-v2`;
const SAFE_DESTINATIONS = new Set(["document", "script", "style", "image", "font"]);
const SAFE_DOCUMENT_PATHS = ["/", "/curriculum", "/roadmap", "/projects", "/resources"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.add("/")));
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

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) return;
  if (!SAFE_DESTINATIONS.has(request.destination)) return;
  if (request.destination === "document" && !SAFE_DOCUMENT_PATHS.some(
    (path) => url.pathname === path || url.pathname.startsWith(`${path}/`)
  )) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      });
      return cached ?? network.catch(() => caches.match("/"));
    })
  );
});
