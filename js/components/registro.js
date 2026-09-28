// Registro rápido de movimientos: monto primero (teclado-calculadora en celular),
// y todo lo demás en fichas de un toque. También sirve para editar.

import { on } from '../core/eventos.js';
import { sel } from '../core/store.js';
import { guardarTransaccion, borrarTransaccion } from '../core/actions.js';
import { abrirHoja, cerrarHoja, hojaAbierta, toast, confirmar } from './capas.js';
import { icon } from '../lib/icons.js';
import { escapeHtml, money, fechaCorta } from '../lib/format.js';
import { hoyISO, sumarDias } from '../domain/fechas.js';
import { teclear, evaluar, tieneOperacion, expresionLegible, normalizarTexto } from '../domain/calculadora.js';

let r = null; // estado del formulario

const TITULOS = { gasto: 'Gasto', ingreso: 'Ingreso', transferencia: 'Transferencia' };
const MSI = [0, 3, 6, 9, 12, 18];

// abrirRegistro({ tipo, id (editar), cuentaId, cuentaDestinoId, subtipo })
export function abrirRegistro(opts = {}) {
    const tx = opts.id ? sel.transaccion(opts.id) : null;
    const tipo = tx?.tipo || opts.tipo || 'gasto';
    r = {
        id: tx?.id || null, original: tx,
        tipo, montoTxt: tx ? String(tx.monto) : '',
        categoriaId: tx?.categoriaId || null,
        cuentaId: tx?.cuentaId || opts.cuentaId || null,
        cuentaDestinoId: tx?.cuentaDestinoId || opts.cuentaDestinoId || null,
        subtipo: tx?.subtipo || opts.subtipo || null,
        msi: tx?.msi || 0,
        fecha: tx?.fecha || hoyISO(),
        desc: tx?.desc || '',
    };
    if (!r.cuentaId) r.cuentaId = cuentaSugerida(r.tipo, null);
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
}

function tecla(k) {
    r.montoTxt = teclear(r.montoTxt, k);
    const input = hojaAbierta()?.querySelector('#reg-monto');
    if (input) input.value = r.montoTxt;
    refrescarMonto();
}

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
        campos += `<div class="field"><span class="label">Categoría</span><div class="chips">${categoriasOrdenadas().map(c =>
            `<button type="button" class="chip ${c.id === r.categoriaId ? 'activo' : ''}" data-action="regCat" data-id="${escapeHtml(c.id)}">${icon(c.icono || 'tag')}${escapeHtml(c.nombre)}</button>`).join('')}</div></div>`;
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
        if (!r.categoriaId) return toast('Elige una categoría', { tipo: 'error' });
        tx = { tipo: 'gasto', monto, fecha: r.fecha, desc, cuentaId: r.cuentaId, categoriaId: r.categoriaId };
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
    if (r.id) tx.id = r.id;

    const original = r.original;
    const texto = `${TITULOS[r.tipo]} ${r.id ? 'actualizado' : 'registrado'} · ${money(monto)}`;
    try {
        const id = await guardarTransaccion(tx);
        toast(texto, { deshacer: () => original ? guardarTransaccion({ ...original }) : borrarTransaccion(id) });
        if (otro && r) { r.montoTxt = ''; r.desc = ''; pintar(); hojaAbierta()?.querySelector('#reg-monto')?.focus(); }
        else cerrarHoja();
    } catch (e) { toast('No se pudo guardar: ' + e.message, { tipo: 'error' }); }
}

function teclasEscritorio(e) {
    if (e.key === 'Enter' && !e.target.matches('textarea')) { e.preventDefault(); guardar(false); }
}

// ---------- Eventos ----------
on('regTipo', (el) => {
    r.tipo = el.dataset.t; r.subtipo = null; r.msi = 0;
    r.cuentaId = cuentaSugerida(r.tipo, r.categoriaId) || r.cuentaId;
    if (r.tipo === 'transferencia') r.cuentaDestinoId = destinoSugerido();
    pintar();
});
on('regTecla', (el) => tecla(el.dataset.k));
on('regCat', (el) => { r.categoriaId = el.dataset.id; if (!r.id) r.cuentaId = cuentaSugerida('gasto', r.categoriaId) || r.cuentaId; pintar(); });
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
