export function money(n) {
    return `$${Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function moneyRounded(n) {
    return `$${Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function todayISO() {
    return new Date().toISOString().split('T')[0];
}

export function monthPrefix(date = new Date()) {
    return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
}

export function formatFecha(iso) {
    if (!iso) return '';
    const d = new Date(iso + 'T12:00:00');
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

const BANK_PALETTES = {
    nu: ['#6c63ff', '#564ee0'], klar: ['#6c63ff', '#564ee0'], stori: ['#6c63ff', '#564ee0'],
    bbva: ['#4d8dff', '#2f6fe0'], azteca: ['#4d8dff', '#2f6fe0'], bienestar: ['#4d8dff', '#2f6fe0'],
    santander: ['#ef5b6a', '#d8404f'], banorte: ['#ef5b6a', '#d8404f'], scotiabank: ['#ef5b6a', '#d8404f'],
    hey: ['#16a37a', '#0f7d5c'], mercadopago: ['#16a37a', '#0f7d5c'],
};

export function getBankColorsArray(banco) {
    const b = (banco || '').toLowerCase();
    for (const key in BANK_PALETTES) { if (b.includes(key)) return BANK_PALETTES[key]; }
    return ['#ff9466', '#f57f4d'];
}

export function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
