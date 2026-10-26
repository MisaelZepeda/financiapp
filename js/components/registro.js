// Registro rápido de movimientos: monto primero (teclado-calculadora en celular),
// y todo lo demás en fichas de un toque. También sirve para editar.

import { on } from '../core/eventos.js';
import { sel } from '../core/store.js';
import { guardarTransaccion, borrarTransaccion, guardarPlantilla } from '../core/actions.js';
import { abrirHoja, cerrarHoja, hojaAbierta, toast, confirmar } from './capas.js';
import { icon } from '../lib/icons.js';
import { escapeHtml, money, fechaCorta } from '../lib/format.js';
import { hoyISO, sumarDias } from '../domain/fechas.js';
import { teclear, evaluar, tieneOperacion, expresionLegible, normalizarTexto } from '../domain/calculadora.js';
import { sugerirCategoria } from '../domain/autocategoria.js';
import { tlacoSVG } from './tlaco.js';
import { monedaAlcancia, confeti } from './efectos.js';
import { esIngresoGrande } from '../domain/analisis.js';

let r = null; // estado del formulario

const TITULOS = { gasto: 'Gasto', ingreso: 'Ingreso', transferencia: 'Transferencia' };
const MSI = [0, 3, 6, 9, 12, 18];

// abrirRegistro({ tipo, id (editar), cuentaId, cuentaDestinoId, subtipo,
//                 monto, desc, categoriaId (prellenado: favoritos y Siri) })
export function abrirRegistro(opts = {}) {
    const tx = opts.id ? sel.transaccion(opts.id) : null;
    const tipo = tx?.tipo || opts.tipo || 'gasto';
    const partes = tx?.partes?.length > 1 ? tx.partes.map(p => ({ categoriaId: p.categoriaId, montoTxt: String(p.monto) })) : [];
    r = {
        id: tx?.id || null, original: tx,
        tipo, montoTxt: tx ? String(tx.monto) : (opts.monto ? String(opts.monto) : ''),
        categoriaId: tx?.categoriaId || opts.categoriaId || null,
        catManual: !!(tx?.categoriaId || opts.categoriaId),   // si la eligió el usuario, no se sugiere otra
        catSugerida: false,
        cuentaId: tx?.cuentaId || opts.cuentaId || null,
        cuentaDestinoId: tx?.cuentaDestinoId || opts.cuentaDestinoId || null,
        subtipo: tx?.subtipo || opts.subtipo || null,
        msi: tx?.msi || 0,
        fecha: tx?.fecha || hoyISO(),
        desc: tx?.desc || opts.desc || '',
        dividir: partes.length > 1, partes,
        etiquetas: [...(tx?.etiquetas || [])], favorito: false,
        desdeAtajo: !!opts.desdeAtajo,
    };
    if (!r.categoriaId && r.desc) aplicarSugerencia();
    if (!r.cuentaId) r.cuentaId = cuentaSugerida(r.tipo, r.categoriaId);
    if (r.tipo === 'transferencia' && !r.cuentaDestinoId) r.cuentaDestinoId = destinoSugerido();
    abrirHoja({
        titulo: r.id ? `Editar ${TITULOS[tipo].toLowerCase()}` : 'Nuevo movimiento',
        html: '<div id="reg"></div>',
        alMontar: (hoja) => {
            pintar();
            hoja.addEventListener('keydown', teclasEscritorio);
            if (matchMedia('(hover: hover) and (pointer: fine)').matches) hoja.querySelector('#reg-monto')?.focus();
        },
        alCerrar: () => { r = null; },
    });
}

// ---------- Sugerencias ----------
function usoCategorias() {
    const desde = sumarDias(hoyISO(), -90);
    const cuenta = {};
    sel.transacciones().forEach(t => { if (t.tipo === 'gasto' && t.fecha >= desde) cuenta[t.categoriaId] = (cuenta[t.categoriaId] || 0) + 1; });
    return cuenta;
}

function categoriasOrdenadas() {
    const uso = usoCategorias();
    return sel.categorias().slice().sort((a, b) => (uso[b.id] || 0) - (uso[a.id] || 0) || (a.orden ?? 99) - (b.orden ?? 99));
}

// Última cuenta usada con esa categoría; si no, la última usada para ese tipo.
function cuentaSugerida(tipo, categoriaId) {
    const txs = sel.transacciones();
    const existe = (id) => id && sel.cuenta(id);
    if (categoriaId) { const t = txs.find(x => x.tipo === 'gasto' && x.categoriaId === categoriaId && existe(x.cuentaId)); if (t) return t.cuentaId; }
    const t = txs.find(x => x.tipo === tipo && existe(x.cuentaId));
    if (t) return t.cuentaId;
    const cuentas = sel.cuentas();
    return (cuentas.find(c => c.tipo !== 'credito') || cuentas[0])?.id || null;
}

function destinoSugerido() {
    const t = sel.transacciones().find(x => x.tipo === 'transferencia' && x.cuentaId === r.cuentaId);
    return t?.cuentaDestinoId || sel.cuentas().find(c => c.id !== r.cuentaId)?.id || null;
}

function sugerenciasDesc() {
    const q = r.desc.trim().toLowerCase();
    if (q.length < 2) return [];
    const vistas = new Set(), out = [];
    for (const t of sel.transacciones()) {
        if (t.tipo !== r.tipo || !t.desc) continue;
        const k = t.desc.trim().toLowerCase();
        if (vistas.has(k) || !k.includes(q) || k === q) continue;
        vistas.add(k); out.push(t);
        if (out.length === 3) break;
    }
    return out;
}

// ---------- Monto (calculadora) ----------
// r.montoTxt guarda la expresión tecleada, p. ej. "120+35×2".
function montoNum() { return evaluar(r.montoTxt) || 0; }

function montoHTML() {
    if (!r.montoTxt) return '<span class="num vacio-monto">$0</span>';
    if (tieneOperacion(r.montoTxt)) {
        const v = evaluar(r.montoTxt);
        return `<div class="calc-expr num">${escapeHtml(expresionLegible(r.montoTxt))}</div><span class="num ${v < 0 ? 'neg' : ''}">= ${money(v || 0)}</span>`;
    }
    const [ent, dec] = r.montoTxt.split('.');
    const entero = Number(ent || 0).toLocaleString('es-MX');
    return `<span class="num">$${entero}${dec !== undefined ? `<span class="cent">.${dec}</span>` : ''}</span>`;
}

function refrescarMonto() {
    const hoja = hojaAbierta();
    const d = hoja?.querySelector('.monto-display'); if (d) d.innerHTML = montoHTML();
    const p = hoja?.querySelector('.calc-preview');
    if (p) p.textContent = tieneOperacion(r.montoTxt) ? `= ${money(evaluar(r.montoTxt) || 0)}` : '';
    if (r.dividir) actualizarResumenPartes();
}

function tecla(k) {
    r.montoTxt = teclear(r.montoTxt, k);
    const input = hojaAbierta()?.querySelector('#reg-monto');
    if (input) input.value = r.montoTxt;
    refrescarMonto();
}

// ---------- Categoría sugerida, partes y etiquetas ----------
function aplicarSugerencia() {
    if (r.tipo !== 'gasto' || r.catManual) return false;
    const sug = sugerirCategoria(r.desc, sel.transacciones(), sel.categorias().map(c => c.id));
    const antes = r.categoriaId;
    r.categoriaId = sug?.categoriaId || null;
    r.catSugerida = !!sug;
    return antes !== r.categoriaId;
}

function categoriasHTML() {
    return `<span class="label">Categoría${r.catSugerida && r.categoriaId ? ' <span class="badge badge-accent">sugerida</span>' : ''}</span>
        <div class="chips">${categoriasOrdenadas().map(c =>
            `<button type="button" class="chip ${c.id === r.categoriaId ? 'activo' : ''}" data-action="regCat" data-id="${escapeHtml(c.id)}">${icon(c.icono || 'tag')}${escapeHtml(c.nombre)}</button>`).join('')}</div>
        <button type="button" class="link" data-action="regDividir" style="margin-top:8px;">${icon(r.dividir ? 'x' : 'list')}${r.dividir ? 'No dividir' : 'Dividir en varias categorías'}</button>
        ${r.dividir ? `<div id="reg-partes">${partesHTML()}</div>` : ''}`;
}

function sumaPartes() { return Math.round(r.partes.reduce((a, p) => a + (parseFloat(p.montoTxt) || 0), 0) * 100) / 100; }

function partesHTML() {
    const total = Math.round(montoNum() * 100) / 100, asignado = sumaPartes();
    const falta = Math.round((total - asignado) * 100) / 100;
    return `<div class="partes">${r.partes.map((p, i) => `<div class="parte">
            <select data-change="regParteCat" data-i="${i}" aria-label="Categoría de la parte ${i + 1}">${sel.categorias().map(c => `<option value="${escapeHtml(c.id)}" ${c.id === p.categoriaId ? 'selected' : ''}>${escapeHtml(c.nombre)}</option>`).join('')}</select>
            <input inputmode="decimal" placeholder="$0.00" value="${escapeHtml(p.montoTxt)}" data-input="regParteMonto" data-i="${i}" aria-label="Monto de la parte ${i + 1}">
            <button type="button" class="icon-btn" data-action="regQuitarParte" data-i="${i}" aria-label="Quitar parte">${icon('x')}</button>
        </div>`).join('')}
        <div class="partes-pie"><button type="button" class="link" data-action="regAgregarParte">${icon('plus')}Agregar parte</button>
            <span id="reg-partes-resumen" class="hint ${Math.abs(falta) > 0.009 ? 'neg' : 'pos'}">${resumenPartes(total, asignado)}</span></div></div>`;
}

function resumenPartes(total, asignado) {
    const falta = Math.round((total - asignado) * 100) / 100;
    if (!total) return 'Escribe primero el monto total';
    if (Math.abs(falta) < 0.01) return 'Completo';
    return falta > 0 ? `Faltan ${money(falta)} por repartir` : `Te pasaste por ${money(-falta)}`;
}

function etiquetasUsadas() {
    const cuenta = {};
    sel.transacciones().forEach(t => (t.etiquetas || []).forEach(e => { cuenta[e] = (cuenta[e] || 0) + 1; }));
    return Object.keys(cuenta).sort((a, b) => cuenta[b] - cuenta[a]);
}

const limpiarEtiqueta = (t) => String(t || '').replace(/[,;]/g, ' ').trim().replace(/^#+/, '').toLowerCase().replace(/\s+/g, '-').replace(/[.#$/[\]]/g, '').replace(/^-+|-+$/g, '').slice(0, 30);

function etiquetasHTML() {
    const sugeridas = etiquetasUsadas().filter(e => !r.etiquetas.includes(e)).slice(0, 6);
    return `<div class="chips">${r.etiquetas.map(e => `<button type="button" class="chip chip-sm activo" data-action="regQuitarEtiqueta" data-e="${escapeHtml(e)}" aria-label="Quitar etiqueta ${escapeHtml(e)}">#${escapeHtml(e)} ${icon('x', 'chip-x')}</button>`).join('')}
        <input id="reg-etiqueta" class="etiqueta-input" placeholder="#etiqueta" autocomplete="off" data-input="regEtiquetaTxt" aria-label="Nueva etiqueta"></div>
        ${sugeridas.length ? `<div class="chips" style="margin-top:6px;">${sugeridas.map(e => `<button type="button" class="chip chip-sm chip-outline" data-action="regAgregarEtiqueta" data-e="${escapeHtml(e)}">#${escapeHtml(e)}</button>`).join('')}</div>` : ''}`;
}

function favoritosHTML() {
    if (r.id) return '';
    const favs = sel.plantillas().filter(f => f.tipo === r.tipo);
    if (!favs.length) return '';
    return `<div class="chips chips-scroll favs" style="margin:0 -18px 12px; padding:0 18px;">${favs.map(f =>
        `<button type="button" class="chip chip-outline" data-action="regFavorito" data-id="${escapeHtml(f.id)}">${icon('star')}${escapeHtml(f.desc || sel.categoria(f.categoriaId)?.nombre || 'Favorito')}${f.monto ? ` <span class="muted num">${money(f.monto)}</span>` : ''}</button>`).join('')}</div>`;
}

const repintarSeccion = (id, html) => { const el = hojaAbierta()?.querySelector(`#${id}`); if (el) el.innerHTML = html; };

// ---------- Render ----------
function chipsCuentas(accion, seleccionada, filtro = () => true) {
    const cuentas = sel.cuentas().filter(filtro);
    if (!cuentas.length) return '<p class="hint">Primero agrega una cuenta en Cuentas.</p>';
    return `<div class="chips">${cuentas.map(c => `<button type="button" class="chip ${c.id === seleccionada ? 'activo' : ''}" data-action="${accion}" data-id="${escapeHtml(c.id)}">${escapeHtml(c.nombre)}</button>`).join('')}</div>`;
}

function cuerpoHTML() {
    const cuenta = sel.cuenta(r.cuentaId);
    const esCred = cuenta?.tipo === 'credito';
    let campos = '';

    if (r.tipo === 'gasto') {
        campos += `<div class="field" id="reg-cats">${categoriasHTML()}</div>`;
        campos += `<div class="field"><span class="label">Cuenta</span>${chipsCuentas('regCuenta', r.cuentaId)}</div>`;
        if (esCred) campos += `<div class="field"><span class="label">Meses sin intereses</span><div class="chips">${MSI.map(m =>
            `<button type="button" class="chip chip-sm ${Number(r.msi || 0) === m ? 'activo' : ''}" data-action="regMsi" data-m="${m}">${m ? `${m} meses` : 'De contado'}</button>`).join('')}</div></div>`;
    } else if (r.tipo === 'ingreso') {
        campos += `<div class="field"><span class="label">Cuenta</span>${chipsCuentas('regCuenta', r.cuentaId)}</div>`;
        const opciones = [['', 'Ingreso'], esCred ? ['cashback', 'Cashback'] : ['rendimiento', 'Rendimiento']];
        campos += `<div class="field"><span class="label">Tipo de ingreso</span><div class="chips">${opciones.map(([v, t]) =>
            `<button type="button" class="chip chip-sm ${(r.subtipo || '') === v ? 'activo' : ''}" data-action="regSub" data-v="${v}">${t}</button>`).join('')}</div>
            ${esCred ? '<span class="hint">En tarjetas de crédito, el ingreso resta de la deuda.</span>' : ''}</div>`;
    } else {
        campos += `<div class="field"><span class="label">Desde</span>${chipsCuentas('regCuenta', r.cuentaId)}</div>`;
        campos += `<div class="field"><span class="label">Hacia</span>${chipsCuentas('regDestino', r.cuentaDestinoId, c => c.id !== r.cuentaId)}</div>`;
        const dest = sel.cuenta(r.cuentaDestinoId);
        if (dest?.tipo === 'credito') campos += `<p class="hint" style="margin:-6px 0 12px;">Se registrará como pago de tarjeta.</p>`;
    }

    const sugs = sugerenciasDesc();
    const hoy = hoyISO(), ayer = sumarDias(hoy, -1);
    const fechaOtra = r.fecha !== hoy && r.fecha !== ayer;

    return `
        <div class="seg" style="margin-bottom:10px;">
            ${['gasto', 'ingreso', 'transferencia'].map(t => `<button type="button" class="${r.tipo === t ? 'activo' : ''}" data-action="regTipo" data-t="${t}" ${r.id ? 'disabled' : ''}>${TITULOS[t]}</button>`).join('')}
        </div>
        ${favoritosHTML()}
        <div class="monto-display">${montoHTML()}</div>
        <input id="reg-monto" class="monto-input-desktop" inputmode="decimal" autocomplete="off" placeholder="$0.00" value="${escapeHtml(r.montoTxt)}" data-input="regMontoInput" aria-label="Monto (acepta + − ×)">
        <p class="calc-preview num">${tieneOperacion(r.montoTxt) ? `= ${money(evaluar(r.montoTxt) || 0)}` : ''}</p>
        <div class="teclado" style="margin-bottom:16px;">
            ${['1', '2', '3', 'del', '4', '5', '6', '×', '7', '8', '9', '−', '.', '0', '=', '+'].map(k => k === 'del'
                ? `<button type="button" class="tecla-op" data-action="regTecla" data-k="del" aria-label="Borrar último dígito">${icon('backspace')}</button>`
                : `<button type="button" class="${['+', '−', '×', '='].includes(k) ? 'tecla-op' : ''}" data-action="regTecla" data-k="${k}" aria-label="${{ '+': 'Sumar', '−': 'Restar', '×': 'Multiplicar', '=': 'Resultado' }[k] || k}">${k}</button>`).join('')}
        </div>
        ${campos}
        <div class="field">
            <span class="label">Descripción</span>
            <input id="reg-desc" autocomplete="off" placeholder="${r.tipo === 'gasto' ? '¿En qué gastaste? (opcional)' : 'Opcional'}" value="${escapeHtml(r.desc)}" data-input="regDesc">
            <div id="reg-sugs" class="chips">${sugsHTML(sugs)}</div>
        </div>
        <div class="field">
            <span class="label">Fecha</span>
            <div class="chips">
                <button type="button" class="chip chip-sm ${r.fecha === hoy ? 'activo' : ''}" data-action="regFecha" data-f="${hoy}">Hoy</button>
                <button type="button" class="chip chip-sm ${r.fecha === ayer ? 'activo' : ''}" data-action="regFecha" data-f="${ayer}">Ayer</button>
                <label class="chip chip-sm ${fechaOtra ? 'activo' : ''}" style="position:relative;">${icon('calendar')}${fechaOtra ? fechaCorta(r.fecha) : 'Otra'}
                    <input type="date" value="${r.fecha}" max="${hoy}" data-change="regFechaInput" data-action="regFechaPicker" style="position:absolute; inset:0; opacity:0; cursor:pointer; height:auto;" aria-label="Elegir fecha">
                </label>
            </div>
        </div>
        <div class="field"><span class="label">Etiquetas (opcional)</span><div id="reg-etiquetas">${etiquetasHTML()}</div></div>
        ${r.id ? '' : `<label class="check-fav"><input type="checkbox" data-change="regFavCheck" ${r.favorito ? 'checked' : ''}> Guardar también como favorito</label>`}
        <div class="hoja-foot">
            ${r.id ? `<button type="button" class="btn btn-danger-soft" data-action="regBorrar" style="flex:0 0 auto;">${icon('trash')}</button>` : `<button type="button" class="btn btn-soft" data-action="regGuardar" data-otro="1">Guardar y otro</button>`}
            <button type="button" class="btn btn-primary" data-action="regGuardar">Guardar</button>
        </div>`;
}

function sugsHTML(sugs) {
    return sugs.map(t => {
        const extra = t.tipo === 'gasto' ? sel.categoria(t.categoriaId).nombre : (sel.cuenta(t.cuentaId)?.nombre || '');
        return `<button type="button" class="chip chip-sm chip-outline" data-action="regSug" data-id="${escapeHtml(t.id)}">${escapeHtml(t.desc)}<span class="muted">· ${escapeHtml(extra)}</span></button>`;
    }).join('');
}

function pintar() {
    const cont = hojaAbierta()?.querySelector('#reg');
    if (!cont || !r) return;
    const scroll = cont.closest('.hoja').scrollTop;
    cont.innerHTML = cuerpoHTML();
    cont.closest('.hoja').scrollTop = scroll;
}

// ---------- Guardar ----------
async function guardar(otro) {
    const monto = Math.round(montoNum() * 100) / 100;
    if (!(monto > 0)) return toast(tieneOperacion(r.montoTxt) ? 'El resultado debe ser mayor que cero' : 'Escribe un monto', { tipo: 'error' });
    if (!r.cuentaId || !sel.cuenta(r.cuentaId)) return toast('Elige una cuenta', { tipo: 'error' });
    const desc = r.desc.trim();
    let tx;
    if (r.tipo === 'gasto') {
        if (r.dividir) {
            const partes = r.partes.map(p => ({ categoriaId: p.categoriaId, monto: Math.round((parseFloat(p.montoTxt) || 0) * 100) / 100 })).filter(p => p.monto > 0);
            if (partes.length < 2) return toast('Para dividir necesitas al menos dos partes con monto', { tipo: 'error' });
            if (Math.abs(partes.reduce((a, p) => a + p.monto, 0) - monto) > 0.009) return toast('Las partes deben sumar el monto total', { tipo: 'error' });
            const mayor = partes.reduce((a, p) => (p.monto > a.monto ? p : a), partes[0]);
            tx = { tipo: 'gasto', monto, fecha: r.fecha, desc, cuentaId: r.cuentaId, categoriaId: mayor.categoriaId, partes };
        } else {
            if (!r.categoriaId) return toast('Elige una categoría', { tipo: 'error' });
            tx = { tipo: 'gasto', monto, fecha: r.fecha, desc, cuentaId: r.cuentaId, categoriaId: r.categoriaId };
        }
        if (sel.cuenta(r.cuentaId).tipo === 'credito' && r.msi > 1) tx.msi = Number(r.msi);
    } else if (r.tipo === 'ingreso') {
        const cred = sel.cuenta(r.cuentaId).tipo === 'credito';
        const sub = r.subtipo === 'cashback' && cred ? 'cashback' : (r.subtipo === 'rendimiento' && !cred ? 'rendimiento' : null);
        tx = { tipo: 'ingreso', monto, fecha: r.fecha, desc: desc || (sub === 'cashback' ? 'Cashback' : sub === 'rendimiento' ? 'Rendimiento' : 'Ingreso'), cuentaId: r.cuentaId };
        if (sub) tx.subtipo = sub;
    } else {
        const dest = sel.cuenta(r.cuentaDestinoId);
        if (!dest || dest.id === r.cuentaId) return toast('Elige la cuenta destino', { tipo: 'error' });
        const pago = dest.tipo === 'credito';
        tx = { tipo: 'transferencia', subtipo: pago ? 'pago_tdc' : 'traspaso', monto, fecha: r.fecha, desc: desc || `${pago ? 'Pago a' : 'Traspaso a'} ${dest.nombre}`, cuentaId: r.cuentaId, cuentaDestinoId: dest.id };
    }
    const pendiente = limpiarEtiqueta(hojaAbierta()?.querySelector('#reg-etiqueta')?.value);
    if (pendiente && !r.etiquetas.includes(pendiente)) r.etiquetas.push(pendiente);
    if (r.etiquetas.length) tx.etiquetas = [...r.etiquetas];
    if (r.id) tx.id = r.id;
    if (r.favorito) {
        const { tipo, desc: d, cuentaId, categoriaId, cuentaDestinoId, subtipo } = tx;
        guardarPlantilla({ tipo, desc: d, monto, cuentaId, categoriaId: categoriaId || null, cuentaDestinoId: cuentaDestinoId || null, subtipo: subtipo || null });
    }

    const original = r.original;
    const texto = `${TITULOS[r.tipo]} ${r.id ? 'actualizado' : 'registrado'} · ${money(monto)}`;
    try {
        const grande = !original && tx.tipo === 'ingreso' && !tx.subtipo && esIngresoGrande(monto, sel.transacciones());
        const id = await guardarTransaccion(tx);
        toast(grande ? `¡Llegó el dinero! ${texto}` : texto, { deshacer: () => original ? guardarTransaccion({ ...original }) : borrarTransaccion(id) });
        if (grande) confeti(); else if (!original) monedaAlcancia();
        if (otro && r) { Object.assign(r, { montoTxt: '', desc: '', etiquetas: [], favorito: false, dividir: false, partes: [] }); if (!r.catManual) r.categoriaId = null; pintar(); hojaAbierta()?.querySelector('#reg-monto')?.focus(); }
        else {
            const avisarSafari = r?.desdeAtajo && !enAppInstalada();
            cerrarHoja();
            if (avisarSafari) setTimeout(() => listoDesdeSafari(texto), 250);
        }
    } catch (e) { toast('No se pudo guardar: ' + e.message, { tipo: 'error' }); }
}

function teclasEscritorio(e) {
    if (e.key !== 'Enter' || e.target.matches('textarea')) return;
    e.preventDefault();
    if (e.target.id === 'reg-etiqueta') { agregarEtiqueta(e.target.value); return; }
    guardar(false);
}

function agregarEtiqueta(texto) {
    const e = limpiarEtiqueta(texto);
    if (e && !r.etiquetas.includes(e)) r.etiquetas.push(e);
    repintarSeccion('reg-etiquetas', etiquetasHTML());
    hojaAbierta()?.querySelector('#reg-etiqueta')?.focus();
}

// ---------- Eventos ----------
on('regTipo', (el) => {
    r.tipo = el.dataset.t; r.subtipo = null; r.msi = 0;
    r.cuentaId = cuentaSugerida(r.tipo, r.categoriaId) || r.cuentaId;
    if (r.tipo === 'transferencia') r.cuentaDestinoId = destinoSugerido();
    pintar();
});
on('regTecla', (el) => tecla(el.dataset.k));
on('regCat', (el) => { r.categoriaId = el.dataset.id; r.catManual = true; r.catSugerida = false; if (!r.id) r.cuentaId = cuentaSugerida('gasto', r.categoriaId) || r.cuentaId; pintar(); });
on('regCuenta', (el) => {
    r.cuentaId = el.dataset.id;
    if (r.tipo === 'transferencia' && r.cuentaDestinoId === r.cuentaId) r.cuentaDestinoId = destinoSugerido();
    if (sel.cuenta(r.cuentaId)?.tipo !== 'credito') r.msi = 0;
    pintar();
});
on('regDestino', (el) => { r.cuentaDestinoId = el.dataset.id; pintar(); });
on('regSub', (el) => { r.subtipo = el.dataset.v || null; pintar(); });
on('regMsi', (el) => { r.msi = Number(el.dataset.m); pintar(); });
on('regFecha', (el) => { r.fecha = el.dataset.f; pintar(); });
on('regFechaPicker', (el) => { try { el.showPicker(); } catch { el.focus(); } });
on('regFechaInput', (el) => { if (el.value) { r.fecha = el.value; pintar(); } }, 'change');
on('regSug', (el) => {
    const t = sel.transaccion(el.dataset.id); if (!t) return;
    r.desc = t.desc;
    if (t.categoriaId) r.categoriaId = t.categoriaId;
    if (sel.cuenta(t.cuentaId)) r.cuentaId = t.cuentaId;
    if (!r.montoTxt) r.montoTxt = String(t.monto);
    pintar();
});
on('regDesc', (el) => {
    r.desc = el.value;
    const cont = hojaAbierta()?.querySelector('#reg-sugs');
    if (cont) cont.innerHTML = sugsHTML(sugerenciasDesc());
    if (aplicarSugerencia() || r.catSugerida) repintarSeccion('reg-cats', categoriasHTML());
}, 'input');
on('regMontoInput', (el) => {
    // En escritorio se teclea la expresión directo; se normaliza tecla por tecla
    // con las mismas reglas del teclado en pantalla.
    r.montoTxt = normalizarTexto(el.value).split('').reduce((e, c) => teclear(e, c), '');
    if (el.value !== r.montoTxt) el.value = r.montoTxt;
    refrescarMonto();
}, 'input');
on('regGuardar', (el) => guardar(el.dataset.otro === '1'));
on('regBorrar', async () => {
    if (!r?.id) return;
    const ok = await confirmar({ titulo: 'Eliminar movimiento', texto: 'Se quitará de tus movimientos y los saldos se recalcularán.', aceptar: 'Eliminar', peligro: true });
    if (!ok) return;
    const deshacer = await borrarTransaccion(r.id);
    cerrarHoja();
    toast('Movimiento eliminado', { deshacer });
});

// ---------- Dividir, etiquetas y favoritos ----------
function actualizarResumenPartes() {
    const el = hojaAbierta()?.querySelector('#reg-partes-resumen');
    if (!el) return;
    const total = Math.round(montoNum() * 100) / 100, asignado = sumaPartes();
    el.textContent = resumenPartes(total, asignado);
    el.className = `hint ${Math.abs(total - asignado) > 0.009 ? 'neg' : 'pos'}`;
}
on('regDividir', () => {
    r.dividir = !r.dividir;
    if (r.dividir && r.partes.length < 2) {
        const cats = sel.categorias();
        const primera = r.categoriaId || cats[0]?.id;
        const segunda = cats.find(c => c.id !== primera)?.id;
        const total = Math.round(montoNum() * 100) / 100;
        r.partes = [{ categoriaId: primera, montoTxt: total ? String(total) : '' }, { categoriaId: segunda, montoTxt: '' }];
    }
    repintarSeccion('reg-cats', categoriasHTML());
});
on('regParteCat', (el) => { r.partes[Number(el.dataset.i)].categoriaId = el.value; }, 'change');
on('regParteMonto', (el) => {
    const limpio = el.value.replace(/[^0-9.]/g, '');
    if (limpio !== el.value) el.value = limpio;
    r.partes[Number(el.dataset.i)].montoTxt = limpio;
    actualizarResumenPartes();
}, 'input');
on('regAgregarParte', () => {
    const usadas = r.partes.map(p => p.categoriaId);
    const libre = sel.categorias().find(c => !usadas.includes(c.id))?.id || sel.categorias()[0]?.id;
    const falta = Math.round((montoNum() - sumaPartes()) * 100) / 100;
    r.partes.push({ categoriaId: libre, montoTxt: falta > 0 ? String(falta) : '' });
    repintarSeccion('reg-partes', partesHTML());
});
on('regQuitarParte', (el) => {
    r.partes.splice(Number(el.dataset.i), 1);
    if (r.partes.length < 2) { r.dividir = false; r.categoriaId = r.partes[0]?.categoriaId || r.categoriaId; repintarSeccion('reg-cats', categoriasHTML()); }
    else repintarSeccion('reg-partes', partesHTML());
});
on('regEtiquetaTxt', (el) => { if (/[,\s]$/.test(el.value)) agregarEtiqueta(el.value); }, 'input');
on('regAgregarEtiqueta', (el) => agregarEtiqueta(el.dataset.e));
on('regQuitarEtiqueta', (el) => { r.etiquetas = r.etiquetas.filter(e => e !== el.dataset.e); repintarSeccion('reg-etiquetas', etiquetasHTML()); });
on('regFavCheck', (el) => { r.favorito = el.checked; }, 'change');
on('regFavorito', (el) => {
    const f = sel.plantillas().find(x => x.id === el.dataset.id);
    if (!f) return;
    Object.assign(r, {
        tipo: f.tipo, desc: f.desc || '', montoTxt: f.monto ? String(f.monto) : r.montoTxt,
        categoriaId: f.categoriaId || r.categoriaId, catManual: !!f.categoriaId, catSugerida: false,
        cuentaId: sel.cuenta(f.cuentaId) ? f.cuentaId : r.cuentaId,
        cuentaDestinoId: sel.cuenta(f.cuentaDestinoId) ? f.cuentaDestinoId : r.cuentaDestinoId,
        subtipo: f.subtipo || null, dividir: false, partes: [],
    });
    pintar();
});

// ---------- Atajos de Siri ----------
// iOS abre las direcciones de Atajos en Safari, nunca en la app de la pantalla
// de inicio. Lo guardado en Safari llega a la app al instante por Firebase.
const enAppInstalada = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

function listoDesdeSafari(texto) {
    abrirHoja({
        titulo: 'Listo',
        html: `<div class="listo-atajo">${tlacoSVG('celebrando', { tamano: 88 })}
            <p class="listo-monto">${escapeHtml(texto)}</p>
            <p class="hint">Ya está en Morralla y aparece en la app de tu pantalla de inicio. Puedes cerrar esta pestaña de Safari.</p>
            <button class="btn btn-soft btn-block" data-action="cerrarHoja">Cerrar</button></div>`,
    });
}
