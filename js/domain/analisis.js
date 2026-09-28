// Cálculos de análisis. Los traspasos y pagos de tarjeta NO cuentan como
// ingreso ni gasto: solo mueven dinero entre cuentas propias.

import { mesKey, ultimosMeses, sumarMeses } from './fechas.js';

const monto = (tx) => Number(tx.monto) || 0;
const r2 = (n) => Math.round(n * 100) / 100;

export function resumenMes(transacciones, key) {
    let ingresos = 0, gastos = 0;
    const porCategoria = {};
    transacciones.forEach(tx => {
        if (!tx.fecha?.startsWith(key)) return;
        if (tx.tipo === 'ingreso') ingresos += monto(tx);
        else if (tx.tipo === 'gasto') {
            gastos += monto(tx);
            const c = tx.categoriaId || 'otros';
            porCategoria[c] = (porCategoria[c] || 0) + monto(tx);
        }
    });
    return { mes: key, ingresos: r2(ingresos), gastos: r2(gastos), balance: r2(ingresos - gastos), porCategoria };
}

export function serieMensual(transacciones, n = 12, hoy = new Date()) {
    return ultimosMeses(n, mesKey(hoy)).map(k => resumenMes(transacciones, k));
}

// Variación porcentual; null si no hay base para comparar.
export function variacion(actual, anterior) {
    if (!anterior) return actual ? null : 0;
    return ((actual - anterior) / anterior) * 100;
}

// Cada categoría del mes actual contra su promedio de los 3 meses previos.
export function comparativaCategorias(transacciones, hoy = new Date()) {
    const actual = mesKey(hoy);
    const previos = [1, 2, 3].map(i => resumenMes(transacciones, sumarMeses(actual, -i)).porCategoria);
    const este = resumenMes(transacciones, actual).porCategoria;
    const ids = new Set([...Object.keys(este), ...previos.flatMap(p => Object.keys(p))]);
    return [...ids].map(id => {
        const promedio = r2(previos.reduce((a, p) => a + (p[id] || 0), 0) / 3);
        const mes = r2(este[id] || 0);
        return { categoriaId: id, mes, promedio, diferencia: r2(mes - promedio), variacion: variacion(mes, promedio) };
    }).sort((a, b) => b.mes - a.mes || b.promedio - a.promedio);
}

export function gastosMasGrandes(transacciones, key, n = 5) {
    return transacciones.filter(tx => tx.tipo === 'gasto' && tx.fecha?.startsWith(key))
        .sort((a, b) => monto(b) - monto(a)).slice(0, n);
}

// Descripciones de gasto más repetidas en los últimos `meses` meses.
export function gastosFrecuentes(transacciones, hoy = new Date(), meses = 3, n = 5) {
    const desde = sumarMeses(mesKey(hoy), -(meses - 1));
    const grupos = {};
    transacciones.forEach(tx => {
        if (tx.tipo !== 'gasto' || !tx.fecha || tx.fecha.slice(0, 7) < desde) return;
        const k = (tx.desc || '').trim().toLowerCase();
        if (!k) return;
        const g = grupos[k] || (grupos[k] = { desc: tx.desc.trim(), veces: 0, total: 0, categoriaId: tx.categoriaId });
        g.veces += 1; g.total += monto(tx);
    });
    return Object.values(grupos).filter(g => g.veces > 1)
        .sort((a, b) => b.veces - a.veces || b.total - a.total).slice(0, n)
        .map(g => ({ ...g, total: r2(g.total) }));
}

// Porcentaje del ingreso que no se gastó.
export function tasaAhorro({ ingresos, gastos }) {
    return ingresos > 0 ? ((ingresos - gastos) / ingresos) * 100 : null;
}

// La categoría con el cambio más notable frente al mes anterior.
export function insightPrincipal(transacciones, hoy = new Date()) {
    const actual = mesKey(hoy);
    const este = resumenMes(transacciones, actual).porCategoria;
    const antes = resumenMes(transacciones, sumarMeses(actual, -1)).porCategoria;
    let mejor = null;
    Object.keys(este).forEach(id => {
        if (!antes[id]) return;
        const v = variacion(este[id], antes[id]);
        if (!mejor || Math.abs(v) > Math.abs(mejor.variacion)) mejor = { categoriaId: id, variacion: v };
    });
    return mejor;
}
