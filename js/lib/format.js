import { aFecha, hoyISO, sumarDias } from '../domain/fechas.js';

const mx = (n, dec) => Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: dec, maximumFractionDigits: dec });

export function money(n) { return `${n < 0 ? '−' : ''}$${mx(Math.abs(n), 2)}`; }
export function moneyRedondo(n) { return `${n < 0 ? '−' : ''}$${mx(Math.abs(n), 0)}`; }
export function moneyCompacto(n) {
    return '$' + Number(n || 0).toLocaleString('es-MX', { notation: 'compact', maximumFractionDigits: 1 });
}
// Separa pesos y centavos para mostrar los centavos más pequeños.
export function moneyPartes(n) {
    const abs = Math.abs(Number(n) || 0);
    const [ent, dec] = mx(abs, 2).split('.');
    return { signo: n < 0 ? '−' : '', entero: `$${ent}`, decimales: `.${dec}` };
}

export function pct(n, dec = 0) { return n == null || !isFinite(n) ? '—' : `${n >= 0 ? '' : '−'}${Math.abs(n).toFixed(dec)}%`; }

const capital = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export function fechaCorta(iso) {
    if (!iso) return '';
    return aFecha(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }).replace('.', '');
}
export function fechaLarga(iso) {
    if (!iso) return '';
    const d = aFecha(iso);
    return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined }).replace('.', '');
}
export function etiquetaDia(iso) {
    const hoy = hoyISO();
    if (iso === hoy) return 'Hoy';
    if (iso === sumarDias(hoy, -1)) return 'Ayer';
    const d = aFecha(iso);
    return capital(d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined }));
}
export function nombreMes(key, formato = 'long') {
    const [y, m] = key.split('-').map(Number);
    return capital(new Date(y, m - 1, 1).toLocaleDateString('es-MX', { month: formato }).replace('.', ''));
}
export function nombreMesAnio(key) {
    const [y, m] = key.split('-').map(Number);
    return capital(new Date(y, m - 1, 1).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' }));
}
export function cuandoRelativo(iso) {
    const hoy = hoyISO();
    if (iso === hoy) return 'hoy';
    if (iso === sumarDias(hoy, 1)) return 'mañana';
    if (iso < hoy) return `hace ${Math.round((aFecha(hoy) - aFecha(iso)) / 86400000)} d`;
    return `en ${Math.round((aFecha(iso) - aFecha(hoy)) / 86400000)} d`;
}

export function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}


export const TIPO_CUENTA = { debito: 'Débito', credito: 'Crédito', efectivo: 'Efectivo' };
