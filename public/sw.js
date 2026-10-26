/* OVEREO service worker — offline-first shell.
   - App pages: network first, fall back to the cached copy, then /offline.
   - Build assets (/_next/static, fonts, icons): cache first (they're versioned).
   - Never caches /api/* (Overeo SI) or anything that isn't a GET.
   Her data never passes through here — it lives in the browser's storage. */
const VERSION = "overeo-v1";
const SHELL = ["/", "/app", "/app/track", "/app/agents", "/app/me", "/offline", "/manifest.webmanifest", "/icons/icon-192.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(VERSION)
      .then((c) => Promise.allSettled(SHELL.map((u) => c.add(u))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin || url.pathname.startsWith("/api/")) return;

  const asset = url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") || /\.(woff2|png|svg|jpg|webp|css|js)$/.test(url.pathname);
  if (asset) {
    e.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) caches.open(VERSION).then((c) => c.put(req, res.clone()));
            return res;
          }),
      ),
    );
    return;
  }

  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) caches.open(VERSION).then((c) => c.put(req, res.clone()));
          return res;
        })
        .catch(async () => (await caches.match(req)) || (await caches.match(url.pathname)) || (await caches.match("/app")) || caches.match("/offline")),
    );
  }
});

/* tapping a reminder notification opens OVEREO */
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "/app";
  e.waitUntil(
    self.clients.matchAll({ type: "window" }).then((ws) => {
      const w = ws.find((x) => "focus" in x);
      if (w) return w.navigate(url).then((x) => x && x.focus());
      return self.clients.openWindow(url);
    }),
  );
});
