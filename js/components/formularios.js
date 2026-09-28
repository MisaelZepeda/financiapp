// Formularios en hoja: cuenta, meta, recurrente y categoría.

import { on } from '../core/eventos.js';
import { sel } from '../core/store.js';
import * as A from '../core/actions.js';
import { abrirHoja, cerrarHoja, hojaAbierta, toast, confirmar } from './capas.js';
import { icon } from '../lib/icons.js';
import { escapeHtml, money } from '../lib/format.js';
import { ICONOS_CATEGORIA } from '../domain/categorias.js';
import { FRECUENCIAS } from '../domain/recurrentes.js';
import { navegar } from '../core/router.js';

const v = (form, name) => form.elements[name]?.value.trim() ?? '';
const n = (form, name) => parseFloat(v(form, name)) || 0;

// ---------- Cuenta ----------
export function abrirFormCuenta(id = null) {
    const c = id ? sel.cuenta(id) : null;
    const tipo = c?.tipo || 'debito';
    abrirHoja({
        titulo: c ? 'Editar cuenta' : 'Nueva cuenta',
        html: `<form data-submit="guardarCuenta" data-id="${escapeHtml(id || '')}">
            <div class="field"><span class="label">Tipo</span><div class="seg" id="fc-tipo">
                ${['debito', 'credito', 'efectivo'].map(t => `<button type="button" class="${t === tipo ? 'activo' : ''}" data-action="fcTipo" data-t="${t}">${{ debito: 'Débito', credito: 'Crédito', efectivo: 'Efectivo' }[t]}</button>`).join('')}
            </div><input type="hidden" name="tipo" value="${tipo}"></div>
            <div class="field"><label for="fc-nombre">Nombre</label><input id="fc-nombre" name="nombre" required placeholder="Ej. Nómina" value="${escapeHtml(c?.nombre || '')}"></div>
            <div class="field"><label for="fc-banco">Banco</label><input id="fc-banco" name="banco" placeholder="Ej. BBVA, Nu" value="${escapeHtml(c?.banco || '')}"></div>
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
            <div class="field"><label for="fc-logo">Logo (enlace, opcional)</label><input id="fc-logo" name="icono" type="url" placeholder="https://…" value="${escapeHtml(c?.icono || '')}"></div>
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
    const cuenta = { id: form.dataset.id || undefined, tipo, nombre: v(form, 'nombre'), banco: v(form, 'banco') || (tipo === 'efectivo' ? 'Efectivo' : '') };
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
    await A.moverMeta(form.dataset.id, monto * Number(form.dataset.signo));
    cerrarHoja(); toast(Number(form.dataset.signo) > 0 ? `Abonaste ${money(monto)}` : `Retiraste ${money(monto)}`);
}, 'submit');

// ---------- Recurrente ----------
export function abrirFormRecurrente(id = null) {
    const r = id ? sel.recurrentes().find(x => x.id === id) : null;
    const tipo = r?.tipo || 'gasto';
    const cuentas = sel.cuentas();
    abrirHoja({
        titulo: r ? 'Editar recurrente' : 'Nuevo recurrente',
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
    cerrarHoja(); toast('Recurrente guardado');
}, 'submit');
on('frBorrar', async () => {
    const id = hojaAbierta()?.querySelector('form').dataset.id;
    if (!(await confirmar({ titulo: 'Eliminar recurrente', texto: 'Los movimientos que ya generó se conservan.', aceptar: 'Eliminar', peligro: true }))) return;
    await A.borrarRecurrente(id); cerrarHoja(); toast('Recurrente eliminado');
});

// ---------- Categoría ----------
export function abrirFormCategoria(id = null) {
    const c = id ? sel.categoria(id) : null;
    const actual = c?.icono || 'tag';
    abrirHoja({
        titulo: c ? 'Editar categoría' : 'Nueva categoría',
        html: `<form data-submit="guardarCategoria" data-id="${escapeHtml(id || '')}">
            <input type="hidden" name="icono" value="${actual}">
            <div class="field"><label for="fk-nombre">Nombre</label><input id="fk-nombre" name="nombre" required placeholder="Ej. Mascotas" value="${escapeHtml(c?.nombre || '')}"></div>
            <div class="field"><span class="label">Ícono</span><div class="chips" id="fk-iconos">${ICONOS_CATEGORIA.map(i => `<button type="button" class="chip ${i === actual ? 'activo' : ''}" data-action="fkIcono" data-i="${i}" aria-label="${i}">${icon(i)}</button>`).join('')}</div></div>
            <div class="field"><label for="fk-pres">Presupuesto mensual (opcional)</label><input id="fk-pres" name="presupuesto" inputmode="decimal" placeholder="Sin límite" value="${c?.presupuesto || ''}"></div>
            <div class="hoja-foot">
                ${c ? '<button type="button" class="btn btn-danger-soft" data-action="fkBorrar" style="flex:0 0 auto;">' + icon('trash') + '</button>' : ''}
                <button type="submit" class="btn btn-primary">Guardar</button>
            </div>
        </form>`,
    });
}
on('fkIcono', (el) => {
    const hoja = hojaAbierta();
    hoja.querySelector('[name="icono"]').value = el.dataset.i;
    hoja.querySelectorAll('#fk-iconos .chip').forEach(b => b.classList.toggle('activo', b === el));
});
on('guardarCategoria', async (form) => {
    await A.guardarCategoria({ id: form.dataset.id || undefined, nombre: v(form, 'nombre'), icono: v(form, 'icono'), presupuesto: n(form, 'presupuesto') });
    cerrarHoja(); toast('Categoría guardada');
}, 'submit');
on('fkBorrar', async () => {
    const id = hojaAbierta()?.querySelector('form').dataset.id;
    const usos = sel.transacciones().filter(t => t.categoriaId === id).length;
    if (!(await confirmar({ titulo: 'Eliminar categoría', texto: usos ? `${usos} movimiento(s) la usan; seguirán mostrando su nombre.` : '', aceptar: 'Eliminar', peligro: true }))) return;
    await A.borrarCategoria(id); cerrarHoja(); toast('Categoría eliminada');
});
