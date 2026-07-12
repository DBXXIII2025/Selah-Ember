const CACHE_VERSION = "selah-ember-pwa-v1";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const OFFLINE_URL = "/offline.html";

const PRECACHE_URLS = [
  OFFLINE_URL,
  "/images/selah-ember-logo.png",
  "/icons/selah-ember-icon-192.png",
  "/icons/selah-ember-icon-512.png",
  "/icons/selah-ember-maskable-192.png",
  "/icons/selah-ember-maskable-512.png",
  "/manifest.webmanifest",
];

const PRIVATE_PREFIXES = [
  "/account-restricted",
  "/auth",
  "/community/new",
  "/dashboard",
  "/leader",
  "/messages",
  "/notifications",
  "/platform",
  "/prayer",
  "/profile",
  "/signin",
  "/signup",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => !key.startsWith(CACHE_VERSION)).map((key) => caches.delete(key))),
    ),
  );
  self.clients.claim();
});

function isSameOrigin(requestUrl) {
  return requestUrl.origin === self.location.origin;
}

function isPrivatePath(pathname) {
  return PRIVATE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function isStaticAsset(requestUrl) {
  return (
    requestUrl.pathname.startsWith("/_next/static/") ||
    requestUrl.pathname.startsWith("/icons/") ||
    requestUrl.pathname.startsWith("/images/") ||
    requestUrl.pathname === "/manifest.webmanifest" ||
    requestUrl.pathname === OFFLINE_URL
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  const requestUrl = new URL(request.url);

  if (!isSameOrigin(requestUrl)) {
    return;
  }

  if (isPrivatePath(requestUrl.pathname)) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_URL, { cacheName: STATIC_CACHE })),
    );
    return;
  }

  if (!isStaticAsset(requestUrl)) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(request).then((response) => {
        if (!response || response.status !== 200 || response.type !== "basic") {
          return response;
        }

        const responseToCache = response.clone();
        caches.open(STATIC_CACHE).then((cache) => cache.put(request, responseToCache));
        return response;
      });
    }),
  );
});
