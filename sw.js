// Minimal offline service worker for Rory's English.
//
// Two strategies, so the app is both fresh-on-redeploy and offline-capable:
//  • Page navigations (HTML)  → network-first: always try the live page so a
//    redeploy shows new content immediately; fall back to cache when offline.
//  • Everything else (JS/CSS/icons/manifests) → cache-first with background
//    refresh: instant loads, updated quietly for next time.
//
// CACHE version: "20260612070527" is stamped with a timestamp by scripts/deploy-pages.sh
// on every deploy, so each release gets a fresh cache and activate() evicts the
// old one (otherwise dead content-hashed _next/ chunks accumulate forever).
// In local dev the literal placeholder is fine — it just means one stable cache.
const CACHE = "rorys-english-20260612070527";

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
    // Network-first: fresh when online, cached page (or the app root) offline.
    // Use the SW's own scope as the root so this works under a sub-path host
    // (e.g. GitHub Pages /rorys-english/), not just at the domain root.
    event.respondWith(
      fetch(req)
        .then((res) => cachePut(req, res))
        .catch(() => caches.match(req).then((c) => c || caches.match(self.registration.scope))),
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
