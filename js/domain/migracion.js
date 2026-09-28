// Migración de los datos de la versión publicada (v1, en Usuarios/{uid}) al
// formato v4 (en Usuarios/{uid}/v4). Función pura: no lee ni escribe nada;
// quien la llama decide si guardar el resultado.
//
// Clave de la migración: en v4 el saldo se calcula. Para que cada cuenta
// conserve exactamente su saldo actual, saldoInicial = saldo v1 − efecto de
// todas sus transacciones. El reporte compara ambos saldos cuenta por cuenta.

import { calcularSaldos, redondear } from './saldos.js';
import { hoyISO, mesKey } from './fechas.js';
import { categoriasIniciales, slugCategoria, iconoSugerido } from './categorias.js';
import { siguienteFecha } from './recurrentes.js';
import { ultimoCorte } from './tarjetas.js';

const lista = (v) => (Array.isArray(v) ? v : Object.values(v || {})).filter(Boolean);
const idStr = (v) => (v == null || v === '' ? null : String(v));

export const VERSION_DATOS = 4;

export function migrarV1(v1, hoy = new Date()) {
    const h = hoyISO(hoy);

    // Categorías: base + propias + las que aparezcan en transacciones.
    const categorias = categoriasIniciales();
    let orden = Object.keys(categorias).length;
    const asegurarCategoria = (nombre) => {
        const id = slugCategoria(nombre || 'Otros');
        if (!categorias[id]) categorias[id] = { id, nombre: String(nombre).trim() || 'Otros', icono: iconoSugerido(nombre), orden: orden++ };
        return id;
    };
    lista(v1.categoriasCustom).forEach(asegurarCategoria);
    Object.entries(v1.presupuestos || {}).forEach(([nombre, limite]) => {
        const id = asegurarCategoria(nombre);
        if (Number(limite) > 0) categorias[id].presupuesto = Number(limite);
    });

    // Transacciones con el esquema único.
    const transacciones = {};
    Object.entries(v1.transacciones || {}).forEach(([key, t]) => {
        if (!t || !t.tipo) return;
        const base = { monto: Number(t.monto) || 0, fecha: t.fecha || h, desc: t.desc || '' };
        let tx;
        if (t.tipo === 'gasto') {
            tx = { ...base, tipo: 'gasto', cuentaId: idStr(t.cuentaId), categoriaId: asegurarCategoria(t.cat || 'Otros') };
            if (t.isMSI && Number(t.meses) > 1) tx.msi = Number(t.meses);
        } else if (t.tipo === 'ingreso') {
            tx = { ...base, tipo: 'ingreso', cuentaId: idStr(t.cuentaId) };
            const sub = t.subtipo || (t.desc === 'Rendimiento' ? 'rendimiento' : null);
            if (sub) tx.subtipo = sub;
        } else if (t.tipo === 'movimiento') {
            tx = { ...base, tipo: 'transferencia', subtipo: t.subtipo === 'pago' ? 'pago_tdc' : 'traspaso', cuentaId: idStr(t.origenId), cuentaDestinoId: idStr(t.destinoId) };
        } else return;
        tx.id = key;
        tx.creadoEn = 0; // desconocido en v1; el orden estable lo da la fecha y el id
        transacciones[key] = tx;
    });
    const txs = Object.values(transacciones);

    // Cuentas: saldoInicial para que el saldo calculado iguale al de v1.
    const cuentasV1 = lista(v1.cuentas);
    const cuentas = {};
    cuentasV1.forEach(c => {
        const id = idStr(c.id);
        const cuenta = {
            id, nombre: c.nombre || c.banco || 'Cuenta', banco: c.banco || '', tipo: c.tipo || 'debito',
            saldoInicial: 0, fechaInicial: h,
        };
        if (c.digitos) cuenta.digitos = String(c.digitos);
        if (c.clabe) cuenta.clabe = String(c.clabe);
        if (c.icon) cuenta.icono = c.icon;
        if (cuenta.tipo === 'credito') {
            cuenta.limite = Number(c.limite) || 0;
            if (c.diaCorte) cuenta.diaCorte = Number(c.diaCorte);
            if (c.diaPago) cuenta.diaPago = Number(c.diaPago);
            // mesPagado en v1 era solo el número de mes; solo se respeta si es el mes actual.
            if (c.mesPagado === hoy.getMonth()) cuenta.pagadoPeriodo = mesKey(ultimoCorte(cuenta, hoy));
        }
        cuentas[id] = cuenta;
    });
    const efecto = calcularSaldos(Object.values(cuentas), txs);
    const primeraFecha = {};
    txs.forEach(tx => [tx.cuentaId, tx.cuentaDestinoId].forEach(id => {
        if (id && cuentas[id] && (!primeraFecha[id] || tx.fecha < primeraFecha[id])) primeraFecha[id] = tx.fecha;
    }));
    cuentasV1.forEach(c => {
        const id = idStr(c.id);
        cuentas[id].saldoInicial = redondear((Number(c.saldo) || 0) - efecto[id]);
        cuentas[id].fechaInicial = primeraFecha[id] || h;
    });

    const metas = {};
    lista(v1.metas).forEach((m, i) => {
        const id = idStr(m.id) || `meta_${i}`;
        metas[id] = {
            id, nombre: m.nombre || 'Meta', icono: m.emoji || 'target',
            montoObjetivo: Number(m.montoObjetivo) || 0, montoActual: Number(m.montoActual) || 0,
            ...(m.fechaLimite ? { fechaLimite: m.fechaLimite } : {}),
        };
    });

    const recurrentes = {};
    lista(v1.recurrentes).forEach((r, i) => {
        const rec = {
            id: idStr(r.id) || `rec_${i}`, tipo: r.tipo === 'ingreso' ? 'ingreso' : 'gasto', desc: r.desc || '', monto: Number(r.monto) || 0,
            cuentaId: idStr(r.cuentaId), frecuencia: r.frecuencia || 'mensual', activo: r.activo !== false,
        };
        if (r.diaMes) rec.diaMes = Number(r.diaMes);
        if (rec.tipo === 'gasto') rec.categoriaId = asegurarCategoria(r.cat || 'Otros');
        rec.proximaFecha = r.ultimaGeneracion ? siguienteFecha(rec, r.ultimaGeneracion) : h;
        recurrentes[rec.id] = rec;
    });

    const perfil = { nombre: v1.perfil?.nombre || 'Usuario', foto: v1.perfil?.foto || '' };

    const v4 = {
        meta: { version: VERSION_DATOS, origen: 'v1', migradoEn: Date.now() },
        perfil, ajustes: {}, cuentas, categorias, transacciones, metas, recurrentes,
        notifDescartadas: v1.notifDescartadas || {},
    };

    // Reporte: saldo v1 contra saldo calculado en v4.
    const calculado = calcularSaldos(Object.values(cuentas), txs);
    const reporte = cuentasV1.map(c => {
        const id = idStr(c.id);
        const antes = redondear(Number(c.saldo) || 0);
        return { id, nombre: cuentas[id].nombre, tipo: cuentas[id].tipo, antes, despues: calculado[id], ok: Math.abs(antes - calculado[id]) < 0.005 };
    });
    const huerfanas = txs.filter(tx => (tx.cuentaId && !cuentas[tx.cuentaId]) || (tx.cuentaDestinoId && !cuentas[tx.cuentaDestinoId])).length;

    return { v4, reporte, ok: reporte.every(r => r.ok), resumen: { cuentas: cuentasV1.length, transacciones: txs.length, huerfanas, metas: Object.keys(metas).length, recurrentes: Object.keys(recurrentes).length } };
}
