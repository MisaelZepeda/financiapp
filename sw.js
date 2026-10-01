const CACHE_NAME = 'financiapp-cache-v13'; // v13: sin zoom al escribir en iPhone

const urlsToCache = [
    './',
    './index.html',
    './manifest.json',
    './logo.svg',
    './icon-192x192.png',
    './icon-512x512.png',
    './css/base.css',
    './css/components.css',
    './css/tokens.css',
    './css/views.css',
    './js/app.js',
    './js/components/capas.js',
    './js/components/formularios.js',
    './js/components/graficas.js',
    './js/components/piezas.js',
    './js/components/registro.js',
    './js/core/actions.js',
    './js/core/db.js',
    './js/core/eventos.js',
    './js/core/router.js',
    './js/core/store.js',
    './js/domain/analisis.js',
    './js/domain/calculadora.js',
    './js/domain/categorias.js',
    './js/domain/fechas.js',
    './js/domain/migracion.js',
    './js/domain/notificaciones.js',
    './js/domain/recurrentes.js',
    './js/domain/saldos.js',
    './js/domain/tarjetas.js',
    './js/firebase-init.js',
    './js/lib/apariencia.js',
    './js/lib/compartir.js',
    './js/lib/demo-data.js',
    './js/lib/exportar.js',
    './js/lib/format.js',
    './js/lib/icons.js',
    './js/views/acceso.js',
    './js/views/ajustes.js',
    './js/views/analisis.js',
    './js/views/cuenta.js',
    './js/views/cuentas.js',
    './js/views/inicio.js',
    './js/views/movimientos.js',
    './js/views/planear.js',
];

// Ciclo de actualización:
// 1. Al publicar, se cambia CACHE_NAME; el navegador detecta que sw.js
//    cambió e instala este service worker nuevo, que descarga la versión
//    completa en su propia caché (sin tocar la que se está usando).
// 2. El nuevo queda "en espera" y la app muestra el aviso "Actualizar".
// 3. Al tocarlo, la app manda SKIP_WAITING: el nuevo se activa, borra las
//    cachés anteriores y la app se recarga ya con la versión nueva.

self.addEventListener('install', (event) => {
    // cache: 'reload' evita copiar archivos viejos de la caché HTTP.
    event.waitUntil(caches.open(CACHE_NAME).then(cache =>
        cache.addAll(urlsToCache.map(url => new Request(url, { cache: 'reload' })))));
});

self.addEventListener('message', (event) => {
    if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then(nombres => Promise.all(nombres.filter(n => n !== CACHE_NAME).map(n => caches.delete(n))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;
    const url = new URL(req.url);
    // Firebase (datos y sesión) siempre va directo a la red.
    if (/firebaseio\.com|googleapis\.com\/identitytoolkit|securetoken/.test(url.href)) return;

    if (url.origin === self.location.origin) {
        // Archivos de la app: siempre de la versión instalada, para no mezclar
        // versiones. Las actualizaciones llegan con un service worker nuevo.
        event.respondWith(
            caches.match(req, { ignoreSearch: true }).then(enCache => enCache || fetch(req).then(resp => {
                if (resp.ok) { const copia = resp.clone(); caches.open(CACHE_NAME).then(c => c.put(req, copia)); }
                return resp;
            }))
        );
        return;
    }

    // Librerías externas (CDN, fuentes): rápido desde caché y se refrescan en segundo plano.
    event.respondWith(
        caches.match(req).then(enCache => {
            const red = fetch(req).then(resp => {
                if (resp.ok || resp.type === 'opaque') { const copia = resp.clone(); caches.open(CACHE_NAME).then(c => c.put(req, copia)); }
                return resp;
            }).catch(() => enCache);
            return enCache || red;
        })
    );
});
