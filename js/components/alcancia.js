// Alcancía de morralla: tarjeta de Inicio y hoja para echar las monedas del día.

import { sel } from '../core/store.js';
import { on } from '../core/eventos.js';
import { echarMonedas } from '../core/actions.js';
import { icon } from '../lib/icons.js';
import { money, escapeHtml } from '../lib/format.js';
import { abrirHoja, cerrarHoja, hojaAbierta, toast } from './capas.js';
import { ALCANCIA, monedaAlcancia, confeti } from './efectos.js';
import { resumenAlcancia, origenAlcancia, esAlcancia } from '../domain/alcancia.js';

const resumen = () => resumenAlcancia(sel.cuentas(), sel.saldos(), sel.transacciones());
const racha = (n) => n > 1 ? `${n} días seguidos` : '';

export function tarjetaAlcanciaHTML() {
    const r = resumen();
    const cerdito = `<span class="alc-cerdito">${ALCANCIA}</span>`;
    if (!r) return `<section class="card alc-card">${cerdito}
        <div class="alc-txt"><b>Alcancía de morralla</b><small>Al final del día echa las monedas que juntaste. Salen de tu Efectivo, tu total no cambia.</small></div>
        <button class="btn btn-soft btn-sm" data-action="abrirAlcancia">Empezar</button></section>`;
    const hoy = r.hoy ? `Hoy echaste <span class="privado">${money(r.hoy)}</span>` : 'Hoy aún no echas monedas';
    return `<section class="card alc-card">${cerdito}
        <div class="alc-txt"><small>Alcancía</small><b class="num privado">${money(r.total)}</b>
            <small>${hoy}${r.racha ? ` · ${racha(r.racha)}` : ''}</small></div>
        <button class="btn ${r.hoy ? 'btn-soft' : 'btn-primary'} btn-sm" data-action="abrirAlcancia">${icon('plus')}${r.hoy ? 'Más' : 'Echar'}</button></section>`;
}

// ---------- Hoja ----------
let estado = null;

function hojaHTML() {
    const cuentas = sel.cuentas().filter(c => !esAlcancia(c) && c.tipo !== 'credito');
    const r = resumen();
    return `<div class="alc-hoja">
        <div class="alc-hoja-cerdito">${ALCANCIA}</div>
        <p class="hint" style="text-align:center; margin:0 0 10px;">${r ? `Llevas <b class="privado">${money(r.total)}</b>${r.racha ? ` · ${racha(r.racha)}` : ''}` : 'Tu primera vez: se crea la cuenta Alcancía.'}</p>
        <div class="field"><label for="alc-monto">¿Cuántas monedas juntaste hoy?</label>
            <input id="alc-monto" class="alc-monto" inputmode="decimal" placeholder="$0" autocomplete="off" value="${estado.monto || ''}" data-input="alcMonto"></div>
        ${cuentas.length > 1 ? `<div class="field"><span class="label">Salen de</span><div class="chips">${cuentas.map(c => `<button type="button" class="chip ${c.id === estado.origenId ? 'activo' : ''}" data-action="alcOrigen" data-id="${escapeHtml(c.id)}">${escapeHtml(c.nombre)}</button>`).join('')}</div></div>` : ''}
        <p class="hint">Pasan de ${escapeHtml(sel.cuenta(estado.origenId)?.nombre || 'tu Efectivo')} a la Alcancía: no es un gasto y tu total no cambia.</p>
        <div class="hoja-foot"><button class="btn btn-primary" data-action="alcGuardar">${icon('coin')}Echar a la alcancía</button></div>
    </div>`;
}

export function abrirAlcancia() {
    const origen = origenAlcancia(sel.cuentas());
    if (!origen) return toast('Primero agrega tu cuenta de Efectivo en Cuentas', { tipo: 'error' });
    estado = { monto: 0, origenId: origen.id };
    abrirHoja({
        titulo: 'Alcancía', html: `<div id="alc-body">${hojaHTML()}</div>`,
        alMontar: (h) => setTimeout(() => h.querySelector('#alc-monto')?.focus(), 250),
        alCerrar: () => { estado = null; },
    });
}

on('abrirAlcancia', () => abrirAlcancia());
on('alcMonto', (el) => {
    const limpio = el.value.replace(/[^0-9.]/g, '');
    if (limpio !== el.value) el.value = limpio;
    estado.monto = Math.round((parseFloat(limpio) || 0) * 100) / 100;
}, 'input');
on('alcOrigen', (el) => {
    estado.origenId = el.dataset.id;
    const b = hojaAbierta()?.querySelector('#alc-body'); if (b) b.innerHTML = hojaHTML();
});
on('alcGuardar', async () => {
    if (!(estado?.monto > 0)) return toast('Escribe cuántas monedas juntaste', { tipo: 'error' });
    const { monto, origenId } = estado;
    await echarMonedas(monto, origenId);
    cerrarHoja();
    const r = resumen();
    if (r?.racha && r.racha % 7 === 0) { confeti(); toast(`¡${r.racha} días seguidos! Llevas ${money(r.total)} en la alcancía`); }
    else { monedaAlcancia(); toast(`${money(monto)} a la alcancía · llevas ${money(r?.total || monto)}`); }
});
