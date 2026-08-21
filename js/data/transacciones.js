import { state } from '../state.js';
import { userRef, auth } from '../firebase-init.js';

function uid() { return auth.currentUser?.uid; }
function nuevoId() { return state.isDemo ? `demo_${Date.now()}_${Math.random().toString(36).slice(2, 7)}` : userRef(uid(), 'transacciones').push().key; }

// Calcula los ajustes de saldo necesarios para deshacer el efecto de una
// transacción (usado antes de editar o borrar). Devuelve un mapa de
// updates estilo Firebase (`cuentas/<id>/saldo`) para no duplicar la lógica
// de saldos entre alta/edición/borrado.
export function revertirTransaccion(fid) {
    const t = state.transacciones.find(x => x.firebaseId === fid);
    if (!t) return {};
    const updates = {};
    if (t.tipo === 'ingreso') {
        const c = state.cuentas.find(x => x.id == t.cuentaId);
        if (c) updates[`cuentas/${c.id}/saldo`] = c.saldo - t.monto;
    } else if (t.tipo === 'gasto') {
        const c = state.cuentas.find(x => x.id == t.cuentaId);
        if (c) updates[`cuentas/${c.id}/saldo`] = (c.tipo === 'debito' || c.tipo === 'efectivo') ? c.saldo + t.monto : c.saldo - t.monto;
    } else if (t.tipo === 'movimiento') {
        const or = state.cuentas.find(x => x.id == t.origenId);
        const des = state.cuentas.find(x => x.id == t.destinoId);
        if (or) updates[`cuentas/${or.id}/saldo`] = or.saldo + t.monto;
        if (des) updates[`cuentas/${des.id}/saldo`] = (des.tipo === 'debito' || des.tipo === 'efectivo') ? des.saldo - t.monto : des.saldo + t.monto;
    }
    return updates;
}

function aplicarUpdatesLocal(updates) {
    Object.entries(updates).forEach(([path, val]) => {
        const m = path.match(/^cuentas\/(.+)\/saldo$/);
        if (m) { const c = state.cuentas.find(x => x.id == m[1]); if (c) c.saldo = val; }
    });
}

export function guardarIngreso({ monto, desc, cuentaId, editId }) {
    let updates = editId ? revertirTransaccion(editId) : {};
    const cId = editId ? state.transacciones.find(x => x.firebaseId === editId).cuentaId : cuentaId;
    const c = state.cuentas.find(x => x.id == cId);
    const saldoActual = updates[`cuentas/${c.id}/saldo`] !== undefined ? updates[`cuentas/${c.id}/saldo`] : c.saldo;
    const id = editId || nuevoId();
    const oldFecha = editId ? state.transacciones.find(x => x.firebaseId === editId).fecha : new Date().toISOString().split('T')[0];
    updates[`transacciones/${id}`] = { desc, monto, tipo: 'ingreso', cuentaId: c.id, fecha: oldFecha };
    updates[`cuentas/${c.id}/saldo`] = saldoActual + monto;

    if (state.isDemo) {
        aplicarUpdatesLocal(updates);
        const idx = state.transacciones.findIndex(x => x.firebaseId === id);
        const registro = { ...updates[`transacciones/${id}`], firebaseId: id };
        if (idx >= 0) state.transacciones[idx] = registro; else state.transacciones.push(registro);
        return Promise.resolve();
    }
    return userRef(uid()).update(updates);
}

export function guardarGasto({ monto, desc, cat, cuentaId, editId, isMSI = false, meses = 1 }) {
    let updates = editId ? revertirTransaccion(editId) : {};
    const cId = editId ? state.transacciones.find(x => x.firebaseId === editId).cuentaId : cuentaId;
    const c = state.cuentas.find(x => x.id == cId);
    const saldoActual = updates[`cuentas/${c.id}/saldo`] !== undefined ? updates[`cuentas/${c.id}/saldo`] : c.saldo;
    const id = editId || nuevoId();
    const oldFecha = editId ? state.transacciones.find(x => x.firebaseId === editId).fecha : new Date().toISOString().split('T')[0];
    updates[`transacciones/${id}`] = { desc, cat, monto, tipo: 'gasto', cuentaId: c.id, fecha: oldFecha, isMSI, meses };
    updates[`cuentas/${c.id}/saldo`] = (c.tipo === 'debito' || c.tipo === 'efectivo') ? saldoActual - monto : saldoActual + monto;

    if (state.isDemo) {
        aplicarUpdatesLocal(updates);
        const idx = state.transacciones.findIndex(x => x.firebaseId === id);
        const registro = { ...updates[`transacciones/${id}`], firebaseId: id };
        if (idx >= 0) state.transacciones[idx] = registro; else state.transacciones.push(registro);
        return Promise.resolve();
    }
    return userRef(uid()).update(updates);
}

export function guardarMovimiento({ monto, origenId, destinoId, subtipo, editId }) {
    let updates = editId ? revertirTransaccion(editId) : {};
    const orId = editId ? state.transacciones.find(x => x.firebaseId === editId).origenId : origenId;
    const desId = editId ? state.transacciones.find(x => x.firebaseId === editId).destinoId : destinoId;
    const or = state.cuentas.find(x => x.id == orId);
    const des = state.cuentas.find(x => x.id == desId);
    const sOr = updates[`cuentas/${or.id}/saldo`] !== undefined ? updates[`cuentas/${or.id}/saldo`] : or.saldo;
    const sDes = updates[`cuentas/${des.id}/saldo`] !== undefined ? updates[`cuentas/${des.id}/saldo`] : des.saldo;
    updates[`cuentas/${or.id}/saldo`] = sOr - monto;
    updates[`cuentas/${des.id}/saldo`] = (des.tipo === 'debito' || des.tipo === 'efectivo') ? sDes + monto : sDes - monto;

    const id = editId || nuevoId();
    const oldFecha = editId ? state.transacciones.find(x => x.firebaseId === editId).fecha : new Date().toISOString().split('T')[0];
    const modo = subtipo || 'traspaso';
    updates[`transacciones/${id}`] = { tipo: 'movimiento', subtipo: modo, monto, desc: modo === 'pago' ? `Pago a ${des.nombre}` : `Traspaso a ${des.nombre}`, origenId: or.id, destinoId: des.id, fecha: oldFecha };
    if (modo === 'pago') updates[`cuentas/${des.id}/mesPagado`] = new Date().getMonth();

    if (state.isDemo) {
        aplicarUpdatesLocal(updates);
        if (modo === 'pago') des.mesPagado = new Date().getMonth();
        const idx = state.transacciones.findIndex(x => x.firebaseId === id);
        const registro = { ...updates[`transacciones/${id}`], firebaseId: id };
        if (idx >= 0) state.transacciones[idx] = registro; else state.transacciones.push(registro);
        return Promise.resolve();
    }
    return userRef(uid()).update(updates);
}

export function eliminarTransaccion(fid) {
    const updates = revertirTransaccion(fid);
    updates[`transacciones/${fid}`] = null;
    if (state.isDemo) {
        aplicarUpdatesLocal(updates);
        state.transacciones = state.transacciones.filter(x => x.firebaseId !== fid);
        return Promise.resolve();
    }
    return userRef(uid()).update(updates);
}
