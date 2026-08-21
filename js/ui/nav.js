// Navegación: cambio de tabs, menús desplegables y hoja "Más" (móvil).

const onTabChange = new Set();

export function subscribeTabChange(fn) { onTabChange.add(fn); }

export function cambiarTab(id) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('active', b.dataset.tab === id));
    const section = document.getElementById('tab-' + id);
    if (section) section.classList.add('active');

    closeDropdowns();
    closeMoreSheet();
    window.scrollTo(0, 0);
    onTabChange.forEach(fn => fn(id));
}

export function toggleUserMenu(e) {
    e.stopPropagation();
    document.getElementById('notifPanel')?.classList.remove('show');
    document.getElementById('userMenu')?.classList.toggle('show');
}

export function toggleNotifPanel(e) {
    e.stopPropagation();
    document.getElementById('userMenu')?.classList.remove('show');
    document.getElementById('notifPanel')?.classList.toggle('show');
}

export function closeDropdowns() {
    document.getElementById('userMenu')?.classList.remove('show');
    document.getElementById('notifPanel')?.classList.remove('show');
}

export function abrirMenuRegistro() { const el = document.getElementById('addMenuOverlay'); if (el) el.style.display = 'flex'; }
export function cerrarMenuRegistro() { const el = document.getElementById('addMenuOverlay'); if (el) el.style.display = 'none'; }

export function openMoreSheet() { document.getElementById('moreSheetOverlay')?.style.setProperty('display', 'flex'); }
export function closeMoreSheet() { const el = document.getElementById('moreSheetOverlay'); if (el) el.style.display = 'none'; }

export function toggleThemeSwitch(checked) {
    const t = checked ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem('dashpro_theme', t);
    onTabChange.forEach(fn => fn('__theme__'));
}

export function initThemePreference() {
    const saved = localStorage.getItem('dashpro_theme');
    if (saved) document.documentElement.setAttribute('data-theme', saved);
    const checkbox = document.getElementById('themeToggle');
    if (checkbox) {
        const isLight = saved ? saved === 'light' : !(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
        checkbox.checked = isLight;
    }
}

export function togglePrivacy() {
    document.body.classList.toggle('privacy-mode');
    const active = document.body.classList.contains('privacy-mode');
    const use = document.querySelector('#btnPrivacy use');
    if (use) use.setAttribute('href', active ? '#i-eye-off' : '#i-eye');
}
