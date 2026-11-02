// Compras para alguien más ("Te deben").
//
// Una compra que hiciste por otra persona es un gasto normal en tu cuenta
// (tu tarjeta sí la debe, con sus meses sin intereses), marcado con
// `paraTercero: 'Nombre'`. Lo que esa persona te devuelve es un ingreso
// marcado con `abonoDe: 'Nombre'`. Ninguno de los dos cuenta como gasto o
// ingreso tuyo en análisis, presupuestos, retos ni en el ánimo de Tlaco;
// los saldos de tus cuentas sí se mueven, porque el dinero sí se movió.

import { hoyISO, sumarMeses, fechaEnMes, mesKey } from './fechas.js';
import { detalleMSI } from './msi.js';
import { fechaPagoDe, primerCorteDesde } from './tarjetas.js';

const r2 = (n) => Math.round(n * 100) / 100;
const clave = (nombre) => String(nombre || '').trim().toLowerCase();

export const esDeTercero = (tx) => !!(tx && (tx.paraTercero || tx.abonoDe));

// Cobros de cada compra: lo que la persona te debe pagar y cuándo (las mismas
// mensualidades y fechas límite que te cobra el banco). De contado: un solo cobro.
export function cobrosDeCompra(tx, cuenta) {
    const monto = Number(tx.monto) || 0;
    const meses = Number(tx.msi) || 0;
    if (cuenta?.tipo === 'credito' && meses > 1) {
        const d = detalleMSI(cuenta, tx);
        return Array.from({ length: meses }, (_, i) => {
            const corte = fechaEnMes(sumarMeses(mesKey(d.primerCorte), i), cuenta.diaCorte || 1);
            return { fecha: fechaPagoDe(cuenta, corte), monto: i === meses - 1 ? r2(monto - d.mensualidad * (meses - 1)) : d.mensualidad };
        });
    }
    if (cuenta?.tipo === 'credito' && cuenta.diaPago) return [{ fecha: fechaPagoDe(cuenta, primerCorteDesde(cuenta, tx.fecha)), monto }];
    return [{ fecha: tx.fecha, monto }];
}

// Resumen por persona: { nombre, compras, cobros, total, abonado, pendiente,
// vencido (lo que ya debió pagarte), proximo { fecha, monto }, mensualidad, saldada }
export function deudasTerceros(cuentas, transacciones, hoy = new Date()) {
    const h = hoyISO(hoy);
    const porId = Object.fromEntries(cuentas.map(c => [c.id, c]));
    const personas = {};
    const persona = (nombre) => personas[clave(nombre)] || (personas[clave(nombre)] = { nombre: String(nombre).trim(), compras: [], abonos: [], cobros: [] });

    transacciones.forEach(tx => {
        if (tx.tipo === 'gasto' && tx.paraTercero) {
            const p = persona(tx.paraTercero);
            p.compras.push(tx);
            p.cobros.push(...cobrosDeCompra(tx, porId[tx.cuentaId]));
        } else if (tx.tipo === 'ingreso' && tx.abonoDe) persona(tx.abonoDe).abonos.push(tx);
    });

    return Object.values(personas).map(p => {
        p.cobros.sort((a, b) => a.fecha.localeCompare(b.fecha));
        const total = r2(p.compras.reduce((a, t) => a + (Number(t.monto) || 0), 0));
        const abonado = r2(p.abonos.reduce((a, t) => a + (Number(t.monto) || 0), 0));
        const pendiente = r2(Math.max(0, total - abonado));
        const debioPagar = r2(p.cobros.filter(c => c.fecha <= h).reduce((a, c) => a + c.monto, 0));
        const vencido = r2(Math.max(0, debioPagar - abonado));
        // El siguiente cobro que aún no cubren sus abonos.
        let acumulado = 0, proximo = null;
        for (const c of p.cobros) {
            acumulado = r2(acumulado + c.monto);
            if (acumulado > abonado + 0.009) { proximo = { fecha: c.fecha, monto: r2(Math.min(c.monto, acumulado - abonado)) }; break; }
        }
        const futuros = p.cobros.filter(c => c.fecha > h);
        return {
            nombre: p.nombre, compras: p.compras, abonos: p.abonos.sort((a, b) => b.fecha.localeCompare(a.fecha)), cobros: p.cobros,
            total, abonado, pendiente, vencido, proximo,
            mensualidad: futuros[0]?.monto || proximo?.monto || 0,
            saldada: pendiente <= 0.009,
        };
    }).sort((a, b) => Number(a.saldada) - Number(b.saldada) || b.pendiente - a.pendiente);
}

export const totalTeDeben = (deudas) => r2(deudas.reduce((a, d) => a + d.pendiente, 0));
