// Navegación: cambio de tabs, menús desplegables y hoja "Más" (móvil).

const onTabChange = new Set();

const TITULOS_TAB = {
    resumen: 'Inicio',
    reportes: 'Movimientos',
    presupuestos: 'Presupuesto',
    metas: 'Metas',
    recurrentes: 'Recurrentes',
    cuentas: 'Cuentas',
    perfil: 'Configuración',
};

// Colores que se consideran "sin personalizar": el morado de versiones
// anteriores y el acento actual. Con ellos se deja que tokens.css decida el
// tono según el tema (claro/oscuro) en lugar de fijarlo en línea.
const ACENTOS_POR_DEFECTO = ['#6c63ff', '#0f766e'];

export function subscribeTabChange(fn) { onTabChange.add(fn); }

export function cambiarTab(id) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('active', b.dataset.tab === id));
    const section = document.getElementById('tab-' + id);
    if (section) section.classList.add('active');

    const titulo = document.getElementById('pageTitle');
    if (titulo && TITULOS_TAB[id]) titulo.textContent = TITULOS_TAB[id];

    closeDropdowns();
    closeMoreSheet();
    window.scrollTo(0, 0);
    onTabChange.forEach(fn => fn(id));
}

export function aplicarColorAcento(color) {
    const root = document.documentElement.style;
    const c = (color || '').toLowerCase();
    if (!c || ACENTOS_POR_DEFECTO.includes(c)) {
        root.removeProperty('--primary');
        root.removeProperty('--on-primary');
    } else {
        root.setProperty('--primary', c);
        root.setProperty('--on-primary', '#ffffff');
    }
    document.querySelectorAll('.color-swatch').forEach(s => {
        const sc = s.dataset.color.toLowerCase();
        s.classList.toggle('active', sc === c || (sc === ACENTOS_POR_DEFECTO[1] && (!c || ACENTOS_POR_DEFECTO.includes(c))));
    });
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
    // Las gráficas dibujan montos en canvas: se redibujan para ocultarlos.
    onTabChange.forEach(fn => fn('__theme__'));
}
