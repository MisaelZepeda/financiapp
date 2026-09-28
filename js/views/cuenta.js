// Detalle de una cuenta: saldo, datos de la tarjeta, acciones rápidas y sus movimientos.

import { sel } from '../core/store.js';
import { icon } from '../lib/icons.js';
import { money, moneyPartes, escapeHtml, TIPO_CUENTA, fechaLarga, cuandoRelativo } from '../lib/format.js';
import { txAgrupadasHTML, vacioHTML, monogramaHTML } from '../components/piezas.js';
import { estadoPago, porFacturar } from '../domain/tarjetas.js';

export const titulo = ({ id }) => {
    const c = sel.cuenta(id);
    return { titulo: c?.nombre || 'Cuenta', subtitulo: c ? [c.banco, TIPO_CUENTA[c.tipo]].filter(Boolean).join(' · ') : '', atras: '#/cuentas' };
};

export function render({ id }) {
    const c = sel.cuenta(id);
    if (!c) return `<section class="card">${vacioHTML('landmark', 'Esta cuenta ya no existe.', '<a class="btn btn-soft btn-sm" href="#/cuentas">Ver cuentas</a>')}</section>`;
    const saldo = sel.saldo(id);
    const cred = c.tipo === 'credito';
    const partes = moneyPartes(saldo);
    const txs = sel.transacciones().filter(t => t.cuentaId === id || t.cuentaDestinoId === id);

    let credito = '';
    if (cred) {
        const usado = c.limite > 0 ? Math.min(100, Math.max(0, saldo / c.limite * 100)) : 0;
        const e = estadoPago(c, sel.transacciones());
        credito = `<div class="cred-uso">
            ${c.limite > 0 ? `<div class="barra"><i style="width:${usado}%; background:${usado > 80 ? 'var(--neg)' : usado > 50 ? 'var(--warn)' : 'var(--accent)'}"></i></div>
            <div class="cred-uso-meta"><span>${Math.round(usado)}% usado</span><span class="privado">Disponible ${money(c.limite - saldo)} de ${money(c.limite)}</span></div>` : ''}
        </div>
        ${e ? `<div class="cred-pago">
            <div><small>Pago para no generar intereses</small><b class="num privado">${money(e.pago)}</b></div>
            <div><small>Fecha límite</small><b>${fechaLarga(e.fechaPago)} <span class="muted" style="font-weight:500">(${e.dias < 0 ? 'vencida' : cuandoRelativo(e.fechaPago)})</span></b></div>
            <div><small>Abonado desde el corte</small><b class="num privado">${money(e.abonado)}</b></div>
            <div><small>Estado</small>${e.pagada ? `<span class="badge badge-pos">${icon('check')}Pagada</span>${e.marcada ? ` <button class="link" data-action="desmarcarPagada" data-id="${escapeHtml(id)}">Deshacer</button>` : ''}` : `<span class="badge ${e.dias < 0 ? 'badge-neg' : e.dias <= 3 ? 'badge-warn' : ''}">Faltan <span class="privado">${money(e.pendiente)}</span></span> <button class="link" data-action="marcarPagada" data-id="${escapeHtml(id)}">Marcar pagada</button>`}</div>
            <div><small>Corte</small><b>${fechaLarga(e.corte)}</b></div>
            <div><small>Por facturar (siguiente corte)</small><b class="num privado">${money(porFacturar(c, sel.transacciones()))}</b></div>
        </div>` : ''}`;
    }

    const acciones = cred
        ? [['pagarTarjeta', 'credit-card', 'Pagar'], ['cashback', 'gift', 'Cashback'], ['gastoCuenta', 'minus', 'Gasto'], ['editarCuenta', 'edit', 'Editar']]
        : [['gastoCuenta', 'minus', 'Gasto'], ['ingresoCuenta', 'plus', 'Ingreso'], ['traspasar', 'repeat', 'Traspasar'], c.tipo === 'debito' ? ['rendimiento', 'trending-up', 'Rendimiento'] : null, ['editarCuenta', 'edit', 'Editar']].filter(Boolean);

    return `<section class="card cuenta-hero">
            <div class="cuenta-hero-top">${monogramaHTML(c)}<div><p class="card-meta">${cred ? 'Deuda actual' : 'Saldo disponible'}</p>
                <p class="cuenta-saldo num privado">${partes.signo}${partes.entero}<span class="cent">${partes.decimales}</span></p></div>
                ${c.tipo === 'debito' ? `<button class="icon-btn" data-action="compartirCuenta" data-id="${escapeHtml(id)}" title="Compartir datos de depósito" aria-label="Compartir datos de depósito" style="margin-left:auto;">${icon('share')}</button>` : ''}
            </div>
            ${c.digitos || c.clabe ? `<p class="cuenta-datos">${c.digitos ? `•••• ${escapeHtml(c.digitos)}` : ''}${c.clabe ? ` · CLABE ${escapeHtml(c.clabe)}` : ''}</p>` : ''}
            ${credito}
            <div class="acciones-rapidas">${acciones.map(([a, i, t]) => `<button data-action="${a}" data-id="${escapeHtml(id)}"><span>${icon(i === 'minus' ? 'trending-down' : i)}</span>${t}</button>`).join('')}</div>
        </section>
        <section class="seccion">
            <div class="seccion-head"><h2>Movimientos</h2><span class="card-meta">${txs.length}</span></div>
            <div class="card card-flush">${txs.length ? txAgrupadasHTML(txs.slice(0, 60)) : vacioHTML('list', 'Sin movimientos en esta cuenta.')}
            ${txs.length > 60 ? `<div style="padding:14px 18px;"><a class="btn btn-soft btn-block" href="#/movimientos?cuenta=${encodeURIComponent(id)}">Ver todos</a></div>` : ''}</div>
        </section>`;
}
