// "Tu mes en resumen": historias a pantalla completa narradas por Tlaco.
// Toca a la derecha para avanzar, a la izquierda para regresar; avanzan solas.

import { sel } from '../core/store.js';
import { on } from '../core/eventos.js';
import { icon } from '../lib/icons.js';
import { money, pct, escapeHtml, nombreMes, fechaLarga } from '../lib/format.js';
import { tlacoSVG } from './tlaco.js';
import { datosResumenMes, tonoResumen } from '../domain/historias.js';
import { mesKey, sumarMeses } from '../domain/fechas.js';

const DURACION = 6500;
let estado = null; // { slides, i, timer, el }

const cifra = (n) => `<span class="privado">${money(n)}</span>`;

function construir(d) {
    const mes = nombreMes(d.mes).toLowerCase();
    const tono = tonoResumen(d);
    const slides = [];
    slides.push({
        tlaco: 'contento', clase: 'h-intro',
        html: `<small>Tu resumen</small><h2>Así te fue en ${escapeHtml(mes)}</h2><p>Registraste <b>${d.movimientos}</b> movimiento${d.movimientos === 1 ? '' : 's'}. Vamos a verlo.</p>`,
    });
    const vg = d.variacionGastos;
    slides.push({
        tlaco: d.balance >= 0 ? 'contento' : 'preocupado',
        html: `<small>Entradas y salidas</small><h2>Entraron ${cifra(d.ingresos)}</h2><h2 class="h-sec">y salieron ${cifra(d.gastos)}</h2>
            <p>${d.balance >= 0 ? `Te quedaron ${cifra(d.balance)} a favor.` : `Gastaste ${cifra(-d.balance)} más de lo que entró.`}
            ${vg == null ? '' : ` Gastaste ${pct(Math.abs(vg))} ${vg > 0 ? 'más' : 'menos'} que el mes anterior.`}</p>`,
    });
    if (d.top) {
        const cat = sel.categoria(d.top.categoriaId);
        const vt = d.top.variacion;
        slides.push({
            tlaco: 'tranquilo', icono: cat.icono || 'tag',
            html: `<small>Tu categoría top</small><h2>${escapeHtml(cat.nombre)} se llevó ${cifra(d.top.monto)}</h2>
                <p>Fue el <b>${pct(d.top.porcentaje)}</b> de tus gastos${vt == null ? '.' : `, ${pct(Math.abs(vt))} ${vt > 0 ? 'más' : 'menos'} que el mes anterior.`}</p>`,
        });
    }
    if (d.ahorro != null) {
        const sube = d.ahorroAnterior != null && d.ahorro > d.ahorroAnterior;
        slides.push({
            tlaco: d.ahorro >= 10 ? 'celebrando' : d.ahorro >= 0 ? 'contento' : 'preocupado',
            html: `<small>Ahorro</small><h2>${d.ahorro >= 0 ? `Guardaste el ${pct(d.ahorro)} de lo que ganaste` : 'Este mes no alcanzó para ahorrar'}</h2>
                <p>${d.ahorroAnterior == null ? 'La regla de oro: págate primero a ti, apenas llegue la quincena.' : sube ? `¡Mejor que el mes anterior (${pct(d.ahorroAnterior)})!` : `El mes anterior fue ${pct(d.ahorroAnterior)}. El que sigue puede ser mejor.`}</p>`,
        });
    }
    if (d.masCaro) {
        slides.push({
            tlaco: 'sorprendido',
            html: `<small>Días</small><h2>Tu día más caro fue el ${escapeHtml(fechaLarga(d.masCaro.fecha))}</h2>
                <p>Ese día gastaste ${cifra(d.masCaro.monto)}. Y hubo <b>${d.diasSinGasto}</b> día${d.diasSinGasto === 1 ? '' : 's'} sin gastar nada.</p>`,
        });
    }
    if (d.meta) {
        slides.push({
            tlaco: d.meta.progreso >= 1 ? 'celebrando' : 'contento', icono: d.meta.icono || 'target',
            html: `<small>Tu meta más avanzada</small><h2>${escapeHtml(d.meta.nombre)} va en ${pct(d.meta.progreso * 100)}</h2>
                <div class="h-barra"><i style="width:${d.meta.progreso * 100}%"></i></div>
                <p>${cifra(Number(d.meta.montoActual) || 0)} de ${cifra(Number(d.meta.montoObjetivo))}.</p>`,
        });
    }
    const cierre = {
        celebrando: '¡Qué buen mes! Sigue así y tu morralla va a crecer solita.',
        contento: 'Un mes en orden. Un pequeño ajuste y el siguiente sale todavía mejor.',
        preocupado: 'Mes apretado. Revisa tu categoría top y pon un presupuesto: yo te aviso si te acercas.',
    }[tono];
    slides.push({
        tlaco: tono, clase: 'h-cierre',
        html: `<small>Tlaco dice</small><h2>${cierre}</h2><button class="btn btn-primary" data-action="historiaCerrar">Listo</button>`,
    });
    return slides;
}

export function abrirResumenMes(key = sumarMeses(mesKey(), -1)) {
    const d = datosResumenMes(sel.transacciones(), sel.metas(), key);
    if (!d.hayDatos) {
        import('./capas.js').then(({ toast }) => toast(`No hay movimientos en ${nombreMes(key).toLowerCase()} para resumir`));
        return;
    }
    marcarVisto(key);
    cerrar();
    const el = document.createElement('div');
    el.className = 'historias';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', `Tu ${nombreMes(key).toLowerCase()} en resumen`);
    document.body.appendChild(el);
    estado = { slides: construir(d), i: 0, timer: null, el };
    document.addEventListener('keydown', teclas);
    pintar();
}

function pintar() {
    const { slides, i, el } = estado;
    const s = slides[i];
    el.innerHTML = `
        <div class="h-barras">${slides.map((_, j) => `<span class="${j < i ? 'llena' : j === i ? 'actual' : ''}"><i style="animation-duration:${DURACION}ms"></i></span>`).join('')}</div>
        <button class="icon-btn h-cerrar" data-action="historiaCerrar" aria-label="Cerrar">${icon('x')}</button>
        <div class="h-slide ${s.clase || ''}">
            <div class="h-tlaco">${tlacoSVG(s.tlaco, { tamano: 120 })}${s.icono ? `<span class="h-icono">${icon(s.icono)}</span>` : ''}</div>
            <div class="h-texto">${s.html}</div>
        </div>
        <button class="h-zona h-prev" data-action="historiaPaso" data-d="-1" aria-label="Anterior"></button>
        <button class="h-zona h-next" data-action="historiaPaso" data-d="1" aria-label="Siguiente"></button>`;
    clearTimeout(estado.timer);
    if (i < slides.length - 1) estado.timer = setTimeout(() => paso(1), DURACION);
}

function paso(d) {
    if (!estado) return;
    const j = estado.i + d;
    if (j < 0) return;
    if (j >= estado.slides.length) { cerrar(); return; }
    estado.i = j;
    pintar();
}

function cerrar() {
    if (!estado) return;
    clearTimeout(estado.timer);
    estado.el.remove();
    document.removeEventListener('keydown', teclas);
    document.querySelectorAll('.resumen-cta[data-pendiente]').forEach(b => b.remove());   // ya se vio
    estado = null;
}

function teclas(e) {
    if (e.key === 'Escape') cerrar();
    else if (e.key === 'ArrowRight') paso(1);
    else if (e.key === 'ArrowLeft') paso(-1);
}

on('historiaPaso', (el) => paso(Number(el.dataset.d)));
on('historiaCerrar', () => cerrar());

// Se ofrece en Inicio hasta que veas el resumen del mes pasado.
const CLAVE = 'morralla_resumen_visto';
function marcarVisto(key) { try { localStorage.setItem(CLAVE, key); } catch { /* sin almacenamiento */ } }
export function resumenPendiente(hoy = new Date()) {
    const key = sumarMeses(mesKey(hoy), -1);
    let visto = null;
    try { visto = localStorage.getItem(CLAVE); } catch { /* sin almacenamiento */ }
    if (visto && visto >= key) return null;
    return sel.transacciones().some(t => t.fecha?.startsWith(key)) ? key : null;
}
on('anResumen', (el) => abrirResumenMes(el.dataset.mes));
