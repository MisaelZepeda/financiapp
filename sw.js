const CACHE_NAME = 'financiapp-cache-v10'; // v10: tema automático, menú de perfil y desbordes en móvil

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