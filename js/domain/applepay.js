// Pagos con Apple Pay: el Atajo "Al pagar con la Cartera" manda monto, comercio y
// tarjeta tal como los da el iPhone. Aquí se interpretan y se sugiere la cuenta.

// "$1,234.50", "MX$ 1.234,50", "1234,5", "$85" → número; null si no se entiende.
export function interpretarMonto(valor) {
    if (typeof valor === 'number') return valor > 0 ? Math.round(valor * 100) / 100 : null;
    let s = String(valor || '').replace(/[^\d.,]/g, '');
    if (!s) return null;
    const ultPunto = s.lastIndexOf('.'), ultComa = s.lastIndexOf(',');
    if (ultPunto >= 0 && ultComa >= 0) {
        // El separador que aparece al final es el decimal.
        s = ultPunto > ultComa ? s.replace(/,/g, '') : s.replace(/\./g, '').replace(',', '.');
    } else if (ultComa >= 0) {
        // Solo comas: decimal si hay una y le siguen 1 o 2 dígitos ("85,5"); si no, miles.
        s = (s.match(/,/g).length === 1 && /,\d{1,2}$/.test(s)) ? s.replace(',', '.') : s.replace(/,/g, '');
    } else if (ultPunto >= 0 && !(s.match(/\./g).length === 1 && /\.\d{1,2}$/.test(s))) {
        s = s.replace(/\./g, '');   // "1.234" o "1.234.567": miles
    }
    const n = Math.round(parseFloat(s) * 100) / 100;
    return n > 0 && n < 10000000 ? n : null;
}

export const normalizarNombre = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// Cuenta para una tarjeta de la Cartera: la que ya elegiste antes para ese nombre,
// la que tenga sus últimos 4 dígitos, o la que se llame parecido (nombre o banco).
export function sugerirCuentaWallet(tarjeta, cuentas = [], recordadas = {}) {
    const n = normalizarNombre(tarjeta);
    if (!n) return null;
    const existe = (id) => cuentas.some(c => c.id === id);
    if (recordadas[n] && existe(recordadas[n])) return recordadas[n];
    const digitos = n.match(/\d{4}/g) || [];
    const porDigitos = cuentas.find(c => c.digitos && digitos.includes(String(c.digitos)));
    if (porDigitos) return porDigitos.id;
    const palabras = n.split(' ').filter(w => w.length > 1);
    let mejor = null, puntos = 0;
    cuentas.forEach(c => {
        const nombre = normalizarNombre(c.nombre), banco = normalizarNombre(c.banco);
        let p = 0;
        if (nombre && n.includes(nombre)) p += 3;
        palabras.forEach(w => { if (nombre.split(' ').includes(w)) p += 2; if (banco && banco.split(' ').includes(w)) p += 1; });
        if (c.tipo === 'credito' && /credito|credit/.test(n)) p += 1;
        if (c.tipo === 'debito' && /debito|debit/.test(n)) p += 1;
        if (p > puntos) { puntos = p; mejor = c.id; }
    });
    return mejor;
}
