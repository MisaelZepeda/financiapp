// Tema y acento. Se guardan en Firebase (ajustes) y también en localStorage
// para aplicarlos antes de que carguen los datos y evitar el parpadeo.

const CLAVE = 'financiapp_apariencia';

export function leerApariencia() {
    try { return JSON.parse(localStorage.getItem(CLAVE)) || {}; } catch { return {}; }
}

export function aplicarApariencia(cambios = {}) {
    const ap = { ...leerApariencia(), ...cambios };
    try { localStorage.setItem(CLAVE, JSON.stringify(ap)); } catch { /* modo privado */ }
    const root = document.documentElement;
    root.setAttribute('data-theme', ap.tema === 'claro' ? 'light' : 'dark');
    if (ap.acento && ap.acento !== 'lima') root.setAttribute('data-accent', ap.acento); else root.removeAttribute('data-accent');
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', ap.tema === 'claro' ? '#f3f4f6' : '#0e0f12');
    document.dispatchEvent(new CustomEvent('apariencia'));
    return ap;
}
