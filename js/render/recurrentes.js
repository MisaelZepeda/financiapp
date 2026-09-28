import { state } from '../state.js';
import { money, escapeHtml } from '../utils/format.js';
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
        const pausado = r.activo === false;
        const dia = r.diaMes ? ` · día ${r.diaMes}` : '';
        return `<div class="recur-item ${pausado ? 'paused' : ''}">
            <div class="tx-ico">${icon(esIngreso ? 'coin' : 'repeat')}</div>
            <div class="tx-body">
                <div class="tx-desc">${escapeHtml(r.desc)}${pausado ? ' <span class="badge badge-neutral">Pausado</span>' : ''}</div>
                <div class="tx-meta"><span class="recur-freq">${FRECUENCIA_LABEL[r.frecuencia] || escapeHtml(r.frecuencia)}${dia}</span> · ${cuenta ? escapeHtml(cuenta.nombre) : 'Cuenta eliminada'}</div>
            </div>
            <b class="tx-amount ${esIngreso ? 'pos' : 'neg'} money-blur tabular-nums">${esIngreso ? '+' : '−'}${money(r.monto)}</b>
            <div class="tx-actions">
                <button data-action="toggleRecurrente" data-id="${r.id}" title="${pausado ? 'Reactivar' : 'Pausar'}" aria-label="${pausado ? 'Reactivar' : 'Pausar'}">${icon(pausado ? 'play' : 'pause')}</button>
                <button data-action="editarRecurrente" data-id="${r.id}" title="Editar" aria-label="Editar">${icon('edit')}</button>
                <button data-action="eliminarRecurrente" data-id="${r.id}" title="Eliminar" aria-label="Eliminar">${icon('trash')}</button>
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
