export function money(n) {
    return `$${Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function moneyRounded(n) {
    return `$${Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function formatFecha(iso) {
    if (!iso) return '';
    const d = new Date(iso + 'T12:00:00');
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

const BANK_PALETTES = {
    nu: ['#7c3aed', '#5b21b6'], klar: ['#7c3aed', '#5b21b6'], stori: ['#7c3aed', '#5b21b6'],
    bbva: ['#1d4ed8', '#1e3a8a'], azteca: ['#1d4ed8', '#1e3a8a'], bienestar: ['#1d4ed8', '#1e3a8a'],
    santander: ['#dc2626', '#991b1b'], banorte: ['#dc2626', '#991b1b'], scotiabank: ['#dc2626', '#991b1b'],
    hey: ['#15803d', '#14532d'], mercadopago: ['#15803d', '#14532d'],
};

export function getBankColorsArray(banco) {
    const b = (banco || '').toLowerCase();
    for (const key in BANK_PALETTES) { if (b.includes(key)) return BANK_PALETTES[key]; }
    return ['#0f766e', '#134e4a'];
}

export function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
