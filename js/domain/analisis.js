// Cálculos de análisis. Los traspasos y pagos de tarjeta NO cuentan como
// ingreso ni gasto: solo mueven dinero entre cuentas propias.

import { mesKey, ultimosMeses, sumarMeses } from './fechas.js';

const monto = (tx) => Number(tx.monto) || 0;
const r2 = (n) => Math.round(n * 100) / 100;

// Un gasto dividido reparte su monto entre categorías; uno normal va completo a la suya.
export function partesDe(tx) {
    if (Array.isArray(tx.partes) && tx.partes.length) return tx.partes.map(p => ({ categoriaId: p.categoriaId || 'otros', monto: Number(p.monto) || 0 }));
    return [{ categoriaId: tx.categoriaId || 'otros', monto: monto(tx) }];
}

export function resumenMes(transacciones, key) {
    let ingresos = 0, gastos = 0;
    const porCategoria = {};
    transacciones.forEach(tx => {
        if (!tx.fecha?.startsWith(key)) return;
        if (tx.tipo === 'ingreso') ingresos += monto(tx);
        else if (tx.tipo === 'gasto') {
            gastos += monto(tx);
            partesDe(tx).forEach(p => { porCategoria[p.categoriaId] = (porCategoria[p.categoriaId] || 0) + p.monto; });
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

// Total de gasto por etiqueta en un rango ('AAAA-MM' a 'AAAA-MM', ambos incluidos).
export function porEtiqueta(transacciones, desde = '0000-00', hasta = '9999-99') {
    const grupos = {};
    transacciones.forEach(tx => {
        if (tx.tipo !== 'gasto' || !tx.etiquetas?.length || !tx.fecha) return;
        const m = tx.fecha.slice(0, 7);
        if (m < desde || m > hasta) return;
        tx.etiquetas.forEach(e => {
            const g = grupos[e] || (grupos[e] = { etiqueta: e, total: 0, veces: 0, desde: tx.fecha, hasta: tx.fecha });
            g.total += monto(tx); g.veces += 1;
            if (tx.fecha < g.desde) g.desde = tx.fecha;
            if (tx.fecha > g.hasta) g.hasta = tx.fecha;
        });
    });
    return Object.values(grupos).map(g => ({ ...g, total: r2(g.total) })).sort((a, b) => b.total - a.total);
}

// Este año contra el anterior: gasto de cada mes (enero a diciembre) y el mes actual
// contra el mismo mes del año pasado. Los meses futuros de este año quedan en null.
export function comparativoAnual(transacciones, hoy = new Date()) {
    const actual = mesKey(hoy);
    const anio = Number(actual.slice(0, 4));
    const mesN = Number(actual.slice(5, 7));
    const gastoMes = (k) => resumenMes(transacciones, k).gastos;
    const k = (a, m) => `${a}-${String(m).padStart(2, '0')}`;
    const meses = Array.from({ length: 12 }, (_, i) => i + 1);
    const este = resumenMes(transacciones, actual);
    const pasado = resumenMes(transacciones, k(anio - 1, mesN));
    const acumulado = (a) => r2(meses.filter(m => m <= mesN).reduce((s, m) => s + gastoMes(k(a, m)), 0));
    // Antes de tu primer movimiento no hay datos (null), no gasto en cero.
    const primero = transacciones.reduce((min, t) => (t.fecha && t.fecha.slice(0, 7) < min ? t.fecha.slice(0, 7) : min), actual);
    const valor = (key) => (key < primero ? null : gastoMes(key));
    return {
        anio, mes: actual,
        serieActual: meses.map(m => (m <= mesN ? valor(k(anio, m)) : null)),
        serieAnterior: meses.map(m => valor(k(anio - 1, m))),
        este, pasado,
        variacionMes: variacion(este.gastos, pasado.gastos),
        acumuladoActual: acumulado(anio), acumuladoAnterior: acumulado(anio - 1),
        hayAnterior: meses.some(m => gastoMes(k(anio - 1, m)) > 0),
    };
}

// Gasto de cada día del mes: { 'AAAA-MM-DD': total }, el máximo y la referencia
// de la escala (percentil 85), para que un solo día enorme (la renta) no deje
// todos los demás en el tono más claro.
export function gastoPorDia(transacciones, key) {
    const dias = {};
    transacciones.forEach(tx => {
        if (tx.tipo !== 'gasto' || !tx.fecha?.startsWith(key)) return;
        dias[tx.fecha] = r2((dias[tx.fecha] || 0) + monto(tx));
    });
    const valores = Object.values(dias).sort((a, b) => a - b);
    const referencia = valores.length ? valores[Math.min(valores.length - 1, Math.floor(valores.length * 0.85))] : 0;
    return { dias, maximo: valores[valores.length - 1] || 0, referencia };
}

// Nivel 0–4 de un día para el mapa de calor (0 = sin gasto).
export function nivelCalor(valor, maximo) {
    if (!valor || !maximo) return 0;
    return Math.min(4, Math.max(1, Math.ceil((valor / maximo) * 4)));
}

// Un ingreso "grande" (la quincena, la nómina) merece confeti: al menos $3,000 y
// al menos el 40 % de tu ingreso mensual promedio de los últimos 3 meses.
export function esIngresoGrande(montoIngreso, transacciones, hoy = new Date()) {
    const m = Number(montoIngreso) || 0;
    if (m < 3000) return false;
    const previos = [1, 2, 3].map(i => resumenMes(transacciones, sumarMeses(mesKey(hoy), -i)).ingresos).filter(x => x > 0);
    if (!previos.length) return true;
    return m >= (previos.reduce((a, b) => a + b, 0) / previos.length) * 0.4;
}
