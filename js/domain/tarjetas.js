// Tarjetas de crédito: ciclo de corte, fecha de pago, pago para no generar
// intereses y compras a meses sin intereses (MSI).
//
// Modelo: cada corte cierra un estado de cuenta con las compras hechas desde
// el corte anterior. Ese estado se paga en su fecha límite (el día de pago
// siguiente al corte). Las compras posteriores al último corte quedan
// "por facturar" y se pagarán en el siguiente ciclo.

import { hoyISO, mesKey, fechaEnMes, sumarMeses, diasEntre } from './fechas.js';

const dia = (c) => c.diaCorte || 1;

// Fecha (ISO) del último corte en o antes de hoy.
export function ultimoCorte(cuenta, hoy = new Date()) {
    const mes = mesKey(hoy);
    const esteMes = fechaEnMes(mes, dia(cuenta));
    return esteMes <= hoyISO(hoy) ? esteMes : fechaEnMes(sumarMeses(mes, -1), dia(cuenta));
}

export function cortePrevio(cuenta, corte) {
    return fechaEnMes(sumarMeses(mesKey(corte), -1), dia(cuenta));
}

// Fecha límite de pago del estado que cierra en `corte`.
export function fechaPagoDe(cuenta, corte) {
    const mes = mesKey(corte);
    const diaPago = cuenta.diaPago || dia(cuenta);
    return diaPago > dia(cuenta) ? fechaEnMes(mes, diaPago) : fechaEnMes(sumarMeses(mes, 1), diaPago);
}

// Mensualidad de una compra a MSI que se factura en el corte `corte`, o 0.
// La primera mensualidad cae en el primer corte en o después de la compra.
function mensualidadMSI(cuenta, tx, corte) {
    const meses = Number(tx.msi) || 0;
    const enMes = fechaEnMes(mesKey(tx.fecha), dia(cuenta));
    const primerCorte = enMes >= tx.fecha ? enMes : fechaEnMes(sumarMeses(mesKey(tx.fecha), 1), dia(cuenta));
    if (corte < primerCorte) return 0;
    const [y1, m1] = mesKey(primerCorte).split('-').map(Number);
    const [y2, m2] = mesKey(corte).split('-').map(Number);
    const n = (y2 - y1) * 12 + (m2 - m1);
    return n < meses ? Number(tx.monto) / meses : 0;
}

const r2 = (n) => Math.round(n * 100) / 100;

// Monto del estado de cuenta que cierra en `corte`: compras del ciclo (las
// de MSI solo con su mensualidad) menos cashback/abonos del ciclo.
export function montoEstado(cuenta, transacciones, corte) {
    const desde = cortePrevio(cuenta, corte);
    let total = 0;
    transacciones.forEach(tx => {
        if (tx.cuentaId !== cuenta.id) return;
        if (tx.tipo === 'gasto') {
            if (Number(tx.msi) > 1) total += mensualidadMSI(cuenta, tx, corte);
            else if (tx.fecha > desde && tx.fecha <= corte) total += Number(tx.monto) || 0;
        } else if (tx.tipo === 'ingreso' && tx.fecha > desde && tx.fecha <= corte) {
            total -= Number(tx.monto) || 0;
        }
    });
    return Math.max(0, r2(total));
}

// Compras hechas después del último corte (se pagarán en el siguiente ciclo).
export function porFacturar(cuenta, transacciones, hoy = new Date()) {
    const corte = ultimoCorte(cuenta, hoy);
    return r2(transacciones.reduce((a, tx) => {
        if (tx.cuentaId !== cuenta.id || tx.fecha <= corte) return a;
        if (tx.tipo === 'gasto' && !(Number(tx.msi) > 1)) return a + (Number(tx.monto) || 0);
        if (tx.tipo === 'ingreso') return a - (Number(tx.monto) || 0);
        return a;
    }, 0));
}

// Pagos a la tarjeta hechos después de `corte`.
export function abonadoDesde(cuenta, transacciones, corte) {
    return r2(transacciones
        .filter(tx => tx.tipo === 'transferencia' && tx.cuentaDestinoId === cuenta.id && tx.fecha > corte)
        .reduce((a, tx) => a + (Number(tx.monto) || 0), 0));
}

// Pago para no generar intereses del estado vigente.
export function pagoSinIntereses(cuenta, transacciones, hoy = new Date()) {
    return montoEstado(cuenta, transacciones, ultimoCorte(cuenta, hoy));
}

// Estado del pago vigente: días a la fecha límite (negativo = vencida),
// monto, lo abonado, lo pendiente y si ya está pagada (por abonos o porque
// el usuario la marcó en este periodo).
export function estadoPago(cuenta, transacciones, hoy = new Date()) {
    if (!cuenta.diaPago) return null;
    const corte = ultimoCorte(cuenta, hoy);
    const fechaPago = fechaPagoDe(cuenta, corte);
    const pago = montoEstado(cuenta, transacciones, corte);
    const abonado = abonadoDesde(cuenta, transacciones, corte);
    const periodo = mesKey(corte);
    const marcada = cuenta.pagadoPeriodo === periodo;
    const pendiente = marcada ? 0 : Math.max(0, r2(pago - abonado));
    return {
        corte, fechaPago, periodo, pago, abonado, pendiente, marcada,
        pagada: marcada || pendiente === 0,
        dias: diasEntre(hoyISO(hoy), fechaPago),
    };
}
