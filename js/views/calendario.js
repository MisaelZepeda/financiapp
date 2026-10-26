// Calendario de pagos (pestaña de Planear): mes en cuadrícula con puntos por
// día, el detalle del día elegido y el total de salidas por semana.

import { sel } from '../core/store.js';
import { on } from '../core/eventos.js';
import { icon } from '../lib/icons.js';
import { money, escapeHtml, nombreMesAnio, fechaLarga, fechaCorta } from '../lib/format.js';
import { vacioHTML } from '../components/piezas.js';
import { eventosMes, semanasMes } from '../domain/calendario.js';
import { mesKey, sumarMeses, hoyISO, ultimoDiaMes, aFecha } from '../domain/fechas.js';

let mes = null;     // 'AAAA-MM' que se está viendo
let dia = null;     // 'AAAA-MM-DD' elegido

const DIAS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const CLASE = { pago: 'ev-pago', recurrente: 'ev-rec', corte: 'ev-corte', msi: 'ev-msi' };
const ICONO = { pago: 'credit-card', recurrente: 'repeat', corte: 'calendar', msi: 'check-circle' };

function eventos() {
    return eventosMes(mes, { cuentas: sel.cuentas(), transacciones: sel.transacciones(), recurrentes: sel.recurrentes() });
}

function claseEvento(e) {
    if (e.tipo === 'recurrente' && e.ingreso) return 'ev-ingreso';
    return CLASE[e.tipo];
}

function filaEvento(e) {
    const estado = e.pagado ? '<span class="badge badge-pos">Pagado</span>'
        : e.tipo === 'pago' && e.fecha < hoyISO() ? '<span class="badge badge-neg">Vencido</span>'
        : e.tipo === 'pago' && e.estimado ? '<span class="badge">Estimado</span>'
        : e.pendiente ? '<span class="badge badge-warn">Pendiente</span>' : '';
    const monto = e.monto == null ? '' : `<span class="num privado ${e.ingreso ? 'pos' : ''}">${e.ingreso ? '+' : ''}${money(e.monto)}</span>`;
    const destino = e.cuentaId ? `#/cuenta/${encodeURIComponent(e.cuentaId)}` : '#/planear/recurrentes';
    return `<a class="fila fila-link" href="${e.tipo === 'recurrente' ? '#/planear/recurrentes' : destino}">
        <div class="fila-ico ${claseEvento(e)}-ico">${icon(ICONO[e.tipo])}</div>
        <div class="fila-body"><div class="fila-titulo">${escapeHtml(e.titulo)}</div><div class="fila-sub">${fechaLarga(e.fecha)}</div></div>
        <div class="fila-der">${monto}${estado}</div>
    </a>`;
}

export function calendarioHTML() {
    const hoy = hoyISO();
    if (!mes) mes = mesKey();
    const evs = eventos();
    if (!dia || !dia.startsWith(mes)) dia = hoy.startsWith(mes) ? hoy : (evs[0]?.fecha || `${mes}-01`);

    // Cuadrícula: desde el lunes de la primera semana hasta completar el mes.
    const primero = aFecha(`${mes}-01`);
    const hueco = (primero.getDay() + 6) % 7;
    const total = Number(ultimoDiaMes(mes).slice(8));
    const porDia = {};
    evs.forEach(e => (porDia[e.fecha] = porDia[e.fecha] || []).push(e));
    let celdas = '';
    for (let i = 0; i < hueco; i++) celdas += '<span class="cal-vacia"></span>';
    for (let d = 1; d <= total; d++) {
        const f = `${mes}-${String(d).padStart(2, '0')}`;
        const lista = porDia[f] || [];
        const puntos = [...new Set(lista.map(claseEvento))].slice(0, 3).map(c => `<i class="${c}"></i>`).join('');
        celdas += `<button class="cal-dia ${f === hoy ? 'hoy' : ''} ${f === dia ? 'activo' : ''} ${f < hoy ? 'pasado' : ''}" data-action="calDia" data-f="${f}" aria-label="${fechaLarga(f)}${lista.length ? `, ${lista.length} evento${lista.length > 1 ? 's' : ''}` : ''}">
            <span>${d}</span><span class="cal-puntos">${puntos}</span></button>`;
    }

    const delDia = porDia[dia] || [];
    const semanas = semanasMes(mes, evs);
    const maxSem = Math.max(...semanas.map(s => s.total), 1);
    const pesada = semanas.reduce((a, s) => (s.total > a.total ? s : a), semanas[0]);
    const salidas = evs.filter(e => e.sale && !e.pagado).reduce((a, e) => a + (e.monto || 0), 0);
    const entradas = evs.filter(e => e.ingreso).reduce((a, e) => a + (e.monto || 0), 0);

    return `<section class="card">
            <div class="cal-head">
                <button class="icon-btn" data-action="calMes" data-d="-1" aria-label="Mes anterior">${icon('chevron-right', 'rot180')}</button>
                <h2 class="card-title">${nombreMesAnio(mes)}</h2>
                <button class="icon-btn" data-action="calMes" data-d="1" aria-label="Mes siguiente">${icon('chevron-right')}</button>
            </div>
            <div class="cal-resumen">
                <span>Por pagar <b class="num privado">${money(salidas)}</b></span>
                <span>Por recibir <b class="num privado pos">+${money(entradas)}</b></span>
            </div>
            <div class="cal-grid">${DIAS.map(d => `<span class="cal-dow">${d}</span>`).join('')}${celdas}</div>
            <div class="cal-leyenda"><span><i class="ev-pago"></i>Pago de tarjeta</span><span><i class="ev-rec"></i>Recurrente</span><span><i class="ev-ingreso"></i>Ingreso</span><span><i class="ev-corte"></i>Corte</span><span><i class="ev-msi"></i>Fin de MSI</span></div>
        </section>
        <section class="card" style="margin-top:14px;">
            <div class="card-head"><h2 class="card-title">${fechaLarga(dia)}</h2></div>
            ${delDia.length ? `<div class="lista">${delDia.map(filaEvento).join('')}</div>` : vacioHTML('calendar', 'Nada programado este día.')}
        </section>
        <section class="card" style="margin-top:14px;">
            <div class="card-head"><h2 class="card-title">Salidas por semana</h2>${pesada?.total ? `<span class="card-meta">Más pesada: ${fechaCorta(pesada.desde)}</span>` : ''}</div>
            <div class="semanas">${semanas.map(s => `<div class="semana ${s === pesada && s.total ? 'pesada' : ''}">
                <span class="semana-fechas">${fechaCorta(s.desde)} – ${fechaCorta(s.hasta)}</span>
                <div class="barra sm"><i style="width:${(s.total / maxSem) * 100}%"></i></div>
                <span class="num privado">${money(s.total)}</span>
            </div>`).join('')}</div>
        </section>`;
}

const repintar = () => { const el = document.getElementById('planear-contenido'); if (el) el.innerHTML = calendarioHTML(); };
on('calMes', (el) => { mes = sumarMeses(mes || mesKey(), Number(el.dataset.d)); dia = null; repintar(); });
on('calDia', (el) => { dia = el.dataset.f; repintar(); });
