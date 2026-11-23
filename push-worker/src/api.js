/* API personal de Morralla (HTTPS, con llave). Vive en el mismo Worker que los avisos.
 *
 *   GET    /api/movimientos?mes=AAAA-MM   movimientos del mes (filtros: q, cuenta, categoria, tipo,
 *                                          desde, hasta, montoMin, montoMax, paraQuien)
 *   GET    /api/cuentas                    saldos, deuda, corte y próximo pago
 *   POST   /api/cuentas                    dar de alta una cuenta
 *   PATCH  /api/cuentas/{id}               corregir nombre, banco, dígitos y datos de crédito
 *   GET    /api/presupuestos?mes=AAAA-MM   tope, gastado y restante por categoría
 *   PATCH  /api/presupuestos?mes=AAAA-MM   cambiar topes a partir de ese mes
 *   GET    /api/te-deben?persona=Nombre    quién te debe, cuánto, compras y abonos
 *   POST   /api/movimientos                registrar gasto (con partes), ingreso (con abonoDe) o transferencia
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
import { deudasTerceros, pendientesPorCompra } from '../../js/domain/terceros.js';
import { topeEnMes, SIN_TOPE } from '../../js/domain/topes.js';
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
    return { cuentas: lista(v4?.cuentas), transacciones: lista(v4?.transacciones), categorias: lista(v4?.categorias), topes: v4?.topes || {} };
}

const norm = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
// Cuentas y categorías por id o por nombre; ante ambigüedad gana el id.
const cuentaPor = (d, x) => (x == null || x === '' ? null : d.cuentas.find(c => c.id === x) || buscarPorNombre(String(x), d.cuentas));
const categoriaPor = (d, x) => (x == null || x === '' ? null : d.categorias.find(c => c.id === x) || buscarPorNombre(String(x), d.categorias));

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
        // abonoDe: id de la compra que salda; abonoPersona: a quién se le abonó.
        abonoDe: t.tipo === 'ingreso' && t.abonoDe ? (t.abonoCompra || null) : null,
        abonoPersona: t.tipo === 'ingreso' ? (t.abonoDe || null) : null,
        creadoEn: t.creadoEn ? new Date(t.creadoEn).toISOString() : null,
    };
}

// Filtros opcionales de GET /movimientos (se combinan con AND). → { filtros } o { error }.
const FILTROS = ['q', 'cuenta', 'categoria', 'tipo', 'desde', 'hasta', 'montoMin', 'montoMax', 'paraQuien'];
export function leerFiltros(params) {
    const f = {};
    FILTROS.forEach(k => { const v = params.get(k); if (v !== null && v !== '') f[k] = v; });
    for (const k of ['desde', 'hasta']) if (f[k] && !FECHA.test(f[k])) return { error: `${k} debe tener el formato AAAA-MM-DD` };
    if (f.desde && f.hasta && f.hasta < f.desde) return { error: 'hasta no puede ser anterior a desde' };
    for (const k of ['montoMin', 'montoMax']) if (k in f) { const n = Number(f[k]); if (!Number.isFinite(n) || n < 0) return { error: `${k} debe ser un número mayor o igual a 0` }; f[k] = n; }
    if ('montoMin' in f && 'montoMax' in f && f.montoMax < f.montoMin) return { error: 'montoMax no puede ser menor que montoMin' };
    if (f.tipo && !['gasto', 'ingreso', 'transferencia'].includes(f.tipo)) return { error: 'tipo debe ser gasto, ingreso o transferencia' };
    return { filtros: f };
}

export function respMovimientos(v4, mes, filtros = {}) {
    const d = datosDe(v4);
    const f = filtros;
    const rango = f.desde || f.hasta;
    let error = null;
    const cuenta = f.cuenta ? cuentaPor(d, f.cuenta) : null;
    if (f.cuenta && !cuenta) error = 'cuenta no encontrada (usa su id o su nombre; GET /api/cuentas)';
    const cat = f.categoria ? categoriaPor(d, f.categoria) : null;
    if (f.categoria && !cat) error = 'categoría no encontrada (usa su id o su nombre; GET /api/presupuestos)';
    if (error) return { error };
    const q = f.q ? norm(f.q) : null;
    const movs = d.transacciones.filter(t => {
        if (!t.fecha) return false;
        if (rango) { if (f.desde && t.fecha < f.desde) return false; if (f.hasta && t.fecha > f.hasta) return false; }
        else if (!t.fecha.startsWith(mes)) return false;
        if (q && !norm(t.desc).includes(q)) return false;
        if (cuenta && t.cuentaId !== cuenta.id && t.cuentaDestinoId !== cuenta.id) return false;
        if (cat && (t.tipo !== 'gasto' || !(t.categoriaId === cat.id || (t.partes || []).some(p => p.categoriaId === cat.id)))) return false;
        if (f.tipo && t.tipo !== f.tipo) return false;
        const m = Number(t.monto) || 0;
        if ('montoMin' in f && m < f.montoMin) return false;
        if ('montoMax' in f && m > f.montoMax) return false;
        if (f.paraQuien && norm(t.paraTercero) !== norm(f.paraQuien)) return false;
        return true;
    }).sort((a, b) => b.fecha.localeCompare(a.fecha) || (b.creadoEn || 0) - (a.creadoEn || 0))
        .map(t => movimientoPublico(t, d));
    const resp = { mes: rango ? null : mes, total: movs.length, movimientos: movs };
    if (Object.keys(f).length) resp.filtros = f;
    return resp;
}

export function respCuentas(v4, hoy) {
    const d = datosDe(v4);
    const saldos = calcularSaldos(d.cuentas, d.transacciones);
    return {
        cuentas: d.cuentas.map(c => cuentaPublica(c, d, saldos, hoy)),
    };
}

export function cuentaPublica(c, d, saldos, hoy) {
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
}

// Alta (previo = null) o corrección de una cuenta. → { cuenta } para guardar o { error }.
// No cambia tipo ni saldos: el saldo solo se mueve con movimientos (saldoInicial solo al crear).
export function validarCuenta(entrada, v4, { previo = null, hoy = new Date() } = {}) {
    const d = datosDe(v4);
    const b = entrada && typeof entrada === 'object' && !Array.isArray(entrada) ? entrada : {};
    const permitidos = previo ? ['nombre', 'banco', 'digitos', 'limite', 'diaCorte', 'diaPago'] : ['nombre', 'banco', 'digitos', 'tipo', 'limite', 'diaCorte', 'diaPago', 'saldoInicial'];
    const extra = Object.keys(b).filter(k => !permitidos.includes(k));
    if (extra.length) return { error: previo ? `No se puede cambiar ${extra.join(', ')} por API (tipo y saldos se mueven con movimientos)` : `Campos no reconocidos: ${extra.join(', ')}` };
    if (previo && !Object.keys(b).length) return { error: 'Manda al menos un campo a cambiar' };
    const tipo = previo ? previo.tipo : b.tipo;
    if (!['debito', 'efectivo', 'credito'].includes(tipo)) return { error: 'tipo es obligatorio: debito, efectivo o credito' };
    const nombre = 'nombre' in b ? String(b.nombre || '').trim().slice(0, 40) : previo?.nombre;
    if (!nombre) return { error: 'nombre es obligatorio' };
    if (d.cuentas.some(c => c.id !== previo?.id && norm(c.nombre) === norm(nombre))) return { error: `Ya existe una cuenta llamada "${nombre}"` };
    const c = { ...(previo || {}), nombre, tipo };
    delete c.id;
    if ('banco' in b) c.banco = b.banco ? String(b.banco).trim().slice(0, 40) : null;
    if ('digitos' in b) {
        if (b.digitos === null || b.digitos === '') c.digitos = null;
        else { const dg = String(b.digitos); if (!/^\d{4}$/.test(dg)) return { error: 'digitos deben ser 4 números, como texto ("0582")' }; c.digitos = dg; }
    }
    const credito = ['limite', 'diaCorte', 'diaPago'].filter(k => k in b);
    if (credito.length && tipo !== 'credito') return { error: `${credito.join(', ')} solo aplican a tarjetas de crédito` };
    if ('limite' in b) { const n = Number(b.limite); if (b.limite !== null && !(n > 0)) return { error: 'limite debe ser mayor que 0' }; c.limite = b.limite === null ? null : r2(n); }
    for (const k of ['diaCorte', 'diaPago']) if (k in b) {
        const n = Number(b[k]);
        if (b[k] !== null && !(Number.isInteger(n) && n >= 1 && n <= 31)) return { error: `${k} debe ser un día del 1 al 31` };
        c[k] = b[k] === null ? null : n;
    }
    if (!previo) {
        const si = 'saldoInicial' in b ? Number(b.saldoInicial) : 0;
        if (!Number.isFinite(si)) return { error: 'saldoInicial debe ser un número' };
        c.saldoInicial = r2(si);
        c.fechaInicial = hoyISO(hoy);
    }
    return { cuenta: c };
}

export function respPresupuestos(v4, mes) {
    const d = datosDe(v4);
    const { porCategoria } = resumenMes(d.transacciones, mes);
    const filas = d.categorias.map(c => {
        // Tope del mes (cambios con fecha de inicio; ver topes.js). 0 es un tope válido.
        const tope = topeEnMes(c, d.topes, mes);
        const gastado = r2(porCategoria[c.id] || 0);
        const con = tope !== null;
        return { categoria: { id: c.id, nombre: c.nombre }, tope, gastado, restante: con ? r2(tope - gastado) : null, porcentaje: con ? (tope ? Math.round(gastado / tope * 100) : (gastado > 0 ? null : 0)) : null };
    }).sort((a, b) => (b.tope !== null ? 1 : 0) - (a.tope !== null ? 1 : 0) || b.gastado - a.gastado);
    const conTope = filas.filter(f => f.tope !== null);
    return {
        mes, presupuestos: filas,
        total: { tope: r2(conTope.reduce((a, f) => a + f.tope, 0)), gastado: r2(conTope.reduce((a, f) => a + f.gastado, 0)), restante: r2(conTope.reduce((a, f) => a + f.restante, 0)) },
    };
}

export function respTeDeben(v4, hoy, persona = null) {
    const d = datosDe(v4);
    const porCompra = pendientesPorCompra(d.transacciones);
    const cuenta = (id) => { const c = d.cuentas.find(x => x.id === id); return c ? { id: c.id, nombre: c.nombre } : (id ? { id, nombre: null } : null); };
    const deudas = deudasTerceros(d.cuentas, d.transacciones, hoy)
        .filter(x => !persona || norm(x.nombre) === norm(persona))
        .map(x => ({
            nombre: x.nombre, total: x.total, pagado: x.abonado, pendiente: x.pendiente, vencido: x.vencido, saldado: x.saldada,
            proximaMensualidad: x.proximo ? { fecha: x.proximo.fecha, monto: x.proximo.monto } : null,
            compras: x.compras.map(t => ({ id: t.id, fecha: t.fecha, descripcion: t.desc || '', monto: Number(t.monto) || 0, msi: Number(t.msi) > 1 ? Number(t.msi) : null, pendiente: porCompra[t.id]?.pendiente ?? null })),
            // Ingresos con abonoDe de esta persona, del más reciente al más antiguo.
            abonos: x.abonos.slice().sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '') || (b.creadoEn || 0) - (a.creadoEn || 0))
                .map(t => ({ id: t.id, fecha: t.fecha, monto: Number(t.monto) || 0, cuenta: cuenta(t.cuentaId), abonoDe: t.abonoCompra || null, descripcion: t.desc || '' })),
        }));
    return { totalPendiente: r2(deudas.reduce((a, x) => a + x.pendiente, 0)), personas: deudas };
}

// PATCH /presupuestos: valida la lista completa (atómico). → { cambios: { catId: tope|-1 } } o { error }.
export function validarTopes(entrada, v4) {
    const d = datosDe(v4);
    const topes = entrada?.topes;
    if (!Array.isArray(topes) || !topes.length) return { error: 'Manda "topes": [{ "categoria": "...", "tope": 1000 }, …]' };
    const cambios = {};
    for (const [i, t] of topes.entries()) {
        const cat = categoriaPor(d, t?.categoria);
        if (!cat) return { error: `topes[${i}]: categoría "${t?.categoria}" no encontrada` };
        if (!('tope' in (t || {}))) return { error: `topes[${i}] (${cat.nombre}): falta tope (número ≥ 0, o null para quitarlo)` };
        if (t.tope === null) { cambios[cat.id] = SIN_TOPE; continue; }
        const n = Number(t.tope);
        if (!Number.isFinite(n) || n < 0) return { error: `topes[${i}] (${cat.nombre}): el tope debe ser un número mayor o igual a 0` };
        cambios[cat.id] = r2(n);
    }
    return { cambios };
}

// ---------------------------------------------------------------- validar escrituras (pura)
// Mismos campos y reglas que el formulario de Morralla. `previo` = movimiento a corregir (PATCH).
// → { tx } listo para guardar en Firebase, o { error }.
export function validarMovimiento(entrada, v4, { previo = null, previoId = null, hoy = new Date() } = {}) {
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
    if (b.partes != null && tipo !== 'gasto') return { error: 'partes solo aplica a gastos' };
    if (b.abonoDe != null && tipo !== 'ingreso') return { error: 'abonoDe solo aplica a ingresos (el pago de alguien que te debe)' };

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
        if (b.partes != null) {
            // Gasto dividido: cada parte cuenta en su categoría (presupuestos y análisis).
            if (!Array.isArray(b.partes) || b.partes.length < 2) return { error: 'partes debe ser una lista de al menos 2: [{ "categoria", "monto" }]' };
            const partes = [];
            for (const [i, p] of b.partes.entries()) {
                const c = categoriaPor(d, p?.categoria);
                if (!c) return { error: `partes[${i}]: categoría "${p?.categoria}" no encontrada` };
                const m = r2(Number(p?.monto));
                if (!(m > 0)) return { error: `partes[${i}] (${c.nombre}): el monto debe ser mayor que 0` };
                if (partes.some(x => x.categoriaId === c.id)) return { error: `partes: la categoría ${c.nombre} está repetida` };
                partes.push({ categoriaId: c.id, monto: m });
            }
            const suma = r2(partes.reduce((a, p) => a + p.monto, 0));
            if (Math.abs(suma - monto) > 0.001) return { error: `La suma de las partes (${suma}) debe ser igual al monto (${monto})` };
            tx.partes = partes;
            // Categoría principal: la indicada o la de la parte mayor (como en la app).
            if (!catIn) tx.categoriaId = partes.reduce((a, p) => (p.monto > a.monto ? p : a), partes[0]).categoriaId;
        } else if ('partes' in b) {
            tx.partes = null;   // "partes": null quita la división
        } else {
            // Si se cambia monto o categoría, las partes de un gasto dividido ya no cuadran: se quitan.
            tx.partes = previo?.partes && !('monto' in b) && !('categoria' in b) ? previo.partes : null;
        }
    } else if (tipo === 'ingreso') {
        const sub = val('subtipo', previo?.subtipo) || null;
        if (sub && !['cashback', 'rendimiento'].includes(sub)) return { error: 'subtipo de ingreso debe ser cashback o rendimiento' };
        if (sub === 'cashback' && cuenta.tipo !== 'credito') return { error: 'el cashback solo aplica a tarjetas de crédito' };
        if (sub === 'rendimiento' && cuenta.tipo === 'credito') return { error: 'el rendimiento no aplica a tarjetas de crédito' };
        tx.subtipo = sub;
        if (!tx.desc) tx.desc = sub === 'cashback' ? 'Cashback' : sub === 'rendimiento' ? 'Rendimiento' : 'Ingreso';
        tx.abonoDe = previo?.abonoDe || null;
        tx.abonoCompra = previo?.abonoCompra || null;
        if ('abonoDe' in b) {
            if (b.abonoDe === null) { tx.abonoDe = null; tx.abonoCompra = null; }   // desliga el abono
            else {
                const compra = d.transacciones.find(t => t.id === String(b.abonoDe));
                if (!compra) return { error: `abonoDe: no existe el movimiento ${b.abonoDe}` };
                if (compra.tipo !== 'gasto' || !compra.paraTercero) return { error: 'abonoDe debe ser el id de una compra para alguien más (un gasto con paraQuien)' };
                tx.abonoDe = compra.paraTercero;
                tx.abonoCompra = compra.id;
            }
        }
        if (tx.abonoCompra && ('abonoDe' in b || 'monto' in b)) {
            const pend = pendientesPorCompra(d.transacciones, previoId)[tx.abonoCompra]?.pendiente ?? 0;
            if (pend <= 0.009) return { error: `Esa compra de ${tx.abonoDe} ya está saldada` };
            if (monto > pend + 0.009) return { error: `El abono (${monto}) supera lo pendiente de esa compra (${pend})` };
        }
        if (tx.abonoDe && tx.subtipo) return { error: 'Un abono de Te deben no lleva subtipo' };
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
    const [cuentas, transacciones, categorias, topes] = await Promise.all(['cuentas', 'transacciones', 'categorias', 'topes'].map(n => firebase(env, uid, token, n)));
    return { cuentas, transacciones, categorias, topes };
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
    if (extra || (id && !['movimientos', 'cuentas'].includes(recurso))) return json({ error: 'Ruta no encontrada' }, 404);

    try {
        const token = await idTokenDe(env, uid, u.api, async (nuevo) => { u.api.refresh = nuevo; await ctx.putUser(uid, u); });
        const mes = url.searchParams.get('mes') || mesKey(hoy);
        const pideMes = recurso === 'movimientos' || recurso === 'presupuestos';
        if (pideMes && !MES.test(mes)) return json({ error: 'mes debe tener el formato AAAA-MM' }, 400);

        if (req.method === 'GET') {
            if (id) return json({ error: `Usa GET /api/${recurso}` }, 404);
            const v4 = await leerV4(env, uid, token);
            if (recurso === 'movimientos') {
                const f = leerFiltros(url.searchParams);
                if (f.error) return json({ error: f.error }, 400);
                const r = respMovimientos(v4, mes, f.filtros);
                return r.error ? json({ error: r.error }, 400) : json(r);
            }
            if (recurso === 'cuentas') return json(respCuentas(v4, hoy));
            if (recurso === 'presupuestos') return json(respPresupuestos(v4, mes));
            if (recurso === 'te-deben') return json(respTeDeben(v4, hoy, url.searchParams.get('persona')));
            return json({ error: 'Ruta no encontrada' }, 404);
        }
        if (!['movimientos', 'cuentas', 'presupuestos'].includes(recurso)) return json({ error: 'Ruta no encontrada' }, 404);

        let cuerpo = {};
        if (req.method === 'POST' || req.method === 'PATCH') {
            try { cuerpo = await req.json(); } catch { return json({ error: 'El cuerpo debe ser JSON' }, 400); }
        }

        // ---- Presupuestos: topes a partir de un mes (atómico: o todos o ninguno) ----
        if (recurso === 'presupuestos') {
            if (req.method !== 'PATCH' || id) return json({ error: 'Método no permitido' }, 405);
            const v4 = await leerV4(env, uid, token);
            const r = validarTopes(cuerpo, v4);
            if (r.error) return json({ error: r.error }, 400);
            await firebase(env, uid, token, `topes/${mes}`, 'PATCH', r.cambios);
            const nuevo = { ...v4, topes: { ...(v4.topes || {}), [mes]: { ...((v4.topes || {})[mes] || {}), ...r.cambios } } };
            return json(respPresupuestos(nuevo, mes));
        }

        // ---- Cuentas: alta y corrección (sin borrar) ----
        if (recurso === 'cuentas') {
            const v4 = await leerV4(env, uid, token);
            if (req.method === 'POST' && !id) {
                const r = validarCuenta(cuerpo, v4, { hoy });
                if (r.error) return json({ error: r.error }, 400);
                const { name } = await firebase(env, uid, token, 'cuentas', 'POST', limpiar(r.cuenta));
                const nuevo = { ...v4, cuentas: { ...(v4.cuentas || {}), [name]: r.cuenta } };
                const d = datosDe(nuevo);
                return json(cuentaPublica({ ...r.cuenta, id: name }, d, calcularSaldos(d.cuentas, d.transacciones), hoy), 201);
            }
            if (req.method === 'PATCH' && id) {
                const previo = v4.cuentas?.[id];
                if (!previo) return json({ error: 'Cuenta no encontrada' }, 404);
                const r = validarCuenta(cuerpo, v4, { previo: { ...previo, id }, hoy });
                if (r.error) return json({ error: r.error }, 400);
                await firebase(env, uid, token, `cuentas/${id}`, 'PUT', limpiar(r.cuenta));
                const nuevo = { ...v4, cuentas: { ...v4.cuentas, [id]: r.cuenta } };
                const d = datosDe(nuevo);
                return json(cuentaPublica({ ...r.cuenta, id }, d, calcularSaldos(d.cuentas, d.transacciones), hoy));
            }
            return json({ error: 'Método no permitido' }, 405);
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
            const r = validarMovimiento(cuerpo, v4, { previo, previoId: id, hoy });
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
