import { state, getIconCategoria } from '../state.js';
import { money, escapeHtml } from '../utils/format.js';
import { icon } from '../utils/icons.js';

let limits = { gastos: 15, ingresos: 15, movimientos: 15 };
let modo = 'gastos';

export function resetReportesUI() {
    limits = { gastos: 15, ingresos: 15, movimientos: 15 };
    ['searchGastos', 'searchIngresos', 'searchMovs'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
}

export function setReportMode(m) {
    modo = m;
    document.getElementById('btnRepGastos').classList.toggle('active', m === 'gastos');
    document.getElementById('btnRepIngresos').classList.toggle('active', m === 'ingresos');
    document.getElementById('btnRepMovs').classList.toggle('active', m === 'movimientos');
    document.getElementById('rep-gastos-view').style.display = m === 'gastos' ? 'block' : 'none';
    document.getElementById('rep-ingresos-view').style.display = m === 'ingresos' ? 'block' : 'none';
    document.getElementById('rep-movs-view').style.display = m === 'movimientos' ? 'block' : 'none';
}

function txItemHTML(t) {
    const esRecompensa = t.subtipo === 'rendimiento' || t.subtipo === 'cashback';
    const action = t.tipo === 'movimiento' ? `data-action="editMovimiento"` : (t.tipo === 'gasto' ? `data-action="editGasto"` : (esRecompensa ? `data-action="editRecompensa"` : `data-action="editIngreso"`));
    const esIngreso = t.tipo === 'ingreso';
    const nombreIcono = t.tipo === 'movimiento' ? (t.subtipo === 'pago' ? 'credit-card' : 'repeat') : (t.tipo === 'ingreso' ? 'coin' : getIconCategoria(t.cat));
    const cuenta = esRecompensa ? state.cuentas.find(c => c.id == t.cuentaId) : null;
    const meta = t.tipo === 'movimiento' ? (t.subtipo === 'pago' ? 'Pago de tarjeta' : 'Traspaso')
        : esRecompensa ? [t.subtipo === 'cashback' ? 'Cashback' : 'Rendimiento', cuenta?.nombre].filter(x => x && x !== t.desc).join(' · ')
        : (t.cat || (esIngreso ? 'Ingreso' : ''));
    const msi = t.isMSI && t.meses > 1 ? ` · ${t.meses} MSI` : '';
    return `<div class="tx-item">
        <div class="tx-ico">${icon(nombreIcono)}</div>
        <div class="tx-body">
            <div class="tx-desc">${escapeHtml(t.desc)}</div>
            <div class="tx-meta">${escapeHtml(meta)}${msi}</div>
        </div>
        <b class="tx-amount ${esIngreso ? 'pos' : 'neg'} money-blur tabular-nums">${esIngreso ? '+' : '−'}${money(t.monto)}</b>
        <div class="tx-actions">
            <button ${action} data-id="${t.firebaseId}" title="Editar" aria-label="Editar">${icon('edit')}</button>
            <button data-action="eliminarTransaccion" data-id="${t.firebaseId}" title="Eliminar" aria-label="Eliminar">${icon('trash')}</button>
        </div>
    </div>`;
}

// Etiqueta de grupo por día: "Hoy", "Ayer" o la fecha completa.
function etiquetaDia(iso) {
    if (!iso) return 'Sin fecha';
    const hoy = new Date();
    const d = new Date(iso + 'T12:00:00');
    const diff = Math.round((new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 12) - d) / 86400000);
    if (diff === 0) return 'Hoy';
    if (diff === 1) return 'Ayer';
    const txt = d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: d.getFullYear() !== hoy.getFullYear() ? 'numeric' : undefined });
    return txt.charAt(0).toUpperCase() + txt.slice(1);
}

function listaAgrupadaHTML(arr) {
    let html = '', ultimo = null;
    arr.forEach(t => {
        if (t.fecha !== ultimo) { html += `<div class="tx-date">${etiquetaDia(t.fecha)}</div>`; ultimo = t.fecha; }
        html += txItemHTML(t);
    });
    return html;
}

export function renderListas() {
    const qGastos = (document.getElementById('searchGastos')?.value || '').toLowerCase();
    const qIngresos = (document.getElementById('searchIngresos')?.value || '').toLowerCase();
    const qMovs = (document.getElementById('searchMovs')?.value || '').toLowerCase();

    const ordenadas = state.transacciones.slice().sort((a, b) => {
        const dA = new Date(a.fecha || 0), dB = new Date(b.fecha || 0);
        if (dB > dA) return 1; if (dB < dA) return -1;
        return (b.firebaseId > a.firebaseId) ? 1 : -1;
    });

    const gArr = [], iArr = [], mArr = [];
    ordenadas.forEach(t => {
        if (t.tipo === 'gasto') { if (!qGastos || (t.desc || '').toLowerCase().includes(qGastos) || (t.cat || '').toLowerCase().includes(qGastos)) gArr.push(t); }
        else if (t.tipo === 'ingreso') { if (!qIngresos || (t.desc || '').toLowerCase().includes(qIngresos)) iArr.push(t); }
        else { if (!qMovs || (t.desc || '').toLowerCase().includes(qMovs)) mArr.push(t); }
    });

    const vacio = `<div class="empty-state">${icon('box')}No hay registros que coincidan.</div>`;
    document.getElementById('listaGastos').innerHTML = listaAgrupadaHTML(gArr.slice(0, limits.gastos)) || vacio;
    document.getElementById('listaIngresos').innerHTML = listaAgrupadaHTML(iArr.slice(0, limits.ingresos)) || vacio;
    document.getElementById('listaMovimientos').innerHTML = listaAgrupadaHTML(mArr.slice(0, limits.movimientos)) || vacio;

    document.getElementById('btnMasGastos').style.display = gArr.length > limits.gastos ? 'block' : 'none';
    document.getElementById('btnMasIngresos').style.display = iArr.length > limits.ingresos ? 'block' : 'none';
    document.getElementById('btnMasMovs').style.display = mArr.length > limits.movimientos ? 'block' : 'none';

    renderInsight();
}

export function loadMore(tipo) { limits[tipo] += 15; renderListas(); }

function renderInsight() {
    const el = document.getElementById('insightText');
    if (!el) return;
    const hoy = new Date();
    const prefijoMes = `${hoy.getFullYear()}-${(hoy.getMonth() + 1).toString().padStart(2, '0')}`;
    const prev = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
    const prefijoPrev = `${prev.getFullYear()}-${(prev.getMonth() + 1).toString().padStart(2, '0')}`;

    const catsMes = {}, catsPrev = {};
    state.transacciones.filter(t => t.tipo === 'gasto').forEach(t => {
        if (t.fecha?.startsWith(prefijoMes)) catsMes[t.cat] = (catsMes[t.cat] || 0) + Number(t.monto || 0);
        if (t.fecha?.startsWith(prefijoPrev)) catsPrev[t.cat] = (catsPrev[t.cat] || 0) + Number(t.monto || 0);
    });

    let mayorCambio = null;
    Object.keys(catsMes).forEach(cat => {
        const antes = catsPrev[cat] || 0;
        const ahora = catsMes[cat];
        if (antes <= 0) return;
        const cambio = ((ahora - antes) / antes) * 100;
        if (!mayorCambio || Math.abs(cambio) > Math.abs(mayorCambio.cambio)) mayorCambio = { cat, cambio };
    });

    if (!mayorCambio) { el.innerText = 'Registra movimientos por dos meses seguidos para ver comparativas por categoría.'; return; }
    const dir = mayorCambio.cambio >= 0 ? 'subió' : 'bajó';
    el.innerHTML = `Tu gasto en <b>${escapeHtml(mayorCambio.cat)}</b> ${dir} <b style="color:${mayorCambio.cambio >= 0 ? 'var(--danger)' : 'var(--success)'}">${Math.abs(mayorCambio.cambio).toFixed(0)}%</b> respecto al mes anterior.`;
}

export function renderReportes() {
    setReportMode(modo);
    renderListas();
}
