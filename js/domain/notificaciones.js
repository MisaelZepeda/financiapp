// Avisos calculados a partir de los datos. Cada uno lleva una clave que
// describe su situación concreta: si el usuario lo descarta y la situación
// cambia, la clave cambia y el aviso vuelve a aparecer.

import { mesKey } from './fechas.js';
import { estadoPago } from './tarjetas.js';
import { pendientes } from './recurrentes.js';
import { resumenMes } from './analisis.js';

// Claves válidas para Firebase (sin . # $ / [ ] ni espacios).
export const clave = (...partes) => partes.join('_').replace(/[.#$/[\]\s]/g, '-');

export function construirAvisos({ cuentas, transacciones, categorias, metas, recurrentes, descartadas = {} }, hoy = new Date()) {
    const avisos = [];
    const periodo = mesKey(hoy);

    cuentas.filter(c => c.tipo === 'credito' && c.diaPago).forEach(c => {
        const e = estadoPago(c, transacciones, hoy);
        if (!e || e.pagada || e.dias > 5) return;
        const estado = e.dias < 0 ? 'atrasado' : (e.dias === 0 ? 'hoy' : 'pronto');
        avisos.push({
            key: clave('tdc', c.id, e.periodo, estado), tono: e.dias < 0 ? 'danger' : 'warning', icono: e.dias < 0 ? 'alert-triangle' : 'credit-card',
            titulo: e.dias < 0 ? `${c.nombre}: pago atrasado` : (e.dias === 0 ? `${c.nombre}: se paga hoy` : `${c.nombre}: paga en ${e.dias} día${e.dias === 1 ? '' : 's'}`),
            detalle: 'Tarjeta de crédito', ruta: `#/cuenta/${c.id}`,
        });
    });

    const porCat = resumenMes(transacciones, periodo).porCategoria;
    categorias.forEach(cat => {
        const limite = Number(cat.presupuesto) || 0;
        if (limite <= 0) return;
        const pct = ((porCat[cat.id] || 0) / limite) * 100;
        if (pct < 90) return;
        avisos.push({
            key: clave('pres', cat.id, periodo, pct >= 100 ? 'excedido' : 'casi'), tono: pct >= 100 ? 'danger' : 'warning', icono: 'alert-circle',
            titulo: `Presupuesto de ${cat.nombre} ${pct >= 100 ? 'excedido' : 'casi al límite'}`,
            detalle: `${Math.round(pct)}% usado este mes`, ruta: '#/planear/presupuestos',
        });
    });

    const pend = pendientes(recurrentes, hoy);
    if (pend.length) avisos.push({
        key: clave('rec', ...pend.map(r => `${r.id}@${r.proximaFecha}`).sort()), tono: 'info', icono: 'repeat',
        titulo: `${pend.length} recurrente${pend.length > 1 ? 's' : ''} por registrar`,
        detalle: pend.slice(0, 3).map(r => r.desc).join(', '), ruta: '#/planear/recurrentes',
    });

    metas.forEach(m => {
        if (!(m.montoObjetivo > 0)) return;
        const pct = (m.montoActual / m.montoObjetivo) * 100;
        if (pct >= 90 && pct < 100) avisos.push({
            key: clave('meta', m.id, 'casi'), tono: 'accent', icono: 'target',
            titulo: `Meta "${m.nombre}" casi lista`, detalle: `${Math.round(pct)}% completada`, ruta: '#/planear/metas',
        });
    });

    return avisos.filter(a => !descartadas[a.key]);
}
