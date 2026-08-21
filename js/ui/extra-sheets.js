import { state, todasLasCategorias, iconosMeta } from '../state.js';

/* ---------- META (ahorro) ---------- */
export function poblarSelectEmojiMeta() {
    const sel = document.getElementById('metaEmoji');
    if (sel) sel.innerHTML = iconosMeta.map(e => `<option value="${e}">${e}</option>`).join('');
}

export function abrirSheetMeta(meta = null) {
    document.getElementById('formMeta').reset();
    poblarSelectEmojiMeta();
    document.getElementById('metaEditId').value = meta ? meta.id : '';
    document.getElementById('sheetMetaTitle').innerText = meta ? 'Editar Meta' : 'Nueva Meta de Ahorro';
    if (meta) {
        document.getElementById('metaNombre').value = meta.nombre;
        document.getElementById('metaEmoji').value = meta.emoji || '🎯';
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
    if (sel) sel.innerHTML = state.cuentas.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
    const cat = document.getElementById('recCat');
    if (cat) cat.innerHTML = todasLasCategorias().map(c => `<option value="${c}">${c}</option>`).join('');
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
