import { state } from '../state.js';
import { money, formatFecha, escapeHtml } from '../utils/format.js';
import { icon } from '../utils/icons.js';

export function renderMetas() {
    const cont = document.getElementById('metasGrid');
    if (!cont) return;
    if (state.metas.length === 0) {
        cont.innerHTML = `<div class="card empty-state" style="grid-column:1/-1;">${icon('target')}Aún no tienes metas de ahorro. Crea la primera con “Nueva meta”.</div>`;
        return;
    }
    cont.innerHTML = state.metas.map(m => {
        const pct = m.montoObjetivo > 0 ? Math.min(100, (m.montoActual / m.montoObjetivo) * 100) : 0;
        const completa = pct >= 100;
        const falta = Math.max(0, (m.montoObjetivo || 0) - (m.montoActual || 0));
        return `<div class="goal-card">
            <div class="goal-top">
                <div class="goal-emoji">${icon(m.emoji || 'target')}</div>
                <div style="min-width:0; flex:1;">
                    <div class="goal-name">${escapeHtml(m.nombre)}</div>
                    <div class="goal-sub">${m.fechaLimite ? 'Para el ' + formatFecha(m.fechaLimite) : 'Sin fecha límite'}</div>
                </div>
                ${completa ? `<span class="badge badge-success">${icon('check')}Lograda</span>` : ''}
            </div>
            <div class="goal-amounts">
                <span class="now money-blur tabular-nums">${money(m.montoActual)}</span>
                <span class="target money-blur tabular-nums">de ${money(m.montoObjetivo)}</span>
            </div>
            <div class="progress-bar-track"><div class="progress-bar-fill" style="width:${pct}%; background:${completa ? 'var(--success)' : 'var(--primary)'};"></div></div>
            <div class="goal-pct"><span>${pct.toFixed(0)}%</span><span class="money-blur">${completa ? 'Meta alcanzada' : 'Faltan ' + money(falta)}</span></div>
            <div class="goal-actions">
                <button class="btn btn-sm btn-primary" data-action="abonarMeta" data-id="${m.id}">${icon('plus')}Abonar</button>
                <button class="btn btn-sm btn-secondary" data-action="retirarMeta" data-id="${m.id}">Retirar</button>
                <button class="mini-icon-btn" data-action="editarMeta" data-id="${m.id}" title="Editar" aria-label="Editar">${icon('edit')}</button>
                <button class="mini-icon-btn" data-action="eliminarMeta" data-id="${m.id}" title="Eliminar" aria-label="Eliminar">${icon('trash')}</button>
            </div>
        </div>`;
    }).join('');
}
