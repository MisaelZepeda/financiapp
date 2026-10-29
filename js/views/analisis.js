// Análisis: patrimonio en el tiempo, flujo mensual, comparativo anual, mapa de
// calor del mes, categorías contra su promedio, etiquetas, gastos grandes y
// frecuentes, tasa de ahorro, "Tu mes en resumen" y exportación.

import { sel } from '../core/store.js';
import { on } from '../core/eventos.js';
import { icon } from '../lib/icons.js';
import { money, pct, escapeHtml, nombreMes, nombreMesAnio, fechaCorta } from '../lib/format.js';
import { vacioHTML, txFilaHTML } from '../components/piezas.js';
import { lineaPatrimonio, barrasIngresosGastos, lineasAnual } from '../components/graficas.js';
import { seriePatrimonio } from '../domain/saldos.js';
import { serieMensual, comparativaCategorias, gastosMasGrandes, gastosFrecuentes, tasaAhorro, insightPrincipal, porEtiqueta, comparativoAnual, gastoPorDia, nivelCalor } from '../domain/analisis.js';
import { mesKey, ultimosMeses, sumarMeses, sumarDias, ultimoDiaMes, aFecha, hoyISO } from '../domain/fechas.js';
import '../components/resumen-mes.js';
import { generarPDF, exportarCSV } from '../lib/exportar.js';
import { toast } from '../components/capas.js';

let meses = 12;
let calorMes = mesKey();
let calorDia = null;

export const titulo = () => ({ titulo: 'Análisis', atras: '#/mas' });

function kpisHTML(serie) {
    const actual = serie[serie.length - 1];
    const completos = serie.slice(0, -1).filter(m => m.ingresos || m.gastos);
    const prom = (k) => completos.length ? completos.reduce((a, m) => a + m[k], 0) / completos.length : 0;
    const ahorroMes = tasaAhorro(actual);
    const ahorroProm = tasaAhorro({ ingresos: prom('ingresos'), gastos: prom('gastos') });
    return `<div class="kpi-grid">
        <div class="card kpi-card"><small>Ahorraste este mes</small><b class="num ${ahorroMes > 0 ? 'pos' : ahorroMes < 0 ? 'neg' : ''}">${pct(ahorroMes)}</b><span class="muted">Promedio: ${pct(ahorroProm)}</span></div>
        <div class="card kpi-card"><small>Gasto promedio mensual</small><b class="num privado">${money(prom('gastos'))}</b><span class="muted">Este mes: <span class="privado">${money(actual.gastos)}</span></span></div>
        <div class="card kpi-card"><small>Ingreso promedio mensual</small><b class="num privado">${money(prom('ingresos'))}</b><span class="muted">Este mes: <span class="privado">${money(actual.ingresos)}</span></span></div>
    </div>`;
}

function categoriasHTML() {
    const filas = comparativaCategorias(sel.transacciones()).filter(c => c.mes > 0 || c.promedio > 0);
    if (!filas.length) return vacioHTML('bar-chart', 'Aún no hay gastos para comparar.');
    const max = Math.max(...filas.map(f => Math.max(f.mes, f.promedio)), 1);
    return `<div class="lista">${filas.map(f => {
        const cat = sel.categoria(f.categoriaId);
        const v = f.variacion;
        const badge = v == null ? '<span class="badge">Nuevo</span>' : Math.abs(v) < 5 ? '<span class="badge">Igual</span>'
            : `<span class="badge ${v > 0 ? 'badge-neg' : 'badge-pos'}">${v > 0 ? '↑' : '↓'} ${pct(Math.abs(v))}</span>`;
        return `<a class="fila fila-link comp-cat" href="#/movimientos?categoria=${encodeURIComponent(f.categoriaId)}&mes=${mesKey()}">
            <div class="fila-ico">${icon(cat.icono || 'tag')}</div>
            <div class="fila-body">
                <div class="comp-top"><span class="fila-titulo">${escapeHtml(cat.nombre)}</span>${badge}</div>
                <div class="comp-barras"><div class="barra sm"><i style="width:${f.mes / max * 100}%"></i></div><div class="barra sm prom"><i style="width:${f.promedio / max * 100}%"></i></div></div>
                <div class="fila-sub"><span class="privado">${money(f.mes)}</span> este mes · promedio <span class="privado">${money(f.promedio)}</span></div>
            </div>
        </a>`;
    }).join('')}</div>`;
}

function topHTML() {
    const grandes = gastosMasGrandes(sel.transacciones(), mesKey());
    const frecuentes = gastosFrecuentes(sel.transacciones());
    const filaGrande = (t) => `<div class="fila fila-link" data-action="editarTx" data-id="${escapeHtml(t.id)}"><div class="fila-ico">${icon(sel.categoria(t.categoriaId).icono || 'tag')}</div>
        <div class="fila-body"><div class="fila-titulo">${escapeHtml(t.desc || sel.categoria(t.categoriaId).nombre)}</div><div class="fila-sub">${fechaCorta(t.fecha)} · ${escapeHtml(sel.categoria(t.categoriaId).nombre)}</div></div>
        <div class="fila-der"><span class="num privado">${money(t.monto)}</span></div></div>`;
    const filaFrec = (g) => `<div class="fila"><div class="fila-ico">${icon(sel.categoria(g.categoriaId).icono || 'tag')}</div>
        <div class="fila-body"><div class="fila-titulo">${escapeHtml(g.desc)}</div><div class="fila-sub">${g.veces} veces en 3 meses</div></div>
        <div class="fila-der"><span class="num privado">${money(g.total)}</span><small>total</small></div></div>`;
    return `<div class="grid-2">
        <section class="card"><div class="card-head"><h2 class="card-title">Gastos más grandes</h2><span class="card-meta">${nombreMes(mesKey())}</span></div>
            ${grandes.length ? `<div class="lista">${grandes.map(filaGrande).join('')}</div>` : vacioHTML('box', 'Sin gastos este mes.')}</section>
        <section class="card"><div class="card-head"><h2 class="card-title">Gastos frecuentes</h2><span class="card-meta">Últimos 3 meses</span></div>
            ${frecuentes.length ? `<div class="lista">${frecuentes.map(filaFrec).join('')}</div>` : vacioHTML('repeat', 'Aún no hay gastos que se repitan.')}</section>
    </div>`;
}

// ---------- Este año vs. el anterior ----------
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function anualHTML() {
    const c = comparativoAnual(sel.transacciones());
    const v = c.variacionMes;
    const vAcum = c.acumuladoAnterior ? ((c.acumuladoActual - c.acumuladoAnterior) / c.acumuladoAnterior) * 100 : null;
    const badge = (x) => x == null ? '<span class="badge">Sin datos</span>' : `<span class="badge ${x > 0 ? 'badge-neg' : 'badge-pos'}">${x > 0 ? '↑' : '↓'} ${pct(Math.abs(x))}</span>`;
    return `<section class="card" style="margin-top:14px;">
        <div class="card-head"><h2 class="card-title">${c.anio} vs. ${c.anio - 1}</h2><span class="card-meta">Gasto por mes</span></div>
        ${c.hayAnterior ? `<div class="anual-kpis">
            <div><small>${nombreMes(c.mes)} vs. ${c.anio - 1}</small><b class="num privado">${money(c.este.gastos)}</b><span>${c.pasado.gastos ? `${badge(v)} <span class="muted">antes <span class="privado">${money(c.pasado.gastos)}</span></span>` : '<span class="muted">Sin datos del año pasado</span>'}</span></div>
            <div><small>En lo que va del año</small><b class="num privado">${money(c.acumuladoActual)}</b><span>${c.acumuladoAnterior ? `${badge(vAcum)} <span class="muted">antes <span class="privado">${money(c.acumuladoAnterior)}</span></span>` : '<span class="muted">Sin datos del año pasado</span>'}</span></div>
        </div>` : `<p class="hint" style="margin:0 0 10px;">Todavía no hay gastos del año pasado para comparar; la línea punteada aparecerá cuando los haya.</p>`}
        <div class="leyenda"><span><i style="background:var(--accent-ink)"></i>${c.anio}</span><span><i class="punteada"></i>${c.anio - 1}</span></div>
        <div class="grafica" style="height:210px;"><canvas id="an-anual" aria-label="Gasto por mes de ${c.anio} y ${c.anio - 1}"></canvas></div>
        <details class="tabla-datos"><summary>Ver tabla</summary>
            <table><thead><tr><th>Mes</th><th>${c.anio}</th><th>${c.anio - 1}</th></tr></thead><tbody>
            ${MESES_CORTOS.map((m, i) => `<tr><td>${m}</td><td class="num privado">${c.serieActual[i] == null ? '—' : money(c.serieActual[i])}</td><td class="num privado">${c.serieAnterior[i] == null ? '—' : money(c.serieAnterior[i])}</td></tr>`).join('')}
            </tbody></table></details>
    </section>`;
}

// ---------- Mapa de calor del mes ----------
function calorHTML() {
    const txs = sel.transacciones();
    const { dias, referencia } = gastoPorDia(txs, calorMes);
    const h = hoyISO();
    const vacios = (aFecha(`${calorMes}-01`).getDay() + 6) % 7;   // la semana empieza en lunes
    const celdas = [];
    for (let i = 0; i < vacios; i++) celdas.push('<span class="calor-celda vacia"></span>');
    for (let f = `${calorMes}-01`, fin = ultimoDiaMes(calorMes); f <= fin; f = sumarDias(f, 1)) {
        const v = dias[f] || 0;
        const futuro = f > h;
        const dia = Number(f.slice(8));
        celdas.push(`<button type="button" class="calor-celda n${futuro ? 'x' : nivelCalor(v, referencia)}${f === calorDia ? ' sel' : ''}${f === h ? ' hoy' : ''}" data-action="anCalorDia" data-f="${f}" ${futuro ? 'disabled' : ''} aria-label="${dia}: ${v ? money(v) : 'sin gasto'}" title="${dia} · ${v ? money(v) : 'sin gasto'}">${dia}</button>`);
    }
    const total = Object.values(dias).reduce((a, b) => a + b, 0);
    const conGasto = Object.keys(dias).length;
    const transcurridos = calorMes < mesKey() ? Number(ultimoDiaMes(calorMes).slice(8)) : Number(h.slice(8));
    let detalle = '';
    if (calorDia) {
        const delDia = txs.filter(t => t.fecha === calorDia && t.tipo === 'gasto');
        detalle = `<div class="calor-detalle"><div class="card-head" style="margin:0 0 4px;"><b>${fechaCorta(calorDia)}</b><span class="num privado">${money(dias[calorDia] || 0)}</span></div>
            ${delDia.length ? `<div class="lista">${delDia.map(txFilaHTML).join('')}</div>` : '<p class="hint">Sin gastos este día.</p>'}</div>`;
    }
    return `<div class="card-head"><h2 class="card-title nowrap">Mapa de calor</h2>
            <div class="cal-nav"><button class="icon-btn" data-action="anCalorMes" data-d="-1" aria-label="Mes anterior">${icon('chevron-right', 'rot180')}</button>
            <span class="card-meta">${nombreMesAnio(calorMes)}</span>
            <button class="icon-btn" data-action="anCalorMes" data-d="1" aria-label="Mes siguiente" ${calorMes >= mesKey() ? 'disabled' : ''}>${icon('chevron-right')}</button></div></div>
        <p class="hint" style="margin:0 0 10px;"><span class="privado">${money(total)}</span> en ${conGasto} día${conGasto === 1 ? '' : 's'} con gasto · ${Math.max(0, transcurridos - conGasto)} sin gastar</p>
        <div class="calor-semana">${['L', 'M', 'M', 'J', 'V', 'S', 'D'].map(d => `<span>${d}</span>`).join('')}</div>
        <div class="calor">${celdas.join('')}</div>
        <div class="calor-escala"><span>Menos</span>${[0, 1, 2, 3, 4].map(n => `<i class="calor-celda n${n}"></i>`).join('')}<span>Más</span></div>
        ${detalle}`;
}

// ---------- Por etiqueta ----------
function etiquetasHTML() {
    const grupos = porEtiqueta(sel.transacciones());
    if (!grupos.length) return '';
    const max = grupos[0].total || 1;
    return `<section class="card" style="margin-top:14px;">
        <div class="card-head"><h2 class="card-title">Por etiqueta</h2><span class="card-meta">Todo el historial</span></div>
        <div class="lista">${grupos.slice(0, 8).map(g => `<a class="fila fila-link" href="#/movimientos?etiqueta=${encodeURIComponent(g.etiqueta)}">
            <div class="fila-ico">${icon('tag')}</div>
            <div class="fila-body"><div class="comp-top"><span class="fila-titulo">#${escapeHtml(g.etiqueta)}</span><span class="num privado">${money(g.total)}</span></div>
                <div class="barra sm"><i style="width:${g.total / max * 100}%"></i></div>
                <div class="fila-sub">${g.veces} gasto${g.veces === 1 ? '' : 's'} · ${g.desde === g.hasta ? fechaCorta(g.desde) : `${fechaCorta(g.desde)} – ${fechaCorta(g.hasta)}`}</div></div>
        </a>`).join('')}</div>
    </section>`;
}

function resumenMesHTML() {
    const pasado = sumarMeses(mesKey(), -1);
    return `<button class="card resumen-cta" data-action="anResumen" data-mes="${pasado}">
        <span class="resumen-cta-ico">${icon('sparkle')}</span>
        <span class="resumen-cta-txt"><b>Tu ${nombreMes(pasado).toLowerCase()} en resumen</b><small>Tlaco te cuenta cómo te fue</small></span>
        ${icon('chevron-right', 'chev')}</button>`;
}

export function render() {
    const txs = sel.transacciones();
    if (!txs.length) return `<section class="card">${vacioHTML('bar-chart', 'Registra movimientos para ver tu análisis.')}</section>`;
    const serie = serieMensual(txs, meses);
    const ins = insightPrincipal(txs);
    const mesesExport = ultimosMeses(12, mesKey()).reverse();
    return `
        <div class="seg" style="max-width:260px; margin-bottom:14px;">${[6, 12].map(n => `<button class="${meses === n ? 'activo' : ''}" data-action="anMeses" data-n="${n}">${n} meses</button>`).join('')}</div>
        ${ins ? `<div class="insight">${icon('sparkle')}<p>Tu gasto en <b>${escapeHtml(sel.categoria(ins.categoriaId).nombre)}</b> ${ins.variacion >= 0 ? 'subió' : 'bajó'} <b class="${ins.variacion >= 0 ? 'neg' : 'pos'}">${pct(Math.abs(ins.variacion))}</b> respecto al mes pasado.</p></div>` : ''}
        ${resumenMesHTML()}
        ${kpisHTML(serie)}
        <section class="card" style="margin-top:14px;">
            <div class="card-head"><h2 class="card-title">Tu dinero en total</h2><span class="card-meta">Lo que tienes menos lo que debes, al cierre de cada mes</span></div>
            <div class="grafica" style="height:220px;"><canvas id="an-neto" aria-label="Tu dinero en total por mes"></canvas></div>
        </section>
        <section class="card" style="margin-top:14px;">
            <div class="card-head"><h2 class="card-title">Ingresos vs. gastos</h2><span class="card-meta">Por mes</span></div>
            <div class="leyenda"><span><i style="background:var(--series-1)"></i>Ingresos</span><span><i style="background:var(--series-2)"></i>Gastos</span></div>
            <div class="grafica" style="height:230px;"><canvas id="an-flujo" aria-label="Ingresos y gastos por mes"></canvas></div>
            <details class="tabla-datos"><summary>Ver tabla</summary>
                <table><thead><tr><th>Mes</th><th>Ingresos</th><th>Gastos</th><th>Balance</th></tr></thead><tbody>
                ${serie.slice().reverse().map(m => `<tr><td>${nombreMesAnio(m.mes)}</td><td class="num privado">${money(m.ingresos)}</td><td class="num privado">${money(m.gastos)}</td><td class="num privado ${m.balance >= 0 ? 'pos' : 'neg'}">${money(m.balance)}</td></tr>`).join('')}
                </tbody></table></details>
        </section>
        ${anualHTML()}
        <section class="card" style="margin-top:14px;" id="an-calor">${calorHTML()}</section>
        <section class="card" style="margin-top:14px;">
            <div class="card-head"><h2 class="card-title">Categorías</h2><span class="card-meta">Este mes vs. promedio de 3 meses</span></div>
            <div class="leyenda"><span><i style="background:var(--accent)"></i>Este mes</span><span><i style="background:var(--line-strong)"></i>Promedio</span></div>
            ${categoriasHTML()}
        </section>
        ${etiquetasHTML()}
        <div style="margin-top:14px;">${topHTML()}</div>
        <section class="card" style="margin-top:14px;">
            <div class="card-head"><h2 class="card-title">Exportar</h2></div>
            <div class="export">
                <select id="an-mes" aria-label="Mes del estado de cuenta">${mesesExport.map(k => `<option value="${k}">${nombreMesAnio(k)}</option>`).join('')}</select>
                <button class="btn btn-soft" data-action="anPDF">${icon('file-text')}Estado de cuenta PDF</button>
                <button class="btn btn-soft" data-action="anCSV">${icon('table')}Movimientos CSV</button>
            </div>
        </section>`;
}

export function montar() {
    if (!sel.transacciones().length) return;
    const neto = seriePatrimonio(sel.cuentas(), sel.transacciones(), meses);
    lineaPatrimonio(document.getElementById('an-neto'), neto.map(s => nombreMes(s.mes, 'short')), neto.map(s => s.neto));
    const serie = serieMensual(sel.transacciones(), meses);
    barrasIngresosGastos(document.getElementById('an-flujo'), serie.map(m => nombreMes(m.mes, 'short')), serie.map(m => m.ingresos), serie.map(m => m.gastos));
    const c = comparativoAnual(sel.transacciones());
    lineasAnual(document.getElementById('an-anual'), MESES_CORTOS, c.serieActual, c.serieAnterior, c.anio);
}

const repintarCalor = () => { const el = document.getElementById('an-calor'); if (el) el.innerHTML = calorHTML(); };
on('anCalorMes', (el) => { calorMes = sumarMeses(calorMes, Number(el.dataset.d)); calorDia = null; repintarCalor(); });
on('anCalorDia', (el) => { calorDia = calorDia === el.dataset.f ? null : el.dataset.f; repintarCalor(); });

on('anMeses', (el) => { meses = Number(el.dataset.n); const v = document.getElementById('vista'); v.innerHTML = render(); montar(); });
on('anPDF', async () => {
    try { await generarPDF(document.getElementById('an-mes').value); toast('Estado de cuenta descargado'); }
    catch (e) { toast(e.message, { tipo: 'error' }); }
});
on('anCSV', () => { exportarCSV(); toast('Movimientos exportados'); });
