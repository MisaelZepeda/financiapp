// Compras a meses sin intereses: cuántas mensualidades van, cuántas faltan,
// cuánto queda por pagar y cuándo se libera cada compra.
//
// Una mensualidad se "factura" en cada corte, empezando por el primer corte
// en o después de la compra (ver primerCorteDesde en tarjetas.js).

import { ultimoCorte, primerCorteDesde, mesesEntre, fechaPagoDe } from './tarjetas.js';
import { fechaEnMes, sumarMeses, mesKey } from './fechas.js';

const r2 = (n) => Math.round(n * 100) / 100;

export function detalleMSI(cuenta, tx, hoy = new Date()) {
    const meses = Number(tx.msi) || 0;
    const mensualidad = r2((Number(tx.monto) || 0) / meses);
    const primerCorte = primerCorteDesde(cuenta, tx.fecha);
    const corteActual = ultimoCorte(cuenta, hoy);
    const facturadas = corteActual < primerCorte ? 0 : Math.min(meses, mesesEntre(primerCorte, corteActual) + 1);
    const restantes = meses - facturadas;
    const ultimoCorteMSI = fechaEnMes(sumarMeses(mesKey(primerCorte), meses - 1), cuenta.diaCorte || 1);
    return {
        tx, meses, mensualidad, facturadas, restantes,
        pendiente: r2(Math.max(0, (Number(tx.monto) || 0) - mensualidad * facturadas)),
        primerCorte, ultimoCorte: ultimoCorteMSI,
        ultimoPago: fechaPagoDe(cuenta, ultimoCorteMSI),
        activa: restantes > 0,
    };
}

// Todas las compras a MSI de una cuenta, activas primero (las que terminan antes, arriba).
export function msiDeCuenta(cuenta, transacciones, hoy = new Date()) {
    const compras = transacciones
        .filter(t => t.tipo === 'gasto' && t.cuentaId === cuenta.id && Number(t.msi) > 1)
        .map(t => detalleMSI(cuenta, t, hoy));
    const activas = compras.filter(c => c.activa).sort((a, b) => a.ultimoCorte.localeCompare(b.ultimoCorte));
    const terminadas = compras.filter(c => !c.activa).sort((a, b) => b.ultimoCorte.localeCompare(a.ultimoCorte));
    return {
        activas, terminadas,
        mensualidadTotal: r2(activas.reduce((a, c) => a + c.mensualidad, 0)),
        pendienteTotal: r2(activas.reduce((a, c) => a + c.pendiente, 0)),
    };
}
