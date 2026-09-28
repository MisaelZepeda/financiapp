import { state } from '../state.js';
import { userRef, auth } from '../firebase-init.js';

function uid() { return auth.currentUser?.uid; }

export function guardarCuenta(cuenta) {
    if (state.isDemo) {
        const idx = state.cuentas.findIndex(c => c.id == cuenta.id);
        if (idx >= 0) state.cuentas[idx] = { ...state.cuentas[idx], ...cuenta };
        else state.cuentas.push(cuenta);
        return Promise.resolve();
    }
    return userRef(uid(), `cuentas/${cuenta.id}`).set(cuenta);
}

export function eliminarCuenta(id) {
    if (state.isDemo) {
        state.cuentas = state.cuentas.filter(c => c.id != id);
        return Promise.resolve();
    }
    return userRef(uid(), `cuentas/${id}`).remove();
}

export function marcarPagado(id, mes) {
    if (state.isDemo) {
        const c = state.cuentas.find(x => x.id == id); if (c) c.mesPagado = mes;
        return Promise.resolve();
    }
    return userRef(uid(), `cuentas/${id}/mesPagado`).set(mes);
}

export function desmarcarPagado(id) {
    if (state.isDemo) {
        const c = state.cuentas.find(x => x.id == id); if (c) c.mesPagado = null;
        return Promise.resolve();
    }
    return userRef(uid(), `cuentas/${id}/mesPagado`).remove();
}
