const CACHE_NAME = "ani-ghost-shell-v3";
const APP_SHELL = ["/browse", "/brand/ani-ghost-compact.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => Promise.allSettled(APP_SHELL.map((url) => cache.add(url))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  // Never cache RSC payloads, API calls, or search queries
  if (
    requestUrl.searchParams.has("_rsc") ||
    requestUrl.searchParams.has("q") ||
    requestUrl.pathname.startsWith("/api/") ||
    requestUrl.pathname.startsWith("/anime/") ||
    requestUrl.pathname.startsWith("/watch/")
  ) {
    event.respondWith(fetch(event.request));
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(async () => {
        const shell = await caches.match("/browse");
        return shell ?? offlinePage();
      }),
    );
    return;
  }

  // Network-first with cache fallback for static assets
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok && response.type === "basic") {
          const copy = response.clone();
          void caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(async () => {
        const match = await caches.match(event.request);
        return match || offlinePage();
      }),
  );
});

function offlinePage() {
  return new Response(
    "<!doctype html><html lang=\"en\"><meta name=\"viewport\" content=\"width=device-width\"><title>Ani Ghost is offline</title><body style=\"margin:0;display:grid;min-height:100vh;place-items:center;background:#161522;color:#f4f2ff;font:16px system-ui\"><main><h1>You're offline</h1><p>Reconnect to load the Ani Ghost catalogue.</p></main></body></html>",
    { headers: { "Content-Type": "text/html; charset=utf-8" }, status: 503 },
  );
}
