const CACHE_NAME = 'financiapp-cache-v6'; // v6: íconos rellenos y nuevo logo

const urlsToCache = [
    './',
    './index.html',
    './manifest.json',
    './logo.svg',
    './css/tokens.css',
    './css/base.css',
    './css/components.css',
    './js/main.js',
    './js/firebase-init.js',
    './js/state.js',
    './js/data/cuentas.js',
    './js/data/transacciones.js',
    './js/data/presupuestos.js',
    './js/data/perfil.js',
    './js/data/metas.js',
    './js/data/recurrentes.js',
    './js/data/mantenimiento.js',
    './js/render/resumen.js',
    './js/render/reportes.js',
    './js/render/presupuestos.js',
    './js/render/cuentas.js',
    './js/render/perfil.js',
    './js/render/metas.js',
    './js/render/recurrentes.js',
    './js/render/notificaciones.js',
    './js/ui/modals.js',
    './js/ui/nav.js',
    './js/ui/charts.js',
    './js/ui/bank-card.js',
    './js/ui/registro-sheet.js',
    './js/ui/extra-sheets.js',
    './js/utils/format.js',
    './js/utils/icons.js',
    './js/utils/demo-data.js',
    './js/utils/share-card.js',
    './js/utils/csv-export.js',
    './js/utils/pdf-export.js',
];

// Instalación: Guardar archivos esenciales
self.addEventListener('install', event => { 
    console.log('Service Worker instalado');
    event.waitUntil( 
        caches.open(CACHE_NAME).then(cache => { 
            return cache.addAll(urlsToCache); 
        }) 
    ); 
});

// Activación: Limpiar cachés de versiones anteriores
self.addEventListener('activate', (e) => {
    console.log('Service Worker activo');
    e.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

// Fetch: Estrategia "Stale-While-Revalidate" (Favorita de PWABuilder)
self.addEventListener('fetch', event => {
    // Solo manejamos peticiones GET (ignoramos POST de Firebase)
    if (event.request.method !== 'GET') return;

    event.respondWith(
        caches.match(event.request).then(cachedResponse => {
            // 1. Iniciamos la petición a internet en segundo plano para actualizar el caché
            const fetchPromise = fetch(event.request).then(networkResponse => {
                caches.open(CACHE_NAME).then(cache => {
                    cache.put(event.request, networkResponse.clone());
                });
                return networkResponse;
            }).catch(() => {
                // Falla silenciosa si no hay internet
            });

            // 2. Si hay algo en caché, lo mostramos de INMEDIATO (super rápido)
            // Si no hay nada en caché, esperamos la respuesta de internet
            return cachedResponse || fetchPromise;
        })
    );
});