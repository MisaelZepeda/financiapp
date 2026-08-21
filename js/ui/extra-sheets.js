import { state, todasLasCategorias, iconosMeta } from '../state.js';
import { icon } from '../utils/icons.js';
import { escapeHtml } from '../utils/format.js';

/* ---------- META (ahorro) ---------- */
export function seleccionarIconoMeta(nombre) {
    document.getElementById('metaEmoji').value = nombre;
    document.querySelectorAll('#metaIconPicker .icon-swatch').forEach(el => el.classList.toggle('active', el.dataset.icon === nombre));
}

function poblarPickerIconoMeta(seleccionado) {
    const cont = document.getElementById('metaIconPicker');
    if (!cont) return;
    cont.innerHTML = iconosMeta.map(nombre => `<button type="button" class="icon-swatch ${nombre === seleccionado ? 'active' : ''}" data-action="seleccionarIconoMeta" data-icon="${nombre}">${icon(nombre)}</button>`).join('');
}

export function abrirSheetMeta(meta = null) {
    document.getElementById('formMeta').reset();
    document.getElementById('metaEditId').value = meta ? meta.id : '';
    document.getElementById('sheetMetaTitle').innerText = meta ? 'Editar Meta' : 'Nueva Meta de Ahorro';
    const iconoInicial = (meta && meta.emoji) || 'target';
    poblarPickerIconoMeta(iconoInicial);
    document.getElementById('metaEmoji').value = iconoInicial;
    if (meta) {
        document.getElementById('metaNombre').value = meta.nombre;
        document.getElementById('metaObjetivo').value = meta.montoObjetivo;
        document.getElementById('metaActual').value = meta.montoActual || 0;
        document.getElementById('metaFecha').value = meta.fechaLimite || '';
    }
    document.getElementById('sheetMetaOverlay').style.display = 'flex';
}

export function cerrarSheetMeta() { document.getElementById('sheetMetaOverlay').style.display = 'none'; }

/* ---------- RECURRENTE ---------- */
export function actualizarSelectsRecurrente() {
    const sel = document.getElementById('recCuenta');
    if (sel) sel.innerHTML = state.cuentas.map(c => `<option value="${c.id}">${escapeHtml(c.nombre)}</option>`).join('');
    const cat = document.getElementById('recCat');
    if (cat) cat.innerHTML = todasLasCategorias().map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
    toggleCampoCategoria();
}

export function toggleCampoCategoria() {
    const tipo = document.getElementById('recTipo')?.value;
    const wrap = document.getElementById('recCatWrap');
    if (wrap) wrap.style.display = tipo === 'gasto' ? 'block' : 'none';
}

export function abrirSheetRecurrente(recurrente = null) {
    document.getElementById('formRecurrente').reset();
    actualizarSelectsRecurrente();
    document.getElementById('recEditId').value = recurrente ? recurrente.id : '';
    document.getElementById('sheetRecurrenteTitle').innerText = recurrente ? 'Editar Recurrente' : 'Nuevo Recurrente';
    if (recurrente) {
        document.getElementById('recTipo').value = recurrente.tipo;
        document.getElementById('recDesc').value = recurrente.desc;
        document.getElementById('recMonto').value = recurrente.monto;
        document.getElementById('recCuenta').value = recurrente.cuentaId;
        document.getElementById('recFrecuencia').value = recurrente.frecuencia;
        document.getElementById('recDia').value = recurrente.diaMes || '';
        if (recurrente.cat) document.getElementById('recCat').value = recurrente.cat;
        toggleCampoCategoria();
    }
    document.getElementById('sheetRecurrenteOverlay').style.display = 'flex';
}

export function cerrarSheetRecurrente() { document.getElementById('sheetRecurrenteOverlay').style.display = 'none'; }
