// Tema (oscuro, claro o automático según el dispositivo) y acento. Se
// guardan en Firebase (ajustes) y también en localStorage para aplicarlos
// antes de que carguen los datos y evitar el parpadeo.

const CLAVE = 'financiapp_apariencia';
const sistemaOscuro = window.matchMedia('(prefers-color-scheme: dark)');

export function leerApariencia() {
    try { return JSON.parse(localStorage.getItem(CLAVE)) || {}; } catch { return {}; }
}

// 'oscuro' | 'claro' | 'auto' (predeterminado: oscuro)
export function temaElegido() { return leerApariencia().tema || 'oscuro'; }

// Tema que se ve en pantalla (resuelve 'auto').
export function temaEfectivo(tema = temaElegido()) {
    if (tema === 'auto') return sistemaOscuro.matches ? 'oscuro' : 'claro';
    return tema === 'claro' ? 'claro' : 'oscuro';
}

export function aplicarApariencia(cambios = {}) {
    const ap = { ...leerApariencia(), ...cambios };
    try { localStorage.setItem(CLAVE, JSON.stringify(ap)); } catch { /* modo privado */ }
    const root = document.documentElement;
    const efectivo = temaEfectivo(ap.tema || 'oscuro');
    root.setAttribute('data-theme', efectivo === 'claro' ? 'light' : 'dark');
    if (ap.acento && ap.acento !== 'lima') root.setAttribute('data-accent', ap.acento); else root.removeAttribute('data-accent');
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', efectivo === 'claro' ? '#f3f4f6' : '#0e0f12');
    document.dispatchEvent(new CustomEvent('apariencia'));
    return ap;
}

// En modo automático, seguir al sistema si cambia (p. ej. al anochecer).
sistemaOscuro.addEventListener('change', () => { if (temaElegido() === 'auto') aplicarApariencia(); });
