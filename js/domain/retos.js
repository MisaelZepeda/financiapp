// Retos de Tlaco: metas cortas de hábitos, de unos días.
//   sin-categoria     N días sin gastar en una categoría
//   tope-diario       N días gastando como máximo $X cada día
//   registrar-diario  N días registrando al menos un movimiento cada día
// Un reto guardado: { tipo, dias, inicio: 'AAAA-MM-DD', categoriaId?, tope?, celebrado? }

import { hoyISO, sumarDias, diasEntre, mesKey, sumarMeses } from './fechas.js';
import { partesDe, resumenMes } from './analisis.js';

export const TIPOS_RETO = {
    'sin-categoria': { icono: 'shield', nombre: 'Días sin gastar en…', dias: [3, 7, 14] },
    'tope-diario': { icono: 'target', nombre: 'Gasto diario máximo', dias: [5, 7, 14] },
    'registrar-diario': { icono: 'check-circle', nombre: 'Registrar todos los días', dias: [7, 14, 30] },
};

const r2 = (n) => Math.round(n * 100) / 100;

export function tituloReto(reto, nombreCategoria = '') {
    if (reto.tipo === 'sin-categoria') return `${reto.dias} días sin gastar en ${nombreCategoria || 'esa categoría'}`;
    if (reto.tipo === 'tope-diario') return `${reto.dias} días con máximo $${Number(reto.tope || 0).toLocaleString('es-MX')} al día`;
    return `Registrar ${reto.dias} días seguidos`;
}

// Estado de un reto a la fecha `hoy`.
// → { estado: 'activo'|'cumplido'|'fallido', fin, diasOk, progreso (0–1), falloEn, hoyGastado }
export function evaluarReto(reto, transacciones, hoy = new Date()) {
    const h = hoyISO(hoy);
    const fin = sumarDias(reto.inicio, reto.dias - 1);
    const hasta = h < fin ? h : fin;
    const txs = transacciones.filter(t => t.fecha >= reto.inicio && t.fecha <= hasta);
    const base = { fin, falloEn: null, hoyGastado: 0 };
    if (h < reto.inicio) return { ...base, estado: 'activo', diasOk: 0, progreso: 0 };

    const dias = [];
    for (let f = reto.inicio; f <= hasta; f = sumarDias(f, 1)) dias.push(f);
    const terminado = h > fin;

    if (reto.tipo === 'registrar-diario') {
        const conRegistro = new Set(txs.map(t => t.fecha));
        // Hoy todavía puede registrarse: solo falla un día ya pasado sin registro.
        const falloEn = dias.find(f => f < h && !conRegistro.has(f)) || (terminado ? dias.find(f => !conRegistro.has(f)) : null) || null;
        const diasOk = dias.filter(f => conRegistro.has(f)).length;
        const estado = falloEn ? 'fallido' : diasOk >= reto.dias ? 'cumplido' : 'activo';
        return { ...base, estado, falloEn, diasOk, progreso: Math.min(1, diasOk / reto.dias) };
    }

    const gastoDia = {};
    // El tope diario mide el gasto variable: los recurrentes (renta, suscripciones) no cuentan.
    txs.filter(t => t.tipo === 'gasto' && (reto.tipo === 'sin-categoria' || !t.recurrenteId)).forEach(t => {
        const m = reto.tipo === 'sin-categoria'
            ? partesDe(t).filter(p => p.categoriaId === reto.categoriaId).reduce((a, p) => a + p.monto, 0)
            : Number(t.monto) || 0;
        if (m > 0) gastoDia[t.fecha] = r2((gastoDia[t.fecha] || 0) + m);
    });
    const limite = reto.tipo === 'sin-categoria' ? 0 : Number(reto.tope) || 0;
    const falloEn = dias.find(f => (gastoDia[f] || 0) > limite) || null;
    // Los días cuentan cuando terminan: hoy todavía no está completo.
    const diasOk = falloEn ? dias.filter(f => f < falloEn).length : dias.filter(f => f < h).length;
    const estado = falloEn ? 'fallido' : terminado ? 'cumplido' : 'activo';
    return { ...base, estado, falloEn, diasOk, progreso: Math.min(1, diasOk / reto.dias), hoyGastado: gastoDia[h] || 0 };
}

// Propuestas según tus gastos: la categoría variable con más gasto en 3 meses
// y un tope diario un 20 % abajo de tu promedio variable (redondeado a $50).
const FIJAS = new Set(['vivienda', 'servicios', 'suscripciones']);
export function sugerirRetos(transacciones, hoy = new Date()) {
    const mes = mesKey(hoy);
    const meses = [1, 2, 3].map(i => resumenMes(transacciones, sumarMeses(mes, -i)));
    const porCat = {};
    meses.forEach(m => Object.entries(m.porCategoria).forEach(([id, v]) => { if (!FIJAS.has(id)) porCat[id] = (porCat[id] || 0) + v; }));
    const categoriaId = Object.entries(porCat).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    const desde = `${sumarMeses(mes, -3)}-01`;
    const variable = Object.values(porCat).reduce((a, v) => a + v, 0);
    const diario = variable / Math.max(1, diasEntre(desde, `${mes}-01`));
    const tope = Math.max(50, Math.round((diario * 0.8) / 50) * 50);
    return { categoriaId, tope };
}
