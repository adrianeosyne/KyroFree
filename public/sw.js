const CACHE = "kyro-shell-v3";
const SHELL = [
  "/offline.html",
  "/manifest.webmanifest",
  "/apple-touch-icon.png",
  "/logo-192.png",
  "/logo-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("kyro-shell-") && key !== CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

async function remember(request, response) {
  if (!response.ok || response.type === "opaque") return;
  try {
    const cache = await caches.open(CACHE);
    await cache.put(request, response.clone());
  } catch {
    // Storage limits must not prevent the online app from opening.
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || request.cache === "no-store") return;
  const url = new URL(request.url);
  if (
    url.origin !== self.location.origin ||
    url.pathname === "/api" ||
    url.pathname.startsWith("/api/")
  )
    return;

  if (request.mode === "navigate") {
    // Chats and account data stay online. Never retain arbitrary page responses.
    event.respondWith(
      fetch(request).catch(
        async () =>
          (await caches.match("/offline.html")) ||
          new Response("Kyro is offline. Reconnect and reload.", {
            status: 503,
            headers: { "Content-Type": "text/plain" },
          }),
      ),
    );
    return;
  }

  if (SHELL.includes(url.pathname)) {
    // The manifest and home-screen artwork have stable URLs and must refresh.
    event.respondWith(
      fetch(request)
        .then(async (response) => {
          await remember(request, response);
          return response;
        })
        .catch(async () => (await caches.match(request)) || Response.error()),
    );
    return;
  }

  if (
    /^\/assets\/[^/]+-[A-Za-z0-9_-]{8,}\.[A-Za-z0-9]+$/.test(url.pathname) &&
    ["script", "style", "image", "font"].includes(request.destination)
  ) {
    // Vite build assets have content hashes; member media is not cached here.
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then(async (response) => {
            await remember(request, response);
            return response;
          }),
      ),
    );
  }
});
