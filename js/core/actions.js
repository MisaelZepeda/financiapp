// Todas las escrituras de la app. Las vistas nunca escriben directo a la
// base: llaman a estas funciones. Como el saldo se calcula, crear, editar o
// borrar un movimiento es una sola escritura (sin ajustar saldos a mano).

import { actualizar, nuevoId, reemplazarTodo } from './db.js';
import { store, sel } from './store.js';
import { generarOcurrencia, primeraFecha } from '../domain/recurrentes.js';
import { slugCategoria, iconoSugerido } from '../domain/categorias.js';
import { hoyISO, mesKey } from '../domain/fechas.js';
import { esMetaAuto } from '../domain/alcancia.js';
import { ultimoCorte } from '../domain/tarjetas.js';
import { normalizarNombre } from '../domain/applepay.js';

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

// ---------- Por revisar (pagos con Apple Pay) ----------
export function agregarPorRevisar(items) {
    const updates = {};
    items.forEach(p => { updates[`porRevisar/${p.id || nuevoId()}`] = { ...p, id: undefined }; });
    return actualizar(updates);
}

// Guarda el movimiento, quita el pendiente y recuerda la cuenta de esa tarjeta.
export function aceptarPorRevisar(id, tx) {
    const p = datos().porRevisar[id];
    const txId = nuevoId();
    const updates = { [`porRevisar/${id}`]: null, [`transacciones/${txId}`]: { ...tx, id: undefined, creadoEn: Date.now(), origen: 'applepay' } };
    const clave = p?.tarjeta ? normalizarNombre(p.tarjeta) : '';
    if (clave && tx.cuentaId) updates[`ajustes/tarjetasWallet/${clave.replace(/[.#$/[\]]/g, ' ')}`] = tx.cuentaId;
    return actualizar(updates).then(() => txId);
}

export function descartarPorRevisar(id) {
    return actualizar({ [`porRevisar/${id}`]: null });
}

// ---------- Cuentas ----------
// Al editar el saldo, se ajusta saldoInicial para que el saldo calculado sea
// el que el usuario escribió (sus movimientos no cambian).
// Alcancía: crea la cuenta la primera vez y registra el traspaso desde `origenId`.
// `metaId`: meta a la que suma la alcancía ('propia' = su meta "Alcancía de morralla").
export async function echarMonedas(monto, origenId, metaId = null) {
    let alcancia = Object.entries(datos().cuentas).find(([, c]) => c?.alcancia)?.[0];
    if (!alcancia) alcancia = await guardarCuenta({ nombre: 'Alcancía', banco: 'Alcancía', tipo: 'efectivo', alcancia: true, institucion: 'alcancia' }, 0);
    // Meta de ahorro: la elegida, o si no hay ninguna ligada, su propia meta (ver sel.metas).
    if (metaId) await ligarAlcancia(metaId, alcancia);
    else if (!Object.values(datos().metas || {}).some(m => m?.cuentaId === alcancia)) await ligarAlcancia('propia', alcancia);
    return guardarTransaccion({ tipo: 'transferencia', subtipo: 'alcancia', monto, fecha: hoyISO(), desc: 'Monedas a la alcancía', cuentaId: origenId, cuentaDestinoId: alcancia });
}

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
    return actualizar({ [`categorias/${id}`]: registro, ...topeDesdeEsteMes(id, registro.presupuesto) }).then(() => id);
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
    Object.entries(mapa).forEach(([id, v]) => {
        const tope = Number(v) > 0 ? Number(v) : null;
        updates[`categorias/${id}/presupuesto`] = tope;
        Object.assign(updates, topeDesdeEsteMes(id, tope));
    });
    return actualizar(updates);
}

// Si hay topes con fecha (p. ej. puestos por la API para un mes), un cambio en la app
// aplica desde el mes actual para no quedar tapado por uno anterior.
function topeDesdeEsteMes(id, tope) {
    if (!Object.keys(datos().topes || {}).length) return {};
    return { [`topes/${mesKey()}/${id}`]: tope > 0 ? tope : -1 };
}

// ---------- Metas ----------
export function guardarMeta(meta) {
    const id = meta.id || nuevoId();
    const previo = datos().metas[id] || {};
    return actualizar({ [`metas/${id}`]: { ...previo, ...meta, id: undefined } }).then(() => id);
}

export function borrarMeta(id) { return actualizar({ [`metas/${id}`]: null }); }

// Liga la alcancía a una meta (su saldo se suma a esa meta). Solo una meta a la vez;
// la meta automática "Alcancía de morralla" se quita si deja de usarse y no tiene abonos.
export async function ligarAlcancia(metaId, alcanciaId = Object.entries(datos().cuentas).find(([, c]) => c?.alcancia)?.[0]) {
    if (!alcanciaId) return;
    const metas = datos().metas || {};
    const updates = {};
    let destino = metaId === 'propia' ? Object.entries(metas).find(([, m]) => esMetaAuto(m))?.[0] : metaId;
    Object.entries(metas).forEach(([id, m]) => {
        if (!m || id === destino || m.cuentaId !== alcanciaId) return;
        if (esMetaAuto(m) && !(Number(m.montoActual) > 0)) updates[`metas/${id}`] = null;
        else updates[`metas/${id}/cuentaId`] = null;
    });
    if (!destino) {
        destino = nuevoId();
        updates[`metas/${destino}`] = { nombre: 'Alcancía de morralla', icono: 'coin', montoObjetivo: 1000, montoActual: 0, cuentaId: alcanciaId, auto: true };
    } else updates[`metas/${destino}/cuentaId`] = alcanciaId;
    return actualizar(updates);
}

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

// ---------- Favoritos (plantillas) ----------
export function guardarPlantilla(p) {
    const id = p.id || nuevoId();
    const previo = datos().plantillas[id] || {};
    return actualizar({ [`plantillas/${id}`]: { creadoEn: Date.now(), ...previo, ...p, id: undefined } }).then(() => id);
}

export function borrarPlantilla(id) { return actualizar({ [`plantillas/${id}`]: null }); }

// ---------- Retos ----------
export function guardarReto(reto) {
    const id = reto.id || nuevoId();
    const previo = datos().retos[id] || {};
    return actualizar({ [`retos/${id}`]: { ...previo, ...reto, id: undefined } }).then(() => id);
}

export function borrarReto(id) { return actualizar({ [`retos/${id}`]: null }); }

// Registra la ocurrencia pendiente de cada recurrente (con la fecha de hoy) y
// avanza su fecha. Si lleva varios periodos atrasado, registra uno por periodo.
export function generarRecurrentes(recs) {
    const updates = {};
    const hoy = hoyISO();
    recs.forEach(rec => {
        let actual = { ...rec };
        let vueltas = 0;
        while (actual.proximaFecha && actual.proximaFecha <= hoy && vueltas++ < 24) {
            const { tx, proximaFecha } = generarOcurrencia(actual, hoy);
            updates[`transacciones/${nuevoId()}`] = { ...tx, creadoEn: Date.now() };
            actual.proximaFecha = proximaFecha;
        }
        updates[`recurrentes/${rec.id}/proximaFecha`] = actual.proximaFecha;
    });
    return actualizar(updates);
}

// Registra hoy la próxima ocurrencia aunque aún no toque, y avanza su fecha.
export function adelantarRecurrente(rec) {
    const { tx, proximaFecha } = generarOcurrencia(rec, hoyISO());
    return actualizar({
        [`transacciones/${nuevoId()}`]: { ...tx, creadoEn: Date.now() },
        [`recurrentes/${rec.id}/proximaFecha`]: proximaFecha,
    });
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
