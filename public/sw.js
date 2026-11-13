/* Simple app-shell cache. Bump CACHE when shipping a new build. */
const CACHE = "bj-coach-v4";

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then((cache) => {
      const base = new URL("./", self.registration.scope).pathname;
      return cache.addAll([base, base + "index.html", base + "manifest.webmanifest"]).catch(() => {
        /* first visit may 404 hashed assets; runtime cache will fill in */
      });
    }),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ).then(() => self.clients.claim()),
  );
});

function isHtmlRequest(req, url) {
  if (req.mode === "navigate") return true;
  if (req.destination === "document") return true;
  const path = url.pathname;
  if (path.endsWith("/") || path.endsWith("index.html")) return true;
  const accept = req.headers.get("accept") || "";
  return accept.includes("text/html");
}

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req, { cache: "no-store" });
    if (res && res.ok) {
      cache.put(req, res.clone());
      const scope = self.registration.scope;
      cache.put(new URL("./", scope), res.clone());
      cache.put(new URL("./index.html", scope), res.clone());
    }
    return res;
  } catch {
    return (await cache.match(req)) || (await cache.match(new URL("./index.html", self.registration.scope))) || Response.error();
  }
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  const fresh = fetch(req)
    .then((res) => {
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    })
    .catch(() => hit);
  return hit || fresh;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(isHtmlRequest(req, url) ? networkFirst(req) : staleWhileRevalidate(req));
});
