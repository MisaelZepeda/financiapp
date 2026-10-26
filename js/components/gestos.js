// Gestos táctiles:
//  · Deslizar un movimiento a la izquierda muestra Editar y Borrar (con Deshacer).
//  · Jalar hacia abajo en Inicio busca una versión nueva de la app.
// Solo con dedo: en computadora todo sigue funcionando con clic.

import { on } from '../core/eventos.js';
import { borrarTransaccion } from '../core/actions.js';
import { toast } from './capas.js';
import { rutaActual } from '../core/router.js';
import { icon } from '../lib/icons.js';

const ANCHO = 148;     // lo que se recorre para mostrar las dos acciones
const UMBRAL = 56;

// ---------- Deslizar movimientos ----------
let abierta = null;    // .swipe abierta
let toque = null;      // { fila, swipe, x0, y0, dx, decidido, horizontal, base }

function cerrarAbierta(excepto) {
    if (abierta && abierta !== excepto) { abierta.classList.remove('abierta'); abierta.querySelector('.swipe-fila').style.transform = ''; abierta = null; }
}

document.addEventListener('touchstart', (e) => {
    const swipe = e.target.closest('.swipe');
    if (!swipe || e.touches.length > 1) { if (!e.target.closest('.swipe-acciones')) cerrarAbierta(); return; }
    if (e.target.closest('.swipe-acciones')) return;
    cerrarAbierta(swipe);
    const t = e.touches[0];
    toque = { swipe, fila: swipe.querySelector('.swipe-fila'), x0: t.clientX, y0: t.clientY, dx: 0, decidido: false, horizontal: false, base: swipe === abierta ? -ANCHO : 0 };
}, { passive: true });

document.addEventListener('touchmove', (e) => {
    if (!toque) return;
    const t = e.touches[0];
    const dx = t.clientX - toque.x0, dy = t.clientY - toque.y0;
    if (!toque.decidido && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) { toque.decidido = true; toque.horizontal = Math.abs(dx) > Math.abs(dy) * 1.2; }
    if (!toque.horizontal) return;
    e.preventDefault();
    toque.dx = dx;
    const x = Math.max(-ANCHO - 30, Math.min(0, toque.base + dx));
    toque.fila.style.transition = 'none';
    toque.fila.style.transform = `translateX(${x}px)`;
}, { passive: false });

document.addEventListener('touchend', () => {
    if (!toque) return;
    const { swipe, fila, horizontal, base, dx } = toque;
    toque = null;
    if (!horizontal) return;
    fila.style.transition = '';
    const abrir = base + dx < -UMBRAL;
    fila.style.transform = abrir ? `translateX(${-ANCHO}px)` : '';
    swipe.classList.toggle('abierta', abrir);
    abierta = abrir ? swipe : null;
    // El clic que sigue a un deslizamiento no debe abrir el movimiento.
    swipe.dataset.recienDeslizada = '1';
    setTimeout(() => { delete swipe.dataset.recienDeslizada; }, 350);
});

// Evita que el toque que sigue a un deslizamiento abra el editor; si estaba abierta, la cierra.
document.addEventListener('click', (e) => {
    const swipe = e.target.closest('.swipe');
    if (!swipe || e.target.closest('.swipe-acciones')) return;
    if (swipe.dataset.recienDeslizada || swipe === abierta) { e.stopPropagation(); e.preventDefault(); cerrarAbierta(); }
}, true);

on('swipeBorrar', async (el) => {
    cerrarAbierta();
    const deshacer = await borrarTransaccion(el.dataset.id);
    toast('Movimiento eliminado', { deshacer });
});

// HTML de las acciones que quedan detrás de la fila.
export function accionesSwipeHTML(id) {
    return `<div class="swipe-acciones" aria-hidden="true">
        <button type="button" class="swipe-editar" data-action="editarTx" data-id="${id}" tabindex="-1">${icon('edit')}Editar</button>
        <button type="button" class="swipe-borrar" data-action="swipeBorrar" data-id="${id}" tabindex="-1">${icon('trash')}Borrar</button></div>`;
}

// ---------- Jalar para actualizar (Inicio) ----------
const JALON = 72;
let jalon = null;    // { y0, dy, indicador }

function indicador() {
    let el = document.getElementById('jalar');
    if (!el) {
        el = document.createElement('div');
        el.id = 'jalar';
        el.className = 'jalar';
        el.innerHTML = `${icon('repeat')}<span></span>`;
        document.getElementById('vista')?.before(el);
    }
    return el;
}

document.addEventListener('touchstart', (e) => {
    if (rutaActual().patron !== '/inicio' || window.scrollY > 0 || document.querySelector('.capa, .historias') || e.target.closest('.swipe')) return;
    jalon = { y0: e.touches[0].clientY, dy: 0 };
}, { passive: true });

document.addEventListener('touchmove', (e) => {
    if (!jalon) return;
    const dy = e.touches[0].clientY - jalon.y0;
    if (dy <= 0 || window.scrollY > 0) { jalon.dy = 0; return; }
    jalon.dy = dy;
    const el = indicador();
    const d = Math.min(JALON + 30, dy * 0.5);
    el.style.height = `${d}px`;
    el.classList.toggle('listo', d >= JALON * 0.75);
    el.querySelector('span').textContent = d >= JALON * 0.75 ? 'Suelta para actualizar' : 'Jala para actualizar';
    el.querySelector('.icon').style.transform = `rotate(${d * 4}deg)`;
}, { passive: true });

document.addEventListener('touchend', async () => {
    if (!jalon) return;
    const listo = jalon.dy * 0.5 >= JALON * 0.75;
    jalon = null;
    const el = document.getElementById('jalar');
    if (!el) return;
    if (!listo) { el.remove(); return; }
    el.classList.add('cargando');
    el.style.height = '48px';
    el.querySelector('span').textContent = 'Buscando novedades…';
    let hayNueva = false;
    try {
        const reg = await navigator.serviceWorker?.getRegistration();
        if (reg) { await reg.update(); hayNueva = !!(reg.waiting || reg.installing); }
    } catch { /* sin conexión */ }
    await new Promise(r => setTimeout(r, 500));
    el.remove();
    toast(hayNueva ? 'Hay una versión nueva: toca Actualizar' : navigator.onLine === false ? 'Sin conexión: verás tus datos al reconectar' : 'Todo al día');
});
