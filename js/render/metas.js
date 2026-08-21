import { state } from '../state.js';
import { money, formatFecha } from '../utils/format.js';

const COLORES = ['var(--primary-soft)', 'var(--success-soft)', 'var(--warning-soft)', 'var(--info-soft)', 'var(--danger-soft)'];
const TEXTOS = ['var(--primary)', 'var(--success)', 'var(--warning)', 'var(--info)', 'var(--danger)'];

export function renderMetas() {
    const cont = document.getElementById('metasGrid');
    if (!cont) return;
    if (state.metas.length === 0) {
        cont.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><span class="icon">🎯</span>Aún no tienes metas de ahorro. Crea la primera abajo.</div>`;
        return;
    }
    cont.innerHTML = state.metas.map((m, i) => {
        const pct = m.montoObjetivo > 0 ? Math.min(100, (m.montoActual / m.montoObjetivo) * 100) : 0;
        const completa = pct >= 100;
        return `<div class="goal-card">
            <div class="goal-top">
                <div class="goal-emoji" style="background:${COLORES[i % COLORES.length]}; color:${TEXTOS[i % TEXTOS.length]};">${m.emoji || '🎯'}</div>
                <div style="min-width:0;">
                    <div class="goal-name">${m.nombre}</div>
                    <div class="goal-sub">${m.fechaLimite ? 'Meta: ' + formatFecha(m.fechaLimite) : 'Sin fecha límite'}</div>
                </div>
            </div>
            <div class="goal-amounts">
                <span class="now money-blur">${money(m.montoActual)}</span>
                <span class="target money-blur">de ${money(m.montoObjetivo)}</span>
            </div>
            <div class="progress-bar-track"><div class="progress-bar-fill" style="width:${pct}%; background:${completa ? 'var(--success)' : 'var(--primary)'};"></div></div>
            ${completa ? `<div class="badge badge-success" style="margin-top:10px;">🎉 ¡Meta completada!</div>` : ''}
            <div class="goal-actions">
                <button class="btn btn-sm btn-ghost" style="flex:1;" data-action="retirarMeta" data-id="${m.id}">− Retirar</button>
                <button class="btn btn-sm btn-primary" style="flex:1;" data-action="abonarMeta" data-id="${m.id}">+ Abonar</button>
                <button class="btn btn-sm btn-ghost" data-action="editarMeta" data-id="${m.id}">✏️</button>
                <button class="btn btn-sm btn-outline-danger" data-action="eliminarMeta" data-id="${m.id}">🗑️</button>
            </div>
        </div>`;
    }).join('');
}
