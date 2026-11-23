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
export const ESTILOS = ['neumorfico', 'cristal', 'clasico'];
export const estiloElegido = () => (ESTILOS.includes(leerApariencia().estilo) ? leerApariencia().estilo : 'neumorfico');
// Acento propio de cada estilo cuando no eliges uno.
export const acentoDelEstilo = (estilo = estiloElegido()) => (estilo === 'neumorfico' ? 'azul' : 'violeta');
const FONDO = { neumorfico: ['#e8ecf2', '#2a2e36'], cristal: ['#f6f5fa', '#110e1c'], clasico: ['#f6f5fa', '#110e1c'] };

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
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', FONDO[estilo][efectivo === 'claro' ? 0 : 1]);
    document.dispatchEvent(new CustomEvent('apariencia'));
    return ap;
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
