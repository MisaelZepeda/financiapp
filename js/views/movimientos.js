// Movimientos: filtros en fichas (tipo, cuenta, categoría, mes) y búsqueda.

import { sel } from '../core/store.js';
import { on } from '../core/eventos.js';
import { icon } from '../lib/icons.js';
import { money, escapeHtml, nombreMesAnio } from '../lib/format.js';
import { txAgrupadasHTML, vacioHTML } from '../components/piezas.js';
import { mesKey, ultimosMeses } from '../domain/fechas.js';

const f = { tipo: 'todos', cuentaId: '', categoriaId: '', mes: '', q: '', limite: 80 };

export const titulo = () => ({ titulo: 'Movimientos' });

// Los parámetros de la URL (p. ej. ?cuenta=…) fijan filtros al entrar.
export function alEntrar(params) {
    if (params.cuenta !== undefined) { Object.assign(f, { cuentaId: params.cuenta, tipo: 'todos', categoriaId: '', mes: '', q: '' }); }
    if (params.categoria !== undefined) { Object.assign(f, { categoriaId: params.categoria, tipo: 'gasto', cuentaId: '', q: '' }); }
    if (params.mes !== undefined) f.mes = params.mes;
    f.limite = 80;
}

function filtradas() {
    const q = f.q.trim().toLowerCase();
    return sel.transacciones().filter(t => {
        if (f.tipo !== 'todos' && t.tipo !== f.tipo) return false;
        if (f.cuentaId && t.cuentaId !== f.cuentaId && t.cuentaDestinoId !== f.cuentaId) return false;
        if (f.categoriaId && t.categoriaId !== f.categoriaId) return false;
        if (f.mes && !t.fecha?.startsWith(f.mes)) return false;
        if (q) {
            const texto = `${t.desc || ''} ${sel.categoria(t.categoriaId).nombre || ''} ${sel.cuenta(t.cuentaId)?.nombre || ''} ${t.monto}`.toLowerCase();
            if (!texto.includes(q)) return false;
        }
        return true;
    });
}

function listaHTML() {
    const txs = filtradas();
    const gastos = txs.filter(t => t.tipo === 'gasto').reduce((a, t) => a + t.monto, 0);
    const ingresos = txs.filter(t => t.tipo === 'ingreso').reduce((a, t) => a + t.monto, 0);
    const resumen = `<div class="mov-resumen"><span>${txs.length} movimiento${txs.length === 1 ? '' : 's'}</span>
        ${ingresos ? `<span>Ingresos <b class="num privado pos">+${money(ingresos)}</b></span>` : ''}
        ${gastos ? `<span>Gastos <b class="num privado">${money(gastos)}</b></span>` : ''}</div>`;
    if (!txs.length) return resumen + `<div class="card">${vacioHTML('search', 'No hay movimientos con estos filtros.', hayFiltros() ? '<button class="btn btn-soft btn-sm" data-action="movLimpiar">Quitar filtros</button>' : '')}</div>`;
    return resumen + `<div class="card card-flush">${txAgrupadasHTML(txs.slice(0, f.limite))}
        ${txs.length > f.limite ? `<div style="padding:14px 18px;"><button class="btn btn-soft btn-block" data-action="movMas">Cargar más (${txs.length - f.limite})</button></div>` : ''}</div>`;
}

const hayFiltros = () => f.tipo !== 'todos' || f.cuentaId || f.categoriaId || f.mes || f.q;

function selectChip(nombre, valor, opciones, etiquetaVacia) {
    const activo = !!valor;
    return `<label class="chip chip-select ${activo ? 'activo' : ''}">
        <span>${escapeHtml(activo ? opciones.find(o => o[0] === valor)?.[1] || etiquetaVacia : etiquetaVacia)}</span>${icon('chevron-right')}
        <select data-change="movFiltro" data-f="${nombre}" aria-label="${etiquetaVacia}">
            <option value="">${etiquetaVacia}: todas</option>
            ${opciones.map(([v, t]) => `<option value="${escapeHtml(v)}" ${v === valor ? 'selected' : ''}>${escapeHtml(t)}</option>`).join('')}
        </select></label>`;
}

export function render() {
    const meses = ultimosMeses(12, mesKey()).reverse().map(k => [k, nombreMesAnio(k)]);
    return `
        <div class="search"><span>${icon('search')}</span><input type="search" placeholder="Buscar por descripción, categoría o monto" value="${escapeHtml(f.q)}" data-input="movBuscar" aria-label="Buscar movimientos"></div>
        <div class="chips chips-scroll" style="margin:12px -16px 4px;">
            ${[['todos', 'Todos'], ['gasto', 'Gastos'], ['ingreso', 'Ingresos'], ['transferencia', 'Transferencias']].map(([v, t]) => `<button class="chip ${f.tipo === v ? 'activo' : ''}" data-action="movTipo" data-v="${v}">${t}</button>`).join('')}
            ${selectChip('cuentaId', f.cuentaId, sel.cuentas().map(c => [c.id, c.nombre]), 'Cuenta')}
            ${selectChip('categoriaId', f.categoriaId, sel.categorias().map(c => [c.id, c.nombre]), 'Categoría')}
            ${selectChip('mes', f.mes, meses, 'Mes')}
            ${hayFiltros() ? `<button class="chip" data-action="movLimpiar">${icon('x')}Limpiar</button>` : ''}
        </div>
        <div id="mov-lista">${listaHTML()}</div>`;
}

const repintarLista = () => { const el = document.getElementById('mov-lista'); if (el) el.innerHTML = listaHTML(); };
const repintarTodo = () => { const v = document.getElementById('vista'); if (v) { v.innerHTML = render(); } };

on('movBuscar', (el) => { f.q = el.value; f.limite = 80; repintarLista(); }, 'input');
on('movTipo', (el) => { f.tipo = el.dataset.v; f.limite = 80; repintarTodo(); });
on('movFiltro', (el) => { f[el.dataset.f] = el.value; f.limite = 80; repintarTodo(); }, 'change');
on('movMas', () => { f.limite += 80; repintarLista(); });
on('movLimpiar', () => { Object.assign(f, { tipo: 'todos', cuentaId: '', categoriaId: '', mes: '', q: '', limite: 80 }); if (location.hash.includes('?')) location.hash = '#/movimientos'; else repintarTodo(); });
