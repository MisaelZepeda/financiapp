import { state } from '../state.js';
import { money } from '../utils/format.js';
import { icon } from '../utils/icons.js';
import { calcularVencidos } from '../data/recurrentes.js';

const FRECUENCIA_LABEL = { semanal: 'Semanal', quincenal: 'Quincenal', mensual: 'Mensual' };

export function renderRecurrentes() {
    const cont = document.getElementById('recurrentesLista');
    if (!cont) return;
    if (state.recurrentes.length === 0) {
        cont.innerHTML = `<div class="empty-state">${icon('repeat')}No tienes pagos ni ingresos recurrentes registrados.</div>`;
        return;
    }
    cont.innerHTML = state.recurrentes.map(r => {
        const cuenta = state.cuentas.find(c => c.id == r.cuentaId);
        const esIngreso = r.tipo === 'ingreso';
        return `<div class="recur-item" style="opacity:${r.activo === false ? 0.55 : 1};">
            <div class="tx-ico" style="background:${esIngreso ? 'var(--success-soft)' : 'var(--danger-soft)'}; color:${esIngreso ? 'var(--success)' : 'var(--danger)'};">${icon(esIngreso ? 'coin' : 'repeat')}</div>
            <div style="flex:1; min-width:0;">
                <div style="font-weight:700; font-size:13.5px;">${r.desc}</div>
                <div class="tx-meta">${cuenta ? cuenta.nombre : 'Cuenta eliminada'} · <span class="recur-freq">${FRECUENCIA_LABEL[r.frecuencia] || r.frecuencia}</span></div>
            </div>
            <b class="tx-amount ${esIngreso ? 'pos' : 'neg'} money-blur tabular-nums">${money(r.monto)}</b>
            <div class="tx-actions">
                <button data-action="toggleRecurrente" data-id="${r.id}" title="${r.activo === false ? 'Reactivar' : 'Pausar'}">${icon(r.activo === false ? 'play' : 'pause')}</button>
                <button data-action="editarRecurrente" data-id="${r.id}" title="Editar">${icon('edit')}</button>
                <button data-action="eliminarRecurrente" data-id="${r.id}" title="Eliminar">${icon('trash')}</button>
            </div>
        </div>`;
    }).join('');
}

export function chequearVencidosBanner() {
    const banner = document.getElementById('recurrentesVencidosBanner');
    if (!banner) return;
    const vencidos = calcularVencidos();
    if (vencidos.length === 0) { banner.style.display = 'none'; return; }
    const total = vencidos.reduce((a, r) => a + Number(r.monto || 0), 0);
    banner.style.display = 'flex';
    document.getElementById('recurrentesVencidosTexto').innerHTML = `Tienes <b>${vencidos.length}</b> movimiento${vencidos.length > 1 ? 's' : ''} recurrente${vencidos.length > 1 ? 's' : ''} pendiente${vencidos.length > 1 ? 's' : ''} por generar (≈ ${money(total)}).`;
}
