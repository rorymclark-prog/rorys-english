// Minimal offline service worker for Rory's English.
//
// Two strategies, so the app is both fresh-on-redeploy and offline-capable:
//  • Page navigations (HTML)  → network-first: always try the live page so a
//    redeploy shows new content immediately; fall back to cache when offline.
//  • Everything else (JS/CSS/icons/manifests) → cache-first with background
//    refresh: instant loads, updated quietly for next time.
const CACHE = "rorys-english-v1";

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
    // Network-first: fresh when online, cached page (or the app start page) offline.
    event.respondWith(
      fetch(req)
        .then((res) => cachePut(req, res))
        .catch(() => caches.match(req).then((c) => c || caches.match("/"))),
    );
    return;
  }

  // Cache-first for static assets, warming the cache in the background.
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => cachePut(req, res))
        .catch(() => cached);
      return cached || network;
    }),
  );
});
