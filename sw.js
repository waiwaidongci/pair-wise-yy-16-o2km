/* ============================================================
   sw.js — offline cache for the portfolio.
   App shell + data pre-cached; photos served cache-first so the
   site works with no network after first visit.
   ============================================================ */

const CACHE = "lumina-portfolio-v2";
const CORE = [
  "/",
  "/index.html",
  "/works.html",
  "/series.html",
  "/series-detail.html",
  "/about.html",
  "/contact.html",
  "/css/style.css",
  "/js/store.js",
  "/js/lightbox.js",
  "/js/ui.js",
  "/js/app.js",
  "/js/home.js",
  "/js/works.js",
  "/js/series.js",
  "/js/series-detail.js",
  "/js/about.js",
  "/js/contact.js",
  "/fonts/inter-400-600.woff2",
  "/fonts/playfair-display-600.woff2",
  "/fonts/playfair-display-italic-400.woff2",
  "/data/photos.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(CORE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  // Photos: cache-first (large, immutable once cached).
  if (url.pathname.startsWith("/photos/")) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        try {
          const res = await fetch(req);
          if (res && res.status === 200) cache.put(req, res.clone());
          return res;
        } catch (e) {
          return hit || Response.error();
        }
      })
    );
    return;
  }

  // App shell / data: stale-while-revalidate.
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(req);
      const fetchPromise = fetch(req)
        .then((res) => {
          if (res && res.status === 200) cache.put(req, res.clone());
          return res;
        })
        .catch(() => hit);
      return hit || fetchPromise;
    })
  );
});
