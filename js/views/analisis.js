// Análisis: patrimonio en el tiempo, flujo mensual, categorías contra su
// promedio, gastos grandes y frecuentes, tasa de ahorro y exportación.

import { sel } from '../core/store.js';
import { on } from '../core/eventos.js';
import { icon } from '../lib/icons.js';
import { money, pct, escapeHtml, nombreMes, nombreMesAnio, fechaCorta } from '../lib/format.js';
import { vacioHTML } from '../components/piezas.js';
import { lineaPatrimonio, barrasIngresosGastos } from '../components/graficas.js';
import { seriePatrimonio } from '../domain/saldos.js';
import { serieMensual, comparativaCategorias, gastosMasGrandes, gastosFrecuentes, tasaAhorro, insightPrincipal } from '../domain/analisis.js';
import { mesKey, ultimosMeses } from '../domain/fechas.js';
import { generarPDF, exportarCSV } from '../lib/exportar.js';
import { toast } from '../components/capas.js';

let meses = 12;

export const titulo = () => ({ titulo: 'Análisis' });

function kpisHTML(serie) {
    const actual = serie[serie.length - 1];
    const completos = serie.slice(0, -1).filter(m => m.ingresos || m.gastos);
    const prom = (k) => completos.length ? completos.reduce((a, m) => a + m[k], 0) / completos.length : 0;
    const ahorroMes = tasaAhorro(actual);
    const ahorroProm = tasaAhorro({ ingresos: prom('ingresos'), gastos: prom('gastos') });
    return `<div class="kpi-grid">
        <div class="card kpi-card"><small>Tasa de ahorro del mes</small><b class="num ${ahorroMes > 0 ? 'pos' : ahorroMes < 0 ? 'neg' : ''}">${pct(ahorroMes)}</b><span class="muted">Promedio: ${pct(ahorroProm)}</span></div>
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

export function render() {
    const txs = sel.transacciones();
    if (!txs.length) return `<section class="card">${vacioHTML('bar-chart', 'Registra movimientos para ver tu análisis.')}</section>`;
    const serie = serieMensual(txs, meses);
    const ins = insightPrincipal(txs);
    const mesesExport = ultimosMeses(12, mesKey()).reverse();
    return `
        <div class="seg" style="max-width:260px; margin-bottom:14px;">${[6, 12].map(n => `<button class="${meses === n ? 'activo' : ''}" data-action="anMeses" data-n="${n}">${n} meses</button>`).join('')}</div>
        ${ins ? `<div class="insight">${icon('sparkle')}<p>Tu gasto en <b>${escapeHtml(sel.categoria(ins.categoriaId).nombre)}</b> ${ins.variacion >= 0 ? 'subió' : 'bajó'} <b class="${ins.variacion >= 0 ? 'neg' : 'pos'}">${pct(Math.abs(ins.variacion))}</b> respecto al mes pasado.</p></div>` : ''}
        ${kpisHTML(serie)}
        <section class="card" style="margin-top:14px;">
            <div class="card-head"><h2 class="card-title">Patrimonio neto</h2><span class="card-meta">Cierre de cada mes</span></div>
            <div class="grafica" style="height:220px;"><canvas id="an-neto" aria-label="Patrimonio neto por mes"></canvas></div>
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
        <section class="card" style="margin-top:14px;">
            <div class="card-head"><h2 class="card-title">Categorías</h2><span class="card-meta">Este mes vs. promedio de 3 meses</span></div>
            <div class="leyenda"><span><i style="background:var(--accent)"></i>Este mes</span><span><i style="background:var(--line-strong)"></i>Promedio</span></div>
            ${categoriasHTML()}
        </section>
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
}

on('anMeses', (el) => { meses = Number(el.dataset.n); const v = document.getElementById('vista'); v.innerHTML = render(); montar(); });
on('anPDF', async () => {
    try { await generarPDF(document.getElementById('an-mes').value); toast('Estado de cuenta descargado'); }
    catch (e) { toast(e.message, { tipo: 'error' }); }
});
on('anCSV', () => { exportarCSV(); toast('Movimientos exportados'); });
