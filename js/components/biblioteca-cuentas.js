// Pregunta de una sola vez (el día que llegó la biblioteca de instituciones): en cada
// cuenta con logo propio, ¿conservarlo o usar el de la biblioteca? Muestra los dos.
// Solo se ofrece el primer día que aparece; después no vuelve a salir.

import { sel } from '../core/store.js';
import { on } from '../core/eventos.js';
import { actualizar } from '../core/db.js';
import { guardarAjustes } from '../core/actions.js';
import { icon } from '../lib/icons.js';
import { escapeHtml } from '../lib/format.js';
import { abrirHoja, cerrarHoja, hojaAbierta, toast } from './capas.js';
import { logoImgHTML } from './piezas.js';
import { cuentasParaBiblioteca, institucionDe, logoDeInstitucion, colorDeCuenta } from '../domain/instituciones.js';
import { hoyISO } from '../domain/fechas.js';

// ¿Se ofrece hoy? Solo el primer día en que hay algo que decidir.
export function bibliotecaPendiente() {
    const lista = cuentasParaBiblioteca(sel.cuentas());
    if (!lista.length) return 0;
    const dia = sel.ajustes().bibliotecaDia;
    if (dia && dia !== hoyISO()) return 0;
    if (!dia) guardarAjustes({ bibliotecaDia: hoyISO() });   // se registra el día en que se ofreció
    return lista.length;
}

const logo = (src, inicial, color) => `<span class="inst-logo bib-logo" style="--ic:${color}">${src ? logoImgHTML(src, inicial) : inicial}</span>`;

function filaHTML(c) {
    const inst = institucionDe(c);
    const inicial = escapeHtml((inst?.nombre || c.nombre || '?').charAt(0).toUpperCase());
    return `<div class="bib-fila">
        <div class="fila-titulo">${escapeHtml(c.nombre)} <span class="muted">· ${escapeHtml(inst.nombre)}</span></div>
        <div class="bib-comparar">
            <button type="button" class="bib-op" data-action="bibDecidir" data-id="${escapeHtml(c.id)}" data-usar="0">
                ${logo(c.icono, inicial, colorDeCuenta(c))}<b>El tuyo</b><small>Conservar</small></button>
            <span class="bib-vs">${icon('repeat')}</span>
            <button type="button" class="bib-op" data-action="bibDecidir" data-id="${escapeHtml(c.id)}" data-usar="1">
                ${logo(logoDeInstitucion(inst), inicial, inst.color)}<b>Biblioteca</b><small>Usar este</small></button>
        </div>
    </div>`;
}

function cuerpoHTML() {
    const lista = cuentasParaBiblioteca(sel.cuentas());
    if (!lista.length) return `<p class="hint" style="text-align:center;">¡Listo! Todas tus cuentas quedaron como las elegiste.</p>
        <div class="hoja-foot"><button class="btn btn-primary" data-action="cerrarHoja">Cerrar</button></div>`;
    return `<p class="hint" style="margin-top:0;">Llegó la biblioteca de instituciones con logos y colores oficiales. Estas cuentas tienen un logo que pusiste tú: elige cuál quieres en cada una. Solo te lo pregunto hoy.</p>
        <div class="bib-lista">${lista.map(filaHTML).join('')}</div>
        <div class="hoja-foot"><button class="btn btn-soft" data-action="bibTodas" data-usar="0">Conservar todos</button>
            <button class="btn btn-primary" data-action="bibTodas" data-usar="1">Biblioteca en todas</button></div>`;
}
const repintar = () => { const el = hojaAbierta()?.querySelector('#bib-body'); if (el) el.innerHTML = cuerpoHTML(); };

// Usar la biblioteca: queda la institución y se quitan el logo y el color propios.
function cambios(c, usar) {
    const inst = institucionDe(c);
    const base = `cuentas/${c.id}`;
    return usar
        ? { [`${base}/institucion`]: inst.id, [`${base}/icono`]: null, [`${base}/color`]: null, [`${base}/bibliotecaDecidida`]: true }
        : { [`${base}/institucion`]: inst.id, [`${base}/bibliotecaDecidida`]: true };
}

export function abrirBiblioteca() {
    abrirHoja({ titulo: 'Logos de tus cuentas', html: `<div id="bib-body">${cuerpoHTML()}</div>` });
}

on('abrirBiblioteca', () => abrirBiblioteca());
on('bibDecidir', async (el) => {
    const c = sel.cuenta(el.dataset.id);
    if (!c) return;
    await actualizar(cambios(c, el.dataset.usar === '1'));
    toast(el.dataset.usar === '1' ? `${c.nombre}: ahora usa el logo de la biblioteca` : `${c.nombre}: conservaste tu logo`);
    repintar();
});
on('bibTodas', async (el) => {
    const usar = el.dataset.usar === '1';
    const updates = Object.assign({}, ...cuentasParaBiblioteca(sel.cuentas()).map(c => cambios(c, usar)));
    await actualizar(updates);
    cerrarHoja();
    toast(usar ? 'Tus cuentas ya usan los logos de la biblioteca' : 'Conservaste tus logos');
});
