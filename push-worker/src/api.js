/* API personal de Morralla (HTTPS, con llave). Vive en el mismo Worker que los avisos.
 *
 *   GET    /api/movimientos?mes=AAAA-MM   movimientos del mes
 *   GET    /api/cuentas                    saldos, deuda, corte y próximo pago
 *   GET    /api/presupuestos?mes=AAAA-MM   tope, gastado y restante por categoría
 *   GET    /api/te-deben                   quién te debe, cuánto y su próxima mensualidad
 *   POST   /api/movimientos                registrar gasto, ingreso o transferencia
 *   PATCH  /api/movimientos/{id}           corregir un movimiento
 *   DELETE /api/movimientos/{id}           borrar un movimiento
 *
 * Autenticación: Authorization: Bearer mrl_… (la llave se crea en Morralla › Ajustes).
 * El Worker no usa credenciales de administrador: al crear la llave, la app le deja
 * un "refresh token" de TU sesión de Firebase, y con él lee y escribe como tú, con
 * las mismas reglas de seguridad de tu base. Revocar la llave lo borra.
 *
 * Las funciones puras (armar respuestas y validar) se exportan para probarlas sin red.
 */

import { calcularSaldos } from '../../js/domain/saldos.js';
import { estadoPago, ultimoCorte } from '../../js/domain/tarjetas.js';
import { resumenMes } from '../../js/domain/analisis.js';
import { deudasTerceros } from '../../js/domain/terceros.js';
import { sugerirCategoria, buscarPorNombre } from '../../js/domain/autocategoria.js';
import { fechaEnMes, sumarMeses, mesKey, hoyISO } from '../../js/domain/fechas.js';

const r2 = (n) => Math.round(n * 100) / 100;
const lista = (obj) => Object.entries(obj || {}).filter(([, v]) => v).map(([id, v]) => ({ ...v, id }));
const MES = /^\d{4}-(0[1-9]|1[0-2])$/;
const FECHA = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

// "Hoy" en la zona del usuario (desfase en minutos, como getTimezoneOffset). El Worker corre en UTC,
// así que se corre el reloj y las funciones de fecha (que usan hora local = UTC) dan el día correcto.
export const ahoraLocal = (tz = 360) => new Date(Date.now() - tz * 60000);

// ---------------------------------------------------------------- respuestas (puras)
export function datosDe(v4) {
    return { cuentas: lista(v4?.cuentas), transacciones: lista(v4?.transacciones), categorias: lista(v4?.categorias) };
}

export function movimientoPublico(t, d) {
    const cuenta = (id) => { const c = d.cuentas.find(x => x.id === id); return c ? { id: c.id, nombre: c.nombre } : (id ? { id, nombre: null } : null); };
    const cat = t.categoriaId ? d.categorias.find(c => c.id === t.categoriaId) : null;
    return {
        id: t.id, fecha: t.fecha, tipo: t.tipo, subtipo: t.subtipo || null, monto: Number(t.monto) || 0,
        cuenta: cuenta(t.cuentaId),
        cuentaDestino: t.tipo === 'transferencia' ? cuenta(t.cuentaDestinoId) : null,
        categoria: t.tipo === 'gasto' ? { id: t.categoriaId || null, nombre: cat?.nombre || null } : null,
        partes: Array.isArray(t.partes) && t.partes.length ? t.partes.map(p => ({ categoria: p.categoriaId, monto: Number(p.monto) || 0 })) : null,
        descripcion: t.desc || '',
        etiquetas: Array.isArray(t.etiquetas) ? t.etiquetas : [],
        msi: Number(t.msi) > 1 ? Number(t.msi) : null,
        paraQuien: t.paraTercero || null,
        abonoDe: t.abonoDe || null,
        creadoEn: t.creadoEn ? new Date(t.creadoEn).toISOString() : null,
    };
}

export function respMovimientos(v4, mes) {
    const d = datosDe(v4);
    const movs = d.transacciones.filter(t => t.fecha?.startsWith(mes))
        .sort((a, b) => b.fecha.localeCompare(a.fecha) || (b.creadoEn || 0) - (a.creadoEn || 0))
        .map(t => movimientoPublico(t, d));
    return { mes, total: movs.length, movimientos: movs };
}

export function respCuentas(v4, hoy) {
    const d = datosDe(v4);
    const saldos = calcularSaldos(d.cuentas, d.transacciones);
    return {
        cuentas: d.cuentas.map(c => {
            const base = { id: c.id, nombre: c.nombre, banco: c.banco || null, tipo: c.tipo, digitos: c.digitos || null };
            if (c.tipo !== 'credito') return { ...base, saldo: r2(saldos[c.id] || 0) };
            const deuda = r2(saldos[c.id] || 0);
            const limite = Number(c.limite) || null;
            const e = estadoPago(c, d.transacciones, hoy);
            const corte = ultimoCorte(c, hoy);
            const proximoCorte = fechaEnMes(sumarMeses(mesKey(corte), 1), c.diaCorte || 1);
            return {
                ...base, deuda, limite, disponible: limite ? r2(limite - deuda) : null,
                diaCorte: c.diaCorte || null, diaPago: c.diaPago || null,
                ultimoCorte: corte, proximoCorte,
                proximoPago: e ? { fechaLimite: e.fechaPago, monto: e.pago, abonado: e.abonado, pendiente: e.pendiente, pagado: e.pagada } : null,
            };
        }),
    };
}

export function respPresupuestos(v4, mes) {
    const d = datosDe(v4);
    const { porCategoria } = resumenMes(d.transacciones, mes);
    const filas = d.categorias.map(c => {
        const tope = Number(c.presupuesto) || 0;
        const gastado = r2(porCategoria[c.id] || 0);
        return { categoria: { id: c.id, nombre: c.nombre }, tope: tope || null, gastado, restante: tope ? r2(tope - gastado) : null, porcentaje: tope ? Math.round(gastado / tope * 100) : null };
    }).sort((a, b) => (b.tope ? 1 : 0) - (a.tope ? 1 : 0) || b.gastado - a.gastado);
    const conTope = filas.filter(f => f.tope);
    return {
        mes, presupuestos: filas,
        total: { tope: r2(conTope.reduce((a, f) => a + f.tope, 0)), gastado: r2(conTope.reduce((a, f) => a + f.gastado, 0)), restante: r2(conTope.reduce((a, f) => a + f.restante, 0)) },
    };
}

export function respTeDeben(v4, hoy) {
    const d = datosDe(v4);
    const deudas = deudasTerceros(d.cuentas, d.transacciones, hoy).map(x => ({
        nombre: x.nombre, total: x.total, pagado: x.abonado, pendiente: x.pendiente, vencido: x.vencido, saldado: x.saldada,
        proximaMensualidad: x.proximo ? { fecha: x.proximo.fecha, monto: x.proximo.monto } : null,
        compras: x.compras.map(t => ({ id: t.id, fecha: t.fecha, descripcion: t.desc || '', monto: Number(t.monto) || 0, msi: Number(t.msi) > 1 ? Number(t.msi) : null })),
    }));
    return { totalPendiente: r2(deudas.reduce((a, x) => a + x.pendiente, 0)), personas: deudas };
}

// ---------------------------------------------------------------- validar escrituras (pura)
// Mismos campos y reglas que el formulario de Morralla. `previo` = movimiento a corregir (PATCH).
// → { tx } listo para guardar en Firebase, o { error }.
export function validarMovimiento(entrada, v4, { previo = null, hoy = new Date() } = {}) {
    const d = datosDe(v4);
    const b = entrada && typeof entrada === 'object' ? entrada : {};
    const val = (k, deprevio) => (k in b ? b[k] : deprevio);
    const encontrarCuenta = (x) => (x == null || x === '' ? null : d.cuentas.find(c => c.id === x) || buscarPorNombre(String(x), d.cuentas));
    const encontrarCat = (x) => (x == null || x === '' ? null : d.categorias.find(c => c.id === x) || buscarPorNombre(String(x), d.categorias));

    const tipo = val('tipo', previo?.tipo);
    if (!['gasto', 'ingreso', 'transferencia'].includes(tipo)) return { error: 'tipo debe ser gasto, ingreso o transferencia' };
    const monto = r2(Number(val('monto', previo?.monto)));
    if (!(monto > 0) || monto > 100000000) return { error: 'monto debe ser un número mayor que 0' };
    const fecha = val('fecha', previo?.fecha) || hoyISO(hoy);
    if (!FECHA.test(fecha)) return { error: 'fecha debe tener el formato AAAA-MM-DD' };
    const cuenta = encontrarCuenta(val('cuenta', previo?.cuentaId));
    if (!cuenta) return { error: 'cuenta no encontrada (usa su id o su nombre; GET /api/cuentas)' };
    const desc = String(val('descripcion', previo?.desc) || '').trim().slice(0, 80);
    const etiquetasIn = val('etiquetas', previo?.etiquetas);
    if (etiquetasIn != null && !Array.isArray(etiquetasIn)) return { error: 'etiquetas debe ser una lista de textos' };
    const etiquetas = (etiquetasIn || []).map(e => String(e).replace(/^#/, '').trim().toLowerCase().replace(/\s+/g, '-').slice(0, 30)).filter(Boolean).slice(0, 10);

    const tx = { tipo, monto, fecha, cuentaId: cuenta.id, desc, etiquetas: etiquetas.length ? etiquetas : null, creadoEn: previo?.creadoEn || Date.now() };

    if (tipo === 'gasto') {
        const paraQuien = String(val('paraQuien', previo?.paraTercero) || '').trim().slice(0, 40);
        const catIn = val('categoria', previo?.categoriaId);
        let cat = encontrarCat(catIn);
        if (catIn && !cat) return { error: 'categoría no encontrada (usa su id o su nombre; GET /api/presupuestos)' };
        if (!cat) {
            // Sin categoría: se sugiere con la descripción (como en la app); si no, "otros".
            const ids = d.categorias.map(c => c.id);
            const sug = paraQuien ? null : sugerirCategoria(desc, d.transacciones, ids)?.categoriaId;
            cat = d.categorias.find(c => c.id === sug) || d.categorias.find(c => c.id === 'otros') || { id: 'otros' };
        }
        tx.categoriaId = cat.id;
        const msi = Number(val('msi', previo?.msi) || 0);
        if (msi && (!Number.isInteger(msi) || msi < 2 || msi > 48)) return { error: 'msi debe ser un número de meses entre 2 y 48' };
        if (msi && cuenta.tipo !== 'credito') return { error: 'los meses sin intereses solo aplican a tarjetas de crédito' };
        tx.msi = msi > 1 ? msi : null;
        tx.paraTercero = paraQuien || null;
        // Si se cambia monto o categoría, las partes de un gasto dividido ya no cuadran: se quitan.
        tx.partes = previo?.partes && !('monto' in b) && !('categoria' in b) ? previo.partes : null;
    } else if (tipo === 'ingreso') {
        const sub = val('subtipo', previo?.subtipo) || null;
        if (sub && !['cashback', 'rendimiento'].includes(sub)) return { error: 'subtipo de ingreso debe ser cashback o rendimiento' };
        if (sub === 'cashback' && cuenta.tipo !== 'credito') return { error: 'el cashback solo aplica a tarjetas de crédito' };
        if (sub === 'rendimiento' && cuenta.tipo === 'credito') return { error: 'el rendimiento no aplica a tarjetas de crédito' };
        tx.subtipo = sub;
        if (!tx.desc) tx.desc = sub === 'cashback' ? 'Cashback' : sub === 'rendimiento' ? 'Rendimiento' : 'Ingreso';
        tx.abonoDe = previo?.abonoDe || null;
    } else {
        const destino = encontrarCuenta(val('cuentaDestino', previo?.cuentaDestinoId));
        if (!destino || destino.id === cuenta.id) return { error: 'cuentaDestino no encontrada o igual a la cuenta de origen' };
        tx.cuentaDestinoId = destino.id;
        tx.subtipo = destino.tipo === 'credito' ? 'pago_tdc' : 'traspaso';
        if (!tx.desc) tx.desc = `${destino.tipo === 'credito' ? 'Pago a' : 'Traspaso a'} ${destino.nombre}`;
    }
    return { tx };
}

// ---------------------------------------------------------------- Firebase (sesión del usuario)
const tokens = new Map();   // uid → { idToken, vence } (en memoria del Worker, sin escribir al KV)

async function idTokenDe(env, uid, api, guardarRefresh) {
    const t = tokens.get(uid);
    if (t && t.vence > Date.now() + 60000) return t.idToken;
    const r = await fetch(`https://securetoken.googleapis.com/v1/token?key=${env.FIREBASE_API_KEY}`, {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(api.refresh)}`,
    });
    const datos = await r.json().catch(() => ({}));
    if (!r.ok || datos.user_id !== uid) { const e = new Error('sesion'); e.status = 401; throw e; }
    tokens.set(uid, { idToken: datos.id_token, vence: Date.now() + (Number(datos.expires_in) || 3600) * 1000 });
    if (datos.refresh_token && datos.refresh_token !== api.refresh) await guardarRefresh(datos.refresh_token);
    return datos.id_token;
}

async function firebase(env, uid, token, ruta, metodo = 'GET', cuerpo) {
    const r = await fetch(`${env.FIREBASE_DB_URL}/Usuarios/${uid}/v4${ruta ? '/' + ruta : ''}.json?auth=${token}`, {
        method: metodo, headers: cuerpo ? { 'Content-Type': 'application/json' } : {}, body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    });
    if (r.status === 401 || r.status === 403) { const e = new Error('permiso'); e.status = 401; throw e; }
    if (!r.ok) { const e = new Error(`Firebase respondió ${r.status}`); e.status = 502; throw e; }
    return r.json();
}

// Solo lo necesario de v4 (la foto de perfil y los ajustes no hacen falta).
async function leerV4(env, uid, token) {
    const [cuentas, transacciones, categorias] = await Promise.all(['cuentas', 'transacciones', 'categorias'].map(n => firebase(env, uid, token, n)));
    return { cuentas, transacciones, categorias };
}

// ---------------------------------------------------------------- HTTP
const json = (datos, status = 200) => new Response(JSON.stringify(datos, null, 2), {
    status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' },
});
const sha256 = async (t) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)))].map(b => b.toString(16).padStart(2, '0')).join('');

// ctx: { getUser(uid), putUser(uid, u) } del Worker (KV de Morralla).
export async function manejarApi(req, env, url, ctx) {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' } });
    const m = (req.headers.get('Authorization') || '').match(/^Bearer\s+(mrl_[\w-]+)$/);
    const uid = m ? await env.PUSH.get('ka:' + await sha256(m[1])) : null;
    if (!uid) return json({ error: 'Llave inválida. Créala en Morralla › Ajustes › API.' }, 401);
    const u = await ctx.getUser(uid);
    if (!u.api?.refresh) return json({ error: 'La llave ya no está activa. Crea una nueva en Morralla.' }, 401);
    const hoy = ahoraLocal(u.config?.tz ?? u.api.tz ?? 360);

    const ruta = url.pathname.replace(/^\/api\/?/, '').replace(/\/+$/, '');
    const [recurso, id, extra] = ruta.split('/');
    if (extra || (id && recurso !== 'movimientos')) return json({ error: 'Ruta no encontrada' }, 404);

    try {
        const token = await idTokenDe(env, uid, u.api, async (nuevo) => { u.api.refresh = nuevo; await ctx.putUser(uid, u); });
        const mes = url.searchParams.get('mes') || mesKey(hoy);
        const pideMes = recurso === 'movimientos' || recurso === 'presupuestos';
        if (req.method === 'GET' && pideMes && !MES.test(mes)) return json({ error: 'mes debe tener el formato AAAA-MM' }, 400);

        if (req.method === 'GET') {
            if (id) return json({ error: 'Usa GET /api/movimientos?mes=AAAA-MM' }, 404);
            const v4 = await leerV4(env, uid, token);
            if (recurso === 'movimientos') return json(respMovimientos(v4, mes));
            if (recurso === 'cuentas') return json(respCuentas(v4, hoy));
            if (recurso === 'presupuestos') return json(respPresupuestos(v4, mes));
            if (recurso === 'te-deben') return json(respTeDeben(v4, hoy));
            return json({ error: 'Ruta no encontrada' }, 404);
        }
        if (recurso !== 'movimientos') return json({ error: 'Ruta no encontrada' }, 404);

        let cuerpo = {};
        if (req.method === 'POST' || req.method === 'PATCH') {
            try { cuerpo = await req.json(); } catch { return json({ error: 'El cuerpo debe ser JSON' }, 400); }
        }

        if (req.method === 'POST' && !id) {
            const v4 = await leerV4(env, uid, token);
            const r = validarMovimiento(cuerpo, v4, { hoy });
            if (r.error) return json({ error: r.error }, 400);
            const { name } = await firebase(env, uid, token, 'transacciones', 'POST', limpiar(r.tx));
            return json(movimientoPublico({ ...r.tx, id: name }, datosDe(v4)), 201);
        }
        if (!id || !/^[\w-]{1,40}$/.test(id)) return json({ error: 'Falta el id: /api/movimientos/{id}' }, 400);
        const previo = await firebase(env, uid, token, `transacciones/${id}`);
        if (!previo) return json({ error: 'Movimiento no encontrado' }, 404);

        if (req.method === 'PATCH') {
            const v4 = await leerV4(env, uid, token);
            const r = validarMovimiento(cuerpo, v4, { previo, hoy });
            if (r.error) return json({ error: r.error }, 400);
            // PUT del registro completo: así se quitan campos que ya no aplican (p. ej. msi al cambiar de cuenta).
            await firebase(env, uid, token, `transacciones/${id}`, 'PUT', limpiar(r.tx));
            return json(movimientoPublico({ ...r.tx, id }, datosDe(v4)));
        }
        if (req.method === 'DELETE') {
            await firebase(env, uid, token, `transacciones/${id}`, 'DELETE');
            return json({ ok: true, borrado: movimientoPublico({ ...previo, id }, datosDe({})) });
        }
        return json({ error: 'Método no permitido' }, 405);
    } catch (e) {
        if (e.status === 401) { tokens.delete(uid); return json({ error: 'Tu sesión de Morralla ya no es válida (¿cambiaste la contraseña?). Crea una llave nueva en Ajustes.' }, 401); }
        return json({ error: e.message || 'Error' }, e.status || 500);
    }
}

// Firebase rechaza null dentro de un objeto nuevo como "borrar": se quitan los vacíos.
function limpiar(o) {
    return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined && !(Array.isArray(v) && !v.length)));
}
