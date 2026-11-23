// Formularios en hoja: cuenta, meta, recurrente y categoría.

import { on } from '../core/eventos.js';
import { sel } from '../core/store.js';
import * as A from '../core/actions.js';
import { abrirHoja, cerrarHoja, hojaAbierta, toast, confirmar } from './capas.js';
import { icon } from '../lib/icons.js';
import { escapeHtml, money } from '../lib/format.js';
import { ICONOS_CATEGORIA, COLORES_CATEGORIA } from '../domain/categorias.js';
import { colorCategoria, logoImgHTML } from './piezas.js';
import { INSTITUCIONES, COLORES_CUENTA, GRUPOS_INSTITUCION, institucionDe, institucionPorId, logoDeInstitucion, buscarInstituciones } from '../domain/instituciones.js';
import { FRECUENCIAS } from '../domain/recurrentes.js';
import { navegar } from '../core/router.js';
import { confeti, monedaAlcancia } from './efectos.js';

const v = (form, name) => form.elements[name]?.value.trim() ?? '';
const n = (form, name) => parseFloat(v(form, name)) || 0;

// ---------- Cuenta ----------
// ---------- Institución y color de la cuenta ----------
let fc = null;   // { inst: id|null, color: hex|null, banco: texto libre }

function logoInst(inst, banco = '') {
    const inicial = escapeHtml((inst?.nombre || banco || '?').charAt(0).toUpperCase());
    const src = logoDeInstitucion(inst);
    const color = fc?.color || inst?.color || '#14b8a6';
    return `<span class="inst-logo" style="--ic:${color}">${src ? logoImgHTML(src, inicial) : inicial}</span>`;
}

function instHTML() {
    const inst = institucionPorId(fc.inst);
    return `<button type="button" class="inst-elegida" data-action="fcInstAbrir">${logoInst(inst, fc.banco)}
            <span>${escapeHtml(inst?.nombre || fc.banco || 'Elegir institución')}</span>${icon('chevron-right', 'chev')}</button>
        <div id="fc-inst-panel" hidden>
            <input id="fc-inst-q" class="inst-buscar" placeholder="Buscar banco, tarjeta o tienda" autocomplete="off" data-input="fcInstBuscar">
            <div class="inst-grid" id="fc-inst-grid">${gridInst('')}</div>
        </div>
        ${inst ? '' : `<input id="fc-banco" name="banco" placeholder="Nombre de la institución (si no está en la lista)" value="${escapeHtml(fc.banco || '')}" data-input="fcBancoTxt" style="margin-top:8px;">`}`;
}

// Por secciones (Bancos, Apps y fintech…) y en orden alfabético; al buscar, una sola lista.
function gridInst(q) {
    const op = (i) => `<button type="button" class="inst-op ${i.id === fc.inst ? 'activo' : ''}" data-action="fcInst" data-id="${i.id}">${logoInst(i)}<span>${escapeHtml(i.nombre)}</span></button>`;
    const otra = `<button type="button" class="inst-op" data-action="fcInst" data-id="">${icon('edit')}<span>Otra</span></button>`;
    const orden = (a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' });
    if (q.trim()) {
        const lista = buscarInstituciones(q).sort(orden);
        return (lista.length ? lista.map(op).join('') : '<p class="hint inst-vacio">No está en la biblioteca: usa "Otra".</p>') + otra;
    }
    return GRUPOS_INSTITUCION.map(([g, titulo]) => {
        const lista = INSTITUCIONES.filter(i => i.grupo === g).sort(orden);
        return lista.length ? `<p class="inst-grupo">${titulo}</p>${lista.map(op).join('')}` : '';
    }).join('') + otra;
}

function coloresHTML() {
    const inst = institucionPorId(fc.inst);
    const delBanco = inst?.color;
    return `<div class="acentos colores-cuenta">
        ${delBanco ? `<button type="button" class="acento ${!fc.color ? 'activo' : ''}" style="--c:${delBanco}" data-action="fcColor" data-c="" title="Color de ${escapeHtml(inst.nombre)}" aria-label="Color de ${escapeHtml(inst.nombre)}"></button>` : ''}
        ${COLORES_CUENTA.filter(c => c !== delBanco).map(c => `<button type="button" class="acento ${fc.color === c ? 'activo' : ''}" style="--c:${c}" data-action="fcColor" data-c="${c}" aria-label="Color ${c}"></button>`).join('')}
    </div>
    <span class="hint">${delBanco ? `El primero es el color de ${escapeHtml(inst.nombre)}.` : 'Elige un color para identificarla.'}</span>`;
}

const repintarFc = (sel_, html) => { const el = hojaAbierta()?.querySelector(sel_); if (el) el.innerHTML = html; };

on('fcInstAbrir', () => {
    const p = hojaAbierta()?.querySelector('#fc-inst-panel');
    if (!p) return;
    p.hidden = !p.hidden;
    if (!p.hidden) p.querySelector('#fc-inst-q')?.focus();
});
on('fcInstBuscar', (el) => repintarFc('#fc-inst-grid', gridInst(el.value)), 'input');
on('fcInst', (el) => {
    fc.inst = el.dataset.id || null;
    if (fc.inst) fc.banco = institucionPorId(fc.inst).nombre;
    repintarFc('#fc-inst', instHTML());
    repintarFc('#fc-colores', coloresHTML());
    if (!fc.inst) hojaAbierta()?.querySelector('#fc-banco')?.focus();
});
on('fcBancoTxt', (el) => { fc.banco = el.value; }, 'input');
on('fcColor', (el) => {
    fc.color = el.dataset.c || null;
    repintarFc('#fc-colores', coloresHTML());
    repintarFc('#fc-inst', instHTML());
});

export function abrirFormCuenta(id = null) {
    const c = id ? sel.cuenta(id) : null;
    const tipo = c?.tipo || 'debito';
    // Institución: la guardada o la que se reconozca por el texto del banco.
    fc = { inst: c ? (institucionDe(c)?.id || null) : null, color: c?.color || null, banco: c?.banco || '' };
    abrirHoja({
        titulo: c ? 'Editar cuenta' : 'Nueva cuenta',
        html: `<form data-submit="guardarCuenta" data-id="${escapeHtml(id || '')}">
            <div class="field"><span class="label">Tipo</span><div class="seg" id="fc-tipo">
                ${['debito', 'credito', 'efectivo'].map(t => `<button type="button" class="${t === tipo ? 'activo' : ''}" data-action="fcTipo" data-t="${t}">${{ debito: 'Débito', credito: 'Crédito', efectivo: 'Efectivo' }[t]}</button>`).join('')}
            </div><input type="hidden" name="tipo" value="${tipo}"></div>
            <div class="field"><label for="fc-nombre">Nombre</label><input id="fc-nombre" name="nombre" required placeholder="Ej. Nómina" value="${escapeHtml(c?.nombre || '')}"></div>
            <div class="field"><span class="label">Institución</span><div id="fc-inst">${instHTML()}</div></div>
            <div class="field"><span class="label">Color</span><div id="fc-colores">${coloresHTML()}</div></div>
            <div class="field"><label for="fc-saldo" data-solo="deb">Saldo actual</label><label for="fc-saldo" data-solo="cre">Deuda actual</label>
                <input id="fc-saldo" name="saldo" inputmode="decimal" required placeholder="0.00" value="${c ? sel.saldo(c.id) : ''}">
                ${c ? '<span class="hint">Si lo cambias, se ajusta el saldo sin tocar tus movimientos.</span>' : ''}</div>
            <div data-solo="nocash" class="field-row">
                <div class="field"><label for="fc-dig">Últimos 4 dígitos</label><input id="fc-dig" name="digitos" inputmode="numeric" maxlength="4" pattern="\\d{4}" placeholder="0000" value="${escapeHtml(c?.digitos || '')}"></div>
                <div class="field" data-solo="cre"><label for="fc-lim">Límite</label><input id="fc-lim" name="limite" inputmode="decimal" placeholder="0.00" value="${c?.limite || ''}"></div>
            </div>
            <div class="field-row" data-solo="cre">
                <div class="field"><label for="fc-corte">Día de corte</label><input id="fc-corte" name="diaCorte" type="number" min="1" max="31" value="${c?.diaCorte || ''}"></div>
                <div class="field"><label for="fc-pago">Día de pago</label><input id="fc-pago" name="diaPago" type="number" min="1" max="31" value="${c?.diaPago || ''}"></div>
            </div>
            <div class="field" data-solo="deb-only"><label for="fc-clabe">CLABE (opcional)</label><input id="fc-clabe" name="clabe" inputmode="numeric" maxlength="18" pattern="\\d{18}" placeholder="18 dígitos" value="${escapeHtml(c?.clabe || '')}"></div>
            <details class="fc-mas"><summary>Logo propio (opcional)</summary>
                <div class="field" style="margin-top:8px;"><label for="fc-logo">Enlace a una imagen</label><input id="fc-logo" name="icono" type="url" placeholder="https://…" value="${escapeHtml(c?.icono || '')}">
                <span class="hint">Si lo pones, se usa en lugar del logo de la institución.</span></div></details>
            <div class="hoja-foot">
                ${c ? '<button type="button" class="btn btn-danger-soft" data-action="fcBorrar" style="flex:0 0 auto;">' + icon('trash') + '</button>' : ''}
                <button type="submit" class="btn btn-primary">${c ? 'Guardar cambios' : 'Agregar cuenta'}</button>
            </div>
        </form>`,
        alMontar: (hoja) => aplicarTipoCuenta(hoja, tipo),
    });
}

function aplicarTipoCuenta(hoja, tipo) {
    hoja.querySelector('[name="tipo"]').value = tipo;
    hoja.querySelectorAll('#fc-tipo button').forEach(b => b.classList.toggle('activo', b.dataset.t === tipo));
    const visible = { deb: tipo !== 'credito', cre: tipo === 'credito', nocash: tipo !== 'efectivo', 'deb-only': tipo === 'debito' };
    hoja.querySelectorAll('[data-solo]').forEach(el => { el.style.display = visible[el.dataset.solo] ? '' : 'none'; });
}

on('fcTipo', (el) => aplicarTipoCuenta(hojaAbierta(), el.dataset.t));
on('guardarCuenta', async (form) => {
    const tipo = v(form, 'tipo');
    const inst = institucionPorId(fc?.inst);
    const banco = inst ? inst.nombre : (fc?.banco || '').trim();
    const cuenta = { id: form.dataset.id || undefined, tipo, nombre: v(form, 'nombre'), banco: banco || (tipo === 'efectivo' ? 'Efectivo' : ''), institucion: inst?.id || null, color: fc?.color || null };
    const icono = v(form, 'icono'); cuenta.icono = icono || null;
    cuenta.digitos = tipo !== 'efectivo' ? v(form, 'digitos') || null : null;
    cuenta.clabe = tipo === 'debito' ? v(form, 'clabe') || null : null;
    if (tipo === 'credito') { cuenta.limite = n(form, 'limite'); cuenta.diaCorte = n(form, 'diaCorte') || null; cuenta.diaPago = n(form, 'diaPago') || null; }
    else { cuenta.limite = null; cuenta.diaCorte = null; cuenta.diaPago = null; cuenta.pagadoPeriodo = null; }
    const id = await A.guardarCuenta(cuenta, n(form, 'saldo'));
    cerrarHoja();
    toast(form.dataset.id ? 'Cuenta actualizada' : 'Cuenta agregada');
    if (!form.dataset.id) navegar(`#/cuenta/${encodeURIComponent(id)}`);
}, 'submit');
on('fcBorrar', async () => {
    const id = hojaAbierta()?.querySelector('form').dataset.id;
    const usos = sel.transacciones().filter(t => t.cuentaId === id || t.cuentaDestinoId === id).length;
    const ok = await confirmar({ titulo: 'Eliminar cuenta', texto: usos ? `Tiene ${usos} movimiento(s). Esos movimientos se conservan pero quedarán sin cuenta.` : 'Se eliminará de tu lista.', aceptar: 'Eliminar', peligro: true });
    if (!ok) return;
    await A.borrarCuenta(id);
    cerrarHoja(); navegar('#/cuentas'); toast('Cuenta eliminada');
});

// ---------- Meta ----------
const ICONOS_META = ['target', 'shield', 'home', 'car', 'plane', 'gift', 'coin', 'box', 'heart', 'calendar'];

export function abrirFormMeta(id = null) {
    const m = id ? sel.metas().find(x => x.id === id) : null;
    abrirHoja({
        titulo: m ? 'Editar meta' : 'Nueva meta',
        html: `<form data-submit="guardarMeta" data-id="${escapeHtml(id || '')}">
            <input type="hidden" name="icono" value="${m?.icono || 'target'}">
            <div class="field"><span class="label">Ícono</span><div class="chips" id="fm-iconos">${ICONOS_META.map(i => `<button type="button" class="chip ${i === (m?.icono || 'target') ? 'activo' : ''}" data-action="fmIcono" data-i="${i}" aria-label="${i}">${icon(i)}</button>`).join('')}</div></div>
            <div class="field"><label for="fm-nombre">Nombre</label><input id="fm-nombre" name="nombre" required placeholder="Ej. Fondo de emergencia" value="${escapeHtml(m?.nombre || '')}"></div>
            <div class="field-row">
                <div class="field"><label for="fm-obj">Objetivo</label><input id="fm-obj" name="montoObjetivo" inputmode="decimal" required placeholder="0.00" value="${m?.montoObjetivo || ''}"></div>
                <div class="field"><label for="fm-act">Ya ahorrado</label><input id="fm-act" name="montoActual" inputmode="decimal" placeholder="0.00" value="${m?.montoActual || ''}"></div>
            </div>
            <div class="field"><label for="fm-fecha">Fecha límite (opcional)</label><input id="fm-fecha" name="fechaLimite" type="date" value="${m?.fechaLimite || ''}"></div>
            <div class="hoja-foot">
                ${m ? '<button type="button" class="btn btn-danger-soft" data-action="fmBorrar" style="flex:0 0 auto;">' + icon('trash') + '</button>' : ''}
                <button type="submit" class="btn btn-primary">Guardar meta</button>
            </div>
        </form>`,
    });
}
on('fmIcono', (el) => {
    const hoja = hojaAbierta();
    hoja.querySelector('[name="icono"]').value = el.dataset.i;
    hoja.querySelectorAll('#fm-iconos .chip').forEach(b => b.classList.toggle('activo', b === el));
});
on('guardarMeta', async (form) => {
    await A.guardarMeta({ id: form.dataset.id || undefined, nombre: v(form, 'nombre'), icono: v(form, 'icono'), montoObjetivo: n(form, 'montoObjetivo'), montoActual: n(form, 'montoActual'), fechaLimite: v(form, 'fechaLimite') || null });
    cerrarHoja(); toast('Meta guardada');
}, 'submit');
on('fmBorrar', async () => {
    const id = hojaAbierta()?.querySelector('form').dataset.id;
    if (!(await confirmar({ titulo: 'Eliminar meta', aceptar: 'Eliminar', peligro: true }))) return;
    await A.borrarMeta(id); cerrarHoja(); toast('Meta eliminada');
});

// Abono o retiro de una meta.
export function abrirMovimientoMeta(id, retiro = false) {
    const m = sel.metas().find(x => x.id === id);
    if (!m) return;
    abrirHoja({
        titulo: `${retiro ? 'Retirar de' : 'Abonar a'} ${m.nombre}`,
        html: `<form data-submit="moverMeta" data-id="${escapeHtml(id)}" data-signo="${retiro ? -1 : 1}">
            <p class="hint" style="margin-bottom:12px;">Llevas ${money(m.montoActual || 0)} de ${money(m.montoObjetivo || 0)}. Esto solo mueve el avance de la meta, no el saldo de tus cuentas.</p>
            <div class="field"><label for="mm-monto">Monto</label><input id="mm-monto" name="monto" inputmode="decimal" required autofocus class="num" style="font-size:22px; height:56px;" placeholder="0.00"></div>
            <div class="hoja-foot"><button type="submit" class="btn btn-primary">${retiro ? 'Retirar' : 'Abonar'}</button></div>
        </form>`,
        alMontar: (h) => h.querySelector('#mm-monto').focus(),
    });
}
on('moverMeta', async (form) => {
    const monto = n(form, 'monto');
    if (!(monto > 0)) return;
    const meta = sel.metas().find(m => m.id === form.dataset.id);
    const abono = Number(form.dataset.signo) > 0;
    const objetivo = Number(meta?.montoObjetivo) || 0, antes = Number(meta?.montoActual) || 0;
    const cumple = abono && objetivo > 0 && antes < objetivo && antes + monto >= objetivo;
    await A.moverMeta(form.dataset.id, monto * Number(form.dataset.signo));
    cerrarHoja();
    if (cumple) {
        toast(`¡Meta cumplida! «${meta.nombre}» está completa`); confeti();
    } else {
        toast(Number(form.dataset.signo) > 0 ? `Abonaste ${money(monto)}` : `Retiraste ${money(monto)}`);
        if (abono) monedaAlcancia();
    }
}, 'submit');

// ---------- Recurrente ----------
export function abrirFormRecurrente(id = null) {
    const r = id ? sel.recurrentes().find(x => x.id === id) : null;
    const tipo = r?.tipo || 'gasto';
    const cuentas = sel.cuentas();
    abrirHoja({
        titulo: r ? 'Editar pago fijo' : 'Nuevo pago fijo',
        html: `<form data-submit="guardarRecurrente" data-id="${escapeHtml(id || '')}">
            <input type="hidden" name="tipo" value="${tipo}">
            <div class="field"><div class="seg" id="fr-tipo">${['gasto', 'ingreso'].map(t => `<button type="button" class="${t === tipo ? 'activo' : ''}" data-action="frTipo" data-t="${t}">${t === 'gasto' ? 'Gasto' : 'Ingreso'}</button>`).join('')}</div></div>
            <div class="field"><label for="fr-desc">Descripción</label><input id="fr-desc" name="desc" required placeholder="Ej. Netflix, renta, nómina" value="${escapeHtml(r?.desc || '')}"></div>
            <div class="field-row">
                <div class="field"><label for="fr-monto">Monto</label><input id="fr-monto" name="monto" inputmode="decimal" required placeholder="0.00" value="${r?.monto || ''}"></div>
                <div class="field"><label for="fr-cuenta">Cuenta</label><select id="fr-cuenta" name="cuentaId" required>${cuentas.map(c => `<option value="${escapeHtml(c.id)}" ${c.id === r?.cuentaId ? 'selected' : ''}>${escapeHtml(c.nombre)}</option>`).join('')}</select></div>
            </div>
            <div class="field" id="fr-cat" ${tipo === 'ingreso' ? 'style="display:none"' : ''}><label for="fr-catsel">Categoría</label><select id="fr-catsel" name="categoriaId">${sel.categorias().map(c => `<option value="${escapeHtml(c.id)}" ${c.id === r?.categoriaId ? 'selected' : ''}>${escapeHtml(c.nombre)}</option>`).join('')}</select></div>
            <div class="field-row">
                <div class="field"><label for="fr-frec">Frecuencia</label><select id="fr-frec" name="frecuencia">${Object.entries(FRECUENCIAS).map(([k, t]) => `<option value="${k}" ${k === (r?.frecuencia || 'mensual') ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
                <div class="field"><label for="fr-dia">Día del mes</label><input id="fr-dia" name="diaMes" type="number" min="1" max="31" placeholder="Ej. 15" value="${r?.diaMes || ''}"></div>
            </div>
            ${r ? `<div class="field"><label for="fr-prox">Próxima fecha</label><input id="fr-prox" name="proximaFecha" type="date" value="${r.proximaFecha || ''}"></div>` : ''}
            <div class="hoja-foot">
                ${r ? '<button type="button" class="btn btn-danger-soft" data-action="frBorrar" style="flex:0 0 auto;">' + icon('trash') + '</button>' : ''}
                <button type="submit" class="btn btn-primary">Guardar</button>
            </div>
        </form>`,
    });
}
on('frTipo', (el) => {
    const hoja = hojaAbierta();
    hoja.querySelector('[name="tipo"]').value = el.dataset.t;
    hoja.querySelectorAll('#fr-tipo button').forEach(b => b.classList.toggle('activo', b === el));
    hoja.querySelector('#fr-cat').style.display = el.dataset.t === 'gasto' ? '' : 'none';
});
on('guardarRecurrente', async (form) => {
    const tipo = v(form, 'tipo');
    const rec = {
        id: form.dataset.id || undefined, tipo, desc: v(form, 'desc'), monto: n(form, 'monto'), cuentaId: v(form, 'cuentaId'),
        frecuencia: v(form, 'frecuencia'), diaMes: n(form, 'diaMes') || null, categoriaId: tipo === 'gasto' ? v(form, 'categoriaId') : null,
    };
    if (!form.dataset.id) rec.activo = true;
    const prox = v(form, 'proximaFecha');
    if (prox) rec.proximaFecha = prox;
    await A.guardarRecurrente(rec);
    cerrarHoja(); toast('Pago fijo guardado');
}, 'submit');
on('frBorrar', async () => {
    const id = hojaAbierta()?.querySelector('form').dataset.id;
    if (!(await confirmar({ titulo: 'Eliminar pago fijo', texto: 'Los movimientos que ya generó se conservan.', aceptar: 'Eliminar', peligro: true }))) return;
    await A.borrarRecurrente(id); cerrarHoja(); toast('Pago fijo eliminado');
});

// ---------- Categoría ----------
// `alTerminar`: qué abrir al guardar o borrar (p. ej. volver a los límites).
let alTerminarCategoria = null;
export function abrirFormCategoria(id = null, { alTerminar = null } = {}) {
    alTerminarCategoria = alTerminar;
    const c = id ? sel.categoria(id) : null;
    const actual = c?.icono || 'tag';
    abrirHoja({
        titulo: c ? 'Editar categoría' : 'Nueva categoría',
        html: `<form data-submit="guardarCategoria" data-id="${escapeHtml(id || '')}">
            <input type="hidden" name="icono" value="${actual}">
            <div class="field"><label for="fk-nombre">Nombre</label><input id="fk-nombre" name="nombre" required placeholder="Ej. Mascotas" value="${escapeHtml(c?.nombre || '')}"></div>
            <input type="hidden" name="color" value="${escapeHtml(c?.color || '')}">
            <div class="field"><span class="label">Color</span><div class="colores" id="fk-colores">${COLORES_CATEGORIA.map(k => `<button type="button" class="color-op ${k.hex === c?.color ? 'activo' : ''}" style="--cat:${k.hex}" data-action="fkColor" data-c="${k.hex}" aria-label="${k.nombre}"></button>`).join('')}</div></div>
            <div class="field"><span class="label">Ícono</span><div class="chips" id="fk-iconos" style="--cat:${c ? colorCategoria(c.id) : 'var(--accent)'}">${ICONOS_CATEGORIA.map(i => `<button type="button" class="chip ${i === actual ? 'activo' : ''}" data-action="fkIcono" data-i="${i}" aria-label="${i}">${icon(i)}</button>`).join('')}</div></div>
            <div class="field"><label for="fk-pres">Presupuesto mensual (opcional)</label><input id="fk-pres" name="presupuesto" inputmode="decimal" placeholder="Sin límite" value="${c?.presupuesto || ''}"></div>
            <div class="hoja-foot">
                ${c ? '<button type="button" class="btn btn-danger-soft" data-action="fkBorrar" style="flex:0 0 auto;">' + icon('trash') + '</button>' : ''}
                <button type="submit" class="btn btn-primary">Guardar</button>
            </div>
        </form>`,
    });
}
on('fkColor', (el) => {
    const hoja = hojaAbierta();
    hoja.querySelector('[name="color"]').value = el.dataset.c;
    hoja.querySelectorAll('#fk-colores .color-op').forEach(b => b.classList.toggle('activo', b === el));
    hoja.querySelector('#fk-iconos').style.setProperty('--cat', el.dataset.c);
});
on('fkIcono', (el) => {
    const hoja = hojaAbierta();
    hoja.querySelector('[name="icono"]').value = el.dataset.i;
    hoja.querySelectorAll('#fk-iconos .chip').forEach(b => b.classList.toggle('activo', b === el));
});
on('guardarCategoria', async (form) => {
    await A.guardarCategoria({ id: form.dataset.id || undefined, nombre: v(form, 'nombre'), icono: v(form, 'icono'), color: v(form, 'color') || null, presupuesto: n(form, 'presupuesto') });
    cerrarHoja(); toast('Categoría guardada');
    const sig = alTerminarCategoria; alTerminarCategoria = null; sig?.();
}, 'submit');
on('fkBorrar', async () => {
    const id = hojaAbierta()?.querySelector('form').dataset.id;
    const usos = sel.transacciones().filter(t => t.categoriaId === id).length;
    if (!(await confirmar({ titulo: 'Eliminar categoría', texto: usos ? `${usos} movimiento(s) la usan; seguirán mostrando su nombre.` : '', aceptar: 'Eliminar', peligro: true }))) return;
    await A.borrarCategoria(id); cerrarHoja(); toast('Categoría eliminada');
    const sig = alTerminarCategoria; alTerminarCategoria = null; sig?.();
});
