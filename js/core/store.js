// Estado único de la app. Los datos llegan completos desde la base (o del
// modo demo) con setDatos(); todo lo derivado (saldos, avisos, listas
// ordenadas) se calcula bajo demanda y se memoriza por versión.

import { calcularSaldos, patrimonio } from '../domain/saldos.js';
import { construirAvisos } from '../domain/notificaciones.js';

const listeners = new Set();

export const store = {
    usuario: null,      // { uid, email } o null
    demo: false,
    cargado: false,
    version: 0,
    datos: vacio(),
    ui: { privacidad: false },
};

function vacio() {
    return { meta: null, perfil: {}, ajustes: {}, cuentas: {}, categorias: {}, transacciones: {}, metas: {}, recurrentes: {}, notifDescartadas: {} };
}

// Asegura objetos y que cada elemento tenga su id (la clave de Firebase).
function normalizar(d = {}) {
    const out = vacio();
    Object.keys(out).forEach(k => { if (d[k] != null) out[k] = d[k]; });
    ['cuentas', 'categorias', 'transacciones', 'metas', 'recurrentes'].forEach(k => {
        const col = {};
        Object.entries(out[k] || {}).forEach(([id, v]) => { if (v) col[id] = { ...v, id }; });
        out[k] = col;
    });
    return out;
}

export function setDatos(d) {
    store.datos = normalizar(d);
    store.cargado = true;
    store.version++;
    memo.clear();
    emitir();
}

export function setUi(cambios) {
    Object.assign(store.ui, cambios);
    emitir();
}

export function suscribir(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emitir() { listeners.forEach(fn => fn(store)); }

// ---------- Selectores memorizados ----------
const memo = new Map();
function memorizar(clave, fn) {
    if (!memo.has(clave)) memo.set(clave, fn());
    return memo.get(clave);
}

const ORDEN_TIPO = { debito: 0, efectivo: 1, credito: 2 };

export const sel = {
    cuentas: () => memorizar('cuentas', () => Object.values(store.datos.cuentas)
        .sort((a, b) => (ORDEN_TIPO[a.tipo] ?? 3) - (ORDEN_TIPO[b.tipo] ?? 3) || (sel.saldos()[b.id] || 0) - (sel.saldos()[a.id] || 0))),
    cuenta: (id) => store.datos.cuentas[id] || null,
    transacciones: () => memorizar('txs', () => Object.values(store.datos.transacciones)
        .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '') || (b.creadoEn || 0) - (a.creadoEn || 0) || String(b.id).localeCompare(String(a.id)))),
    transaccion: (id) => store.datos.transacciones[id] || null,
    categorias: () => memorizar('cats', () => Object.values(store.datos.categorias).sort((a, b) => (a.orden ?? 99) - (b.orden ?? 99) || a.nombre.localeCompare(b.nombre))),
    categoria: (id) => store.datos.categorias[id] || { id, nombre: id ? id.charAt(0).toUpperCase() + id.slice(1) : 'Sin categoría', icono: 'tag', orden: 99 },
    // Índice fijo de color por categoría (sigue a la categoría, no a su ranking).
    indiceCategoria: (id) => memorizar('idxcat', () => Object.fromEntries(sel.categorias().map((c, i) => [c.id, i])))[id] ?? 99,
    saldos: () => memorizar('saldos', () => calcularSaldos(Object.values(store.datos.cuentas), Object.values(store.datos.transacciones))),
    saldo: (id) => sel.saldos()[id] || 0,
    patrimonio: () => memorizar('patrimonio', () => patrimonio(Object.values(store.datos.cuentas), sel.saldos())),
    metas: () => memorizar('metas', () => Object.values(store.datos.metas).sort((a, b) => (a.fechaLimite || '9999').localeCompare(b.fechaLimite || '9999'))),
    recurrentes: () => memorizar('recs', () => Object.values(store.datos.recurrentes).sort((a, b) => (a.proximaFecha || '').localeCompare(b.proximaFecha || ''))),
    avisos: () => memorizar('avisos', () => construirAvisos({
        cuentas: sel.cuentas(), transacciones: sel.transacciones(), categorias: sel.categorias(),
        metas: sel.metas(), recurrentes: sel.recurrentes(), descartadas: store.datos.notifDescartadas,
    })),
    perfil: () => store.datos.perfil || {},
    ajustes: () => store.datos.ajustes || {},
};
