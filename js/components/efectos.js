// Microinteracciones: confeti, la moneda que cae en la alcancía y cifras que
// cuentan al cambiar. Todo se omite si el sistema pide reducir movimiento.
// (Sin vibración: Safari de iPhone no la permite.)

import { moneyPartes } from '../lib/format.js';

const sinMovimiento = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- Confeti ----------
const COLORES = ['#f2b544', '#5b3df5', '#8f78ff', '#6fdcc4', '#7cc4ff', '#ff7a6b', '#ffe08a'];

export function confeti({ cantidad = 140, duracion = 2600 } = {}) {
    if (sinMovimiento()) return;
    const lienzo = document.createElement('canvas');
    lienzo.className = 'confeti';
    lienzo.setAttribute('aria-hidden', 'true');
    document.body.appendChild(lienzo);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = innerWidth, h = innerHeight;
    lienzo.width = w * dpr; lienzo.height = h * dpr;
    const ctx = lienzo.getContext('2d');
    ctx.scale(dpr, dpr);
    // Salen de dos cañones en las esquinas de abajo, hacia el centro.
    const piezas = Array.from({ length: cantidad }, (_, i) => {
        const izq = i % 2 === 0;
        const ang = (izq ? -60 : -120) * Math.PI / 180 + (Math.random() - 0.5) * 0.7;
        const vel = 9 + Math.random() * 8;
        return {
            x: izq ? -10 : w + 10, y: h * 0.85,
            vx: Math.cos(ang) * vel, vy: Math.sin(ang) * vel * 1.25,
            giro: Math.random() * Math.PI, vgiro: (Math.random() - 0.5) * 0.3,
            ancho: 6 + Math.random() * 5, alto: 9 + Math.random() * 7,
            color: COLORES[i % COLORES.length], circulo: Math.random() < 0.25,
        };
    });
    const inicio = performance.now();
    const cuadro = (t) => {
        const pasado = t - inicio;
        ctx.clearRect(0, 0, w, h);
        ctx.globalAlpha = Math.max(0, 1 - Math.max(0, pasado - duracion * 0.7) / (duracion * 0.3));
        piezas.forEach(p => {
            p.vy += 0.32; p.vx *= 0.985; p.vy *= 0.985;
            p.x += p.vx; p.y += p.vy; p.giro += p.vgiro;
            ctx.save();
            ctx.translate(p.x, p.y); ctx.rotate(p.giro);
            ctx.fillStyle = p.color;
            if (p.circulo) { ctx.beginPath(); ctx.arc(0, 0, p.ancho / 2, 0, Math.PI * 2); ctx.fill(); }
            else ctx.fillRect(-p.ancho / 2, -p.alto / 2, p.ancho, p.alto * Math.abs(Math.cos(p.giro * 2)) + 1);
            ctx.restore();
        });
        if (pasado < duracion) requestAnimationFrame(cuadro);
        else lienzo.remove();
    };
    requestAnimationFrame(cuadro);
}

// ---------- Moneda a la alcancía ----------
const ALCANCIA = `<svg class="alcancia-svg" viewBox="0 0 64 52" aria-hidden="true">
    <ellipse cx="32" cy="30" rx="24" ry="18" fill="#e58aa0"/>
    <ellipse cx="32" cy="30" rx="24" ry="18" fill="none" stroke="#c7647d" stroke-width="2"/>
    <rect x="26" y="11" width="12" height="3" rx="1.5" fill="#8a3a50"/>
    <circle cx="44" cy="25" r="2.2" fill="#3a1f0e"/>
    <ellipse cx="55" cy="31" rx="5" ry="4" fill="#d9778f"/><circle cx="54" cy="31" r="0.9" fill="#8a3a50"/><circle cx="57" cy="31" r="0.9" fill="#8a3a50"/>
    <path d="M38 13 l4 -6 3 7z" fill="#d9778f"/>
    <rect x="17" y="43" width="6" height="7" rx="2" fill="#c7647d"/><rect x="40" y="43" width="6" height="7" rx="2" fill="#c7647d"/>
</svg>`;
const MONEDA = `<svg class="moneda-svg" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="#a8740e"/><circle cx="12" cy="12" r="9" fill="#f2b544"/><path d="M12 6v12M9 9h4.5a2 2 0 0 1 0 4H10a2 2 0 0 0 0 4h5" stroke="#a8740e" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>`;

export function monedaAlcancia() {
    if (sinMovimiento()) return;
    document.querySelector('.alcancia')?.remove();
    const el = document.createElement('div');
    el.className = 'alcancia';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = `${MONEDA}${ALCANCIA}`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1500);
}

// ---------- Cifras que cuentan ----------
// Anima el texto de `el` de `desde` a `hasta` con formato de dinero (entero + centavos).
export function contar(el, desde, hasta, duracion = 700) {
    if (!el) return;
    const pintar = (n) => {
        const p = moneyPartes(n);
        el.innerHTML = `${p.signo}${p.entero}<span class="cent">${p.decimales}</span>`;
    };
    if (sinMovimiento() || desde === hasta || desde == null) { pintar(hasta); return; }
    const inicio = performance.now();
    const paso = (t) => {
        const k = Math.min(1, (t - inicio) / duracion);
        const suave = 1 - Math.pow(1 - k, 3);
        pintar(desde + (hasta - desde) * suave);
        if (k < 1) requestAnimationFrame(paso);
    };
    requestAnimationFrame(paso);
}
