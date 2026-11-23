// Revisión de cuentas: cada semana, comparar el saldo de cada cuenta con el del banco.
// Cada cuenta guarda `revisada` ('AAAA-MM-DD'); se pide de nuevo a los 7 días.

import { hoyISO, diasEntre, sumarDias, aFecha } from './fechas.js';

export const DIAS_REVISION = 7;

export function cuentasPorRevisar(cuentas, hoy = new Date()) {
    const h = hoyISO(hoy);
    return cuentas.filter(c => !c.revisada || diasEntre(c.revisada, h) >= DIAS_REVISION);
}

// Clave de la semana (su lunes) para avisar una sola vez por semana.
export function semanaDe(hoy = new Date()) {
    const h = hoyISO(hoy);
    return sumarDias(h, -((aFecha(h).getDay() + 6) % 7));
}
