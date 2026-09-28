// Todas las escrituras de la app. Las vistas nunca escriben directo a la
// base: llaman a estas funciones. Como el saldo se calcula, crear, editar o
// borrar un movimiento es una sola escritura (sin ajustar saldos a mano).

import { actualizar, nuevoId, reemplazarTodo } from './db.js';
import { store, sel } from './store.js';
import { generarOcurrencia, primeraFecha } from '../domain/recurrentes.js';
import { slugCategoria, iconoSugerido } from '../domain/categorias.js';
import { hoyISO, mesKey } from '../domain/fechas.js';
import { ultimoCorte } from '../domain/tarjetas.js';

const datos = () => store.datos;

// ---------- Movimientos ----------
export function guardarTransaccion(tx) {
    const id = tx.id || nuevoId();
    const previo = datos().transacciones[id];
    const registro = { ...tx, id: undefined, creadoEn: previo?.creadoEn || Date.now() };
    return actualizar({ [`transacciones/${id}`]: registro }).then(() => id);
}

// Devuelve una función para deshacer el borrado.
export async function borrarTransaccion(id) {
    const previo = datos().transacciones[id];
    await actualizar({ [`transacciones/${id}`]: null });
    return () => actualizar({ [`transacciones/${id}`]: { ...previo, id: undefined } });
}

// ---------- Cuentas ----------
// Al editar el saldo, se ajusta saldoInicial para que el saldo calculado sea
// el que el usuario escribió (sus movimientos no cambian).
export function guardarCuenta(cuenta, saldoDeseado) {
    const id = cuenta.id || nuevoId();
    const actual = cuenta.id ? sel.saldo(id) : 0;
    const previo = datos().cuentas[id] || {};
    const saldoInicial = Math.round(((Number(previo.saldoInicial) || 0) + (Number(saldoDeseado) - actual)) * 100) / 100;
    const registro = { ...previo, ...cuenta, id: undefined, saldoInicial, fechaInicial: previo.fechaInicial || hoyISO() };
    return actualizar({ [`cuentas/${id}`]: registro }).then(() => id);
}

export function borrarCuenta(id) {
    return actualizar({ [`cuentas/${id}`]: null });
}

export function marcarTarjetaPagada(id, pagada) {
    const cuenta = datos().cuentas[id];
    return actualizar({ [`cuentas/${id}/pagadoPeriodo`]: pagada && cuenta ? mesKey(ultimoCorte({ ...cuenta, id })) : null });
}

// ---------- Categorías ----------
export function guardarCategoria(cat) {
    const id = cat.id || slugUnico(cat.nombre);
    const previo = datos().categorias[id] || {};
    const orden = previo.orden ?? Object.keys(datos().categorias).length;
    const registro = { ...previo, ...cat, id: undefined, icono: cat.icono || previo.icono || iconoSugerido(cat.nombre), orden };
    if (!(Number(registro.presupuesto) > 0)) registro.presupuesto = null;
    return actualizar({ [`categorias/${id}`]: registro }).then(() => id);
}

function slugUnico(nombre) {
    const base = slugCategoria(nombre);
    let id = base, n = 2;
    while (datos().categorias[id]) id = `${base}-${n++}`;
    return id;
}

export function borrarCategoria(id) {
    return actualizar({ [`categorias/${id}`]: null });
}

export function guardarPresupuestos(mapa) {
    const updates = {};
    Object.entries(mapa).forEach(([id, v]) => { updates[`categorias/${id}/presupuesto`] = Number(v) > 0 ? Number(v) : null; });
    return actualizar(updates);
}

// ---------- Metas ----------
export function guardarMeta(meta) {
    const id = meta.id || nuevoId();
    const previo = datos().metas[id] || {};
    return actualizar({ [`metas/${id}`]: { ...previo, ...meta, id: undefined } }).then(() => id);
}

export function borrarMeta(id) { return actualizar({ [`metas/${id}`]: null }); }

// Abono (positivo) o retiro (negativo). Solo mueve el avance de la meta.
export function moverMeta(id, delta) {
    const meta = datos().metas[id];
    if (!meta) return Promise.resolve();
    const nuevo = Math.max(0, Math.round(((Number(meta.montoActual) || 0) + delta) * 100) / 100);
    const hId = nuevoId();
    return actualizar({
        [`metas/${id}/montoActual`]: nuevo,
        [`metas/${id}/historial/${hId}`]: { fecha: hoyISO(), monto: delta },
    });
}

// ---------- Recurrentes ----------
export function guardarRecurrente(rec) {
    const id = rec.id || nuevoId();
    const previo = datos().recurrentes[id] || {};
    const registro = { ...previo, ...rec, id: undefined };
    if (!registro.proximaFecha || rec.reprogramar) registro.proximaFecha = primeraFecha(registro);
    delete registro.reprogramar;
    return actualizar({ [`recurrentes/${id}`]: registro }).then(() => id);
}

export function borrarRecurrente(id) { return actualizar({ [`recurrentes/${id}`]: null }); }

export function pausarRecurrente(id, activo) { return actualizar({ [`recurrentes/${id}/activo`]: activo }); }

// Registra la ocurrencia pendiente de cada recurrente y avanza su fecha.
// Si un recurrente lleva varios periodos atrasado, registra uno por periodo.
export function generarRecurrentes(recs) {
    const updates = {};
    const hoy = hoyISO();
    recs.forEach(rec => {
        let actual = { ...rec };
        let vueltas = 0;
        while (actual.proximaFecha && actual.proximaFecha <= hoy && vueltas++ < 24) {
            const { tx, proximaFecha } = generarOcurrencia(actual);
            updates[`transacciones/${nuevoId()}`] = { ...tx, creadoEn: Date.now() };
            actual.proximaFecha = proximaFecha;
        }
        updates[`recurrentes/${rec.id}/proximaFecha`] = actual.proximaFecha;
    });
    return actualizar(updates);
}

export function saltarRecurrente(rec) {
    const { proximaFecha } = generarOcurrencia(rec);
    return actualizar({ [`recurrentes/${rec.id}/proximaFecha`]: proximaFecha });
}

// ---------- Perfil, ajustes y avisos ----------
export function guardarPerfil(perfil) { return actualizar({ perfil: { ...datos().perfil, ...perfil } }); }
export function guardarAjustes(cambios) {
    const updates = {};
    Object.entries(cambios).forEach(([k, v]) => { updates[`ajustes/${k}`] = v; });
    return actualizar(updates);
}

const VIGENCIA_DESCARTE = 120 * 24 * 60 * 60 * 1000;
export function descartarAvisos(claves) {
    if (!claves.length) return Promise.resolve();
    const ahora = Date.now();
    const updates = {};
    Object.entries(datos().notifDescartadas || {}).forEach(([k, t]) => { if (ahora - t > VIGENCIA_DESCARTE) updates[`notifDescartadas/${k}`] = null; });
    claves.forEach(k => { updates[`notifDescartadas/${k}`] = ahora; });
    return actualizar(updates);
}

// ---------- Mantenimiento ----------
export function restaurar(datosV4) { return reemplazarTodo(datosV4); }

export function borrarMovimientos() {
    // Deja cada cuenta con saldo 0 y sin movimientos.
    const updates = { transacciones: null };
    Object.keys(datos().cuentas).forEach(id => {
        updates[`cuentas/${id}/saldoInicial`] = 0;
        updates[`cuentas/${id}/fechaInicial`] = hoyISO();
        updates[`cuentas/${id}/pagadoPeriodo`] = null;
    });
    return actualizar(updates);
}
