// "Puedes gastar hoy": el dinero libre hasta tu siguiente ingreso, repartido por día.
//
//   libre = débito + efectivo
//         − pagos fijos que salen de débito/efectivo antes del ingreso (incluye los atrasados)
//         − pagos de tarjeta con fecha límite antes del ingreso (lo que falta pagar)
//   por día = (libre + lo que ya gastaste hoy de débito/efectivo) ÷ días hasta el ingreso
//   hoy te quedan = por día − lo que ya gastaste hoy (con cualquier cuenta)
//
// El siguiente ingreso es el pago fijo de ingreso más próximo; si no tienes,
// se toma la siguiente quincena (día 15 o último día del mes).

import { hoyISO, mesKey, sumarMeses, sumarDias, ultimoDiaMes, diasEntre, fechaEnMes } from './fechas.js';
import { siguienteFecha } from './recurrentes.js';
import { fechaPagoDe, montoEstado, abonadoDesde } from './tarjetas.js';
import { esDeTercero } from './terceros.js';

const r2 = (n) => Math.round(n * 100) / 100;
const esLiquida = (c) => c && c.tipo !== 'credito';

// Próxima ocurrencia de un recurrente después de `h` (las atrasadas se saltan).
function proximaDespues(rec, h) {
    let f = rec.proximaFecha, vueltas = 0;
    while (f && f <= h && vueltas++ < 400) f = siguienteFecha(rec, f);
    return f && f > h ? f : null;
}

export function siguienteIngreso(cuentas, recurrentes, hoy = new Date()) {
    const h = hoyISO(hoy);
    const porId = Object.fromEntries(cuentas.map(c => [c.id, c]));
    let mejor = null;
    recurrentes.filter(r => r.tipo === 'ingreso' && r.activo !== false && r.proximaFecha && esLiquida(porId[r.cuentaId])).forEach(r => {
        const f = proximaDespues(r, h);
        if (f && (!mejor || f < mejor.fecha)) mejor = { fecha: f, desc: r.desc || 'Ingreso', monto: Number(r.monto) || 0, origen: 'recurrente' };
    });
    if (mejor) return mejor;
    const mes = mesKey(hoy);
    const quince = `${mes}-15`, fin = ultimoDiaMes(mes);
    return { fecha: h < quince ? quince : h < fin ? fin : `${sumarMeses(mes, 1)}-15`, desc: 'Quincena', monto: null, origen: 'quincena' };
}

export function puedesGastar({ cuentas = [], saldos = {}, transacciones = [], recurrentes = [] }, hoy = new Date()) {
    const h = hoyISO(hoy);
    const ingreso = siguienteIngreso(cuentas, recurrentes, hoy);
    const hasta = ingreso.fecha;                       // el día del ingreso ya no cuenta
    const porId = Object.fromEntries(cuentas.map(c => [c.id, c]));
    const disponible = r2(cuentas.filter(esLiquida).reduce((a, c) => a + (saldos[c.id] || 0), 0));

    // Pagos fijos de débito/efectivo antes del ingreso (los atrasados también: aún no salen).
    const pagosFijos = [];
    recurrentes.filter(r => r.tipo === 'gasto' && r.activo !== false && r.proximaFecha && esLiquida(porId[r.cuentaId])).forEach(r => {
        let f = r.proximaFecha, vueltas = 0;
        while (f < hasta && vueltas++ < 60) { pagosFijos.push({ fecha: f, desc: r.desc || 'Pago fijo', monto: Number(r.monto) || 0 }); f = siguienteFecha(r, f); }
    });

    // Tarjetas: lo que falta pagar de cada estado cuya fecha límite cae antes del ingreso.
    const tarjetas = [];
    cuentas.filter(c => c.tipo === 'credito' && c.diaPago).forEach(c => {
        const mes = mesKey(hoy);
        [sumarMeses(mes, -2), sumarMeses(mes, -1), mes].forEach(mesCorte => {
            const corte = fechaEnMes(mesCorte, c.diaCorte || 1);
            if (corte > h) return;                              // estado aún abierto
            const limite = fechaPagoDe(c, corte);
            if (limite >= hasta) return;
            if (c.pagadoPeriodo === mesKey(corte)) return;
            const pendiente = r2(montoEstado(c, transacciones, corte) - abonadoDesde(c, transacciones, corte));
            // Un estado viejo ya cubierto por pagos posteriores no vuelve a contar.
            if (pendiente > 0 && diasEntre(limite, h) < 45) tarjetas.push({ fecha: limite, desc: c.nombre, monto: pendiente, cuentaId: c.id });
        });
    });

    const comprometido = r2(pagosFijos.reduce((a, p) => a + p.monto, 0) + tarjetas.reduce((a, p) => a + p.monto, 0));
    const libre = r2(disponible - comprometido);
    const dias = Math.max(1, diasEntre(h, hasta));
    const deHoy = transacciones.filter(t => t.tipo === 'gasto' && t.fecha === h && !t.recurrenteId && !esDeTercero(t));
    const montoHoy = (t) => (Number(t.monto) || 0) / (Number(t.msi) > 1 ? Number(t.msi) : 1);
    const gastadoHoyLiquido = r2(deHoy.filter(t => esLiquida(porId[t.cuentaId])).reduce((a, t) => a + montoHoy(t), 0));
    const gastadoHoy = r2(deHoy.reduce((a, t) => a + montoHoy(t), 0));
    const porDia = r2(Math.max(0, libre + gastadoHoyLiquido) / dias);
    return {
        ingreso, dias, disponible, comprometido, libre, porDia, gastadoHoy,
        hoyQueda: r2(porDia - gastadoHoy),
        pagosFijos: pagosFijos.sort((a, b) => a.fecha.localeCompare(b.fecha)),
        tarjetas: tarjetas.sort((a, b) => a.fecha.localeCompare(b.fecha)),
        alcanza: libre >= 0,
    };
}
