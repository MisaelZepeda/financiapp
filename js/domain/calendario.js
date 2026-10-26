// Calendario de pagos de un mes: cortes, fechas límite de tarjetas (con su
// monto), recurrentes programados y compras a MSI que terminan.

import { fechaEnMes, sumarMeses, ultimoDiaMes, hoyISO, aFecha } from './fechas.js';
import { fechaPagoDe, montoEstado, abonadoDesde } from './tarjetas.js';
import { siguienteFecha } from './recurrentes.js';
import { detalleMSI } from './msi.js';

const r2 = (n) => Math.round(n * 100) / 100;

// Eventos del mes `key` ('AAAA-MM'), ordenados por fecha.
// Cada evento: { fecha, tipo: 'corte'|'pago'|'recurrente'|'msi', titulo, monto, sale (true = salida de dinero),
//               pagado, cuentaId, recurrenteId }
export function eventosMes(key, { cuentas = [], transacciones = [], recurrentes = [] }, hoy = new Date()) {
    const desde = `${key}-01`, hasta = ultimoDiaMes(key);
    const h = hoyISO(hoy);
    const eventos = [];

    cuentas.filter(c => c.tipo === 'credito').forEach(c => {
        if (c.diaCorte) eventos.push({ fecha: fechaEnMes(key, c.diaCorte), tipo: 'corte', titulo: `Corte ${c.nombre}`, monto: null, sale: false, cuentaId: c.id });
        if (!c.diaPago) return;
        // El estado que se paga este mes puede cerrar este mes o el anterior.
        [sumarMeses(key, -1), key].forEach(mesCorte => {
            const corte = fechaEnMes(mesCorte, c.diaCorte || 1);
            const fecha = fechaPagoDe(c, corte);
            if (fecha < desde || fecha > hasta) return;
            const monto = montoEstado(c, transacciones, corte);
            const cerrado = corte <= h;
            const pagado = cerrado && (c.pagadoPeriodo === corte.slice(0, 7) || (monto > 0 && abonadoDesde(c, transacciones, corte) >= monto));
            eventos.push({ fecha, tipo: 'pago', titulo: `Pago ${c.nombre}`, monto, estimado: !cerrado, sale: true, pagado, cuentaId: c.id });
        });
        transacciones.filter(t => t.tipo === 'gasto' && t.cuentaId === c.id && Number(t.msi) > 1).forEach(t => {
            const d = detalleMSI(c, t, hoy);
            const fin = d.ultimoPago;
            if (fin >= desde && fin <= hasta) eventos.push({ fecha: fin, tipo: 'msi', titulo: `Última mensualidad: ${t.desc || 'compra a MSI'}`, monto: d.mensualidad, sale: false, cuentaId: c.id });
        });
    });

    // Recurrentes: de su próxima fecha en adelante (lo anterior ya está registrado como movimiento).
    recurrentes.filter(r => r.activo !== false && r.proximaFecha).forEach(r => {
        let fecha = r.proximaFecha, vueltas = 0;
        while (fecha <= hasta && vueltas++ < 40) {
            if (fecha >= desde) eventos.push({ fecha, tipo: 'recurrente', titulo: r.desc, monto: Number(r.monto) || 0, sale: r.tipo !== 'ingreso', ingreso: r.tipo === 'ingreso', pendiente: fecha <= h, recurrenteId: r.id, cuentaId: r.cuentaId });
            fecha = siguienteFecha(r, fecha);
        }
    });

    const orden = { pago: 0, recurrente: 1, msi: 2, corte: 3 };
    return eventos.sort((a, b) => a.fecha.localeCompare(b.fecha) || orden[a.tipo] - orden[b.tipo]);
}

// Salidas pendientes por semana (lunes a domingo) del mes.
export function semanasMes(key, eventos) {
    const semanas = [];
    let inicio = aFecha(`${key}-01`);
    inicio.setDate(inicio.getDate() - ((inicio.getDay() + 6) % 7)); // lunes
    const fin = ultimoDiaMes(key);
    while (hoyISO(inicio) <= fin) {
        const a = hoyISO(inicio);
        const b = new Date(inicio); b.setDate(b.getDate() + 6);
        const z = hoyISO(b);
        const total = eventos.filter(e => e.sale && !e.pagado && e.fecha >= a && e.fecha <= z).reduce((s, e) => s + (e.monto || 0), 0);
        semanas.push({ desde: a, hasta: z, total: r2(total) });
        inicio.setDate(inicio.getDate() + 7);
    }
    return semanas;
}
