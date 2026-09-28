// Helpers de Chart.js. Se apoya en Chart.getChart(canvas) (Chart.js v4) para
// destruir automáticamente cualquier instancia previa antes de redibujar, sin
// tener que mantener un registro manual de instancias entre módulos.
//
// Los colores salen de tokens.css (--series-N, --text-muted, --chart-grid…)
// para que claro y oscuro usen cada uno sus pasos validados.

const cssVar = (name, fallback) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;

const SERIES_FALLBACK = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'];
export const MAX_SERIES = SERIES_FALLBACK.length;

// Color categórico en orden fijo. Nunca se cicla: quien llama debe agrupar
// lo que pase de MAX_SERIES en "Otros" antes de pedir colores.
export function colorSerie(i) {
    return cssVar(`--series-${Math.min(i, MAX_SERIES - 1) + 1}`, SERIES_FALLBACK[Math.min(i, MAX_SERIES - 1)]);
}

const fmtMoney = (n) => '$' + Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtCompact = (n) => '$' + Number(n || 0).toLocaleString('es-MX', { notation: 'compact', maximumFractionDigits: 1 });

function baseTooltip() {
    return {
        backgroundColor: cssVar('--surface', '#fff'),
        titleColor: cssVar('--text', '#1c1917'),
        bodyColor: cssVar('--text-secondary', '#44403c'),
        borderColor: cssVar('--line-strong', '#d6d3d1'),
        borderWidth: 1,
        padding: 10,
        cornerRadius: 8,
        boxPadding: 4,
        usePointStyle: true,
        titleFont: { family: 'Inter', weight: '600', size: 12.5 },
        bodyFont: { family: 'Inter', size: 12.5 },
    };
}

const centerTextPlugin = {
    id: 'centerText',
    afterDraw(chart) {
        const opts = chart.config.options.plugins?.centerText;
        if (!opts?.display) return;
        const { ctx, chartArea } = chart;
        if (!chartArea) return;
        const cx = (chartArea.left + chartArea.right) / 2;
        const cy = (chartArea.top + chartArea.bottom) / 2;
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `500 11.5px Inter, sans-serif`;
        ctx.fillStyle = cssVar('--text-muted', '#78716c');
        ctx.fillText(opts.title || 'Total', cx, cy - 11);
        ctx.font = `600 15px Inter, sans-serif`;
        ctx.fillStyle = cssVar('--text', '#1c1917');
        ctx.fillText(document.body.classList.contains('privacy-mode') ? '••••' : opts.text, cx, cy + 8);
        ctx.restore();
    }
};
if (window.Chart) Chart.register(centerTextPlugin);

function destroyIfExists(canvas) {
    if (!canvas) return;
    const existing = Chart.getChart(canvas);
    if (existing) existing.destroy();
}

// `categorias` es una lista [nombre, monto] ya ordenada y con a lo más
// MAX_SERIES entradas (el resto agrupado en "Otros").
export function renderDonutGastos(canvasId, categorias, totalMes) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    destroyIfExists(canvas);
    const vacio = categorias.length === 0;
    return new Chart(canvas.getContext('2d'), {
        type: 'doughnut',
        data: {
            labels: vacio ? ['Sin gastos'] : categorias.map(c => c[0]),
            datasets: [{
                data: vacio ? [1] : categorias.map(c => c[1]),
                backgroundColor: vacio ? [cssVar('--surface-alt', '#f5f5f4')] : categorias.map((_, i) => colorSerie(i)),
                borderWidth: 2,
                borderColor: cssVar('--surface', '#ffffff'),
                hoverBorderColor: cssVar('--surface', '#ffffff'),
                hoverOffset: 4,
            }]
        },
        options: {
            maintainAspectRatio: false, cutout: '72%', layout: { padding: 4 },
            plugins: {
                legend: { display: false },
                tooltip: vacio ? { enabled: false } : { ...baseTooltip(), callbacks: { label: (c) => ` ${c.label}: ${fmtMoney(c.parsed)}` } },
                centerText: { display: true, title: 'Total del mes', text: fmtMoney(totalMes) },
            },
            animation: { animateRotate: true, duration: 700, easing: 'easeOutQuart' }
        }
    });
}

export function renderBarAnual(canvasId, labels, ingresos, gastos) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    destroyIfExists(canvas);
    const muted = cssVar('--text-muted', '#78716c');
    const grid = cssVar('--chart-grid', '#e7e5e4');
    const bar = { borderRadius: { topLeft: 4, topRight: 4 }, borderSkipped: 'bottom', maxBarThickness: 22, categoryPercentage: 0.62, barPercentage: 0.86 };
    return new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: { labels, datasets: [
            { label: 'Ingresos', data: ingresos, backgroundColor: colorSerie(0), ...bar },
            { label: 'Gastos', data: gastos, backgroundColor: colorSerie(1), ...bar },
        ] },
        options: {
            responsive: true, maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            scales: {
                x: { grid: { display: false }, border: { color: cssVar('--line-strong', '#d6d3d1') }, ticks: { color: muted, font: { family: 'Inter', size: 12 } } },
                y: { grid: { color: grid }, border: { display: false }, ticks: { color: muted, font: { family: 'Inter', size: 11.5 }, maxTicksLimit: 5, callback: (v) => fmtCompact(v) } },
            },
            plugins: {
                legend: { display: false },
                tooltip: { ...baseTooltip(), callbacks: { label: (c) => ` ${c.dataset.label}: ${fmtMoney(c.parsed.y)}` } },
            },
            animation: { duration: 700, easing: 'easeOutQuart' }
        }
    });
}
