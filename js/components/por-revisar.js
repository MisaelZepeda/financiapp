// "Por revisar": pagos con Apple Pay que llegaron del Atajo. Se confirman con
// un toque (cuenta y categoría sugeridas), se corrigen o se descartan.

import { on } from '../core/eventos.js';
import { sel } from '../core/store.js';
import * as A from '../core/actions.js';
import { abrirHoja, cerrarHoja, hojaAbierta, toast } from './capas.js';
import { abrirRegistro } from './registro.js';
import { icoCat } from './piezas.js';
import { icon } from '../lib/icons.js';
import { money, escapeHtml, etiquetaDia } from '../lib/format.js';
import { sugerirCategoria } from '../domain/autocategoria.js';

export const porRevisar = () => Object.values(sel.porRevisar()).sort((a, b) => (b.creadoEn || 0) - (a.creadoEn || 0));

// Categoría: la que mandó el Worker o la que sugiere tu historial; si no, "otros".
function categoriaDe(p) {
    if (p.categoriaId && sel.categorias().some(c => c.id === p.categoriaId)) return p.categoriaId;
    const ids = sel.categorias().map(c => c.id);
    return sugerirCategoria(p.comercio, sel.transacciones().filter(t => t.tipo === 'gasto'), ids)?.categoriaId || (ids.includes('otros') ? 'otros' : ids[0]);
}
const cuentaDe = (p) => (p.cuentaId && sel.cuenta(p.cuentaId) ? p.cuentaId : null);

const txDe = (p, cambios = {}) => ({ tipo: 'gasto', monto: Number(p.monto), fecha: p.fecha, desc: (p.comercio || '').slice(0, 80), cuentaId: cuentaDe(p), categoriaId: categoriaDe(p), ...cambios });

export function porRevisarHTML() {
    const lista = porRevisar();
    if (!lista.length) return '';
    const total = lista.reduce((a, p) => a + (Number(p.monto) || 0), 0);
    return `<button class="card revisar-cta" data-action="abrirPorRevisar">
        <span class="revisar-ico">${icon('credit-card')}</span>
        <span class="revisar-txt"><b>${lista.length} pago${lista.length === 1 ? '' : 's'} con Apple Pay por revisar</b><small><span class="privado">${money(total)}</span> · confirma cuenta y categoría</small></span>
        ${icon('chevron-right', 'chev')}</button>`;
}

function filaHTML(p) {
    const cuenta = sel.cuenta(cuentaDe(p));
    const cat = sel.categoria(categoriaDe(p));
    return `<div class="revisar-fila" data-id="${escapeHtml(p.id)}">
        <div class="fila fila-link" data-action="revisarEditar" data-id="${escapeHtml(p.id)}">
            <div ${icoCat(cat.id)}>${icon(cat.icono || 'tag')}</div>
            <div class="fila-body"><div class="fila-titulo">${escapeHtml(p.comercio || 'Pago con Apple Pay')}</div>
                <div class="fila-sub">${escapeHtml(etiquetaDia(p.fecha))} · ${escapeHtml(cat.nombre)} · ${cuenta ? escapeHtml(cuenta.nombre) : `<span class="neg">Elige la cuenta</span>`}${p.tarjeta ? ` · <span class="muted">${escapeHtml(p.tarjeta)}</span>` : ''}</div></div>
            <div class="fila-der"><span class="num privado">−${money(Number(p.monto) || 0)}</span></div>
        </div>
        <div class="revisar-btns">
            <button class="btn btn-ghost btn-sm" data-action="revisarDescartar" data-id="${escapeHtml(p.id)}">${icon('x')}Descartar</button>
            <button class="btn btn-soft btn-sm" data-action="revisarEditar" data-id="${escapeHtml(p.id)}">${icon('edit')}Corregir</button>
            <button class="btn btn-primary btn-sm" data-action="revisarAceptar" data-id="${escapeHtml(p.id)}" ${cuenta ? '' : 'disabled'}>${icon('check')}Guardar</button>
        </div>
    </div>`;
}

function contenidoHTML() {
    const lista = porRevisar();
    if (!lista.length) return '<p class="hint">Ya revisaste todo.</p>';
    const listos = lista.filter(cuentaDe).length;
    return `<p class="hint" style="margin-bottom:12px;">Llegaron de tu automatización de Apple Pay. Revisa que la cuenta y la categoría sean correctas.</p>
        <div class="revisar-lista">${lista.map(filaHTML).join('')}</div>
        ${listos > 1 ? `<div class="hoja-foot"><button class="btn btn-primary" data-action="revisarTodo">${icon('check')}Guardar los ${listos} listos</button></div>` : ''}`;
}

function repintar() {
    const el = hojaAbierta()?.querySelector('#revisar-body');
    if (!el) return;
    if (!porRevisar().length) { cerrarHoja(); toast('Ya revisaste todo'); return; }
    el.innerHTML = contenidoHTML();
}

export function abrirPorRevisar() {
    if (!porRevisar().length) return;
    abrirHoja({ titulo: 'Por revisar', html: `<div id="revisar-body">${contenidoHTML()}</div>` });
}

on('abrirPorRevisar', abrirPorRevisar);
on('revisarAceptar', async (el) => {
    const p = sel.porRevisar()[el.dataset.id];
    if (!p || !cuentaDe(p)) return;
    el.disabled = true;
    await A.aceptarPorRevisar(p.id, txDe(p));
    toast(`Guardado · ${money(Number(p.monto))}`);
    repintar();
});
on('revisarTodo', async (el) => {
    el.disabled = true;
    const listos = porRevisar().filter(cuentaDe);
    for (const p of listos) await A.aceptarPorRevisar(p.id, txDe(p));
    toast(`${listos.length} pagos guardados`);
    repintar();
});
on('revisarDescartar', async (el) => {
    const p = sel.porRevisar()[el.dataset.id];
    if (!p) return;
    await A.descartarPorRevisar(p.id);
    toast('Pago descartado', { deshacer: () => A.agregarPorRevisar([p]) });
    repintar();
});
// Corregir: el registro de siempre, prellenado; al guardar se quita de la lista.
on('revisarEditar', (el) => {
    const p = sel.porRevisar()[el.dataset.id];
    if (!p) return;
    const tx = txDe(p);
    cerrarHoja(true);
    abrirRegistro({
        tipo: 'gasto', monto: tx.monto, desc: tx.desc, fecha: tx.fecha, cuentaId: tx.cuentaId || undefined, categoriaId: tx.categoriaId,
        alGuardar: async (nuevo) => {
            await A.aceptarPorRevisar(p.id, nuevo);
            toast(`Guardado · ${money(Number(nuevo.monto))}`);
            setTimeout(abrirPorRevisar, 250);
        },
    });
});
