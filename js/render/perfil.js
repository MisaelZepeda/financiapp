import { state } from '../state.js';
import { icon } from '../utils/icons.js';
import { escapeHtml } from '../utils/format.js';

export function renderPerfil() {
    document.getElementById('listaCatCustom').innerHTML = state.categoriasCustom.length
        ? state.categoriasCustom.map(cat => `<div class="tag-chip">${escapeHtml(cat)} <span data-action="eliminarCategoriaCustom" data-cat="${escapeHtml(cat)}" style="cursor:pointer; display:flex;">${icon('x')}</span></div>`).join('')
        : `<small style="color:var(--text-muted);">No tienes etiquetas extra.</small>`;
}
