import { state } from '../state.js';
import { money, escapeHtml } from '../utils/format.js';
import { icon } from '../utils/icons.js';
import { accountRowHTML } from '../ui/bank-card.js';
import { renderDonutGastos, renderBarAnual, colorSerie, MAX_SERIES } from '../ui/charts.js';

let yaAnimo = false;

function animateValue(el, start, end, duration) {
    if (!el) return;
    const t0 = performance.now();
    const step = (now) => {
        const progress = Math.min((now - t0) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        el.innerHTML = money(eased * (end - start) + start);
        if (progress < 1) requestAnimationFrame(step); else el.innerHTML = money(end);
    };
    requestAnimationFrame(step);
}

const FRASES_NEUTRAS = ["Resumen de tu capital neto al día de hoy.", "El panorama general de todas tus cuentas.", "Aquí tienes el balance total de tu patrimonio.", "Listo para comenzar a registrar los movimientos del mes."];
const FRASES_ALERTA = ["Atención: tus gastos del mes superan a tus ingresos.", "Es un buen momento para revisar tus presupuestos.", "Tu ritmo de gasto mensual está por encima de lo habitual.", "Cuidado: este mes el flujo de salida es mayor al de entrada."];
const FRASES_POSITIVAS = ["Excelente: tu balance mensual se mantiene en verde.", "Vas por muy buen camino construyendo tu capital.", "Tus buenos hábitos financieros están dando frutos.", "Tienes un ritmo financiero muy saludable este mes.", "Gran trabajo: mantienes tus gastos bajo control."];
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Variación contra el mes anterior. `subirEsBueno` decide el color: para
// ingresos subir es bueno; para gastos, subir es malo.
function deltaHTML(pct, subirEsBueno) {
    const sube = pct >= 0;
    const bueno = sube === subirEsBueno;
    const color = pct === 0 ? 'var(--text-muted)' : (bueno ? 'var(--success)' : 'var(--danger)');
    return `<span style="color:${color}; display:inline-flex; align-items:center; gap:2px;">${icon(sube ? 'trending-up' : 'trending-down')}${Math.abs(pct).toFixed(1)}%</span>`;
}

export function renderResumen() {
    const cuentasDebito = state.cuentas.filter(c => c.tipo === 'debito' || c.tipo === 'efectivo').sort((a, b) => b.saldo - a.saldo);
    const cuentasCredito = state.cuentas.filter(c => c.tipo === 'credito').sort((a, b) => b.saldo - a.saldo);

    let tengo = 0, debo = 0, capacidad = 0;
    cuentasDebito.forEach(c => tengo += c.saldo);
    cuentasCredito.forEach(c => { debo += c.saldo; capacidad += (c.limite > 0 ? c.limite - c.saldo : 0); });
    const patrimonio = tengo - debo;

    document.getElementById('railDebitos').innerHTML = cuentasDebito.map(c => accountRowHTML(c, { mostrarCompartir: c.tipo === 'debito' })).join('') || `<div class="empty-state">Aún no agregas cuentas de débito o efectivo.</div>`;
    document.getElementById('railCreditos').innerHTML = cuentasCredito.map(c => accountRowHTML(c)).join('') || `<div class="empty-state">Aún no agregas tarjetas de crédito.</div>`;

    const elTotal = document.getElementById('heroTotal');
    const elTengo = document.getElementById('heroTengo');
    const elDebo = document.getElementById('heroDebo');
    const elCap = document.getElementById('heroCapacidad');

    if (!yaAnimo) {
        elTotal.innerText = '$0.00'; elTengo.innerText = '$0.00'; elDebo.innerText = '$0.00'; elCap.innerText = '$0.00';
        setTimeout(() => {
            animateValue(elTotal, 0, patrimonio, 900);
            animateValue(elTengo, 0, tengo, 900);
            animateValue(elDebo, 0, debo, 900);
            animateValue(elCap, 0, capacidad, 900);
        }, 100);
        yaAnimo = true;
    } else {
        elTotal.innerText = money(patrimonio); elTengo.innerText = money(tengo); elDebo.innerText = money(debo); elCap.innerText = money(capacidad);
    }

    const hoy = new Date();
    const mesLabel = document.getElementById('mesActualLabel');
    if (mesLabel) {
        const nombre = hoy.toLocaleString('es-MX', { month: 'long', year: 'numeric' });
        mesLabel.innerText = nombre.charAt(0).toUpperCase() + nombre.slice(1);
    }

    const prefijoMes = `${hoy.getFullYear()}-${(hoy.getMonth() + 1).toString().padStart(2, '0')}`;
    const txMes = state.transacciones.filter(t => t.fecha && t.fecha.startsWith(prefijoMes));
    const gT = txMes.filter(t => t.tipo === 'gasto').reduce((a, b) => a + Number(b.monto || 0), 0);
    const iT = txMes.filter(t => t.tipo === 'ingreso').reduce((a, b) => a + Number(b.monto || 0), 0);
    document.getElementById('homeIngresos').innerText = money(iT);
    document.getElementById('homeGastos').innerText = money(gT);

    const balance = iT - gT;
    const elBalance = document.getElementById('homeBalance');
    if (elBalance) {
        elBalance.innerText = `${balance >= 0 ? '+' : '−'}${money(Math.abs(balance))}`;
        elBalance.style.color = balance > 0 ? 'var(--success)' : (balance < 0 ? 'var(--danger)' : '');
    }

    const prevDate = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
    const prefijoPrev = `${prevDate.getFullYear()}-${(prevDate.getMonth() + 1).toString().padStart(2, '0')}`;
    const txPrev = state.transacciones.filter(t => t.fecha && t.fecha.startsWith(prefijoPrev));
    const gPrev = txPrev.filter(t => t.tipo === 'gasto').reduce((a, b) => a + Number(b.monto || 0), 0);
    const iPrev = txPrev.filter(t => t.tipo === 'ingreso').reduce((a, b) => a + Number(b.monto || 0), 0);
    const pctIng = iPrev > 0 ? ((iT - iPrev) / iPrev) * 100 : (iT > 0 ? 100 : 0);
    const pctGas = gPrev > 0 ? ((gT - gPrev) / gPrev) * 100 : (gT > 0 ? 100 : 0);
    document.getElementById('pctIngresos').innerHTML = deltaHTML(pctIng, true);
    document.getElementById('pctGastos').innerHTML = deltaHTML(pctGas, false);

    const mensajeEl = document.getElementById('heroMessage');
    if (mensajeEl) {
        if (iT === 0 && gT === 0) mensajeEl.innerText = pick(FRASES_NEUTRAS);
        else if (gT > iT) mensajeEl.innerText = pick(FRASES_ALERTA);
        else mensajeEl.innerText = pick(FRASES_POSITIVAS);
    }

    // Pago para no generar intereses
    let tarjetasHtml = '', totalEstimado = 0;
    cuentasCredito.forEach(c => {
        let pago = 0;
        const diaCorte = c.diaCorte || 1;
        let lastCorte = new Date(hoy.getFullYear(), hoy.getMonth(), diaCorte);
        if (hoy.getDate() < diaCorte) lastCorte.setMonth(lastCorte.getMonth() - 1);
        state.transacciones.filter(t => t.tipo === 'gasto' && t.cuentaId == c.id).forEach(t => {
            const txDate = new Date(t.fecha + 'T12:00:00');
            if (t.isMSI && t.meses > 1) {
                const meses = (hoy.getFullYear() - txDate.getFullYear()) * 12 + (hoy.getMonth() - txDate.getMonth());
                if (meses >= 0 && meses < t.meses) pago += (t.monto / t.meses);
            } else if (txDate >= lastCorte) pago += t.monto;
        });
        // El cashback abonado en este periodo se descuenta del pago.
        state.transacciones.filter(t => t.tipo === 'ingreso' && t.cuentaId == c.id && new Date(t.fecha + 'T12:00:00') >= lastCorte)
            .forEach(t => pago -= Number(t.monto || 0));
        pago = Math.max(0, pago);
        totalEstimado += pago;
        tarjetasHtml += `<div class="simple-row">
            <span>${escapeHtml(c.nombre)}${c.diaPago ? `<span class="text-muted"> · día ${c.diaPago}</span>` : ''}</span>
            <b class="money-blur tabular-nums">${money(pago)}</b>
        </div>`;
    });
    const listaTDC = document.getElementById('listaPagosTDC');
    if (listaTDC) listaTDC.innerHTML = tarjetasHtml || `<div class="empty-state">No hay pagos pendientes este periodo.</div>`;
    const totalTDC = document.getElementById('totalEstimadoTDC');
    if (totalTDC) totalTDC.innerText = money(totalEstimado);

    // Gastos por categoría: la dona y su leyenda comparten el mismo orden y
    // color por categoría (de mayor a menor monto).
    const cats = {};
    txMes.filter(t => t.tipo === 'gasto').forEach(t => { const k = t.cat || 'Otros'; cats[k] = (cats[k] || 0) + Number(t.monto || 0); });
    let ordenadas = Object.entries(cats).sort((a, b) => b[1] - a[1]);
    // Más categorías que colores de la paleta: las más pequeñas se agrupan
    // en "Otros" (nunca se repite ni se inventa un color).
    if (ordenadas.length > MAX_SERIES) {
        const principales = ordenadas.filter(([c]) => c !== 'Otros').slice(0, MAX_SERIES - 1);
        const resto = gT - principales.reduce((a, [, m]) => a + m, 0);
        ordenadas = [...principales, ['Otros', resto]];
    }
    renderDonutGastos('chartGastos', ordenadas, gT);
    const leyenda = document.getElementById('leyendaGastos');
    if (leyenda) {
        leyenda.innerHTML = ordenadas.length
            ? ordenadas.map(([cat, monto], i) => `<li><i style="background:${colorSerie(i)};"></i><span class="lg-name">${escapeHtml(cat)}</span><span class="lg-val money-blur">${money(monto)}</span><span class="lg-pct">${gT > 0 ? ((monto / gT) * 100).toFixed(0) : 0}%</span></li>`).join('')
            : `<li class="empty-state" style="display:flex; border:none;">${icon('bar-chart')}Sin gastos registrados este mes.</li>`;
    }

    const labels = []; const dataIng = [0, 0, 0, 0, 0, 0]; const dataGas = [0, 0, 0, 0, 0, 0];
    for (let i = 5; i >= 0; i--) {
        const m = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1).toLocaleString('es-MX', { month: 'short' }).replace('.', '');
        labels.push(m.charAt(0).toUpperCase() + m.slice(1));
    }
    state.transacciones.forEach(t => {
        if (!t.fecha) return;
        const d = new Date(t.fecha + 'T12:00:00');
        const diff = (hoy.getFullYear() - d.getFullYear()) * 12 + (hoy.getMonth() - d.getMonth());
        if (diff >= 0 && diff < 6) { const idx = 5 - diff; if (t.tipo === 'ingreso') dataIng[idx] += Number(t.monto); if (t.tipo === 'gasto') dataGas[idx] += Number(t.monto); }
    });
    renderBarAnual('chartAnual', labels, dataIng, dataGas);
}
