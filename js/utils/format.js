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
    nu: ['#8b5cf6', '#6d28d9'], klar: ['#8b5cf6', '#6d28d9'], stori: ['#8b5cf6', '#6d28d9'],
    bbva: ['#0284c7', '#075985'], azteca: ['#0284c7', '#075985'], bienestar: ['#0284c7', '#075985'],
    santander: ['#e11d48', '#9f1239'], banorte: ['#e11d48', '#9f1239'], scotiabank: ['#e11d48', '#9f1239'],
    hey: ['#059669', '#047857'], mercadopago: ['#059669', '#047857'],
};

export function getBankColorsArray(banco) {
    const b = (banco || '').toLowerCase();
    for (const key in BANK_PALETTES) { if (b.includes(key)) return BANK_PALETTES[key]; }
    return ['#475569', '#1e293b'];
}

export function getBankGradient(banco) {
    const [a, b] = getBankColorsArray(banco);
    return `linear-gradient(135deg, ${a}, ${b})`;
}

export function initialsAvatar(name) {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || '?')}&background=random&color=fff&size=128&bold=true`;
}

export function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
