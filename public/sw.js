// Minimal offline service worker for Rory's English.
//
// Two strategies, so the app is both fresh-on-redeploy and offline-capable:
//  • Page navigations (HTML)  → network-first: always try the live page so a
//    redeploy shows new content immediately; fall back to cache when offline.
//  • Everything else (JS/CSS/icons/manifests) → cache-first with background
//    refresh: instant loads, updated quietly for next time.
//
// CACHE version: "__BUILD__" is stamped with a timestamp by scripts/deploy-pages.sh
// on every deploy, so each release gets a fresh cache and activate() evicts the
// old one (otherwise dead content-hashed _next/ chunks accumulate forever).
// In local dev the literal placeholder is fine — it just means one stable cache.
const CACHE = "rorys-english-__BUILD__";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function cachePut(req, res) {
  if (res && res.status === 200 && res.type === "basic") {
    const copy = res.clone();
    caches.open(CACHE).then((c) => c.put(req, copy));
  }
  return res;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const isPageNavigation =
    req.mode === "navigate" ||
    (req.headers.get("accept") || "").includes("text/html");

  if (isPageNavigation) {
    // Network-first: fresh when online; offline, fall back to (in order) the
    // exact page, then that student's own Today page (/s/<code>/), then the SW
    // root, then a minimal inline offline notice — never resolve to undefined
    // (which the Fetch spec treats as a hard navigation error).
    event.respondWith(
      fetch(req)
        .then((res) => cachePut(req, res))
        .catch(async () => {
          const exact = await caches.match(req);
          if (exact) return exact;
          const m = req.url.match(/\/s\/[^/]+\//);
          if (m) {
            const studentHome = await caches.match(m[0]);
            if (studentHome) return studentHome;
          }
          const root = await caches.match(self.registration.scope);
          if (root) return root;
          return new Response(
            "<!doctype html><meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'>" +
              "<style>@media (prefers-color-scheme:dark){body{background:#17161C!important;color:#FAF8F5!important}}</style>" +
              "<body style='font-family:-apple-system,sans-serif;background:#FAF8F5;color:#17161C;text-align:center;padding:3rem 1.5rem'>" +
              "<p style='font-size:2rem'>📚</p><h1>You're offline</h1>" +
              "<p>Your saved work is safe. Reconnect to load this page.</p></body>",
            { headers: { "Content-Type": "text/html; charset=utf-8" } },
          );
        }),
    );
    return;
  }

  // Cache-first for static assets, warming the cache in the background.
  // waitUntil keeps the SW alive for the refresh — iOS Safari otherwise kills
  // the worker as soon as respondWith settles, so caches never updated there.
  const cachedPromise = caches.match(req);
  const network = fetch(req)
    .then((res) => cachePut(req, res))
    .catch(() => undefined);
  event.waitUntil(network);
  event.respondWith(
    cachedPromise.then((cached) => cached || network.then((res) => res || Response.error())),
  );
});
