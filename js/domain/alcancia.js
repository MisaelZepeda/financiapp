// Alcancía de morralla: al final del día echas las monedas que juntaste.
// Es una cuenta de efectivo marcada `alcancia: true`; cada vez que echas monedas
// se registra un traspaso (subtipo 'alcancia') desde tu Efectivo, así tu total
// no cambia: el dinero solo se mueve de la bolsa a la alcancía.

import { hoyISO, sumarDias, mesKey } from './fechas.js';

const r2 = (n) => Math.round(n * 100) / 100;

export const esAlcancia = (c) => !!c?.alcancia;

// De dónde salen las monedas: tu Efectivo; si no tienes, la primera de débito.
export function origenAlcancia(cuentas) {
    const libres = cuentas.filter(c => !esAlcancia(c) && c.tipo !== 'credito');
    return libres.find(c => c.tipo === 'efectivo') || libres[0] || null;
}

// → null si aún no hay alcancía; si no { cuenta, total, hoy, mes, racha, dias }
//   racha: días seguidos echando monedas (termina hoy, o ayer si hoy aún no).
export function resumenAlcancia(cuentas, saldos, transacciones, hoy = new Date()) {
    const cuenta = cuentas.find(esAlcancia);
    if (!cuenta) return null;
    const h = hoyISO(hoy);
    const porDia = {};
    transacciones.forEach(t => {
        if (t.tipo === 'transferencia' && t.cuentaDestinoId === cuenta.id && t.fecha) porDia[t.fecha] = r2((porDia[t.fecha] || 0) + (Number(t.monto) || 0));
    });
    let racha = 0;
    for (let f = porDia[h] ? h : sumarDias(h, -1); porDia[f]; f = sumarDias(f, -1)) racha++;
    const mes = mesKey(hoy);
    return {
        cuenta,
        total: r2(saldos[cuenta.id] || 0),
        hoy: porDia[h] || 0,
        mes: r2(Object.entries(porDia).filter(([f]) => f.startsWith(mes)).reduce((a, [, v]) => a + v, 0)),
        racha,
        dias: Object.keys(porDia).length,
    };
}
