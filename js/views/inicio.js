import { sel } from '../core/store.js';
import { icon } from '../lib/icons.js';
import { money, moneyPartes, pct, escapeHtml, nombreMes, nombreMesAnio, cuandoRelativo, fechaCorta } from '../lib/format.js';
import { cuentaFilaHTML, vacioHTML, monogramaHTML } from '../components/piezas.js';
import { barrasIngresosGastos, sparkline, donaCategorias, colorSerie, MAX_SERIES } from '../components/graficas.js';
import { seriePatrimonio } from '../domain/saldos.js';
import { resumenMes, serieMensual, variacion } from '../domain/analisis.js';
import { estadoPago } from '../domain/tarjetas.js';
import { pendientes, proximos } from '../domain/recurrentes.js';
import { mesKey, sumarMeses } from '../domain/fechas.js';

export const titulo = () => {
    const nombre = (sel.perfil().nombre || '').split(' ')[0];
    return { titulo: 'Inicio', subtitulo: nombre ? `Hola, ${nombre}` : '' };
};

function heroHTML() {
    const p = sel.patrimonio();
    const serie = seriePatrimonio(sel.cuentas(), sel.transacciones(), 6);
    const antes = serie[serie.length - 2]?.neto;
    const v = variacion(p.neto, antes);
    const partes = moneyPartes(p.neto);
    const delta = v == null || !isFinite(v) ? '' : `<span class="badge ${v >= 0 ? 'badge-pos' : 'badge-neg'}">${icon(v >= 0 ? 'trending-up' : 'trending-down')}${pct(Math.abs(v), 1)} vs. mes anterior</span>`;
    return `<section class="card hero">
        <div class="hero-top">
            <div>
                <p class="card-meta">Patrimonio neto</p>
                <p class="hero-total num privado">${partes.signo}${partes.entero}<span class="cent">${partes.decimales}</span></p>
                ${delta}
            </div>
            <div class="hero-spark"><canvas id="spark-neto" aria-label="Tendencia del patrimonio"></canvas></div>
        </div>
        <div class="hero-stats">
            <div><small>Activos</small><b class="num privado">${money(p.activos)}</b></div>
            <div><small>Deudas</small><b class="num privado">${money(p.deudas)}</b></div>
            <div><small>Crédito libre</small><b class="num privado">${money(p.creditoLibre)}</b></div>
        </div>
    </section>`;
}

function cuentasHTML() {
    const cuentas = sel.cuentas();
    if (!cuentas.length) return `<section class="card">${vacioHTML('landmark', 'Agrega tu primera cuenta para empezar.', '<a class="btn btn-primary btn-sm" href="#/cuentas">Agregar cuenta</a>')}</section>`;
    const deb = cuentas.filter(c => c.tipo !== 'credito');
    const cre = cuentas.filter(c => c.tipo === 'credito');
    const bloque = (titulo, lista) => lista.length ? `<div><p class="lista-label">${titulo}</p><div class="lista">${lista.map(c => cuentaFilaHTML(c)).join('')}</div></div>` : '';
    return `<section class="card">
        <div class="card-head"><h2 class="card-title">Cuentas</h2><a class="link" href="#/cuentas">Ver todas${icon('chevron-right')}</a></div>
        <div class="cuentas-cols">${bloque('Débito y efectivo', deb)}${bloque('Crédito', cre)}</div>
    </section>`;
}

function mesHTML() {
    const key = mesKey();
    const txs = sel.transacciones();
    const act = resumenMes(txs, key), ant = resumenMes(txs, sumarMeses(key, -1));
    const delta = (a, b, subirBueno) => {
        const v = variacion(a, b);
        if (v == null || !isFinite(v)) return '<small class="muted">—</small>';
        const bueno = (v >= 0) === subirBueno;
        return `<small class="${v === 0 ? 'muted' : bueno ? 'pos' : 'neg'}">${v >= 0 ? '↑' : '↓'} ${pct(Math.abs(v))}</small>`;
    };
    return `<section class="card">
        <div class="card-head"><h2 class="card-title">Este mes</h2><span class="card-meta">${nombreMesAnio(key)}</span></div>
        <div class="kpis">
            <div class="kpi"><span class="kpi-label"><i style="background:var(--series-1)"></i>Ingresos</span><b class="num privado">${money(act.ingresos)}</b>${delta(act.ingresos, ant.ingresos, true)}</div>
            <div class="kpi"><span class="kpi-label"><i style="background:var(--series-2)"></i>Gastos</span><b class="num privado">${money(act.gastos)}</b>${delta(act.gastos, ant.gastos, false)}</div>
            <div class="kpi"><span class="kpi-label">Balance</span><b class="num privado ${act.balance > 0 ? 'pos' : act.balance < 0 ? 'neg' : ''}">${act.balance > 0 ? '+' : ''}${money(act.balance)}</b><small class="muted">vs. ${nombreMes(sumarMeses(key, -1), 'short').toLowerCase()}: ${money(ant.balance)}</small></div>
        </div>
        <div class="leyenda" style="margin-top:18px;"><span><i style="background:var(--series-1)"></i>Ingresos</span><span><i style="background:var(--series-2)"></i>Gastos</span><span class="muted">Últimos 6 meses</span></div>
        <div class="grafica" style="height:190px;"><canvas id="barras-mes" aria-label="Ingresos y gastos de los últimos 6 meses"></canvas></div>
    </section>`;
}

function proximosHTML() {
    const txs = sel.transacciones();
    const items = [];
    sel.cuentas().filter(c => c.tipo === 'credito' && c.diaPago).forEach(c => {
        const e = estadoPago(c, txs);
        if (!e || e.pago <= 0 || e.pagada) return;
        items.push({ fecha: e.fechaPago, html: `<a class="fila fila-link" href="#/cuenta/${encodeURIComponent(c.id)}">
            ${monogramaHTML(c)}
            <div class="fila-body"><div class="fila-titulo">Pago ${escapeHtml(c.nombre)}</div><div class="fila-sub">${e.pagada ? `Pagada · límite ${fechaCorta(e.fechaPago)}` : e.dias < 0 ? 'Vencida' : `Vence ${cuandoRelativo(e.fechaPago)}`}${!e.pagada && e.abonado > 0 ? ` · abonado <span class="privado">${money(e.abonado)}</span>` : ''}</div></div>
            <div class="fila-der"><span class="num privado">${money(e.pagada ? e.pago : e.pendiente)}</span>${e.pagada ? '<span class="badge badge-pos">Pagada</span>' : e.dias <= 3 ? `<span class="badge ${e.dias < 0 ? 'badge-neg' : 'badge-warn'}">${e.dias < 0 ? 'Atrasado' : e.dias === 0 ? 'Hoy' : `${e.dias} d`}</span>` : ''}</div>
        </a>`, prioridad: e.pagada ? 2 : 0 });
    });
    const recs = sel.recurrentes();
    const pend = pendientes(recs);
    pend.forEach(rec => items.push({ fecha: rec.proximaFecha, prioridad: 0, html: filaRec(rec, true) }));
    proximos(recs, new Date(), 10).forEach(rec => items.push({ fecha: rec.proximaFecha, prioridad: 1, html: filaRec(rec, false) }));
    items.sort((a, b) => a.prioridad - b.prioridad || a.fecha.localeCompare(b.fecha));
    return `<section class="card">
        <div class="card-head"><h2 class="card-title">Próximos pagos</h2>${pend.length > 1 ? `<button class="link" data-action="generarPendientes">Registrar todos (${pend.length})</button>` : '<a class="link" href="#/planear/recurrentes">Recurrentes' + icon('chevron-right') + '</a>'}</div>
        ${items.length ? `<div class="lista">${items.map(i => i.html).join('')}</div>` : vacioHTML('calendar', 'Nada pendiente en los próximos 10 días.')}
    </section>`;
}

function filaRec(rec, pendiente) {
    const cat = rec.tipo === 'gasto' ? sel.categoria(rec.categoriaId) : null;
    return `<div class="fila">
        <div class="fila-ico ${rec.tipo === 'ingreso' ? 'tono-pos' : ''}">${icon(cat?.icono || 'coin')}</div>
        <div class="fila-body"><div class="fila-titulo">${escapeHtml(rec.desc)}</div><div class="fila-sub">${pendiente ? `Pendiente desde ${cuandoRelativo(rec.proximaFecha).replace('hace ', '')}` : `Programado ${cuandoRelativo(rec.proximaFecha)}`} · ${escapeHtml(sel.cuenta(rec.cuentaId)?.nombre || 'Sin cuenta')}</div></div>
        <div class="fila-der"><span class="num privado ${rec.tipo === 'ingreso' ? 'pos' : ''}">${rec.tipo === 'ingreso' ? '+' : ''}${money(rec.monto)}</span>
            ${pendiente ? `<button class="btn btn-primary btn-sm" data-action="generarRecurrente" data-id="${escapeHtml(rec.id)}" style="margin-top:4px;">Registrar</button>` : ''}</div>
    </div>`;
}

// Categorías del mes; si hay más que colores, las menores se agrupan en "Otras".
export function datosCategoriasMes(key = mesKey()) {
    const { porCategoria, gastos } = resumenMes(sel.transacciones(), key);
    let filas = Object.entries(porCategoria).map(([id, monto]) => ({ id, monto, nombre: sel.categoria(id).nombre, icono: sel.categoria(id).icono, color: colorSerie(sel.indiceCategoria(id)) }))
        .sort((a, b) => b.monto - a.monto);
    // Color por categoría estable; si su índice pasa del máximo, gris neutro.
    filas.forEach(f => { if (sel.indiceCategoria(f.id) >= MAX_SERIES) f.color = 'var(--line-strong)'; });
    if (filas.length > MAX_SERIES) {
        const resto = filas.slice(MAX_SERIES - 1);
        filas = [...filas.slice(0, MAX_SERIES - 1), { id: '_otras', nombre: 'Otras', icono: 'box', monto: resto.reduce((a, f) => a + f.monto, 0), color: 'var(--line-strong)' }];
    }
    return { filas, total: gastos };
}

function categoriasHTML() {
    const { filas, total } = datosCategoriasMes();
    return `<section class="card">
        <div class="card-head"><h2 class="card-title">Gastos por categoría</h2><a class="link" href="#/analisis">Análisis${icon('chevron-right')}</a></div>
        <div class="dona-layout">
            <div class="dona"><canvas id="dona-cat" aria-label="Gastos por categoría"></canvas></div>
            <ul class="leyenda-lista">${filas.length ? filas.map(f => `<li><i style="background:${f.color}"></i><span class="ll-nombre">${escapeHtml(f.nombre)}</span><span class="num privado">${money(f.monto)}</span><span class="ll-pct num">${total ? Math.round(f.monto / total * 100) : 0}%</span></li>`).join('') : '<li class="muted">Sin gastos este mes.</li>'}</ul>
        </div>
    </section>`;
}

export function render() {
    return `${heroHTML()}
        <div class="stack" style="margin-top:14px;">
            ${cuentasHTML()}
            ${mesHTML()}
            <div class="grid-2">${proximosHTML()}${categoriasHTML()}</div>
        </div>`;
}

export function montar() {
    const serie = seriePatrimonio(sel.cuentas(), sel.transacciones(), 6);
    sparkline(document.getElementById('spark-neto'), serie.map(s => s.neto));
    const meses = serieMensual(sel.transacciones(), 6);
    barrasIngresosGastos(document.getElementById('barras-mes'), meses.map(m => nombreMes(m.mes, 'short')), meses.map(m => m.ingresos), meses.map(m => m.gastos));
    const { filas, total } = datosCategoriasMes();
    const resuelto = filas.map(f => ({ ...f, color: f.color.startsWith('var(') ? getComputedStyle(document.documentElement).getPropertyValue(f.color.slice(4, -1)).trim() : f.color }));
    donaCategorias(document.getElementById('dona-cat'), resuelto, total);
}
