'use strict';

const SECTION_CACHE = 'vanduo-sections-v1';

self.addEventListener('install', function () {
    self.skipWaiting();
});

self.addEventListener('activate', function (event) {
    event.waitUntil((async function () {
        const keys = await caches.keys();
        await Promise.all(keys.map(function (key) {
            if (key !== SECTION_CACHE && key.startsWith('vanduo-sections-')) {
                return caches.delete(key);
            }
            return Promise.resolve();
        }));
        await self.clients.claim();
    })());
});

self.addEventListener('fetch', function (event) {
    const request = event.request;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;
    if (!url.pathname.includes('/sections/')) return;

    event.respondWith((async function () {
        const cache = await caches.open(SECTION_CACHE);
        const cached = await cache.match(request);
        const networkPromise = fetch(request).then(function (response) {
            if (response && response.ok) {
                cache.put(request, response.clone());
            }
            return response;
        }).catch(function () {
            return null;
        });

        if (cached) {
            networkPromise;
            return cached;
        }

        const networkResponse = await networkPromise;
        if (networkResponse) return networkResponse;
        return new Response('Offline', { status: 503, statusText: 'Offline' });
    })());
});
