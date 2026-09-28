# FinanciApp

App web de finanzas personales: cuentas, tarjetas de crédito, presupuestos, metas de ahorro y pagos recurrentes en un solo lugar. Se instala en el celular como app (PWA) y sincroniza los datos con Firebase.

**App en línea:** https://misaelzepeda.github.io/financiapp/

## Funciones

- **Inicio:** patrimonio neto, saldos por cuenta (débito y crédito), ingresos y gastos del mes contra el anterior, histórico de 6 meses, gastos por categoría y pago de tarjetas para no generar intereses.
- **Movimientos:** gastos, ingresos, pagos de tarjeta y traspasos, agrupados por día, con búsqueda y edición. Exporta estado de cuenta en PDF y movimientos en CSV.
- **Rendimientos y cashback:** el rendimiento suma al saldo de una cuenta de débito; el cashback resta de la deuda de una tarjeta de crédito.
- **Compras a meses sin intereses (MSI)** en tarjetas de crédito.
- **Presupuestos** por categoría con avance del mes.
- **Metas de ahorro** con abonos y retiros.
- **Recurrentes:** suscripciones, renta o nómina que se generan cuando vencen.
- **Notificaciones** de pagos de tarjeta, presupuestos al límite, recurrentes pendientes y metas casi listas; se pueden borrar.
- Modo claro y oscuro, modo privacidad (oculta montos), color de acento, categorías propias, respaldo y restauración en `.json`.
- **Modo demo** para explorar la app sin crear cuenta.

## Tecnología

- HTML, CSS y JavaScript sin frameworks ni paso de compilación (módulos ES nativos).
- [Firebase](https://firebase.google.com/) 8 (Authentication y Realtime Database).
- [Chart.js](https://www.chartjs.org/) para gráficas y [jsPDF](https://github.com/parallax/jsPDF) + AutoTable para el PDF.
- Service worker para funcionar sin conexión e instalarse como app.

Las librerías se cargan desde CDN; no hay dependencias que instalar.

## Correr en local

Se necesita un servidor HTTP (los módulos ES no funcionan abriendo el archivo directo):

```bash
python -m http.server 5500
```

Luego abre http://localhost:5500. En `localhost` el service worker no se registra, así que los cambios se ven al recargar.

## Publicar

GitHub Pages publica automáticamente la rama `master` desde la raíz del repositorio. Para cada versión:

1. Sube el número de `CACHE_NAME` en `sw.js` (p. ej. `financiapp-cache-v7` → `v8`). Si no cambia, los celulares con la app instalada seguirán mostrando la versión anterior.
2. Si agregas un archivo JS o CSS, añádelo también a `urlsToCache` en `sw.js`.
3. Haz commit y push a `master`.

## Estructura

```
index.html          Toda la interfaz y el sprite de íconos SVG
manifest.json       Datos de instalación como app (PWA)
sw.js               Service worker (caché sin conexión)
logo.svg            Logo; icon-192x192.png e icon-512x512.png para instalar
css/
  tokens.css        Colores, tipografía y espaciado (tema claro y oscuro)
  base.css          Reset, formularios, botones y piezas genéricas
  components.css    Navegación, tarjetas, listas, modales y pantallas
js/
  main.js           Arranque, autenticación y manejo de acciones (data-action)
  state.js          Estado en memoria y catálogos (categorías, íconos)
  firebase-init.js  Configuración de Firebase
  data/             Escritura en Firebase (cuentas, transacciones, metas…)
  render/           Dibujo de cada pantalla a partir del estado
  ui/               Navegación, modales, formularios, gráficas y tarjetas
  utils/            Formato, íconos, datos demo y exportación PDF/CSV
```

## Datos en Firebase

Cada usuario guarda sus datos en `Usuarios/{uid}`:

| Nodo | Contenido |
|---|---|
| `perfil` | Nombre, foto y color de acento |
| `cuentas` | Cuentas de débito, crédito y efectivo con su saldo |
| `transacciones` | Gastos, ingresos, pagos de tarjeta y traspasos |
| `presupuestos` | Límite mensual por categoría |
| `categoriasCustom` | Categorías agregadas por el usuario |
| `metas` | Metas de ahorro |
| `recurrentes` | Pagos e ingresos recurrentes |
| `notifDescartadas` | Notificaciones borradas (se sincronizan entre dispositivos) |

En las tarjetas de crédito, `saldo` es la deuda: un gasto la aumenta y un pago o cashback la reduce.
