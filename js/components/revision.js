// "Revisa tus cuentas": compara el saldo de cada cuenta en Morralla con el de tu banco.
// Coincide → se marca revisada. Corregir → se ajusta el saldo (sin tocar movimientos).

import { sel } from '../core/store.js';
import { on } from '../core/eventos.js';
import { guardarCuenta, marcarRevisadas } from '../core/actions.js';
import { icon } from '../lib/icons.js';
import { money, escapeHtml } from '../lib/format.js';
import { abrirHoja, cerrarHoja, hojaAbierta, toast } from './capas.js';
import { monogramaHTML } from './piezas.js';
import { cuentasPorRevisar } from '../domain/revision.js';
import { hoyISO } from '../domain/fechas.js';

let estado = null;   // { ids: [...], corrigiendo: id|null, hechas: Set }

export const porRevisar = () => cuentasPorRevisar(sel.cuentas());

function filaHTML(c) {
    const saldo = sel.saldo(c.id);
    const cred = c.tipo === 'credito';
    const hecha = estado.hechas.has(c.id);
    const corrigiendo = estado.corrigiendo === c.id;
    return `<div class="rev-fila ${hecha ? 'hecha' : ''}">
        <div class="rev-top">${monogramaHTML(c)}
            <div class="fila-body"><div class="fila-titulo">${escapeHtml(c.nombre)}</div>
                <div class="fila-sub">${cred ? 'Deuda' : 'Saldo'} en Morralla: <b class="privado">${money(saldo)}</b></div></div>
            ${hecha ? `<span class="badge badge-pos">${icon('check')}Lista</span>` : ''}</div>
        ${hecha ? '' : corrigiendo
            ? `<div class="rev-corregir"><label for="rev-${escapeHtml(c.id)}">${cred ? 'Deuda real en tu banco' : 'Saldo real en tu banco'}</label>
                <div class="rev-in"><input id="rev-${escapeHtml(c.id)}" inputmode="decimal" placeholder="${saldo}" autocomplete="off">
                <button type="button" class="btn btn-primary btn-sm" data-action="revGuardar" data-id="${escapeHtml(c.id)}">Guardar</button></div>
                <span class="hint">Se ajusta el saldo sin tocar tus movimientos.</span></div>`
            : `<div class="rev-btns"><button type="button" class="btn btn-soft btn-sm" data-action="revOk" data-id="${escapeHtml(c.id)}">${icon('check')}Coincide</button>
                <button type="button" class="btn btn-ghost btn-sm" data-action="revCorregir" data-id="${escapeHtml(c.id)}">${icon('edit')}Corregir</button></div>`}
    </div>`;
}

function cuerpoHTML() {
    const cuentas = estado.ids.map(id => sel.cuenta(id)).filter(Boolean);
    const faltan = cuentas.filter(c => !estado.hechas.has(c.id)).length;
    return `<p class="hint" style="margin-top:0;">Abre la app de cada banco y compara. ${faltan ? `Te faltan <b>${faltan}</b>.` : '¡Listo, todas al día!'}</p>
        <div class="rev-lista">${cuentas.map(filaHTML).join('')}</div>
        <div class="hoja-foot">${faltan ? `<button class="btn btn-primary" data-action="revTodas">${icon('check')}Todas coinciden</button>` : `<button class="btn btn-primary" data-action="cerrarHoja">Cerrar</button>`}</div>`;
}
const repintar = () => { const el = hojaAbierta()?.querySelector('#rev-body'); if (el) el.innerHTML = cuerpoHTML(); };

export function abrirRevision() {
    const pend = porRevisar();
    const ids = (pend.length ? pend : sel.cuentas()).map(c => c.id);
    estado = { ids, corrigiendo: null, hechas: new Set() };
    abrirHoja({ titulo: 'Revisa tus cuentas', html: `<div id="rev-body">${cuerpoHTML()}</div>`, alCerrar: () => { estado = null; } });
}

on('abrirRevision', () => abrirRevision());
on('revOk', async (el) => {
    await marcarRevisadas([el.dataset.id]);
    estado?.hechas.add(el.dataset.id); repintar();
});
on('revCorregir', (el) => {
    estado.corrigiendo = el.dataset.id; repintar();
    setTimeout(() => hojaAbierta()?.querySelector(`#rev-${CSS.escape(el.dataset.id)}`)?.focus(), 50);
});
on('revGuardar', async (el) => {
    const id = el.dataset.id;
    const input = hojaAbierta()?.querySelector(`#rev-${CSS.escape(id)}`);
    const valor = parseFloat(String(input?.value || '').replace(/[^0-9.\-]/g, ''));
    if (!Number.isFinite(valor)) return toast('Escribe el saldo que marca tu banco', { tipo: 'error' });
    const antes = sel.saldo(id);
    await guardarCuenta({ id, revisada: hoyISO() }, Math.round(valor * 100) / 100);
    estado.hechas.add(id); estado.corrigiendo = null; repintar();
    const dif = Math.round((valor - antes) * 100) / 100;
    toast(dif ? `${sel.cuenta(id)?.nombre}: ajustada ${dif > 0 ? '+' : '−'}${money(Math.abs(dif))}` : 'Sin diferencia: cuenta revisada');
});
on('revTodas', async () => {
    const ids = estado.ids.filter(id => !estado.hechas.has(id));
    await marcarRevisadas(ids);
    ids.forEach(id => estado.hechas.add(id));
    cerrarHoja();
    toast('Cuentas revisadas: todo coincide');
});
