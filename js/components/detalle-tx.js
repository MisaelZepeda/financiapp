// Resumen de un movimiento: al tocarlo se ve el detalle; Editar y Borrar
// quedan en botones (deslizar la fila sigue llevando directo a editar).

import { on } from '../core/eventos.js';
import { sel } from '../core/store.js';
import { borrarTransaccion } from '../core/actions.js';
import { abrirHoja, cerrarHoja, toast, confirmar } from './capas.js';
import { abrirRegistro } from './registro.js';
import { icon } from '../lib/icons.js';
import { money, escapeHtml, etiquetaDia, fechaLarga } from '../lib/format.js';
import { detalleMSI } from '../domain/msi.js';
import { describirTx } from './piezas.js';

const TIPO = { gasto: 'Gasto', ingreso: 'Ingreso', transferencia: 'Transferencia' };
const SUB = { cashback: 'Cashback', rendimiento: 'Rendimiento', pago_tdc: 'Pago de tarjeta', traspaso: 'Traspaso' };

const fila = (etiqueta, valor) => valor ? `<div class="det-fila"><span>${etiqueta}</span><b>${valor}</b></div>` : '';

function detalleHTML(tx) {
    const d = describirTx(tx);
    const cuenta = sel.cuenta(tx.cuentaId);
    const destino = tx.cuentaDestinoId ? sel.cuenta(tx.cuentaDestinoId) : null;
    const partes = Array.isArray(tx.partes) && tx.partes.length > 1 ? tx.partes : null;
    const msi = tx.tipo === 'gasto' && Number(tx.msi) > 1 && cuenta ? detalleMSI(cuenta, tx) : null;
    const nombreCta = (c) => c ? escapeHtml(c.nombre) + (c.digitos ? ` ·${escapeHtml(c.digitos)}` : '') : 'Cuenta borrada';

    return `<div class="det-cabeza">
            <div class="fila-ico ${d.tono}" ${d.estilo || ''}>${icon(d.icono)}</div>
            <div class="det-monto num privado ${d.clase}">${d.signo}${money(Math.abs(tx.monto))}</div>
            ${msi ? `<div class="det-nota">${money(msi.mensualidad)} al mes durante ${msi.meses} meses</div>` : ''}
        </div>
        <div class="det-lista">
            ${fila('Tipo', escapeHtml(SUB[tx.subtipo] || TIPO[tx.tipo] || tx.tipo))}
            ${fila('Fecha', escapeHtml(etiquetaDia(tx.fecha)))}
            ${fila(tx.tipo === 'transferencia' ? 'Desde' : 'Cuenta', nombreCta(cuenta))}
            ${destino ? fila('Hacia', nombreCta(destino)) : ''}
            ${tx.tipo === 'gasto' && !partes && !tx.paraTercero ? fila('Categoría', escapeHtml(sel.categoria(tx.categoriaId).nombre)) : ''}
            ${tx.paraTercero ? fila('Para', escapeHtml(tx.paraTercero)) : ''}
            ${tx.abonoDe ? fila('Abono de', escapeHtml(tx.abonoDe)) : ''}
            ${tx.etiquetas?.length ? fila('Etiquetas', tx.etiquetas.map(e => `<span class="tag">#${escapeHtml(e)}</span>`).join(' ')) : ''}
            ${tx.recurrenteId ? fila('Origen', 'Pago fijo') : ''}
        </div>
        ${partes ? `<div class="det-sub">Dividido en</div><div class="det-lista">${partes.map(p => fila(escapeHtml(sel.categoria(p.categoriaId).nombre), `<span class="num privado">${money(Number(p.monto) || 0)}</span>`)).join('')}</div>` : ''}
        ${msi ? `<div class="det-sub">Meses sin intereses</div><div class="det-lista">
            ${fila('Mensualidad', `<span class="num privado">${money(msi.mensualidad)}</span>`)}
            ${fila('Facturadas', `${msi.facturadas} de ${msi.meses}`)}
            ${fila('Por pagar', `<span class="num privado">${money(msi.pendiente)}</span>`)}
            ${fila(msi.activa ? 'Termina' : 'Terminó', escapeHtml(fechaLarga(msi.ultimoPago)))}
        </div>` : ''}
        <div class="hoja-foot">
            <button class="btn btn-danger-soft" data-action="detBorrar" data-id="${escapeHtml(tx.id)}">${icon('trash')}Borrar</button>
            <button class="btn btn-primary" data-action="detEditar" data-id="${escapeHtml(tx.id)}">${icon('edit')}Editar</button>
        </div>`;
}

export function abrirDetalleTx(id) {
    const tx = sel.transaccion(id);
    if (!tx) return toast('Ese movimiento ya no existe', { tipo: 'error' });
    abrirHoja({ titulo: tx.desc || describirTx(tx).titulo, html: detalleHTML(tx) });
}

on('verTx', (el) => abrirDetalleTx(el.dataset.id));
on('detEditar', (el) => { cerrarHoja(true); abrirRegistro({ id: el.dataset.id }); });
on('detBorrar', async (el) => {
    const id = el.dataset.id;
    if (!(await confirmar({ titulo: '¿Borrar este movimiento?', texto: 'Podrás deshacerlo justo después.', aceptar: 'Borrar', peligro: true }))) return;
    cerrarHoja(true);
    const deshacer = await borrarTransaccion(id);
    toast('Movimiento eliminado', { deshacer });
});
