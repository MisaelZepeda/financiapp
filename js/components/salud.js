// Tlaco en la app: flota abajo a la derecha (al abrir la app dice cómo está)
// y al tocarlo abre la hoja "Tu salud financiera".

import { on } from '../core/eventos.js';
import { sel, store, suscribir } from '../core/store.js';
import { navegar } from '../core/router.js';
import { abrirHoja, cerrarHoja, hojaAbierta } from './capas.js';
import { tlacoSVG } from './tlaco.js';
import { icon } from '../lib/icons.js';
import { escapeHtml, nombreMesAnio } from '../lib/format.js';
import { evaluarSalud } from '../domain/salud.js';
import { consejoAlAzar } from '../domain/consejos.js';

const TITULO_ESTADO = {
    celebrando: 'Tlaco está celebrando', contento: 'Tlaco está contento', tranquilo: 'Tlaco está tranquilo',
    preocupado: 'Tlaco está preocupado', triste: 'Tlaco está triste',
    sorprendido: 'Tlaco está sorprendido', dormido: 'Tlaco está dormido',
};

export function saludActual() {
    return evaluarSalud({
        cuentas: sel.cuentas(), saldos: sel.saldos(), transacciones: sel.transacciones(),
        categorias: sel.categorias(), metas: sel.metas(), recurrentes: sel.recurrentes(),
    });
}

// ---------- Tlaco flotante ----------
// Aparece cuando hay datos. Solo la primera vez que se abre la app muestra
// un globo con su estado; el globo se va solo a los pocos segundos.
let globoMostrado = false;

function quitarGlobo() {
    const g = document.getElementById('tlaco-globo');
    if (!g) return;
    g.classList.add('saliendo');
    setTimeout(() => g.remove(), 220);
}

function actualizarFlotante() {
    if (!store.cargado) return;
    const s = saludActual();
    let el = document.getElementById('tlaco-flotante');
    if (!el) {
        el = document.createElement('div');
        el.id = 'tlaco-flotante';
        el.className = 'tlaco-flotante';
        el.innerHTML = '<button type="button" class="tf-boton" data-action="abrirSalud"></button>';
        document.body.appendChild(el);
    }
    const boton = el.querySelector('.tf-boton');
    if (boton.dataset.estado !== s.estado) {
        boton.dataset.estado = s.estado;
        boton.innerHTML = tlacoSVG(s.estado, { tamano: 46 });
        boton.setAttribute('aria-label', `${TITULO_ESTADO[s.estado]}. Ver tu salud financiera`);
    }
    if (!globoMostrado) {
        globoMostrado = true;
        const g = document.createElement('button');
        g.type = 'button';
        g.id = 'tlaco-globo';
        g.className = 'tlaco-globo';
        g.dataset.action = 'abrirSalud';
        g.innerHTML = `<span class="tlaco-card-estado estado-${s.estado}">${TITULO_ESTADO[s.estado]}</span><span class="tlaco-globo-msg">${escapeHtml(s.mensaje)}</span>`;
        el.appendChild(g);
        setTimeout(quitarGlobo, 9000);
    }
}
suscribir(actualizarFlotante);

const ICONO_NIVEL = { bien: icon('check'), regular: '!', mal: '!', sin: '–' };

function saludHTML(consejo) {
    const s = saludActual();
    return `<div class="salud-top">
            ${tlacoSVG(s.estado, { tamano: 88 })}
            <div>
                <p class="salud-puntaje">${s.puntaje}<small>/100</small></p>
                <p class="salud-etiqueta estado-${s.estado}">${s.etiqueta}</p>
                <p class="hint">${nombreMesAnio(s.mes)}</p>
            </div>
        </div>
        <p style="margin:6px 0 10px; font-size:15px;">${escapeHtml(s.mensaje)}</p>
        <div class="lista">${s.factores.map(f => `<div class="fila">
            <span class="factor-ico nivel-${f.nivel}" aria-hidden="true">${ICONO_NIVEL[f.nivel]}</span>
            <div class="fila-body"><div class="fila-titulo">${escapeHtml(f.titulo)}</div><div class="fila-sub">${escapeHtml(f.detalle)}</div></div>
            <div class="fila-der"><span class="num privado">${escapeHtml(f.valor)}</span></div>
        </div>`).join('')}</div>
        <div class="sugerencia"><p>Tlaco sugiere</p><p>${escapeHtml(s.sugerencia)}</p></div>
        <div class="consejo-extra" id="salud-consejo"><b class="accent-ink">Consejo:</b> ${escapeHtml(consejo)}</div>
        <div class="hoja-foot">
            <button class="btn btn-soft" data-action="otroConsejo">Otro consejo</button>
            ${s.accion
                ? `<button class="btn btn-primary" data-action="saludAccion" data-a="${escapeHtml(s.accion.action)}" data-id="${escapeHtml(s.accion.id || '')}">${escapeHtml(s.accion.texto)}</button>`
                : `<button class="btn btn-primary" data-action="saludIr" data-ruta="${escapeHtml(s.ruta)}">Ver detalle</button>`}
        </div>`;
}

let consejoMostrado = null;

on('abrirSalud', () => {
    quitarGlobo();
    consejoMostrado = consejoAlAzar(consejoMostrado);
    abrirHoja({ titulo: 'Tu salud financiera', html: `<div id="salud-body">${saludHTML(consejoMostrado)}</div>` });
});
on('otroConsejo', () => {
    consejoMostrado = consejoAlAzar(consejoMostrado);
    const el = hojaAbierta()?.querySelector('#salud-consejo');
    if (el) el.innerHTML = `<b class="accent-ink">Consejo:</b> ${escapeHtml(consejoMostrado)}`;
});
on('saludIr', (el) => { cerrarHoja(); navegar(el.dataset.ruta); });
// La acción (p. ej. pagar tarjeta) la atiende su manejador global; aquí solo se cierra la hoja antes.
on('saludAccion', (el) => {
    cerrarHoja();
    document.dispatchEvent(new CustomEvent('accionTlaco', { detail: { action: el.dataset.a, id: el.dataset.id } }));
});
