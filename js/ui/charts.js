// Helpers de Chart.js. Se apoya en Chart.getChart(canvas) (Chart.js v4) para
// destruir automáticamente cualquier instancia previa antes de redibujar, sin
// tener que mantener un registro manual de instancias entre módulos.

const centerTextPlugin = {
    id: 'centerText',
    beforeDraw(chart) {
        const opts = chart.config.options.plugins?.centerText;
        if (!opts?.display) return;
        const { ctx, chartArea } = chart;
        if (!chartArea) return;
        ctx.restore();
        const centerX = chartArea.left + (chartArea.right - chartArea.left) / 2;
        const centerY = chartArea.top + (chartArea.bottom - chartArea.top) / 2;
        const fontSize = (chart.height / 150).toFixed(2);
        ctx.textBaseline = 'middle';
        const top = opts.title || 'TOTAL';
        const bottom = opts.text;
        ctx.font = `bold ${fontSize * 0.4}em var(--font-body)`;
        ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--text-muted').trim() || '#6b6b80';
        ctx.fillText(top, centerX - ctx.measureText(top).width / 2, centerY - 15);
        ctx.font = `800 ${fontSize * 0.85}em var(--font-display)`;
        ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--text').trim() || '#14121f';
        ctx.fillText(bottom, centerX - ctx.measureText(bottom).width / 2, centerY + 15);
        ctx.save();
    }
};
if (window.Chart) Chart.register(centerTextPlugin);

function destroyIfExists(canvas) {
    if (!canvas) return;
    const existing = Chart.getChart(canvas);
    if (existing) existing.destroy();
}

export function isDarkTheme() {
    const attr = document.documentElement.getAttribute('data-theme');
    if (attr === 'dark') return true;
    if (attr === 'light') return false;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function renderPatrimonioChart(canvasId, patrimonioActual) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    destroyIfExists(canvas);
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, 150);
    gradient.addColorStop(0, 'rgba(255,255,255,0.35)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    const curve = patrimonioActual > 0
        ? [patrimonioActual * 0.7, patrimonioActual * 0.75, patrimonioActual * 0.72, patrimonioActual * 0.8, patrimonioActual * 0.85, patrimonioActual * 0.9, patrimonioActual]
        : [0, 0, 0, 0, 0, 0, 0];
    return new Chart(ctx, {
        type: 'line',
        data: { labels: ['1', '2', '3', '4', '5', '6', 'Hoy'], datasets: [{ data: curve, borderColor: '#ffffff', borderWidth: 2.5, backgroundColor: gradient, fill: true, tension: 0.4, pointRadius: 0 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { enabled: false } }, scales: { x: { display: false }, y: { display: false, min: Math.min(...curve) * 0.9 } }, layout: { padding: 0 }, animation: { duration: 1000, easing: 'easeOutQuart' } }
    });
}

export function renderSparkline(canvasId, data, color) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    destroyIfExists(canvas);
    return new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: { labels: data.map((_, i) => i), datasets: [{ data, borderColor: color, borderWidth: 2, tension: 0.4 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { enabled: false } }, scales: { x: { display: false }, y: { display: false } }, layout: { padding: 0 }, elements: { point: { radius: 0, hitRadius: 10, hoverRadius: 4 } } }
    });
}

const DONUT_PALETTE = ['#7c3aed', '#059669', '#e11d48', '#0284c7', '#d97706', '#db2777', '#14b8a6', '#a855f7'];

export function renderDonutGastos(canvasId, categorias, totalMes) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    destroyIfExists(canvas);
    const dark = isDarkTheme();
    Chart.defaults.color = dark ? '#9a9ab0' : '#6b6b80';
    return new Chart(canvas.getContext('2d'), {
        type: 'doughnut',
        data: { labels: Object.keys(categorias), datasets: [{ data: Object.values(categorias), backgroundColor: DONUT_PALETTE, borderWidth: 3, borderColor: dark ? '#141a2a' : '#ffffff' }] },
        options: {
            maintainAspectRatio: false, cutout: '74%', layout: { padding: 10 },
            plugins: { legend: { display: true, position: 'right', labels: { boxWidth: 11, font: { size: 10.5 } } }, centerText: { display: true, title: 'TOTAL MES', text: '$' + totalMes.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) } },
            animation: { animateRotate: true, animateScale: true, duration: 1100, easing: 'easeOutQuart' }
        }
    });
}

export function renderBarAnual(canvasId, labels, ingresos, gastos) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    destroyIfExists(canvas);
    const dark = isDarkTheme();
    return new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: { labels, datasets: [
            { label: 'Ingresos', data: ingresos, backgroundColor: '#059669', borderRadius: 5 },
            { label: 'Gastos', data: gastos, backgroundColor: '#e11d48', borderRadius: 5 },
        ] },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: { x: { grid: { display: false } }, y: { grid: { color: dark ? '#262c42' : '#e7e6f0' }, border: { display: false } } },
            plugins: { legend: { position: 'bottom', labels: { boxWidth: 11, font: { size: 10.5 } } } },
            animation: { duration: 1200, easing: 'easeOutQuart' }
        }
    });
}

export function renderPresupuestoDonut(canvasId, gastado, limite) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    destroyIfExists(canvas);
    const pct = limite > 0 ? (gastado / limite) * 100 : 0;
    const fill = pct > 100 ? '#fecdd3' : '#ffffff';
    const fillData = pct > 100 ? 1 : gastado;
    const emptyData = pct > 100 ? 0 : Math.max(limite - gastado, 0);
    return new Chart(canvas.getContext('2d'), {
        type: 'doughnut',
        data: { labels: ['Gastado', 'Restante'], datasets: [{ data: [fillData, emptyData], backgroundColor: [fill, 'rgba(0,0,0,0.18)'], borderWidth: 0, borderRadius: 15 }] },
        options: { responsive: true, maintainAspectRatio: true, aspectRatio: 2, circumference: 180, rotation: 270, cutout: '80%', plugins: { legend: { display: false }, tooltip: { enabled: false } }, animation: { animateRotate: true, animateScale: true, duration: 1100, easing: 'easeOutQuart' } }
    });
}
