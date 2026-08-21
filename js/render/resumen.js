import { state } from '../state.js';
import { money } from '../utils/format.js';
import { bankCardHTML } from '../ui/bank-card.js';
import { renderPatrimonioChart, renderSparkline, renderDonutGastos, renderBarAnual } from '../ui/charts.js';

let yaAnimo = false;

function animateValue(el, start, end, duration) {
    if (!el) return;
    const t0 = performance.now();
    const step = (now) => {
        const progress = Math.min((now - t0) / duration, 1);
        el.innerHTML = money(progress * (end - start) + start);
        if (progress < 1) requestAnimationFrame(step); else el.innerHTML = money(end);
    };
    requestAnimationFrame(step);
}

const FRASES_NEUTRAS = ["Resumen de tu capital neto al día de hoy.", "El panorama general de todas tus cuentas.", "Aquí tienes el balance total de tu patrimonio.", "Listo para comenzar a registrar los movimientos del mes."];
const FRASES_ALERTA = ["⚠️ Atención: tus gastos del mes superan a tus ingresos.", "⚠️ Es un buen momento para revisar tus presupuestos.", "⚠️ Tu ritmo de gasto mensual está por encima de lo habitual.", "⚠️ Cuidado: este mes el flujo de salida es mayor al de entrada."];
const FRASES_POSITIVAS = ["✅ ¡Excelente! Tu balance mensual se mantiene en verde.", "✅ Vas por muy buen camino construyendo tu capital.", "✅ Tus buenos hábitos financieros están dando frutos.", "✅ Tienes un ritmo financiero muy saludable este mes.", "✅ ¡Gran trabajo! Mantienes tus gastos bajo control."];
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export function renderResumen() {
    const cuentasDebito = state.cuentas.filter(c => c.tipo === 'debito' || c.tipo === 'efectivo').sort((a, b) => b.saldo - a.saldo);
    const cuentasCredito = state.cuentas.filter(c => c.tipo === 'credito').sort((a, b) => b.saldo - a.saldo);

    let tengo = 0, debo = 0, capacidad = 0;
    cuentasDebito.forEach(c => tengo += c.saldo);
    cuentasCredito.forEach(c => { debo += c.saldo; capacidad += (c.limite > 0 ? c.limite - c.saldo : 0); });
    const patrimonio = tengo - debo;

    document.getElementById('railDebitos').innerHTML = cuentasDebito.map(c => bankCardHTML(c, { mostrarCompartir: true })).join('') || `<div class="empty-state" style="padding:0 10px;">Aún no agregas cuentas de débito.</div>`;
    document.getElementById('railCreditos').innerHTML = cuentasCredito.map(c => bankCardHTML(c, { mostrarCompartir: false })).join('') || `<div class="empty-state" style="padding:0 10px;">Aún no agregas tarjetas de crédito.</div>`;

    const elTotal = document.getElementById('heroTotal');
    const elTengo = document.getElementById('heroTengo');
    const elDebo = document.getElementById('heroDebo');
    const elCap = document.getElementById('heroCapacidad');

    if (!yaAnimo) {
        elTotal.innerText = '$0.00'; elTengo.innerText = '$0.00'; elDebo.innerText = '$0.00'; elCap.innerText = '$0.00';
        setTimeout(() => {
            animateValue(elTotal, 0, patrimonio, 1200);
            animateValue(elTengo, 0, tengo, 1200);
            animateValue(elDebo, 0, debo, 1200);
            animateValue(elCap, 0, capacidad, 1200);
        }, 150);
        yaAnimo = true;
    } else {
        elTotal.innerText = money(patrimonio); elTengo.innerText = money(tengo); elDebo.innerText = money(debo); elCap.innerText = money(capacidad);
    }

    renderPatrimonioChart('chartPatrimonio', patrimonio);

    const hoy = new Date();
    const prefijoMes = `${hoy.getFullYear()}-${(hoy.getMonth() + 1).toString().padStart(2, '0')}`;
    const txMes = state.transacciones.filter(t => t.fecha && t.fecha.startsWith(prefijoMes));
    const gT = txMes.filter(t => t.tipo === 'gasto').reduce((a, b) => a + Number(b.monto || 0), 0);
    const iT = txMes.filter(t => t.tipo === 'ingreso').reduce((a, b) => a + Number(b.monto || 0), 0);
    document.getElementById('homeIngresos').innerText = money(iT);
    document.getElementById('homeGastos').innerText = money(gT);

    const prevDate = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
    const prefijoPrev = `${prevDate.getFullYear()}-${(prevDate.getMonth() + 1).toString().padStart(2, '0')}`;
    const txPrev = state.transacciones.filter(t => t.fecha && t.fecha.startsWith(prefijoPrev));
    const gPrev = txPrev.filter(t => t.tipo === 'gasto').reduce((a, b) => a + Number(b.monto || 0), 0);
    const iPrev = txPrev.filter(t => t.tipo === 'ingreso').reduce((a, b) => a + Number(b.monto || 0), 0);
    const pctIng = iPrev > 0 ? ((iT - iPrev) / iPrev) * 100 : (iT > 0 ? 100 : 0);
    const pctGas = gPrev > 0 ? ((gT - gPrev) / gPrev) * 100 : (gT > 0 ? 100 : 0);

    const elPctIng = document.getElementById('pctIngresos');
    elPctIng.innerText = `${pctIng >= 0 ? '↑' : '↓'} ${Math.abs(pctIng).toFixed(1)}%`;
    elPctIng.style.color = pctIng >= 0 ? 'var(--success)' : 'var(--danger)';
    const elPctGas = document.getElementById('pctGastos');
    elPctGas.innerText = `${pctGas >= 0 ? '↑' : '↓'} ${Math.abs(pctGas).toFixed(1)}%`;
    elPctGas.style.color = pctGas >= 0 ? 'var(--danger)' : 'var(--success)';

    const sparkIng = [0, 0, 0, 0, 0, 0], sparkGas = [0, 0, 0, 0, 0, 0];
    state.transacciones.forEach(t => {
        if (!t.fecha) return;
        const d = new Date(t.fecha + 'T12:00:00');
        const diff = (hoy.getFullYear() - d.getFullYear()) * 12 + (hoy.getMonth() - d.getMonth());
        if (diff >= 0 && diff < 6) { const idx = 5 - diff; if (t.tipo === 'ingreso') sparkIng[idx] += Number(t.monto); if (t.tipo === 'gasto') sparkGas[idx] += Number(t.monto); }
    });
    renderSparkline('sparklineIngresos', sparkIng, '#059669');
    renderSparkline('sparklineGastos', sparkGas, '#e11d48');

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
        totalEstimado += pago;
        tarjetasHtml += `<div style="display:flex; justify-content:space-between; align-items:center; padding:12px; background:var(--surface-alt); border-radius:var(--radius-md); border:1px solid var(--line);">
            <span style="font-weight:700; font-size:13.5px;">${c.nombre}</span>
            <span class="money-blur" style="font-weight:800;">${money(pago)}</span>
        </div>`;
    });
    const listaTDC = document.getElementById('listaPagosTDC');
    if (listaTDC) listaTDC.innerHTML = tarjetasHtml || `<div class="empty-state">No se encontraron pagos pendientes este periodo.</div>`;
    const totalTDC = document.getElementById('totalEstimadoTDC');
    if (totalTDC) totalTDC.innerText = money(totalEstimado);

    const cats = {};
    txMes.filter(t => t.tipo === 'gasto').forEach(t => cats[t.cat] = (cats[t.cat] || 0) + Number(t.monto || 0));
    renderDonutGastos('chartGastos', cats, gT);

    const labels = []; const dataIng = [0, 0, 0, 0, 0, 0]; const dataGas = [0, 0, 0, 0, 0, 0];
    for (let i = 5; i >= 0; i--) labels.push(new Date(hoy.getFullYear(), hoy.getMonth() - i, 1).toLocaleString('es-MX', { month: 'short' }).toUpperCase());
    state.transacciones.forEach(t => {
        if (!t.fecha) return;
        const d = new Date(t.fecha + 'T12:00:00');
        const diff = (hoy.getFullYear() - d.getFullYear()) * 12 + (hoy.getMonth() - d.getMonth());
        if (diff >= 0 && diff < 6) { const idx = 5 - diff; if (t.tipo === 'ingreso') dataIng[idx] += Number(t.monto); if (t.tipo === 'gasto') dataGas[idx] += Number(t.monto); }
    });
    renderBarAnual('chartAnual', labels, dataIng, dataGas);
}
