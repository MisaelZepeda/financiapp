// Hoja inferior (formularios), diálogo de confirmación y avisos breves (toasts).

import { icon } from '../lib/icons.js';
import { escapeHtml } from '../lib/format.js';

const raiz = () => document.getElementById('capas');

// ---------- Hoja ----------
let hojaActual = null;

// abrirHoja({ titulo, html, alMontar(el), alCerrar(), acciones: html extra en el encabezado })
export function abrirHoja({ titulo, html, alMontar, alCerrar, acciones = '' }) {
    cerrarHoja(true);
    const capa = document.createElement('div');
    capa.className = 'capa';
    capa.innerHTML = `<div class="hoja" role="dialog" aria-modal="true" aria-label="${escapeHtml(titulo)}">
        <div class="hoja-grip"></div>
        <div class="hoja-head"><h3>${escapeHtml(titulo)}</h3>${acciones}<button class="icon-btn" data-action="cerrarHoja" aria-label="Cerrar">${icon('x')}</button></div>
        <div class="hoja-body">${html}</div>
    </div>`;
    capa.addEventListener('mousedown', (e) => { if (e.target === capa) cerrarHoja(); });
    raiz().appendChild(capa);
    document.body.style.overflow = 'hidden';
    hojaActual = { capa, alCerrar };
    alMontar?.(capa.querySelector('.hoja'));
    return capa.querySelector('.hoja');
}

export function cerrarHoja(silencioso = false) {
    if (!hojaActual) return;
    const { capa, alCerrar } = hojaActual;
    hojaActual = null;
    capa.remove();
    if (!document.querySelector('.capa')) document.body.style.overflow = '';
    if (!silencioso) alCerrar?.();
}

export function hojaAbierta() { return hojaActual?.capa.querySelector('.hoja') || null; }

// ---------- Diálogo ----------
export function confirmar({ titulo, texto = '', aceptar = 'Confirmar', peligro = false }) {
    return new Promise(resolve => {
        const capa = document.createElement('div');
        capa.className = 'capa';
        capa.style.zIndex = 150;
        capa.innerHTML = `<div class="modal" role="alertdialog" aria-modal="true">
            <h3>${escapeHtml(titulo)}</h3>${texto ? `<p>${escapeHtml(texto)}</p>` : ''}
            <div class="modal-btns"><button class="btn btn-soft" data-r="0">Cancelar</button><button class="btn ${peligro ? 'btn-danger' : 'btn-primary'}" data-r="1">${escapeHtml(aceptar)}</button></div>
        </div>`;
        const fin = (v) => { capa.remove(); if (!document.querySelector('.capa')) document.body.style.overflow = ''; resolve(v); };
        capa.addEventListener('click', (e) => {
            const b = e.target.closest('[data-r]');
            if (b) fin(b.dataset.r === '1'); else if (e.target === capa) fin(false);
        });
        raiz().appendChild(capa);
        capa.querySelector('[data-r="1"]').focus();
    });
}

// ---------- Toast ----------
// toast('Gasto registrado', { deshacer: () => …, tipo: 'error' })
export function toast(texto, { deshacer, tipo, duracion = 4000 } = {}) {
    const cont = document.getElementById('toasts');
    const el = document.createElement('div');
    el.className = `toast ${tipo === 'error' ? 'error' : ''}`;
    el.innerHTML = `${icon(tipo === 'error' ? 'alert-circle' : 'check-circle')}<span>${escapeHtml(texto)}</span>${deshacer ? '<button>Deshacer</button>' : ''}`;
    let timer;
    const quitar = () => { clearTimeout(timer); el.remove(); };
    if (deshacer) el.querySelector('button').addEventListener('click', () => { quitar(); deshacer(); });
    cont.appendChild(el);
    while (cont.children.length > 3) cont.firstChild.remove();
    timer = setTimeout(quitar, deshacer ? Math.max(duracion, 6000) : duracion);
}

document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (document.querySelector('.modal')) return; // el diálogo se cierra con sus botones
    cerrarHoja();
});
