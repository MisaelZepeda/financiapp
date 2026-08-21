import { state, todasLasCategorias, getIconCategoria } from '../state.js';
import { money, moneyRounded, escapeHtml } from '../utils/format.js';
import { icon } from '../utils/icons.js';

export function renderFormularioPresupuestos() {
    const cats = todasLasCategorias();
    document.getElementById('contenedorInputsPresupuesto').innerHTML = cats.map(c => {
        const val = state.presupuestos[c] || '';
        return `<div class="field"><label style="display:flex; align-items:center; gap:6px;">${icon(getIconCategoria(c))}${escapeHtml(c)}</label><input type="number" data-cat="${escapeHtml(c)}" value="${val}" placeholder="$0" step="0.01"></div>`;
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
            grid.innerHTML = `<div class="empty-state" style="width:100%;">${icon('bar-chart')}Aún no tienes límites definidos. Configúralos abajo.</div>`;
            globalCard.style.display = 'none';
            return;
        }

        const ANILLOS = ['var(--primary)', 'var(--secondary)', 'var(--info)', 'var(--success)'];
        let totalAsignado = 0, totalGastado = 0;
        grid.innerHTML = activas.map((c, i) => {
            const limite = Number(state.presupuestos[c]) || 0;
            const gastado = Number(gastosPorCat[c]) || 0;
            totalAsignado += limite; totalGastado += gastado;
            const pct = limite > 0 ? (gastado / limite) * 100 : 0;
            const sobregiro = pct > 100;
            const ringColor = sobregiro ? 'var(--danger)' : ANILLOS[i % ANILLOS.length];
            return `<div class="budget-item">
                <div class="budget-ring" style="--pct:${Math.min(pct, 100)}; --ring-color:${ringColor};">
                    <div class="budget-icon">${icon(getIconCategoria(c))}</div>
                </div>
                <div class="budget-title">${escapeHtml(c)}</div>
                <div class="budget-amounts tabular-nums">${moneyRounded(gastado)} / ${moneyRounded(limite)}</div>
                <div class="budget-pct ${sobregiro ? 'over' : ''}" style="${sobregiro ? '' : `color:${ringColor};`}">${pct.toFixed(0)}%</div>
            </div>`;
        }).join('');

        globalCard.style.display = 'block';
        document.getElementById('globalPresupText').innerText = `${moneyRounded(totalGastado)} / ${moneyRounded(totalAsignado)}`;
        const globalPct = totalAsignado > 0 ? (totalGastado / totalAsignado) * 100 : 0;
        const fill = document.getElementById('globalPresupBar');
        fill.style.width = Math.min(globalPct, 100) + '%';
        fill.style.background = globalPct > 100 ? 'var(--danger)' : (globalPct > 80 ? 'var(--warning)' : 'var(--primary)');
    } catch (err) { console.error(err); }
}
