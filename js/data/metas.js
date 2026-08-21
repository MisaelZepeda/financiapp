import { state } from '../state.js';
import { userRef, auth } from '../firebase-init.js';

// Las metas de ahorro son un tracker independiente: los abonos/retiros SOLO
// modifican `montoActual` de la meta. Nunca tocan el saldo de ninguna cuenta
// real ni crean transacciones, para no interferir con la contabilidad de
// saldos que ya existe (cero riesgo de descuadrar datos reales).

function uid() { return auth.currentUser?.uid; }

export function guardarMeta(meta) {
    if (state.isDemo) {
        const idx = state.metas.findIndex(m => m.id === meta.id);
        if (idx >= 0) state.metas[idx] = { ...state.metas[idx], ...meta };
        else state.metas.push(meta);
        return Promise.resolve();
    }
    return userRef(uid(), `metas/${meta.id}`).set(meta);
}

export function eliminarMeta(id) {
    if (state.isDemo) { state.metas = state.metas.filter(m => m.id !== id); return Promise.resolve(); }
    return userRef(uid(), `metas/${id}`).remove();
}

function ajustarMonto(id, delta) {
    const meta = state.metas.find(m => m.id === id);
    if (!meta) return Promise.resolve();
    const nuevoMonto = Math.max(0, Number(meta.montoActual || 0) + delta);
    if (state.isDemo) { meta.montoActual = nuevoMonto; return Promise.resolve(); }
    return userRef(uid(), `metas/${id}/montoActual`).set(nuevoMonto);
}

export function abonarMeta(id, monto) { return ajustarMonto(id, Math.abs(monto)); }
export function retirarMeta(id, monto) { return ajustarMonto(id, -Math.abs(monto)); }
