// Te deben: compras que hiciste por alguien más, cuánto te han pagado y
// cuánto falta. Los abonos van directo a la tarjeta de la compra (cuentan como
// pago de la tarjeta) y no cuentan como ingreso tuyo.

import { sel } from '../core/store.js';
import { on } from '../core/eventos.js';
import { guardarTransaccion } from '../core/actions.js';
import { icon } from '../lib/icons.js';
import { money, escapeHtml, fechaCorta, fechaLarga, cuandoRelativo } from '../lib/format.js';
import { vacioHTML } from '../components/piezas.js';
import { abrirHoja, cerrarHoja, toast } from '../components/capas.js';
import { confeti, monedaAlcancia } from '../components/efectos.js';
import { abrirRegistro } from '../components/registro.js';
import { deudasTerceros, totalTeDeben } from '../domain/terceros.js';
import { hoyISO } from '../domain/fechas.js';

export const titulo = () => ({ titulo: 'Te deben', atras: '#/mas' });

export const deudas = () => deudasTerceros(sel.cuentas(), sel.transacciones());

function personaHTML(d) {
    const pct = d.total ? Math.min(100, (d.abonado / d.total) * 100) : 0;
    const estado = d.saldada
        ? `<span class="badge badge-pos">${icon('check')}Saldado</span>`
        : d.vencido > 0
            ? `<span class="badge badge-warn">Debió pagarte <span class="privado">${money(d.vencido)}</span></span>`
            : '<span class="badge badge-pos">Al corriente</span>';
    const proximo = !d.saldada && d.proximo
        ? `<p class="hint" style="margin:8px 0 0;">${d.vencido > 0 ? 'Cobro pendiente desde' : 'Próxima mensualidad'}: <b class="privado">${money(d.proximo.monto)}</b> el ${fechaLarga(d.proximo.fecha)}${d.proximo.fecha >= hoyISO() ? ` (${cuandoRelativo(d.proximo.fecha)})` : ''}</p>`
        : '';
    const compras = d.compras.map(t => {
        const c = sel.cuenta(t.cuentaId);
        return `<div class="fila fila-link" data-action="editarTx" data-id="${escapeHtml(t.id)}"><div class="fila-ico">${icon('share')}</div>
            <div class="fila-body"><div class="fila-titulo">${escapeHtml(t.desc || 'Compra')}</div><div class="fila-sub">${fechaCorta(t.fecha)} · ${escapeHtml(c?.nombre || 'Cuenta')}${t.msi > 1 ? ` · ${t.msi} MSI` : ''}</div></div>
            <div class="fila-der"><span class="num privado">${money(t.monto)}</span></div></div>`;
    }).join('');
    const abonos = d.abonos.slice(0, 6).map(t => `<div class="fila fila-link" data-action="editarTx" data-id="${escapeHtml(t.id)}"><div class="fila-ico tono-pos">${icon('coin')}</div>
        <div class="fila-body"><div class="fila-titulo">Abono</div><div class="fila-sub">${fechaCorta(t.fecha)} · ${escapeHtml(sel.cuenta(t.cuentaId)?.nombre || 'Cuenta')}</div></div>
        <div class="fila-der"><span class="num privado pos">+${money(t.monto)}</span></div></div>`).join('');
    return `<section class="card persona ${d.saldada ? 'saldada' : ''}">
        <div class="persona-top"><div class="persona-avatar">${escapeHtml(d.nombre.charAt(0).toUpperCase())}</div>
            <div class="persona-body"><b>${escapeHtml(d.nombre)}</b>${estado}</div>
            <div class="persona-der"><small>${d.saldada ? 'Te pagó' : 'Te debe'}</small><b class="num privado">${money(d.saldada ? d.total : d.pendiente)}</b></div></div>
        <div class="barra" style="margin-top:12px;"><i style="width:${pct}%"></i></div>
        <p class="hint" style="margin:6px 0 0;"><span class="privado">${money(d.abonado)}</span> de <span class="privado">${money(d.total)}</span> pagado</p>
        ${proximo}
        ${d.saldada ? '' : `<div class="botones-fila" style="margin-top:12px;"><button class="btn btn-primary" data-action="tdAbonar" data-n="${escapeHtml(d.nombre)}">${icon('plus')}Registrar abono</button></div>`}
        <details class="persona-detalle"><summary>Compras y abonos</summary>
            <p class="lista-label">Compras</p><div class="lista">${compras}</div>
            ${abonos ? `<p class="lista-label" style="margin-top:10px;">Abonos</p><div class="lista">${abonos}</div>` : ''}
        </details>
    </section>`;
}

export function render() {
    const lista = deudas();
    if (!lista.length) return `<section class="card">${vacioHTML('share', 'Cuando hagas una compra por alguien más, regístrala como gasto y marca "Es una compra para alguien más". Aquí verás lo que te debe y cada abono, sin que cuente como gasto ni ingreso tuyo.', `<button class="btn btn-primary btn-sm" data-action="tdNueva">${icon('plus')}Registrar una compra</button>`)}</section>`;
    const activas = lista.filter(d => !d.saldada), saldadas = lista.filter(d => d.saldada);
    const vencido = activas.reduce((a, d) => a + d.vencido, 0);
    return `<section class="card td-resumen">
            <p class="card-meta">En total te deben</p>
            <p class="td-total num privado">${money(totalTeDeben(lista))}</p>
            <p class="hint" style="margin:0;">${activas.length ? `${activas.length} persona${activas.length === 1 ? '' : 's'}${vencido > 0 ? ` · <b class="privado">${money(vencido)}</b> ya debieron pagarte` : ' · todos al corriente'}` : 'Nadie te debe nada'}</p>
            <p class="hint" style="margin:8px 0 0;">Estas compras sí suman a lo que debes en tu tarjeta, pero no cuentan como gasto tuyo.</p>
        </section>
        <div class="acciones-top"><span></span><button class="btn btn-soft" data-action="tdNueva">${icon('plus')}Nueva compra para alguien</button></div>
        ${activas.map(personaHTML).join('')}
        ${saldadas.length ? `<p class="lista-label" style="margin:18px 4px 8px;">Ya saldadas</p>${saldadas.map(personaHTML).join('')}` : ''}`;
}

// ---------- Registrar abono ----------
let abono = null;
function abonoHTML() {
    // Primero las tarjetas donde se hicieron sus compras; luego las demás cuentas.
    const cuentas = [...sel.cuentas()].sort((a, b) => Number(abono.tarjetas.includes(b.id)) - Number(abono.tarjetas.includes(a.id)));
    const elegida = sel.cuenta(abono.cuentaId);
    return `<div class="field"><label for="td-monto">Monto</label><input id="td-monto" inputmode="decimal" value="${abono.monto || ''}" data-input="tdMonto"></div>
        <div class="field"><span class="label">¿A dónde se abona?</span><div class="chips">${cuentas.map(c => `<button type="button" class="chip ${c.id === abono.cuentaId ? 'activo' : ''}" data-action="tdCuenta" data-id="${escapeHtml(c.id)}">${escapeHtml(c.nombre)}</button>`).join('')}</div></div>
        <p class="hint">${elegida?.tipo === 'credito' ? `Se abona directo a ${escapeHtml(elegida.nombre)} y cuenta como pago de la tarjeta.` : 'Entra a esa cuenta.'} No cuenta como ingreso tuyo.</p>
        <div class="hoja-foot"><button class="btn btn-primary" data-action="tdGuardar">Guardar abono</button></div>`;
}
const repintarAbono = () => { const el = document.getElementById('td-abono'); if (el) el.innerHTML = abonoHTML(); };

on('tdAbonar', (el) => {
    const d = deudas().find(x => x.nombre === el.dataset.n);
    if (!d) return;
    const sugerido = d.vencido > 0 ? d.vencido : (d.proximo?.monto || d.pendiente);
    // Por omisión, la tarjeta de su compra más reciente.
    const tarjetas = [...new Set(d.compras.map(t => t.cuentaId).filter(id => sel.cuenta(id)?.tipo === 'credito'))];
    const reciente = [...d.compras].sort((a, b) => b.fecha.localeCompare(a.fecha)).find(t => tarjetas.includes(t.cuentaId));
    const cuenta = sel.cuenta(reciente?.cuentaId) || sel.cuentas().find(c => c.tipo === 'debito');
    abono = { nombre: d.nombre, monto: Math.min(sugerido, d.pendiente), cuentaId: cuenta?.id, pendiente: d.pendiente, tarjetas };
    abrirHoja({ titulo: `Abono de ${d.nombre}`, html: `<div id="td-abono">${abonoHTML()}</div>` });
});
on('tdMonto', (el) => { abono.monto = parseFloat(el.value.replace(/[^0-9.]/g, '')) || 0; }, 'input');
on('tdCuenta', (el) => { abono.cuentaId = el.dataset.id; repintarAbono(); });
on('tdGuardar', async () => {
    const monto = Math.round((abono.monto || 0) * 100) / 100;
    if (!(monto > 0)) return toast('Escribe el monto del abono', { tipo: 'error' });
    if (!abono.cuentaId) return toast('Elige la cuenta donde entró', { tipo: 'error' });
    await guardarTransaccion({ tipo: 'ingreso', monto, fecha: hoyISO(), desc: `Abono de ${abono.nombre}`, cuentaId: abono.cuentaId, abonoDe: abono.nombre });
    cerrarHoja();
    if (monto >= abono.pendiente - 0.009) { toast(`¡${abono.nombre} terminó de pagarte!`); confeti(); }
    else { toast(`Abono de ${money(monto)} registrado`); monedaAlcancia(); }
});
on('tdNueva', () => abrirRegistro({ tipo: 'gasto', paraOtro: true }));
