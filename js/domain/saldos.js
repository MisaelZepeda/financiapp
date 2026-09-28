// Saldos calculados a partir de las transacciones (nunca se guardan).
// Convención: en débito/efectivo `saldo` es dinero disponible; en crédito
// `saldo` es la deuda.

import { ultimoDiaMes, ultimosMeses, mesKey } from './fechas.js';

const esCredito = (c) => c?.tipo === 'credito';

// Cambio que una transacción produce en el saldo de la cuenta `cuentaId`.
export function efectoEnCuenta(tx, cuentaId, cuenta) {
    const m = Number(tx.monto) || 0;
    const cred = esCredito(cuenta);
    let delta = 0;
    if (tx.cuentaId === cuentaId) {
        if (tx.tipo === 'gasto') delta += cred ? m : -m;
        else if (tx.tipo === 'ingreso') delta += cred ? -m : m;
        else if (tx.tipo === 'transferencia') delta += cred ? m : -m; // sale dinero (o se dispone de crédito)
    }
    if (tx.tipo === 'transferencia' && tx.cuentaDestinoId === cuentaId) {
        delta += cred ? -m : m; // entra dinero (o se paga la tarjeta)
    }
    return delta;
}

// Mapa { cuentaId: saldo } considerando transacciones con fecha <= `hasta` (opcional).
export function calcularSaldos(cuentas, transacciones, hasta = null) {
    const saldos = {};
    const porId = {};
    cuentas.forEach(c => { saldos[c.id] = Number(c.saldoInicial) || 0; porId[c.id] = c; });
    transacciones.forEach(tx => {
        if (hasta && tx.fecha > hasta) return;
        for (const id of [tx.cuentaId, tx.cuentaDestinoId]) {
            if (id == null || !(id in porId)) continue;
            if (id === tx.cuentaDestinoId && id === tx.cuentaId) continue;
            saldos[id] += efectoEnCuenta(tx, id, porId[id]);
        }
    });
    Object.keys(saldos).forEach(k => { saldos[k] = redondear(saldos[k]); });
    return saldos;
}

export function redondear(n) { return Math.round(n * 100) / 100; }

export function patrimonio(cuentas, saldos) {
    let activos = 0, deudas = 0, creditoLibre = 0;
    cuentas.forEach(c => {
        const s = saldos[c.id] || 0;
        if (esCredito(c)) { deudas += s; if (c.limite > 0) creditoLibre += Math.max(0, c.limite - s); }
        else activos += s;
    });
    return { activos: redondear(activos), deudas: redondear(deudas), creditoLibre: redondear(creditoLibre), neto: redondear(activos - deudas) };
}

// Patrimonio neto al cierre de cada uno de los últimos `n` meses (el mes en curso al día de hoy).
export function seriePatrimonio(cuentas, transacciones, n = 12, hoy = new Date()) {
    const actual = mesKey(hoy);
    return ultimosMeses(n, actual).map(key => {
        const corte = key === actual ? null : ultimoDiaMes(key);
        return { mes: key, neto: patrimonio(cuentas, calcularSaldos(cuentas, transacciones, corte)).neto };
    });
}
