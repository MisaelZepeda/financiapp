import { state } from '../state.js';
import { userRef, auth } from '../firebase-init.js';

function uid() { return auth.currentUser?.uid; }

export function exportarBackup() {
    const data = {
        cuentas: state.cuentas,
        transacciones: state.transacciones.map(t => { const c = { ...t }; delete c.firebaseId; return c; }),
        presupuestos: state.presupuestos,
        categoriasCustom: state.categoriasCustom,
        metas: state.metas,
        recurrentes: state.recurrentes,
        fecha: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Backup_DashboardPro_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

export function importarBackup(data) {
    if (!data.cuentas && !data.transacciones) throw new Error('Archivo inválido');
    if (state.isDemo) {
        if (data.cuentas) state.cuentas = data.cuentas;
        if (data.transacciones) state.transacciones = data.transacciones.map((t, i) => ({ ...t, firebaseId: `demo_import_${i}` }));
        if (data.presupuestos) state.presupuestos = data.presupuestos;
        if (data.categoriasCustom) state.categoriasCustom = data.categoriasCustom;
        if (data.metas) state.metas = data.metas;
        if (data.recurrentes) state.recurrentes = data.recurrentes;
        return Promise.resolve();
    }
    const updates = {};
    if (data.cuentas) { const obj = {}; data.cuentas.forEach(c => obj[c.id] = c); updates['cuentas'] = obj; }
    if (data.transacciones) { const obj = {}; data.transacciones.forEach((t, i) => obj[`import_${Date.now()}_${i}`] = t); updates['transacciones'] = obj; }
    if (data.presupuestos) updates['presupuestos'] = data.presupuestos;
    if (data.categoriasCustom) updates['categoriasCustom'] = data.categoriasCustom;
    if (data.metas) { const obj = {}; data.metas.forEach(m => obj[m.id] = m); updates['metas'] = obj; }
    if (data.recurrentes) { const obj = {}; data.recurrentes.forEach(r => obj[r.id] = r); updates['recurrentes'] = obj; }
    return userRef(uid()).update(updates);
}

export function resetearCuenta() {
    if (state.isDemo) {
        state.transacciones = [];
        state.cuentas.forEach(c => { c.saldo = 0; c.mesPagado = null; });
        return Promise.resolve();
    }
    const updates = { transacciones: null };
    state.cuentas.forEach(c => { updates[`cuentas/${c.id}/saldo`] = 0; updates[`cuentas/${c.id}/mesPagado`] = null; });
    return userRef(uid()).update(updates);
}

export function eliminarUsuario() {
    if (state.isDemo) return Promise.resolve();
    const user = auth.currentUser;
    return userRef(user.uid).remove().then(() => user.delete());
}
