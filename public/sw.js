const CACHE = 'atelier-shell-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(['/manifest.webmanifest'])),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (url.pathname.startsWith('/api/')) return;
  if (request.method !== 'GET') return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cached = await caches.match('/');
        return cached ?? new Response('Hors ligne — reconnectez-vous au réseau.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
      }),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(async (cached) => {
      if (cached) {
        // Stale-while-revalidate : servir le cache immédiatement et mettre à jour
        // sans jamais consommer deux fois le même body de Response.
        void fetch(request)
          .then(async (response) => {
            if (
              response.ok &&
              !response.bodyUsed &&
              url.origin === self.location.origin
            ) {
              const copy = response.clone();
              const cache = await caches.open(CACHE);
              await cache.put(request, copy);
            }
          })
          .catch(() => undefined);
        return cached;
      }

      try {
        const response = await fetch(request);
        if (
          response.ok &&
          !response.bodyUsed &&
          url.origin === self.location.origin
        ) {
          const copy = response.clone();
          const cache = await caches.open(CACHE);
          await cache.put(request, copy);
        }
        return response;
      } catch {
        return new Response('Ressource indisponible hors ligne.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
      }
    }),
  );
});
