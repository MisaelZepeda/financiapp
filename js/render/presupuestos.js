import { state, todasLasCategorias, getIconCategoria } from '../state.js';
import { money, moneyRounded, escapeHtml } from '../utils/format.js';
import { icon } from '../utils/icons.js';

export function renderFormularioPresupuestos() {
    const cats = todasLasCategorias();
    document.getElementById('contenedorInputsPresupuesto').innerHTML = cats.map(c => {
        const val = state.presupuestos[c] || '';
        return `<div class="field"><label>${icon(getIconCategoria(c))}${escapeHtml(c)}</label><input type="number" data-cat="${escapeHtml(c)}" value="${val}" placeholder="Sin límite" step="0.01"></div>`;
    }).join('');
}

export function renderPresupuestos() {
    try {
        renderFormularioPresupuestos();
        const cats = todasLasCategorias();
        const hoy = new Date();
        const prefijoMes = `${hoy.getFullYear()}-${(hoy.getMonth() + 1).toString().padStart(2, '0')}`;
        const txMes = state.transacciones.filter(t => t.tipo === 'gasto' && t.fecha && t.fecha.startsWith(prefijoMes));
        const gastosPorCat = {}; cats.forEach(c => gastosPorCat[c] = 0);
        txMes.forEach(t => { const cat = t.cat || 'Otros'; gastosPorCat[cat] = (gastosPorCat[cat] ?? gastosPorCat['Otros']) + Number(t.monto || 0); });

        const activas = cats.filter(c => Number(state.presupuestos[c]) > 0);
        const grid = document.getElementById('presupuestosGrid');
        const globalCard = document.getElementById('presupuestoGlobalCard');

        if (activas.length === 0) {
            grid.innerHTML = `<div class="empty-state">${icon('bar-chart')}Aún no tienes límites definidos. Asígnalos en “Ajustar límites”.</div>`;
            globalCard.style.display = 'none';
            return;
        }

        let totalAsignado = 0, totalGastado = 0;
        grid.innerHTML = activas.map(c => {
            const limite = Number(state.presupuestos[c]) || 0;
            const gastado = Number(gastosPorCat[c]) || 0;
            totalAsignado += limite; totalGastado += gastado;
            const pct = limite > 0 ? (gastado / limite) * 100 : 0;
            const sobregiro = pct > 100;
            const color = sobregiro ? 'var(--danger)' : (pct > 80 ? 'var(--warning)' : 'var(--primary)');
            return `<div class="budget-row">
                <div class="budget-row-top">
                    ${icon(getIconCategoria(c))}
                    <span class="budget-name">${escapeHtml(c)}</span>
                    <span class="budget-amounts money-blur">${moneyRounded(gastado)} de ${moneyRounded(limite)}</span>
                    <span class="budget-pct ${sobregiro ? 'over' : ''}">${pct.toFixed(0)}%</span>
                </div>
                <div class="progress-bar-track"><div class="progress-bar-fill" style="width:${Math.min(pct, 100)}%; background:${color};"></div></div>
            </div>`;
        }).join('');

        globalCard.style.display = 'block';
        document.getElementById('globalPresupText').innerHTML = `${moneyRounded(totalGastado)} <span class="text-muted" style="font-size:16px; font-weight:500;">de ${moneyRounded(totalAsignado)}</span>`;
        const globalPct = totalAsignado > 0 ? (totalGastado / totalAsignado) * 100 : 0;
        const fill = document.getElementById('globalPresupBar');
        fill.style.width = Math.min(globalPct, 100) + '%';
        fill.style.background = globalPct > 100 ? 'var(--danger)' : (globalPct > 80 ? 'var(--warning)' : 'var(--primary)');
    } catch (err) { console.error(err); }
}
