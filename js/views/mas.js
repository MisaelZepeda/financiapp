// Más: todo lo que no está en la barra de abajo, agrupado y explicado en una línea.

import { store, sel } from '../core/store.js';
import { icon } from '../lib/icons.js';
import { avatarHTML } from '../components/piezas.js';
import { escapeHtml } from '../lib/format.js';

export const titulo = () => ({ titulo: 'Más' });

const GRUPOS = [
    ['Entender tu dinero', [
        ['#/analisis', 'bar-chart', 'Análisis', 'Gráficas, comparativos y en qué se te va'],
    ]],
    ['Planear', [
        ['#/planear/presupuestos', 'target', 'Presupuestos', 'Cuánto quieres gastar por categoría'],
        ['#/planear/calendario', 'calendar', 'Calendario de pagos', 'Qué vence y cuándo'],
        ['#/planear/metas', 'shield', 'Metas de ahorro', 'Aparta para lo que quieres'],
        ['#/planear/recurrentes', 'repeat', 'Pagos fijos', 'Renta, suscripciones y nómina'],
        ['#/planear/retos', 'check-circle', 'Retos de Tlaco', 'Hábitos cortos de unos días'],
    ]],
    ['Tu cuenta', [
        ['#/ajustes', 'settings', 'Ajustes', 'Categorías, avisos, Siri, apariencia y respaldo'],
    ]],
];

export function render() {
    const p = sel.perfil();
    return `<a class="card mas-perfil" href="#/ajustes">${avatarHTML(p)}<div><b>${escapeHtml(p.nombre || 'Tu perfil')}</b><span>${escapeHtml(store.demo ? 'Modo demo' : store.usuario?.email || '')}</span></div>${icon('chevron-right', 'chev')}</a>
        ${GRUPOS.map(([nombre, items]) => `<p class="lista-label mas-grupo">${nombre}</p>
            <div class="mas-grid">${items.map(([ruta, ico, t, d]) => `<a class="mas-item" href="${ruta}">
                <span class="mas-ico">${icon(ico)}</span><span class="mas-txt"><b>${t}</b><small>${d}</small></span></a>`).join('')}</div>`).join('')}`;
}
