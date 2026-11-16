const CACHE_NAME = "smart-locker-v1"
const OFFLINE_URL = "/offline"
const STATIC_ASSETS = ["/offline", "/icon.svg", "/manifest.webmanifest"]

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener("fetch", (event) => {
  const request = event.request
  const url = new URL(request.url)

  if (request.method !== "GET" || url.origin !== self.location.origin) return

  const path = url.pathname
  if (
    path.startsWith("/dashboard") ||
    path.startsWith("/share/") ||
    path.startsWith("/auth") ||
    path.startsWith("/onboarding") ||
    path.startsWith("/api/")
  ) return

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const offline = await caches.match(OFFLINE_URL)
        return offline ?? Response.error()
      }),
    )
    return
  }

  const isStaticAsset =
    path.startsWith("/_next/static/") ||
    path.startsWith("/icons/") ||
    path === "/icon.svg"

  if (!isStaticAsset) return

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request).then((response) => {
        if (response.ok) {
          void caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()))
        }
        return response
      }).catch(() => cached ?? Response.error())

      return cached ?? network
    }),
  )
})
