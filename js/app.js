// Arranque de FinanciApp v4: sesión, migración, datos, rutas y acciones globales.

import { auth } from './firebase-init.js';
import { store, sel, setDatos, setUi, suscribir } from './core/store.js';
import * as db from './core/db.js';
import * as A from './core/actions.js';
import { definirRuta, iniciarRouter, alNavegar, rutaActual, navegar } from './core/router.js';
import { iniciarEventos, on } from './core/eventos.js';
import { abrirHoja, cerrarHoja, toast, confirmar } from './components/capas.js';
import { abrirRegistro } from './components/registro.js';
import { abrirFormCuenta, abrirFormMeta, abrirMovimientoMeta, abrirFormRecurrente, abrirFormCategoria } from './components/formularios.js';
import { avatarHTML, vacioHTML } from './components/piezas.js';
import { icon } from './lib/icons.js';
import { escapeHtml } from './lib/format.js';
import { aplicarApariencia, leerApariencia, temaEfectivo, temaElegido } from './lib/apariencia.js';
import { construirDemo } from './lib/demo-data.js';
import { compartirTarjeta } from './lib/compartir.js';
import { migrarV1 } from './domain/migracion.js';
import { pendientes } from './domain/recurrentes.js';
import { mostrarAcceso, ocultarAcceso, mostrarMigracion, nombreRegistro } from './views/acceso.js';
import { confirmarMigracion, selectorTema } from './views/ajustes.js';

import * as inicio from './views/inicio.js';
import * as movimientos from './views/movimientos.js';
import * as analisis from './views/analisis.js';
import * as planear from './views/planear.js';
import * as cuentas from './views/cuentas.js';
import * as cuenta from './views/cuenta.js';
import * as ajustes from './views/ajustes.js';

definirRuta('/inicio', inicio);
definirRuta('/movimientos', movimientos);
definirRuta('/analisis', analisis);
definirRuta('/planear', planear);
definirRuta('/planear/:tab', planear);
definirRuta('/cuentas', cuentas);
definirRuta('/cuenta/:id', cuenta);
definirRuta('/ajustes', ajustes);

const NAV = [
    ['#/inicio', 'home', 'Inicio', ['/inicio']],
    ['#/movimientos', 'list', 'Movimientos', ['/movimientos']],
    ['#/analisis', 'bar-chart', 'Análisis', ['/analisis']],
    ['#/planear', 'target', 'Planear', ['/planear']],
];

// ---------- Render ----------
function activo(prefijos) { const p = rutaActual().path || ''; return prefijos.some(x => p.startsWith(x)); }

function pintarNav() {
    document.getElementById('sidebar').innerHTML = `
        <div class="brand"><img src="logo.svg" alt="">FinanciApp</div>
        <button class="btn btn-primary side-add" data-action="nuevo">${icon('plus')}Nuevo movimiento</button>
        ${NAV.map(([h, i, t, p]) => `<a class="side-link ${activo(p) ? 'activo' : ''}" href="${h}">${icon(i)}${t}</a>`).join('')}
        <div class="side-sep"></div>
        <a class="side-link ${activo(['/cuenta']) ? 'activo' : ''}" href="#/cuentas">${icon('landmark')}Cuentas</a>
        <div class="side-bottom"><a class="side-link ${activo(['/ajustes']) ? 'activo' : ''}" href="#/ajustes">${icon('settings')}Ajustes</a></div>`;
    const [a, b, c, d] = NAV;
    const tab = ([h, i, t, p]) => `<a class="tab ${activo(p) ? 'activo' : ''}" href="${h}">${icon(i)}<span>${t}</span></a>`;
    document.getElementById('tabbar').innerHTML = `${tab(a)}${tab(b)}<button class="tab-add" data-action="nuevo" aria-label="Nuevo movimiento">${icon('plus')}</button>${tab(c)}${tab(d)}`;
}

function pintarTop(vista, params) {
    const t = vista.titulo?.(params) || {};
    const avisos = sel.avisos().length;
    const oscuro = temaEfectivo() === 'oscuro';
    document.getElementById('top').innerHTML = `
        ${t.atras ? `<a class="icon-btn top-back" href="${t.atras}" aria-label="Volver">${icon('chevron-right', 'rot180')}</a>` : ''}
        <div class="top-title"><h1>${escapeHtml(t.titulo || '')}</h1>${t.subtitulo ? `<p>${escapeHtml(t.subtitulo)}</p>` : ''}</div>
        ${store.demo ? '<span class="badge badge-warn">Demo</span>' : ''}
        <button class="icon-btn" data-action="togglePrivacidad" aria-label="${store.ui.privacidad ? 'Mostrar montos' : 'Ocultar montos'}" title="${store.ui.privacidad ? 'Mostrar montos' : 'Ocultar montos'}">${icon(store.ui.privacidad ? 'eye-off' : 'eye')}</button>
        <button class="icon-btn" data-action="alternarTema" aria-label="${oscuro ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}" title="${oscuro ? 'Tema claro' : 'Tema oscuro'}">${icon(oscuro ? 'sun' : 'moon')}</button>
        <button class="icon-btn" data-action="abrirAvisos" aria-label="Avisos">${icon('bell')}${avisos ? '<span class="dot"></span>' : ''}</button>
        <button class="avatar-btn" data-action="abrirMenu" aria-label="Menú">${avatarHTML(sel.perfil())}</button>`;
}

function pintarVista(nuevaVista = false) {
    if (!store.cargado) return;
    const r = rutaActual();
    if (!r?.vista) return;
    const el = document.getElementById('vista');
    const scroll = window.scrollY;
    pintarNav();
    pintarTop(r.vista, r.params);
    el.innerHTML = r.vista.render(r.params);
    if (nuevaVista) { el.style.animation = 'none'; void el.offsetWidth; el.style.animation = ''; window.scrollTo(0, 0); }
    else window.scrollTo(0, scroll);
    r.vista.montar?.(el, r.params);
}

alNavegar((r, cambio) => { if (cambio) r.vista.alEntrar?.(r.params); pintarVista(cambio); });
suscribir(() => pintarVista(false));
document.addEventListener('apariencia', () => { pintarVista(false); repintarMenu(); });

// ---------- Datos ----------
const CACHE = (uid) => `financiapp_v4_${uid}`;

function alRecibirDatos(datos, uid) {
    if (uid) { try { localStorage.setItem(CACHE(uid), JSON.stringify(datos)); } catch { /* sin espacio */ } }
    const aj = datos.ajustes || {};
    const ap = leerApariencia();
    if ((aj.tema && aj.tema !== ap.tema) || (aj.acento && aj.acento !== ap.acento)) aplicarApariencia({ tema: aj.tema, acento: aj.acento });
    setDatos(datos);
    mostrarApp();
}

function mostrarApp() {
    ocultarAcceso();
    document.getElementById('app').hidden = false;
    document.getElementById('cargando').hidden = true;
}

function entrarDemo() {
    store.demo = true;
    store.usuario = null;
    db.conectarDemo(construirDemo(), (d) => alRecibirDatos(d, null));
    if (!location.hash) location.hash = '#/inicio';
}

async function entrarUsuario(user) {
    store.usuario = { uid: user.uid, email: user.email };
    store.demo = false;
    const cache = localStorage.getItem(CACHE(user.uid));
    if (cache) { try { alRecibirDatos(JSON.parse(cache), null); } catch { /* caché dañada */ } }
    try {
        if (await db.existeV4(user.uid)) {
            db.conectarFirebase(user.uid, (d) => alRecibirDatos(d, user.uid));
            return;
        }
        const v1 = await db.leerV1(user.uid);
        const resultado = migrarV1(v1);
        if (nombreRegistro && !v1.perfil?.nombre) resultado.v4.perfil.nombre = nombreRegistro;
        const conectar = async () => {
            await db.escribirV4(user.uid, resultado.v4);
            db.conectarFirebase(user.uid, (d) => alRecibirDatos(d, user.uid));
        };
        document.getElementById('cargando').hidden = true;
        // Cuenta nueva o sin datos: se crea directo. Con datos: se muestra la comparación.
        if (!resultado.resumen.cuentas && !resultado.resumen.transacciones) await conectar();
        else mostrarMigracion(resultado, conectar);
    } catch (e) {
        console.error(e);
        document.getElementById('cargando').hidden = true;
        toast('No se pudieron cargar tus datos: ' + e.message, { tipo: 'error', duracion: 8000 });
    }
}

// ---------- Acciones globales ----------
const id = (el) => el.dataset.id;
on('nuevo', () => abrirRegistro());
on('editarTx', (el) => abrirRegistro({ id: id(el) }));
on('cerrarHoja', () => cerrarHoja());
on('nuevaCuenta', () => abrirFormCuenta());
on('editarCuenta', (el) => abrirFormCuenta(id(el)));
on('gastoCuenta', (el) => abrirRegistro({ tipo: 'gasto', cuentaId: id(el) }));
on('ingresoCuenta', (el) => abrirRegistro({ tipo: 'ingreso', cuentaId: id(el) }));
on('traspasar', (el) => abrirRegistro({ tipo: 'transferencia', cuentaId: id(el) }));
on('rendimiento', (el) => abrirRegistro({ tipo: 'ingreso', cuentaId: id(el), subtipo: 'rendimiento' }));
on('cashback', (el) => abrirRegistro({ tipo: 'ingreso', cuentaId: id(el), subtipo: 'cashback' }));
on('pagarTarjeta', (el) => {
    // Origen: la cuenta con la que se pagó esta tarjeta la última vez.
    const ultimo = sel.transacciones().find(t => t.tipo === 'transferencia' && t.cuentaDestinoId === id(el) && sel.cuenta(t.cuentaId));
    const origen = ultimo ? sel.cuenta(ultimo.cuentaId) : (sel.cuentas().find(c => c.tipo === 'debito') || sel.cuentas().find(c => c.tipo !== 'credito'));
    abrirRegistro({ tipo: 'transferencia', cuentaId: origen?.id, cuentaDestinoId: id(el) });
});
on('marcarPagada', async (el) => { await A.marcarTarjetaPagada(id(el), true); toast('Tarjeta marcada como pagada'); });
on('desmarcarPagada', async (el) => { await A.marcarTarjetaPagada(id(el), false); toast('Se quitó la marca de pagada'); });
on('compartirCuenta', (el) => compartirTarjeta(id(el)));
on('nuevaMeta', () => abrirFormMeta());
on('editarMeta', (el) => abrirFormMeta(id(el)));
on('abonarMeta', (el) => abrirMovimientoMeta(id(el), false));
on('retirarMeta', (el) => abrirMovimientoMeta(id(el), true));
on('nuevoRecurrente', () => abrirFormRecurrente());
on('editarRecurrente', (el) => abrirFormRecurrente(id(el)));
on('nuevaCategoria', () => abrirFormCategoria());
on('editarCategoria', (el) => abrirFormCategoria(id(el)));
on('generarRecurrente', async (el) => {
    const rec = sel.recurrentes().find(r => r.id === id(el)); if (!rec) return;
    await A.generarRecurrentes([rec]); toast(`${rec.desc} registrado`);
});
on('generarPendientes', async () => {
    const pend = pendientes(sel.recurrentes()); if (!pend.length) return;
    await A.generarRecurrentes(pend); toast(`${pend.length} recurrente${pend.length > 1 ? 's' : ''} registrado${pend.length > 1 ? 's' : ''}`);
});
on('togglePrivacidad', () => {
    const p = !store.ui.privacidad;
    document.body.classList.toggle('privacidad', p);
    try { localStorage.setItem('financiapp_privacidad', p ? '1' : ''); } catch { /* */ }
    setUi({ privacidad: p });
});

// Panel de avisos
function avisosHTML() {
    const avisos = sel.avisos();
    if (!avisos.length) return vacioHTML('bell', 'No tienes avisos pendientes.');
    return `${avisos.length > 1 ? `<div style="text-align:right; margin:-8px 0 4px;"><button class="link" data-action="descartarTodos">Borrar todos</button></div>` : ''}
        ${avisos.map(a => `<div class="aviso">
            <div class="aviso-ico tono-${a.tono}">${icon(a.icono)}</div>
            <div class="aviso-body" data-action="irAviso" data-ruta="${escapeHtml(a.ruta || '')}"><b>${escapeHtml(a.titulo)}</b><span>${escapeHtml(a.detalle || '')}</span></div>
            <button class="aviso-x" data-action="descartarAviso" data-key="${escapeHtml(a.key)}" aria-label="Borrar aviso">${icon('x')}</button>
        </div>`).join('')}`;
}
const repintarAvisos = () => { const b = document.querySelector('#avisos-body'); if (b) b.innerHTML = avisosHTML(); };
on('abrirAvisos', () => abrirHoja({ titulo: 'Avisos', html: `<div id="avisos-body">${avisosHTML()}</div>` }));
on('descartarAviso', async (el) => { await A.descartarAvisos([el.dataset.key]); repintarAvisos(); });
on('descartarTodos', async () => { await A.descartarAvisos(sel.avisos().map(a => a.key)); repintarAvisos(); });
on('irAviso', (el) => { cerrarHoja(); if (el.dataset.ruta) navegar(el.dataset.ruta); });

// Menú de la foto de perfil: accesos que no caben en la barra inferior.
function menuHTML() {
    const p = sel.perfil();
    const n = sel.cuentas().length;
    const fila = (ruta, ico, titulo, sub = '') => `<button class="fila fila-link" data-action="irMenu" data-ruta="${ruta}" style="width:100%; text-align:left;"><div class="fila-ico">${icon(ico)}</div>
        <div class="fila-body"><div class="fila-titulo">${titulo}</div>${sub ? `<div class="fila-sub">${sub}</div>` : ''}</div>${icon('chevron-right', 'chev')}</button>`;
    return `<div class="menu-perfil">${avatarHTML(p)}<div><b>${escapeHtml(p.nombre || 'Usuario')}</b><span class="muted">${escapeHtml(store.demo ? 'Modo demo' : store.usuario?.email || '')}</span></div></div>
        <div class="lista">
            ${fila('#/cuentas', 'landmark', 'Cuentas', `${n} cuenta${n === 1 ? '' : 's'} · agregar o administrar`)}
            ${fila('#/ajustes', 'tag', 'Categorías y presupuestos')}
            ${fila('#/ajustes', 'settings', 'Ajustes', 'Perfil, apariencia y respaldo')}
        </div>
        <div class="field" style="margin:18px 0 0;"><span class="label">Tema</span>${selectorTema(temaElegido())}</div>
        <button class="btn btn-ghost btn-block" data-action="cerrarSesion" style="margin-top:18px;">${icon('log-out')}${store.demo ? 'Salir de la demo' : 'Cerrar sesión'}</button>`;
}
function repintarMenu() { const b = document.getElementById('menu-body'); if (b) b.innerHTML = menuHTML(); }
on('irMenu', (el) => { cerrarHoja(); navegar(el.dataset.ruta); });
on('abrirMenu', () => abrirHoja({ titulo: 'Menú', html: `<div id="menu-body">${menuHTML()}</div>` }));
on('alternarTema', () => {
    const tema = temaEfectivo() === 'oscuro' ? 'claro' : 'oscuro';
    aplicarApariencia({ tema });
    A.guardarAjustes({ tema });
});

on('entrarDemo', entrarDemo);
on('cerrarSesion', async () => {
    if (store.demo) { location.hash = ''; location.reload(); return; }
    const uid = store.usuario?.uid;
    if (!(await confirmar({ titulo: 'Cerrar sesión', aceptar: 'Cerrar sesión' }))) return;
    if (uid) localStorage.removeItem(CACHE(uid));
    db.desconectar();
    await auth.signOut();
    location.reload();
});
on('ajRecopiar', async () => {
    const uid = store.usuario?.uid; if (!uid) return;
    const resultado = migrarV1(await db.leerV1(uid));
    confirmarMigracion({
        titulo: 'Copiar datos de la versión actual',
        resultado,
        alAceptar: async () => {
            // Conserva ajustes de la prueba (tema, acento) al recopiar.
            resultado.v4.ajustes = { ...store.datos.ajustes };
            await db.escribirV4(uid, resultado.v4);
            toast('Datos copiados de nuevo');
        },
    });
});

// Atajo de teclado: "n" abre un movimiento nuevo (fuera de campos de texto).
document.addEventListener('keydown', (e) => {
    if (e.key !== 'n' || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target.closest('input, textarea, select, [contenteditable]') || document.querySelector('.capa')) return;
    if (!document.getElementById('app').hidden) { e.preventDefault(); abrirRegistro(); }
});

// ---------- Inicio ----------
aplicarApariencia();
iniciarEventos();
if (localStorage.getItem('financiapp_privacidad')) { document.body.classList.add('privacidad'); store.ui.privacidad = true; }
iniciarRouter();

auth.onAuthStateChanged((user) => {
    if (store.demo) return;
    if (user) entrarUsuario(user);
    else { document.getElementById('cargando').hidden = true; document.getElementById('app').hidden = true; mostrarAcceso(); }
});

if ('serviceWorker' in navigator && !['localhost', '127.0.0.1'].includes(location.hostname)) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
