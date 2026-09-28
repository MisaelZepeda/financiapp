# FinanciApp

App web de finanzas personales: cuentas, tarjetas de crédito, presupuestos, metas de ahorro y pagos recurrentes en un solo lugar. Se instala en el celular como app (PWA) y sincroniza los datos con Firebase.

**App en línea:** https://misaelzepeda.github.io/financiapp/

## Funciones

- **Inicio:** patrimonio neto con su tendencia real, saldos por cuenta (débito y luego crédito), el mes contra el anterior, próximos pagos (tarjetas y recurrentes) y gastos por categoría.
- **Registro rápido:** el monto primero (teclado propio en el celular) y categoría, cuenta y fecha en fichas de un toque; sugiere descripciones anteriores y la cuenta más usada. Deshacer con un toque.
- **Movimientos:** agrupados por día, con búsqueda y filtros por tipo, cuenta, categoría y mes.
- **Detalle de cuenta:** saldo, uso del crédito, estado de cuenta (corte, fecha límite, pago sin intereses, abonado y por facturar) y acciones rápidas: pagar, cashback, rendimiento, traspasar.
- **Análisis:** patrimonio mes a mes, ingresos contra gastos, cada categoría contra su promedio de 3 meses, gastos más grandes y más frecuentes, tasa de ahorro, y exportación a PDF (con saldos al cierre del mes) y CSV.
- **Planear:** presupuestos por categoría (con cuánto puedes gastar al día), metas de ahorro con historial y recurrentes que se registran con un toque.
- **Avisos** de tarjetas por vencer, presupuestos al límite, recurrentes pendientes y metas casi listas; se pueden borrar.
- Tema oscuro (predeterminado) o claro, cinco colores de acento, modo privacidad, respaldo y restauración (acepta respaldos de la versión anterior).
- **Modo demo** para explorar sin cuenta.

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

La lógica de negocio (`js/domain/`) tiene pruebas automáticas con el ejecutor de Node, sin dependencias:

```bash
npm test
```

## Publicar

GitHub Pages publica automáticamente la rama `master` desde la raíz del repositorio. Para cada versión:

1. Sube el número de `CACHE_NAME` en `sw.js` (p. ej. `financiapp-cache-v7` → `v8`). Si no cambia, los celulares con la app instalada seguirán mostrando la versión anterior.
2. Si agregas un archivo JS o CSS, añádelo también a `urlsToCache` en `sw.js`.
3. Haz commit y push a `master`.

## Estructura

```
index.html            Esqueleto de la app y sprite de íconos SVG
manifest.json, sw.js  Instalación como app (PWA) y caché sin conexión
css/                  tokens (tema y acentos), base, componentes y vistas
js/app.js             Arranque: sesión, migración, datos, rutas y acciones globales
js/core/              Estado (store), acceso a datos (db), escrituras (actions), rutas y eventos
js/domain/            Lógica pura sin DOM: saldos, tarjetas, recurrentes, análisis, avisos, migración
js/views/             Una vista por pantalla (inicio, movimientos, cuenta, análisis, planear, ajustes…)
js/components/        Registro rápido, formularios, hojas, toasts, gráficas y piezas de lista
js/lib/               Formato, íconos, apariencia, exportación PDF/CSV, datos demo
tests/                Pruebas de js/domain (npm test)
```

## Datos en Firebase

Cada usuario guarda sus datos en `Usuarios/{uid}/v4`:

| Nodo | Contenido |
|---|---|
| `perfil`, `ajustes` | Nombre, foto, tema y acento |
| `cuentas` | Débito, crédito y efectivo con `saldoInicial` y `fechaInicial` |
| `transacciones` | `tipo` gasto/ingreso/transferencia, `subtipo` (pago_tdc, traspaso, rendimiento, cashback), monto, fecha, cuentas, categoría y MSI |
| `categorias` | Nombre, ícono, orden y presupuesto mensual |
| `metas` | Metas de ahorro con historial de abonos y retiros |
| `recurrentes` | Pagos e ingresos recurrentes con su `proximaFecha` |
| `notifDescartadas` | Avisos borrados (se sincronizan entre dispositivos) |

**El saldo no se guarda: se calcula** a partir de `saldoInicial` y los movimientos de la cuenta. En tarjetas de crédito el saldo es la deuda: un gasto la aumenta y un pago o cashback la reduce.

La versión anterior guardaba los datos directo en `Usuarios/{uid}`. La primera vez que un usuario entra a v4, esos datos se copian y convierten a `v4/` (`js/domain/migracion.js`) sin modificar los originales; antes de guardar se comprueba que el saldo de cada cuenta coincida al centavo.
