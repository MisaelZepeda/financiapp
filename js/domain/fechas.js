// Utilidades de fecha en hora LOCAL. Las fechas de movimientos se guardan
// como 'AAAA-MM-DD'. (La versión anterior usaba toISOString(), que en México
// después de las 6 p. m. ya devuelve el día siguiente en UTC.)

const pad = (n) => String(n).padStart(2, '0');

export function hoyISO(d = new Date()) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function aFecha(iso) {
    if (iso instanceof Date) return new Date(iso.getFullYear(), iso.getMonth(), iso.getDate(), 12);
    const [y, m, d] = String(iso).split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1, 12);
}

// 'AAAA-MM' de una fecha ISO o Date.
export function mesKey(f = new Date()) {
    if (typeof f === 'string') return f.slice(0, 7);
    return `${f.getFullYear()}-${pad(f.getMonth() + 1)}`;
}

export function sumarMeses(key, n) {
    const [y, m] = key.split('-').map(Number);
    const d = new Date(y, m - 1 + n, 1);
    return mesKey(d);
}

export function sumarDias(iso, n) {
    const d = aFecha(iso);
    d.setDate(d.getDate() + n);
    return hoyISO(d);
}

export function diasEntre(desdeISO, hastaISO) {
    return Math.round((aFecha(hastaISO) - aFecha(desdeISO)) / 86400000);
}

// Día `dia` del mes `key`, recortado al último día si el mes es más corto.
export function fechaEnMes(key, dia) {
    const [y, m] = key.split('-').map(Number);
    const ultimo = new Date(y, m, 0).getDate();
    return `${key}-${pad(Math.min(Math.max(1, dia), ultimo))}`;
}

export function ultimoDiaMes(key) {
    const [y, m] = key.split('-').map(Number);
    return `${key}-${pad(new Date(y, m, 0).getDate())}`;
}

// Últimas `n` claves de mes terminando en `hasta` (incluido), de más vieja a más reciente.
export function ultimosMeses(n, hasta = mesKey()) {
    return Array.from({ length: n }, (_, i) => sumarMeses(hasta, i - n + 1));
}
