/// <reference lib="webworker" />
// @ts-nocheck - Service Worker has different global types

const _CACHE_NAME = "duyetbot-v1";
const STATIC_CACHE = "duyetbot-static-v1";
const DYNAMIC_CACHE = "duyetbot-dynamic-v1";

// Assets to cache immediately on install
const PRECACHE_ASSETS = [
  "/",
  "/chat",
  "/auth/login",
  "/auth/register",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
];

// Install event - precache static assets
self.addEventListener("install", (event) => {
  console.log("[SW] Install event");

  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      await cache.addAll(PRECACHE_ASSETS);
      await self.skipWaiting();
    })()
  );
});

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  console.log("[SW] Activate event");

  event.waitUntil(
    (async () => {
      // Delete old caches
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter((name) => name !== STATIC_CACHE && name !== DYNAMIC_CACHE)
          .map((name) => caches.delete(name))
      );
      await self.clients.claim();
    })()
  );
});

// Fetch event - network first, then cache strategy
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== "GET") {
    return;
  }

  // Skip cross-origin requests
  if (url.origin !== self.location.origin) {
    return;
  }

  // API routes - network only
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request).catch((error) => {
        console.error("[SW] API fetch failed:", error);
        // Return offline fallback for API
        return new Response(
          JSON.stringify({
            error: "Offline",
            message: "No network connection available",
          }),
          {
            status: 503,
            headers: { "Content-Type": "application/json" },
          }
        );
      })
    );
    return;
  }

  // Static assets - cache first, then network
  if (url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|woff|woff2)$/)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // HTML pages - network first, then cache
  event.respondWith(networkFirst(request));
});

// Cache first strategy
async function cacheFirst(request: Request): Promise<Response> {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);

  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    // Return cached version if network fails
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }
    throw error;
  }
}

// Network first strategy
async function networkFirst(request: Request): Promise<Response> {
  const cache = await caches.open(DYNAMIC_CACHE);

  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }
    throw error;
  }
}

// Background sync for failed requests
self.addEventListener("sync", (event) => {
  console.log("[SW] Background sync:", event.tag);

  if (event.tag === "sync-messages") {
    event.waitUntil(syncMessages());
  }
});

async function syncMessages() {
  // Sync offline messages to server
  const clients = await self.clients.matchAll();
  clients.forEach((client) => {
    client.postMessage({ type: "SYNC_COMPLETE" });
  });
}

// Push notifications
self.addEventListener("push", (event) => {
  const options = {
    body: event.data?.text() || "New message from DuyetBot",
    icon: "/icons/icon-192x192.png",
    badge: "/icons/icon-72x72.png",
    vibrate: [200, 100, 200],
    data: {
      url: "/chat",
    },
  };

  event.waitUntil(self.registration.showNotification("DuyetBot", options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow(event.notification.data?.url || "/"));
});
