// Pagos e ingresos recurrentes. Cada uno guarda `proximaFecha`; cuando llega
// (o pasa), queda pendiente de generar. Nunca se generan solos.

import { hoyISO, sumarDias, mesKey, fechaEnMes, sumarMeses } from './fechas.js';

export const FRECUENCIAS = { semanal: 'Semanal', quincenal: 'Quincenal', mensual: 'Mensual' };

// Fecha siguiente a `desde` según la frecuencia.
export function siguienteFecha(rec, desde) {
    if (rec.frecuencia === 'semanal') return sumarDias(desde, 7);
    if (rec.frecuencia === 'quincenal') return sumarDias(desde, 15);
    const dia = rec.diaMes || Number(desde.slice(8, 10));
    return fechaEnMes(sumarMeses(mesKey(desde), 1), dia);
}

export function pendientes(recurrentes, hoy = new Date()) {
    const h = hoyISO(hoy);
    return recurrentes.filter(r => r.activo !== false && r.proximaFecha && r.proximaFecha <= h);
}

// Recurrentes activos que vencen en los próximos `dias` días (sin contar los ya pendientes).
export function proximos(recurrentes, hoy = new Date(), dias = 10) {
    const h = hoyISO(hoy), limite = sumarDias(h, dias);
    return recurrentes
        .filter(r => r.activo !== false && r.proximaFecha > h && r.proximaFecha <= limite)
        .sort((a, b) => a.proximaFecha.localeCompare(b.proximaFecha));
}

// Transacción que genera un recurrente en su fecha programada, y la fecha siguiente.
export function generarOcurrencia(rec) {
    const fecha = rec.proximaFecha;
    const tx = {
        tipo: rec.tipo, monto: Number(rec.monto), fecha, desc: rec.desc,
        cuentaId: rec.cuentaId, recurrenteId: rec.id,
        ...(rec.tipo === 'gasto' ? { categoriaId: rec.categoriaId || 'otros' } : {}),
    };
    return { tx, proximaFecha: siguienteFecha(rec, fecha) };
}

// Primera fecha programada para un recurrente nuevo: su día en este mes si
// aún no pasa; si ya pasó, el siguiente periodo.
export function primeraFecha(rec, hoy = new Date()) {
    const h = hoyISO(hoy);
    if (rec.frecuencia !== 'mensual' || !rec.diaMes) return h;
    const esteMes = fechaEnMes(mesKey(h), rec.diaMes);
    return esteMes >= h ? esteMes : siguienteFecha(rec, esteMes);
}
