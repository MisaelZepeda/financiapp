// Retos de Tlaco (pestaña de Planear): retos activos con su avance, historial
// y el formulario para empezar uno nuevo.

import { sel } from '../core/store.js';
import { on } from '../core/eventos.js';
import * as A from '../core/actions.js';
import { icon } from '../lib/icons.js';
import { money, escapeHtml, fechaCorta } from '../lib/format.js';
import { vacioHTML } from '../components/piezas.js';
import { abrirHoja, cerrarHoja, hojaAbierta, toast, confirmar } from '../components/capas.js';
import { tlacoSVG } from '../components/tlaco.js';
import { TIPOS_RETO, evaluarReto, tituloReto, sugerirRetos } from '../domain/retos.js';
import { hoyISO, diasEntre } from '../domain/fechas.js';

const nombreCat = (id) => sel.categoria(id).nombre;
const evaluados = () => sel.retos().map(r => ({ r, e: evaluarReto(r, sel.transacciones()) }));

function retoActivoHTML({ r, e }) {
    const t = TIPOS_RETO[r.tipo] || TIPOS_RETO['registrar-diario'];
    const dia = Math.min(r.dias, diasEntre(r.inicio, hoyISO()) + 1);
    let nota = `Día ${dia} de ${r.dias} · termina el ${fechaCorta(e.fin)}`;
    if (r.tipo === 'tope-diario') nota = `Hoy llevas <span class="privado">${money(e.hoyGastado)}</span> de <span class="privado">${money(r.tope)}</span> · día ${dia} de ${r.dias}`;
    return `<section class="card reto">
        <div class="reto-top"><div class="fila-ico">${icon(t.icono)}</div>
            <div class="fila-body"><div class="fila-titulo">${escapeHtml(tituloReto(r, nombreCat(r.categoriaId)))}</div><div class="fila-sub">${nota}</div></div>
            <button class="icon-btn" data-action="retoAbandonar" data-id="${escapeHtml(r.id)}" aria-label="Abandonar reto">${icon('x')}</button></div>
        <div class="reto-dias">${Array.from({ length: r.dias }, (_, i) => `<i class="${i < e.diasOk ? 'ok' : i === e.diasOk ? 'hoy' : ''}"></i>`).join('')}</div>
    </section>`;
}

function historialHTML(lista) {
    if (!lista.length) return '';
    return `<p class="lista-label" style="margin-top:18px;">Historial</p>
        <section class="card card-flush"><div class="lista">${lista.slice(0, 12).map(({ r, e }) => `<div class="fila">
            <div class="fila-ico ${e.estado === 'cumplido' ? 'tono-pos' : ''}">${icon(e.estado === 'cumplido' ? 'check-circle' : 'x')}</div>
            <div class="fila-body"><div class="fila-titulo">${escapeHtml(tituloReto(r, nombreCat(r.categoriaId)))}</div>
                <div class="fila-sub">${e.estado === 'cumplido' ? `Cumplido el ${fechaCorta(e.fin)}` : `Se rompió el ${fechaCorta(e.falloEn)}`}</div></div>
            <button class="icon-btn" data-action="retoBorrar" data-id="${escapeHtml(r.id)}" aria-label="Borrar del historial">${icon('trash')}</button>
        </div>`).join('')}</div></section>`;
}

export function retosHTML() {
    const todos = evaluados();
    const activos = todos.filter(x => x.e.estado === 'activo');
    const pasados = todos.filter(x => x.e.estado !== 'activo').sort((a, b) => b.e.fin.localeCompare(a.e.fin));
    const cumplidos = pasados.filter(x => x.e.estado === 'cumplido').length;
    const recien = todos.find(x => x.e.estado === 'cumplido' && !x.r.celebrado);
    const tlaco = recien
        ? `<section class="card reto-tlaco">${tlacoSVG('celebrando', { tamano: 72 })}<div><b>¡Cumpliste un reto!</b><p>${escapeHtml(tituloReto(recien.r, nombreCat(recien.r.categoriaId)))}. ¡Así se hace!</p></div></section>`
        : `<section class="card reto-tlaco">${tlacoSVG(activos.length ? 'contento' : 'tranquilo', { tamano: 72 })}<div><b>${activos.length ? 'Vas muy bien' : '¿Un reto corto?'}</b>
            <p>${activos.length ? 'Cada día que cumples cuenta. Yo llevo la cuenta por ti.' : 'Los hábitos se forman de a poquito. Elige uno de unos días y te acompaño.'}${cumplidos ? ` Llevas <b>${cumplidos}</b> reto${cumplidos === 1 ? '' : 's'} cumplido${cumplidos === 1 ? '' : 's'}.` : ''}</p></div></section>`;
    return `${tlaco}
        <div class="acciones-top"><span class="hint">${activos.length ? `${activos.length} reto${activos.length === 1 ? '' : 's'} en curso` : 'Sin retos en curso'}</span><button class="btn btn-primary" data-action="nuevoReto">${icon('plus')}Nuevo reto</button></div>
        ${activos.length ? activos.map(retoActivoHTML).join('') : `<section class="card">${vacioHTML('target', 'Empieza un reto: unos días sin gastar en algo, un tope diario o registrar todos los días.')}</section>`}
        ${historialHTML(pasados)}`;
}

// Tlaco celebra una vez cada reto cumplido.
const celebrando = new Set();
export function celebrarRetos() {
    evaluados().filter(x => x.e.estado === 'cumplido' && !x.r.celebrado && !celebrando.has(x.r.id)).forEach(({ r }) => {
        celebrando.add(r.id);
        toast(`¡Reto cumplido! ${tituloReto(r, nombreCat(r.categoriaId))}`);
        setTimeout(() => A.guardarReto({ id: r.id, celebrado: true }), 4000);
    });
}

// ---------- Nuevo reto ----------
let nuevo = null;

function formHTML() {
    const t = TIPOS_RETO[nuevo.tipo];
    const cats = sel.categorias();
    return `<div class="field"><span class="label">Tipo de reto</span><div class="reto-tipos">
            ${Object.entries(TIPOS_RETO).map(([k, v]) => `<button type="button" class="reto-tipo ${k === nuevo.tipo ? 'activo' : ''}" data-action="retoTipo" data-t="${k}">${icon(v.icono)}<span>${v.nombre}</span></button>`).join('')}
        </div></div>
        ${nuevo.tipo === 'sin-categoria' ? `<div class="field"><label for="reto-cat">Categoría</label><select id="reto-cat" data-change="retoCat">${cats.map(c => `<option value="${escapeHtml(c.id)}" ${c.id === nuevo.categoriaId ? 'selected' : ''}>${escapeHtml(c.nombre)}</option>`).join('')}</select></div>` : ''}
        ${nuevo.tipo === 'tope-diario' ? `<div class="field"><label for="reto-tope">Máximo por día</label><input id="reto-tope" inputmode="decimal" value="${nuevo.tope}" data-input="retoTope">
            <span class="hint">Sugerido: un 20 % menos que tu gasto diario variable. Renta y recurrentes no cuentan.</span></div>` : ''}
        <div class="field"><span class="label">Duración</span><div class="chips">${t.dias.map(d => `<button type="button" class="chip ${d === nuevo.dias ? 'activo' : ''}" data-action="retoDias" data-d="${d}">${d} días</button>`).join('')}</div></div>
        <p class="hint">Empieza hoy: <b>${escapeHtml(tituloReto(nuevo, nombreCat(nuevo.categoriaId)))}</b>.</p>
        <div class="hoja-foot"><button class="btn btn-primary" data-action="retoGuardar">Empezar reto</button></div>`;
}
const repintarForm = () => { const el = hojaAbierta()?.querySelector('#reto-form'); if (el) el.innerHTML = formHTML(); };

on('nuevoReto', () => {
    const s = sugerirRetos(sel.transacciones());
    nuevo = { tipo: 'sin-categoria', categoriaId: s.categoriaId || sel.categorias()[0]?.id, tope: s.tope, dias: 7 };
    abrirHoja({ titulo: 'Nuevo reto', html: `<div id="reto-form">${formHTML()}</div>` });
});
on('retoTipo', (el) => { nuevo.tipo = el.dataset.t; if (!TIPOS_RETO[nuevo.tipo].dias.includes(nuevo.dias)) nuevo.dias = TIPOS_RETO[nuevo.tipo].dias[1]; repintarForm(); });
on('retoCat', (el) => { nuevo.categoriaId = el.value; repintarForm(); }, 'change');
on('retoTope', (el) => { nuevo.tope = parseFloat(el.value.replace(/[^0-9.]/g, '')) || 0; }, 'input');
on('retoDias', (el) => { nuevo.dias = Number(el.dataset.d); repintarForm(); });
on('retoGuardar', async () => {
    if (nuevo.tipo === 'tope-diario' && !(nuevo.tope > 0)) return toast('Escribe el máximo por día', { tipo: 'error' });
    const reto = { tipo: nuevo.tipo, dias: nuevo.dias, inicio: hoyISO(), creadoEn: Date.now() };
    if (nuevo.tipo === 'sin-categoria') reto.categoriaId = nuevo.categoriaId;
    if (nuevo.tipo === 'tope-diario') reto.tope = Math.round(nuevo.tope * 100) / 100;
    await A.guardarReto(reto);
    cerrarHoja(); toast('¡Reto en marcha! Tlaco lleva la cuenta');
});
on('retoAbandonar', async (el) => {
    if (!(await confirmar({ titulo: 'Abandonar reto', texto: 'Se quita el reto en curso. Siempre puedes empezar otro.', aceptar: 'Abandonar', peligro: true }))) return;
    await A.borrarReto(el.dataset.id); toast('Reto abandonado');
});
on('retoBorrar', async (el) => { await A.borrarReto(el.dataset.id); toast('Quitado del historial'); });
