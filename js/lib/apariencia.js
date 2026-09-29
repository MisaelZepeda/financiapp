// Tema y acento.
//
// - Preferencia guardada (Ajustes): 'auto' | 'claro' | 'oscuro'. Se guarda en
//   Firebase (ajustes) y en localStorage, y se respeta cada vez que se entra.
//   'auto' sigue al sistema del dispositivo. Predeterminado: 'oscuro'.
// - Cambio rápido (botón sol/luna del encabezado): solo dura la sesión
//   (sessionStorage). No toca la preferencia guardada.

const CLAVE = 'financiapp_apariencia';
const CLAVE_SESION = 'financiapp_tema_sesion';
const sistemaOscuro = window.matchMedia('(prefers-color-scheme: dark)');

export function leerApariencia() {
    try { return JSON.parse(localStorage.getItem(CLAVE)) || {}; } catch { return {}; }
}

function temaSesion() {
    try { return sessionStorage.getItem(CLAVE_SESION); } catch { return null; }
}

// Preferencia guardada: 'auto' | 'claro' | 'oscuro'.
export function temaElegido() { return leerApariencia().tema || 'oscuro'; }

// ¿Hay un cambio rápido activo solo en esta sesión?
export function hayTemaDeSesion() { return !!temaSesion(); }

// Tema que se ve en pantalla: el de la sesión si lo hay; si no, la preferencia.
export function temaEfectivo() {
    const sesion = temaSesion();
    if (sesion) return sesion;
    const tema = temaElegido();
    if (tema === 'auto') return sistemaOscuro.matches ? 'oscuro' : 'claro';
    return tema === 'claro' ? 'claro' : 'oscuro';
}

// Aplica la apariencia (y guarda los cambios de preferencia que se pasen).
export function aplicarApariencia(cambios = {}) {
    const ap = { ...leerApariencia(), ...cambios };
    try { localStorage.setItem(CLAVE, JSON.stringify(ap)); } catch { /* modo privado */ }
    const root = document.documentElement;
    const efectivo = temaEfectivo();
    root.setAttribute('data-theme', efectivo === 'claro' ? 'light' : 'dark');
    if (ap.acento && ap.acento !== 'lima') root.setAttribute('data-accent', ap.acento); else root.removeAttribute('data-accent');
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', efectivo === 'claro' ? '#f3f4f6' : '#0e0f12');
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
