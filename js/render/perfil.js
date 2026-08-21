import { state } from '../state.js';
import { icon } from '../utils/icons.js';

export function renderPerfil() {
    document.getElementById('listaCatCustom').innerHTML = state.categoriasCustom.length
        ? state.categoriasCustom.map(cat => `<div class="tag-chip">${cat} <span data-action="eliminarCategoriaCustom" data-cat="${cat}" style="cursor:pointer; display:flex;">${icon('x')}</span></div>`).join('')
        : `<small style="color:var(--text-muted);">No tienes etiquetas extra.</small>`;
}
