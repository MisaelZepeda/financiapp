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

// Lo que otras personas te deben por compras que hiciste por ellas (compras
// marcadas `paraTercero` menos sus abonos `abonoDe`), hasta la fecha `hasta`.
// Se separa lo comprado con tarjeta (`credito`: se descuenta de lo que debes,
// porque esa deuda la paga la otra persona) de lo pagado con débito o efectivo
// (`otros`: se suma a lo que tienes). Los abonos cubren primero lo de tarjeta,
// igual que las mensualidades del banco.
export function porCobrar(transacciones, cuentas = [], hasta = null) {
    const credito = new Set(cuentas.filter(esCredito).map(c => c.id));
    const porPersona = {};
    transacciones.forEach(tx => {
        if (hasta && tx.fecha > hasta) return;
        const nombre = tx.tipo === 'gasto' ? tx.paraTercero : tx.tipo === 'ingreso' ? tx.abonoDe : null;
        if (!nombre) return;
        const p = porPersona[String(nombre).trim().toLowerCase()] ||= { credito: 0, otros: 0, abonos: 0 };
        const m = Number(tx.monto) || 0;
        if (tx.tipo === 'ingreso') p.abonos += m;
        else if (credito.has(tx.cuentaId)) p.credito += m;
        else p.otros += m;
    });
    let enCredito = 0, otros = 0;
    Object.values(porPersona).forEach(p => {
        const c = Math.max(0, p.credito - p.abonos);
        enCredito += c;
        otros += Math.max(0, p.otros - Math.max(0, p.abonos - p.credito));
    });
    return { credito: redondear(enCredito), otros: redondear(otros), total: redondear(enCredito + otros) };
}

// `deudas` es lo que marcan tus tarjetas; `deudasPropias` le quita lo que pagan
// otras personas (Te deben). `activos` es el dinero en tus cuentas y `teDeben`
// lo que te deben por compras pagadas con débito o efectivo.
export function patrimonio(cuentas, saldos, cobrar = { credito: 0, otros: 0 }) {
    let activos = 0, deudas = 0, creditoLibre = 0;
    cuentas.forEach(c => {
        const s = saldos[c.id] || 0;
        if (esCredito(c)) { deudas += s; if (c.limite > 0) creditoLibre += Math.max(0, c.limite - s); }
        else activos += s;
    });
    const deudasPropias = Math.max(0, deudas - (cobrar.credito || 0));
    const teDeben = (cobrar.otros || 0) + Math.max(0, (cobrar.credito || 0) - deudas);
    return {
        activos: redondear(activos), teDeben: redondear(teDeben),
        deudas: redondear(deudas), deudasPropias: redondear(deudasPropias), creditoLibre: redondear(creditoLibre),
        neto: redondear(activos + teDeben - deudasPropias),
    };
}

// Patrimonio neto al cierre de cada uno de los últimos `n` meses (el mes en curso al día de hoy).
export function seriePatrimonio(cuentas, transacciones, n = 12, hoy = new Date()) {
    const actual = mesKey(hoy);
    return ultimosMeses(n, actual).map(key => {
        const corte = key === actual ? null : ultimoDiaMes(key);
        return { mes: key, neto: patrimonio(cuentas, calcularSaldos(cuentas, transacciones, corte), porCobrar(transacciones, cuentas, corte)).neto };
    });
}
