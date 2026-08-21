import { state, todasLasCategorias, getIconCategoria } from '../state.js';
import { money, moneyRounded } from '../utils/format.js';
import { renderPresupuestoDonut } from '../ui/charts.js';

const GRADIENTES = [
    'linear-gradient(135deg, #7c3aed, #5b21b6)',
    'linear-gradient(135deg, #059669, #047857)',
    'linear-gradient(135deg, #d97706, #b45309)',
    'linear-gradient(135deg, #db2777, #9d174d)',
    'linear-gradient(135deg, #0284c7, #075985)',
    'linear-gradient(135deg, #14b8a6, #0f766e)',
];

export function renderFormularioPresupuestos() {
    const cats = todasLasCategorias();
    document.getElementById('contenedorInputsPresupuesto').innerHTML = cats.map(c => {
        const val = state.presupuestos[c] || '';
        return `<div class="field"><label>${getIconCategoria(c)} ${c}</label><input type="number" data-cat="${c}" value="${val}" placeholder="$0" step="0.01"></div>`;
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
            grid.innerHTML = `<div class="empty-state" style="width:100%;"><span class="icon">📊</span>Aún no tienes límites definidos. Configúralos abajo.</div>`;
            globalCard.style.display = 'none';
            return;
        }

        let totalAsignado = 0, totalGastado = 0;
        grid.innerHTML = activas.map((c, i) => {
            const limite = Number(state.presupuestos[c]) || 0;
            const gastado = Number(gastosPorCat[c]) || 0;
            totalAsignado += limite; totalGastado += gastado;
            const pct = limite > 0 ? (gastado / limite) * 100 : 0;
            return `<div class="budget-item" style="background:${GRADIENTES[i % GRADIENTES.length]};">
                <div class="bg-shape" style="width:110px;height:110px;top:-35px;left:-35px;"></div>
                <div class="bg-shape" style="width:70px;height:70px;bottom:-15px;right:-15px;"></div>
                <div class="budget-canvas-wrap"><canvas id="p-chart-${i}"></canvas><div class="budget-icon">${getIconCategoria(c)}</div></div>
                <div class="budget-title">${c}</div>
                <div class="budget-amounts">${moneyRounded(gastado)} / ${moneyRounded(limite)}</div>
                <div class="budget-pct" style="${pct > 100 ? 'color:#fecaca;' : ''}">${pct.toFixed(0)}%</div>
            </div>`;
        }).join('');

        activas.forEach((c, i) => {
            const limite = Number(state.presupuestos[c]) || 0;
            const gastado = Number(gastosPorCat[c]) || 0;
            renderPresupuestoDonut(`p-chart-${i}`, gastado, limite);
        });

        globalCard.style.display = 'block';
        document.getElementById('globalPresupText').innerText = `${moneyRounded(totalGastado)} / ${moneyRounded(totalAsignado)}`;
        const globalPct = totalAsignado > 0 ? (totalGastado / totalAsignado) * 100 : 0;
        const fill = document.getElementById('globalPresupBar');
        fill.style.width = Math.min(globalPct, 100) + '%';
        fill.style.background = globalPct > 100 ? 'var(--danger)' : (globalPct > 80 ? 'var(--warning)' : 'var(--primary)');
    } catch (err) { console.error(err); }
}
