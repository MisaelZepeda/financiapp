// Planear: Presupuestos, Metas y Recurrentes en una sola sección con pestañas.

import { sel } from '../core/store.js';
import { on } from '../core/eventos.js';
import * as A from '../core/actions.js';
import { icon } from '../lib/icons.js';
import { money, escapeHtml, fechaLarga, cuandoRelativo, nombreMesAnio } from '../lib/format.js';
import { vacioHTML } from '../components/piezas.js';
import { abrirHoja, cerrarHoja, toast } from '../components/capas.js';
import { resumenMes } from '../domain/analisis.js';
import { pendientes, FRECUENCIAS } from '../domain/recurrentes.js';
import { mesKey, hoyISO, ultimoDiaMes, diasEntre, aFecha } from '../domain/fechas.js';

const TABS = { presupuestos: 'Presupuestos', metas: 'Metas', recurrentes: 'Recurrentes' };

export const titulo = () => ({ titulo: 'Planear' });

// ---------- Presupuestos ----------
function presupuestosHTML() {
    const key = mesKey();
    const { porCategoria } = resumenMes(sel.transacciones(), key);
    const cats = sel.categorias();
    const con = cats.filter(c => Number(c.presupuesto) > 0);
    const sin = cats.filter(c => !(Number(c.presupuesto) > 0));
    const asignado = con.reduce((a, c) => a + Number(c.presupuesto), 0);
    const gastado = con.reduce((a, c) => a + (porCategoria[c.id] || 0), 0);
    const diasRestantes = diasEntre(hoyISO(), ultimoDiaMes(key)) + 1;
    const disponible = Math.max(0, asignado - gastado);
    const pctTotal = asignado ? gastado / asignado * 100 : 0;
    const color = (p) => p > 100 ? 'var(--neg)' : p > 85 ? 'var(--warn)' : 'var(--accent)';

    const resumen = con.length ? `<section class="card">
        <p class="card-meta">${nombreMesAnio(key)}</p>
        <p class="pres-total"><span class="num privado">${money(gastado)}</span> <span class="muted num privado">de ${money(asignado)}</span></p>
        <div class="barra"><i style="width:${Math.min(100, pctTotal)}%; background:${color(pctTotal)}"></i></div>
        <p class="hint" style="margin-top:10px;">${gastado > asignado ? `Te pasaste por <b class="neg privado">${money(gastado - asignado)}</b>.` : `Te quedan <b class="privado">${money(disponible)}</b>: unos <b class="privado">${money(disponible / diasRestantes)}</b> por día durante ${diasRestantes} día${diasRestantes === 1 ? '' : 's'}.`}</p>
    </section>` : '';

    const filas = con.map(c => {
        const g = porCategoria[c.id] || 0, p = g / c.presupuesto * 100;
        return `<div class="fila fila-link" data-action="editarCategoria" data-id="${escapeHtml(c.id)}">
            <div class="fila-ico">${icon(c.icono || 'tag')}</div>
            <div class="fila-body">
                <div class="comp-top"><span class="fila-titulo">${escapeHtml(c.nombre)}</span><span class="num ${p > 100 ? 'neg' : ''}" style="font-weight:600; font-size:13px;">${Math.round(p)}%</span></div>
                <div class="barra sm" style="margin:6px 0 4px;"><i style="width:${Math.min(100, p)}%; background:${color(p)}"></i></div>
                <div class="fila-sub"><span class="privado">${money(g)}</span> de <span class="privado">${money(c.presupuesto)}</span> · ${g > c.presupuesto ? `<span class="neg">excedido</span>` : `quedan <span class="privado">${money(c.presupuesto - g)}</span>`}</div>
            </div>
        </div>`;
    }).join('');

    return `${resumen}
        <section class="card" style="margin-top:14px;">
            <div class="card-head"><h2 class="card-title">Por categoría</h2><button class="link" data-action="editarPresupuestos">Ajustar límites</button></div>
            ${con.length ? `<div class="lista">${filas}</div>` : vacioHTML('bar-chart', 'Define cuánto quieres gastar al mes en cada categoría.', '<button class="btn btn-primary btn-sm" data-action="editarPresupuestos">Definir presupuestos</button>')}
            ${sin.length && con.length ? `<p class="lista-label" style="margin-top:14px;">Sin presupuesto</p><div class="chips">${sin.map(c => `<button class="chip chip-sm" data-action="editarCategoria" data-id="${escapeHtml(c.id)}">${icon(c.icono || 'tag')}${escapeHtml(c.nombre)}</button>`).join('')}</div>` : ''}
        </section>`;
}

on('editarPresupuestos', () => {
    abrirHoja({
        titulo: 'Presupuestos mensuales',
        html: `<form data-submit="guardarPresupuestos">
            <p class="hint" style="margin-bottom:14px;">Deja en blanco las categorías sin límite.</p>
            ${sel.categorias().map(c => `<div class="field-inline"><label for="pr-${escapeHtml(c.id)}">${icon(c.icono || 'tag')}${escapeHtml(c.nombre)}</label>
                <input id="pr-${escapeHtml(c.id)}" name="${escapeHtml(c.id)}" inputmode="decimal" placeholder="Sin límite" value="${c.presupuesto || ''}"></div>`).join('')}
            <div class="hoja-foot"><button type="submit" class="btn btn-primary">Guardar</button></div>
        </form>`,
    });
});
on('guardarPresupuestos', async (form) => {
    const mapa = {};
    [...form.elements].forEach(el => { if (el.name) mapa[el.name] = parseFloat(el.value) || 0; });
    await A.guardarPresupuestos(mapa);
    cerrarHoja(); toast('Presupuestos guardados');
}, 'submit');

// ---------- Metas ----------
function metasHTML() {
    const metas = sel.metas();
    const tarjetas = metas.map(m => {
        const p = m.montoObjetivo > 0 ? Math.min(100, m.montoActual / m.montoObjetivo * 100) : 0;
        const falta = Math.max(0, m.montoObjetivo - m.montoActual);
        let ritmo = '';
        if (m.fechaLimite && falta > 0) {
            const hoy = new Date(), fin = aFecha(m.fechaLimite);
            const mesesRest = Math.max(1, (fin.getFullYear() - hoy.getFullYear()) * 12 + (fin.getMonth() - hoy.getMonth()));
            ritmo = `<span class="privado">${money(falta / mesesRest)}</span> al mes para llegar a tiempo`;
        }
        return `<section class="card meta">
            <div class="meta-top"><div class="fila-ico tono-accent">${icon(m.icono || 'target')}</div>
                <div class="fila-body"><div class="fila-titulo">${escapeHtml(m.nombre)}</div><div class="fila-sub">${m.fechaLimite ? `Para el ${fechaLarga(m.fechaLimite)}` : 'Sin fecha límite'}</div></div>
                <button class="icon-btn" data-action="editarMeta" data-id="${escapeHtml(m.id)}" aria-label="Editar meta">${icon('edit')}</button></div>
            <p class="meta-monto"><span class="num privado">${money(m.montoActual)}</span> <span class="muted num privado">/ ${money(m.montoObjetivo)}</span></p>
            <div class="barra"><i style="width:${p}%; ${p >= 100 ? 'background:var(--pos)' : ''}"></i></div>
            <div class="meta-pie"><span>${Math.round(p)}%</span><span>${p >= 100 ? '<span class="pos">¡Meta lograda!</span>' : ritmo || `Faltan <span class="privado">${money(falta)}</span>`}</span></div>
            <div class="meta-btns"><button class="btn btn-primary btn-sm" data-action="abonarMeta" data-id="${escapeHtml(m.id)}">${icon('plus')}Abonar</button><button class="btn btn-soft btn-sm" data-action="retirarMeta" data-id="${escapeHtml(m.id)}">Retirar</button></div>
        </section>`;
    }).join('');
    return `<div class="acciones-top"><button class="btn btn-primary" data-action="nuevaMeta">${icon('plus')}Nueva meta</button></div>
        ${metas.length ? `<div class="metas-grid">${tarjetas}</div>` : `<section class="card">${vacioHTML('target', 'Aparta dinero para algo que quieras: un viaje, un fondo de emergencia, una compra grande.')}</section>`}`;
}

// ---------- Recurrentes ----------
function recurrentesHTML() {
    const recs = sel.recurrentes();
    const pend = pendientes(recs);
    const fila = (r) => {
        const pausado = r.activo === false;
        const cat = r.tipo === 'gasto' ? sel.categoria(r.categoriaId) : null;
        const esPend = pend.includes(r);
        return `<div class="fila ${pausado ? 'pausado' : ''}">
            <div class="fila-ico ${r.tipo === 'ingreso' ? 'tono-pos' : ''}">${icon(cat?.icono || 'coin')}</div>
            <div class="fila-body fila-link" data-action="editarRecurrente" data-id="${escapeHtml(r.id)}">
                <div class="fila-titulo">${escapeHtml(r.desc)}${pausado ? ' <span class="badge">Pausado</span>' : ''}</div>
                <div class="fila-sub">${FRECUENCIAS[r.frecuencia] || ''} · ${escapeHtml(sel.cuenta(r.cuentaId)?.nombre || 'Sin cuenta')} · ${pausado ? 'en pausa' : esPend ? '<span class="accent-ink">pendiente</span>' : `próximo ${cuandoRelativo(r.proximaFecha)}`}</div>
            </div>
            <div class="fila-der"><span class="num privado ${r.tipo === 'ingreso' ? 'pos' : ''}">${r.tipo === 'ingreso' ? '+' : ''}${money(r.monto)}</span></div>
            ${esPend ? `<button class="btn btn-primary btn-sm" data-action="generarRecurrente" data-id="${escapeHtml(r.id)}">Registrar</button>` : ''}
            <button class="icon-btn" data-action="pausarRecurrente" data-id="${escapeHtml(r.id)}" title="${pausado ? 'Reanudar' : 'Pausar'}" aria-label="${pausado ? 'Reanudar' : 'Pausar'}">${icon(pausado ? 'play' : 'pause')}</button>
        </div>`;
    };
    const mensualGasto = recs.filter(r => r.activo !== false && r.tipo === 'gasto').reduce((a, r) => a + r.monto * (r.frecuencia === 'semanal' ? 4.33 : r.frecuencia === 'quincenal' ? 2 : 1), 0);
    return `${pend.length ? `<div class="banner">${icon('repeat')}<p><b>${pend.length}</b> recurrente${pend.length > 1 ? 's' : ''} por registrar.</p><button class="btn btn-primary btn-sm" data-action="generarPendientes">Registrar todos</button></div>` : ''}
        <div class="acciones-top"><span class="hint">Gasto fijo aprox.: <b class="privado">${money(mensualGasto)}</b> al mes</span><button class="btn btn-primary" data-action="nuevoRecurrente">${icon('plus')}Nuevo</button></div>
        <section class="card card-flush">${recs.length ? `<div class="lista">${recs.map(fila).join('')}</div>` : vacioHTML('repeat', 'Agrega pagos que se repiten: renta, suscripciones, nómina.')}</section>`;
}

export function render({ tab = 'presupuestos' }) {
    const t = TABS[tab] ? tab : 'presupuestos';
    return `<div class="seg tabs-planear">${Object.entries(TABS).map(([k, n]) => `<a class="${k === t ? 'activo' : ''}" href="#/planear/${k}">${n}</a>`).join('')}</div>
        <div style="margin-top:14px;">${t === 'presupuestos' ? presupuestosHTML() : t === 'metas' ? metasHTML() : recurrentesHTML()}</div>`;
}

on('pausarRecurrente', async (el) => {
    const r = sel.recurrentes().find(x => x.id === el.dataset.id);
    if (!r) return;
    await A.pausarRecurrente(r.id, r.activo === false);
    toast(r.activo === false ? 'Recurrente reanudado' : 'Recurrente en pausa');
});
