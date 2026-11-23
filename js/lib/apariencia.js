// Tema y acento.
//
// - Preferencia guardada (Ajustes): 'auto' | 'claro' | 'oscuro'. Se guarda en
//   Firebase (ajustes) y en localStorage, y se respeta cada vez que se entra.
//   'auto' sigue al sistema del dispositivo. Predeterminado: 'claro'.
// - La clave es nueva desde el estilo blanco y violeta: las preferencias del
//   estilo anterior (café y latón) no se arrastran.
// - Cambio rápido (botón sol/luna del encabezado): solo dura la sesión
//   (sessionStorage). No toca la preferencia guardada.

// v3: estilo neumórfico con acento azul (no se arrastra el violeta anterior).
const CLAVE = 'morralla_apariencia_v3';
const CLAVE_SESION = 'financiapp_tema_sesion';
const sistemaOscuro = window.matchMedia('(prefers-color-scheme: dark)');
// Acentos alternativos; cualquier otro valor usa el azul predeterminado.
export const ACENTOS_ALTERNOS = ['azul', 'violeta', 'laton', 'cobre', 'menta', 'cielo'];

// Estilos de interfaz: cada uno es una hoja de estilos (index.html) y solo una queda activa.
export const ESTILOS = ['neumorfico', 'papercut', 'cristal', 'clasico'];
export const estiloElegido = () => (ESTILOS.includes(leerApariencia().estilo) ? leerApariencia().estilo : 'neumorfico');
// Acento propio de cada estilo cuando no eliges uno.
export const acentoDelEstilo = (estilo = estiloElegido()) => ({ neumorfico: 'azul', papercut: 'cobre' }[estilo] || 'violeta');
const FONDO = { neumorfico: ['#e8ecf2', '#2a2e36'], papercut: ['#f6d2b4', '#2c3046'], cristal: ['#f6f5fa', '#110e1c'], clasico: ['#f6f5fa', '#110e1c'] };

export function leerApariencia() {
    try { return JSON.parse(localStorage.getItem(CLAVE)) || {}; } catch { return {}; }
}

function temaSesion() {
    try { return sessionStorage.getItem(CLAVE_SESION); } catch { return null; }
}

// Preferencia guardada: 'auto' | 'claro' | 'oscuro'.
export function temaElegido() { return leerApariencia().tema || 'claro'; }

// ¿Hay un cambio rápido activo solo en esta sesión?
export function hayTemaDeSesion() { return !!temaSesion(); }

// Tema que se ve en pantalla: el de la sesión si lo hay; si no, la preferencia.
export function temaEfectivo() {
    const sesion = temaSesion();
    if (sesion) return sesion;
    const tema = temaElegido();
    if (tema === 'auto') return sistemaOscuro.matches ? 'oscuro' : 'claro';
    return tema === 'oscuro' ? 'oscuro' : 'claro';
}

// Aplica la apariencia (y guarda los cambios de preferencia que se pasen).
export function aplicarApariencia(cambios = {}) {
    const ap = { ...leerApariencia(), ...cambios };
    try { localStorage.setItem(CLAVE, JSON.stringify(ap)); } catch { /* modo privado */ }
    const root = document.documentElement;
    const efectivo = temaEfectivo();
    root.setAttribute('data-theme', efectivo === 'claro' ? 'light' : 'dark');
    if (ACENTOS_ALTERNOS.includes(ap.acento)) root.setAttribute('data-accent', ap.acento); else root.removeAttribute('data-accent');
    const estilo = ESTILOS.includes(ap.estilo) ? ap.estilo : 'neumorfico';
    root.setAttribute('data-estilo', estilo);
    ESTILOS.forEach(n => { const l = document.getElementById(`estilo-${n}`); if (l) l.disabled = n !== estilo; });
    const ondas = pintarOndasPapel(estilo, efectivo);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', ondas || FONDO[estilo][efectivo === 'claro' ? 0 : 1]);
    document.dispatchEvent(new CustomEvent('apariencia'));
    return ap;
}

// Papel recortado: las tres capas de ondas del fondo y el encabezado toman el color de
// acento (mezclado con el papel). El CSS trae unas en cobre por si esto aún no corre.
// Devuelve el color del encabezado (para la barra de estado) o null en otros estilos.
function aRgb(hex) {
    const h = String(hex || '').trim().replace('#', '');
    if (!/^[0-9a-f]{3}([0-9a-f]{3})?$/i.test(h)) return null;
    const n = parseInt(h.length === 3 ? h.split('').map(x => x + x).join('') : h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const mezclar = (a, b, t) => '#' + a.map((v, i) => Math.round(v * t + b[i] * (1 - t)).toString(16).padStart(2, '0')).join('');
function pintarOndasPapel(estilo, efectivo) {
    const root = document.documentElement;
    if (estilo !== 'papercut') { root.style.removeProperty('--ondas'); root.style.removeProperty('--onda-1'); return null; }
    const acento = aRgb(getComputedStyle(root).getPropertyValue('--accent'));
    if (!acento) return null;
    const claro = efectivo === 'claro';
    const papel = aRgb(claro ? '#fbf3e7' : '#1d1f2b');
    const [c1, c2, c3] = (claro ? [0.28, 0.5, 0.76] : [0.2, 0.36, 0.55]).map(t => mezclar(acento, papel, t));
    const sombra = claro ? `flood-color='${mezclar(acento, [40, 25, 10], 0.25)}' flood-opacity='.3'` : "flood-color='#000' flood-opacity='.5'";
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 200' preserveAspectRatio='none'><defs><filter id='s' x='-5%' y='-5%' width='110%' height='130%'><feDropShadow dx='0' dy='4' stdDeviation='4' ${sombra}/></filter></defs>`
        + `<path filter='url(#s)' fill='${c1}' d='M0 0h400v150c-50 22-95-18-150 2s-110 30-160 6-60-14-90-10z'/>`
        + `<path filter='url(#s)' fill='${c2}' d='M0 0h400v104c-60 26-110-22-170-2s-100 28-150 8-55-16-80-12z'/>`
        + `<path filter='url(#s)' fill='${c3}' d='M0 0h400v58c-45 18-90-16-145 0s-105 24-160 6-60-12-95-8z'/></svg>`;
    root.style.setProperty('--ondas', `url("data:image/svg+xml,${encodeURIComponent(svg)}")`);
    root.style.setProperty('--onda-1', c1);
    return c1;
}

// Elección explícita en Ajustes o en el menú: se guarda y quita el cambio de sesión.
export function elegirTema(tema) {
    try { sessionStorage.removeItem(CLAVE_SESION); } catch { /* */ }
    return aplicarApariencia({ tema });
}

// Botón del encabezado: invierte el tema que se ve, solo por esta sesión.
export function alternarTemaSesion() {
    const nuevo = temaEfectivo() === 'oscuro' ? 'claro' : 'oscuro';
    try { sessionStorage.setItem(CLAVE_SESION, nuevo); } catch { /* */ }
    aplicarApariencia();
}

// En modo automático, seguir al sistema si cambia (salvo cambio de sesión activo).
sistemaOscuro.addEventListener('change', () => { if (temaElegido() === 'auto' && !hayTemaDeSesion()) aplicarApariencia(); });
