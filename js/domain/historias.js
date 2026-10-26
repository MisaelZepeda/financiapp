// Datos de "Tu mes en resumen": las cifras que Tlaco narra en historias.

import { sumarMeses, ultimoDiaMes, sumarDias } from './fechas.js';
import { resumenMes, tasaAhorro, variacion, gastoPorDia } from './analisis.js';

const r2 = (n) => Math.round(n * 100) / 100;

export function datosResumenMes(transacciones, metas, key) {
    const mes = resumenMes(transacciones, key);
    const anterior = resumenMes(transacciones, sumarMeses(key, -1));
    const delMes = transacciones.filter(t => t.fecha?.startsWith(key));

    const cats = Object.entries(mes.porCategoria).sort((a, b) => b[1] - a[1]);
    const top = cats[0] ? {
        categoriaId: cats[0][0], monto: r2(cats[0][1]),
        porcentaje: mes.gastos ? (cats[0][1] / mes.gastos) * 100 : 0,
        variacion: variacion(cats[0][1], anterior.porCategoria[cats[0][0]] || 0),
    } : null;

    const { dias } = gastoPorDia(transacciones, key);
    const masCaro = Object.entries(dias).sort((a, b) => b[1] - a[1])[0];
    let diasSinGasto = 0;
    for (let f = `${key}-01`, fin = ultimoDiaMes(key); f <= fin; f = sumarDias(f, 1)) if (!dias[f]) diasSinGasto++;

    const meta = metas
        .filter(m => Number(m.montoObjetivo) > 0)
        .map(m => ({ ...m, progreso: Math.min(1, (Number(m.montoActual) || 0) / Number(m.montoObjetivo)) }))
        .sort((a, b) => b.progreso - a.progreso)[0] || null;

    return {
        mes: key,
        ingresos: mes.ingresos, gastos: mes.gastos, balance: mes.balance,
        variacionGastos: variacion(mes.gastos, anterior.gastos),
        ahorro: tasaAhorro(mes), ahorroAnterior: tasaAhorro(anterior),
        top, masCaro: masCaro ? { fecha: masCaro[0], monto: masCaro[1] } : null,
        movimientos: delMes.length, diasSinGasto,
        meta,
        hayDatos: delMes.length > 0,
    };
}

// Tono del cierre: celebrando si ahorraste, preocupado si gastaste más de lo que entró.
export function tonoResumen(d) {
    if (d.ingresos > 0 && d.balance >= d.ingresos * 0.1) return 'celebrando';
    if (d.balance < 0) return 'preocupado';
    return 'contento';
}
