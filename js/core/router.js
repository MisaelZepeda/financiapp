// Rutas por hash: #/inicio, #/movimientos, #/cuenta/:id, #/planear/:tab…
// Cada vista es un módulo con { titulo, render(params) → HTML, montar?(el, params) }.

const rutas = [];
let actual = { vista: null, params: {}, path: '' };
const alCambiar = new Set();

export function definirRuta(patron, vista) {
    const claves = [];
    const re = new RegExp('^' + patron.replace(/:([a-z]+)/g, (_, k) => { claves.push(k); return '([^/]+)'; }) + '$');
    rutas.push({ re, claves, vista, patron });
}

export function resolver(hash = location.hash) {
    const completo = (hash || '').replace(/^#/, '') || '/inicio';
    const [path, qs = ''] = completo.split('?');
    for (const r of rutas) {
        const m = path.match(r.re);
        if (m) {
            const params = Object.fromEntries(new URLSearchParams(qs));
            r.claves.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
            return { vista: r.vista, params, path: completo, patron: r.patron };
        }
    }
    return null;
}

export function iniciarRouter() {
    const ir = () => {
        const r = resolver();
        if (!r) { location.replace('#/inicio'); return; }
        const cambioDeVista = r.path !== actual.path;
        actual = r;
        alCambiar.forEach(fn => fn(r, cambioDeVista));
    };
    window.addEventListener('hashchange', ir);
    ir();
}

export function rutaActual() { return actual; }
export function alNavegar(fn) { alCambiar.add(fn); }
export function navegar(hash) { if (location.hash === hash) alCambiar.forEach(fn => fn(actual, false)); else location.hash = hash; }
