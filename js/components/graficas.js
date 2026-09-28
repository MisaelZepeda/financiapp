// Gráficas con Chart.js. Los colores salen de tokens.css para que oscuro y
// claro usen sus propios pasos validados.

import { store } from '../core/store.js';

const css = (n, f) => getComputedStyle(document.documentElement).getPropertyValue(n).trim() || f;
export const MAX_SERIES = 8;
export function colorSerie(i) { return css(`--series-${Math.min(i, MAX_SERIES - 1) + 1}`, '#3987e5'); }

// El canvas no entiende color-mix(): se convierte el hex del token a rgba.
function rgba(hex, alfa) {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map(x => x + x).join('') : h, 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alfa})`;
}

const oculto = () => store.ui.privacidad;
const fmt = (n) => oculto() ? '••••' : '$' + Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtCorto = (n) => oculto() ? '' : '$' + Number(n || 0).toLocaleString('es-MX', { notation: 'compact', maximumFractionDigits: 1 });

function tooltip() {
    return {
        backgroundColor: css('--surface-2', '#1e2026'), titleColor: css('--text', '#fff'), bodyColor: css('--text-2', '#ccc'),
        borderColor: css('--line-strong', '#333'), borderWidth: 1, padding: 10, cornerRadius: 10, boxPadding: 4, usePointStyle: true,
        titleFont: { family: 'Inter', weight: '600', size: 12.5 }, bodyFont: { family: 'Inter', size: 12.5 },
    };
}

function ejes({ yCompacto = true, min } = {}) {
    const muted = css('--muted', '#8a8f9c');
    return {
        x: { grid: { display: false }, border: { display: false }, ticks: { color: muted, font: { family: 'Inter', size: 11.5 }, maxRotation: 0, autoSkipPadding: 8 } },
        y: { min, grid: { color: css('--chart-grid', '#24262d') }, border: { display: false }, ticks: { color: muted, font: { family: 'Inter', size: 11 }, maxTicksLimit: 5, callback: (v) => yCompacto ? fmtCorto(v) : v } },
    };
}

function lienzo(el) {
    if (!el || !window.Chart) return null;
    Chart.getChart(el)?.destroy();
    return el.getContext('2d');
}

// Barras agrupadas de ingresos y gastos por mes.
export function barrasIngresosGastos(el, etiquetas, ingresos, gastos) {
    const ctx = lienzo(el); if (!ctx) return;
    const barra = { borderRadius: { topLeft: 4, topRight: 4 }, borderSkipped: 'bottom', maxBarThickness: 18, categoryPercentage: 0.66, barPercentage: 0.86 };
    new Chart(ctx, {
        type: 'bar',
        data: { labels: etiquetas, datasets: [
            { label: 'Ingresos', data: ingresos, backgroundColor: colorSerie(0), ...barra },
            { label: 'Gastos', data: gastos, backgroundColor: colorSerie(1), ...barra },
        ] },
        options: {
            responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
            scales: ejes(), plugins: { legend: { display: false }, tooltip: { ...tooltip(), callbacks: { label: (c) => ` ${c.dataset.label}: ${fmt(c.parsed.y)}` } } },
            animation: { duration: 600 },
        },
    });
}

// Línea de patrimonio neto en el tiempo, con el acento de la app.
export function lineaPatrimonio(el, etiquetas, valores) {
    const ctx = lienzo(el); if (!ctx) return;
    const acento = css('--accent-ink', '#c6f432');
    const grad = ctx.createLinearGradient(0, 0, 0, el.parentElement.clientHeight || 200);
    grad.addColorStop(0, rgba(acento, 0.28));
    grad.addColorStop(1, rgba(acento, 0));
    const minimo = Math.min(...valores), maximo = Math.max(...valores);
    new Chart(ctx, {
        type: 'line',
        data: { labels: etiquetas, datasets: [{ label: 'Patrimonio', data: valores, borderColor: acento, backgroundColor: grad, fill: true, tension: 0.35, borderWidth: 2, pointRadius: 0, pointHoverRadius: 5, pointBackgroundColor: acento }] },
        options: {
            responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
            scales: ejes({ min: minimo - (maximo - minimo) * 0.15 }),
            plugins: { legend: { display: false }, tooltip: { ...tooltip(), callbacks: { label: (c) => ` ${fmt(c.parsed.y)}` } } },
            animation: { duration: 700 },
        },
    });
}

// Mini línea sin ejes (tendencia en tarjetas).
export function sparkline(el, valores) {
    const ctx = lienzo(el); if (!ctx) return;
    const acento = css('--accent-ink', '#c6f432');
    new Chart(ctx, {
        type: 'line',
        data: { labels: valores.map((_, i) => i), datasets: [{ data: valores, borderColor: acento, borderWidth: 2, tension: 0.4, pointRadius: 0, fill: false }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { enabled: false } }, scales: { x: { display: false }, y: { display: false } }, animation: { duration: 600 } },
    });
}

// Dona de gastos por categoría. `datos`: [{ nombre, monto, color }]
export function donaCategorias(el, datos, total) {
    const ctx = lienzo(el); if (!ctx) return;
    const vacio = datos.length === 0;
    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: vacio ? ['Sin gastos'] : datos.map(d => d.nombre),
            datasets: [{ data: vacio ? [1] : datos.map(d => d.monto), backgroundColor: vacio ? [css('--surface-3', '#272a31')] : datos.map(d => d.color), borderWidth: 2, borderColor: css('--surface', '#17191e'), hoverOffset: 4 }],
        },
        options: {
            maintainAspectRatio: false, cutout: '74%', layout: { padding: 4 },
            plugins: { legend: { display: false }, tooltip: vacio ? { enabled: false } : { ...tooltip(), callbacks: { label: (c) => ` ${c.label}: ${fmt(c.parsed)}` } } },
            animation: { animateRotate: true, duration: 600 },
        },
        plugins: [{
            id: 'centro',
            afterDraw(chart) {
                const { ctx: c, chartArea: a } = chart; if (!a) return;
                const x = (a.left + a.right) / 2, y = (a.top + a.bottom) / 2;
                c.save(); c.textAlign = 'center'; c.textBaseline = 'middle';
                c.font = '500 11.5px Inter, sans-serif'; c.fillStyle = css('--muted', '#8a8f9c'); c.fillText('Total', x, y - 12);
                c.font = '600 17px "Inter Tight", Inter, sans-serif'; c.fillStyle = css('--text', '#fff'); c.fillText(fmt(total), x, y + 9);
                c.restore();
            },
        }],
    });
}
