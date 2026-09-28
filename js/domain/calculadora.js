// Calculadora del monto: sumas, restas y multiplicaciones (× antes que + y −).
// La expresión es texto con dígitos, punto y los operadores + − ×.
// No usa eval(): se interpreta con un análisis simple.

export const OPERADORES = ['+', '−', '×'];
const esOp = (c) => OPERADORES.includes(c);

// Número que se está escribiendo (lo que va después del último operador).
function numeroActual(expr) {
    const partes = expr.split(/[+−×]/);
    return partes[partes.length - 1];
}

export function tieneOperacion(expr) {
    return /[0-9.][+−×]/.test(expr);
}

// Aplica una tecla a la expresión y devuelve la nueva expresión.
// Teclas: '0'–'9', '.', '+', '−', '×', 'del', '='.
export function teclear(expr, tecla) {
    if (tecla === 'del') return expr.slice(0, -1);
    if (tecla === '=') { const v = evaluar(expr); return v == null ? expr : formatear(v); }
    const ultimo = expr.slice(-1);
    if (esOp(tecla)) {
        if (!expr) return expr;                              // no se empieza con operador
        if (esOp(ultimo)) return expr.slice(0, -1) + tecla;  // cambia el operador
        if (ultimo === '.') return expr.slice(0, -1) + tecla;
        return expr + tecla;
    }
    const actual = numeroActual(expr);
    if (tecla === '.') {
        if (actual.includes('.')) return expr;
        return expr + (actual === '' ? '0.' : '.');
    }
    // Dígito: máximo 2 decimales y 9 enteros por número.
    const [ent, dec] = actual.split('.');
    if (dec !== undefined && dec.length >= 2) return expr;
    if (dec === undefined && ent.length >= 9) return expr;
    if (actual === '0') return expr.slice(0, -1) + tecla; // evita "05"
    return expr + tecla;
}

// Resultado numérico (redondeado a centavos) o null si no hay número.
export function evaluar(expr) {
    let e = String(expr || '');
    while (e && (esOp(e.slice(-1)) || e.slice(-1) === '.')) e = e.slice(0, -1);
    if (!e) return null;
    const tokens = e.split(/([+−×])/).filter(t => t !== '');
    // Primero las multiplicaciones.
    const sumandos = [];
    let signo = 1, acumulado = null, pendienteMult = false;
    for (const t of tokens) {
        if (t === '×') { pendienteMult = true; continue; }
        if (t === '+' || t === '−') {
            if (acumulado != null) sumandos.push(signo * acumulado);
            signo = t === '+' ? 1 : -1; acumulado = null; pendienteMult = false;
            continue;
        }
        const n = parseFloat(t);
        if (!isFinite(n)) return null;
        acumulado = pendienteMult && acumulado != null ? acumulado * n : n;
        pendienteMult = false;
    }
    if (acumulado != null) sumandos.push(signo * acumulado);
    const total = sumandos.reduce((a, b) => a + b, 0);
    return Math.round(total * 100) / 100;
}

// Número → texto de expresión (sin separadores de miles).
export function formatear(n) {
    return String(Math.round(n * 100) / 100);
}

// Expresión con separadores de miles y operadores espaciados, para mostrar.
export function expresionLegible(expr) {
    return expr.split(/([+−×])/).map(t => {
        if (esOp(t)) return ` ${t} `;
        if (!t) return '';
        const [ent, dec] = t.split('.');
        return Number(ent || 0).toLocaleString('es-MX') + (dec !== undefined ? '.' + dec : '');
    }).join('');
}

// Convierte lo que se teclea en un campo de texto (escritorio) al formato
// interno: * y x → ×, - → −, solo dígitos, punto y operadores.
export function normalizarTexto(texto) {
    return String(texto).replace(/[*xX]/g, '×').replace(/-/g, '−').replace(/,/g, '').replace(/[^0-9.+−×]/g, '');
}
