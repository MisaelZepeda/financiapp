// Tarjeta "Puedes gastar hoy" de Inicio y su desglose.

import { on } from '../core/eventos.js';
import { sel } from '../core/store.js';
import { abrirHoja } from './capas.js';
import { icon } from '../lib/icons.js';
import { money, escapeHtml, fechaCorta } from '../lib/format.js';
import { puedesGastar } from '../domain/puedes-gastar.js';

const calcular = () => puedesGastar({ cuentas: sel.cuentas(), saldos: sel.saldos(), transacciones: sel.transacciones(), recurrentes: sel.recurrentes() });

const hastaTexto = (g) => g.ingreso.origen === 'quincena' ? `la quincena del ${fechaCorta(g.ingreso.fecha)}` : `${g.ingreso.desc} (${fechaCorta(g.ingreso.fecha)})`;

export function gastarHoyHTML() {
    if (!sel.cuentas().some(c => c.tipo !== 'credito')) return '';
    const g = calcular();
    const pasado = g.hoyQueda < 0;
    const titulo = !g.alcanza ? 'Tus pagos superan lo que tienes' : pasado ? 'Hoy ya te pasaste por' : 'Puedes gastar hoy';
    const cifra = !g.alcanza ? -g.libre : Math.abs(g.hoyQueda);
    const tono = !g.alcanza || pasado ? 'neg' : g.hoyQueda < g.porDia * 0.25 ? 'warn' : 'pos';
    return `<button class="card gastar-hoy" data-action="abrirGastarHoy">
        <span class="gh-top"><span class="card-meta">${titulo}</span>${icon('chevron-right', 'chev')}</span>
        <span class="gh-cifra num privado ${tono}">${money(cifra)}</span>
        <span class="gh-sub">${g.alcanza
            ? `${g.gastadoHoy > 0 ? `Llevas <span class="privado">${money(g.gastadoHoy)}</span> de <span class="privado">${money(g.porDia)}</span> por día` : `<span class="privado">${money(g.porDia)}</span> cada día`} · ${g.dias} día${g.dias === 1 ? '' : 's'} hasta ${escapeHtml(hastaTexto(g))}`
            : `Faltan antes de ${escapeHtml(hastaTexto(g))}. Toca para ver qué pagos vienen.`}</span>
        ${g.alcanza ? `<span class="barra sm gh-barra"><i style="width:${Math.min(100, g.porDia > 0 ? g.gastadoHoy / g.porDia * 100 : 100)}%; background:var(--${tono === 'pos' ? 'accent' : tono})"></i></span>` : ''}
    </button>`;
}

function desgloseHTML() {
    const g = calcular();
    const fila = (t, v, clase = '') => `<div class="det-fila"><span>${t}</span><b class="num privado ${clase}">${v}</b></div>`;
    const lista = (items) => items.map(p => fila(`${escapeHtml(p.desc)} · ${fechaCorta(p.fecha)}`, `−${money(p.monto)}`)).join('');
    return `<p class="hint" style="margin-bottom:12px;">Lo que te queda libre hasta ${escapeHtml(hastaTexto(g))}, después de apartar los pagos que vienen antes.${g.ingreso.origen === 'quincena' ? ' Si registras tu sueldo como pago fijo de ingreso, se usa su fecha real.' : ''}</p>
        <div class="det-lista">${fila('Débito y efectivo hoy', money(g.disponible))}</div>
        ${g.pagosFijos.length ? `<div class="det-sub">Pagos fijos antes de esa fecha</div><div class="det-lista">${lista(g.pagosFijos)}</div>` : ''}
        ${g.tarjetas.length ? `<div class="det-sub">Pagos de tarjeta</div><div class="det-lista">${lista(g.tarjetas)}</div>` : ''}
        <div class="det-sub">Resultado</div>
        <div class="det-lista">
            ${fila('Libre', money(g.libre), g.libre < 0 ? 'neg' : '')}
            ${fila(`Por día (${g.dias} día${g.dias === 1 ? '' : 's'})`, money(g.porDia))}
            ${fila('Ya gastaste hoy', money(g.gastadoHoy))}
            ${fila('Te quedan hoy', money(g.hoyQueda), g.hoyQueda < 0 ? 'neg' : 'pos')}
        </div>
        <p class="hint" style="margin-top:12px;">Las compras con tarjeta de hoy cuentan en "Ya gastaste hoy"; su pago se aparta cuando llegue la fecha límite de la tarjeta.</p>`;
}

on('abrirGastarHoy', () => abrirHoja({ titulo: 'Puedes gastar hoy', html: desgloseHTML() }));
