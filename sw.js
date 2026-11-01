
const CACHE_NAME = "campusconnect-v1";

const APP_FILES = [
    "./",
    "./index.html",
    "./styles.css",
    "./config.js",
    "./app.js",
    "./manifest.webmanifest",
    "./icon.svg"
];

self.addEventListener("install", event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(APP_FILES))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener("activate", event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys
                    .filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            )
        ).then(() => self.clients.claim())
    );
});

self.addEventListener("fetch", event => {
    const request = event.request;

    if (request.method !== "GET") return;

    const url = new URL(request.url);

    // Never cache Supabase or external API requests.
    if (url.origin !== self.location.origin) return;

    event.respondWith(
        fetch(request)
            .then(response => {
                if (response.ok) {
                    const copy = response.clone();

                    caches.open(CACHE_NAME)
                        .then(cache => cache.put(request, copy));
                }

                return response;
            })
            .catch(async () => {
                return (
                    await caches.match(request)
                    || await caches.match("./index.html")
                );
            })
    );
});
