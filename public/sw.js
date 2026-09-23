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
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response.ok && url.origin === self.location.origin) {
            // Cloner immédiatement : après retour de `response`, le navigateur
            // peut consommer le body avant l'écriture asynchrone dans le cache.
            const responseForCache = response.clone();
            void caches
              .open(CACHE)
              .then((cache) => cache.put(request, responseForCache))
              .catch(() => undefined);
          }
          return response;
        })
        .catch(() =>
          cached ??
          new Response('Ressource indisponible hors ligne.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          }),
        );
      return cached ?? network;
    }),
  );
});
