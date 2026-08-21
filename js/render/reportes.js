import { state, getIconCategoria } from '../state.js';
import { money, formatFecha } from '../utils/format.js';
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
    const action = t.tipo === 'movimiento' ? `data-action="editMovimiento"` : (t.tipo === 'gasto' ? `data-action="editGasto"` : `data-action="editIngreso"`);
    const esIngreso = t.tipo === 'ingreso';
    const nombreIcono = t.tipo === 'movimiento' ? (t.subtipo === 'pago' ? 'credit-card' : 'repeat') : (t.tipo === 'ingreso' ? 'coin' : getIconCategoria(t.cat));
    return `<div class="tx-item">
        <div class="tx-ico" style="background:${esIngreso ? 'var(--success-soft)' : 'var(--danger-soft)'}; color:${esIngreso ? 'var(--success)' : 'var(--danger)'};">${icon(nombreIcono)}</div>
        <div class="tx-body">
            <div class="tx-desc">${t.desc}</div>
            <div class="tx-meta">${formatFecha(t.fecha)}${t.cat ? ' · ' + t.cat : ''}</div>
        </div>
        <b class="tx-amount ${esIngreso ? 'pos' : 'neg'} money-blur tabular-nums">${esIngreso ? '+' : '-'}${money(t.monto)}</b>
        <div class="tx-actions">
            <button data-action="eliminarTransaccion" data-id="${t.firebaseId}" title="Eliminar">${icon('trash')}</button>
            <button ${action} data-id="${t.firebaseId}" title="Editar">${icon('edit')}</button>
        </div>
    </div>`;
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

    const vacio = `<div class="empty-state">${icon('box')}No hay registros.</div>`;
    document.getElementById('listaGastos').innerHTML = gArr.slice(0, limits.gastos).map(txItemHTML).join('') || vacio;
    document.getElementById('listaIngresos').innerHTML = iArr.slice(0, limits.ingresos).map(txItemHTML).join('') || vacio;
    document.getElementById('listaMovimientos').innerHTML = mArr.slice(0, limits.movimientos).map(txItemHTML).join('') || vacio;

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
    el.innerHTML = `Tu gasto en <b>${mayorCambio.cat}</b> ${dir} <b style="color:${mayorCambio.cambio >= 0 ? 'var(--danger)' : 'var(--success)'}">${Math.abs(mayorCambio.cambio).toFixed(0)}%</b> respecto al mes anterior.`;
}

export function renderReportes() {
    setReportMode(modo);
    renderListas();
}
