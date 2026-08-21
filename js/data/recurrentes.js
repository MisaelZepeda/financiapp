import { state } from '../state.js';
import { userRef, auth } from '../firebase-init.js';
import { guardarGasto, guardarIngreso } from './transacciones.js';

function uid() { return auth.currentUser?.uid; }

const UMBRAL_DIAS = { semanal: 7, quincenal: 15, mensual: 30 };

export function guardarRecurrente(recurrente) {
    if (state.isDemo) {
        const idx = state.recurrentes.findIndex(r => r.id === recurrente.id);
        if (idx >= 0) state.recurrentes[idx] = { ...state.recurrentes[idx], ...recurrente };
        else state.recurrentes.push(recurrente);
        return Promise.resolve();
    }
    return userRef(uid(), `recurrentes/${recurrente.id}`).set(recurrente);
}

export function eliminarRecurrente(id) {
    if (state.isDemo) { state.recurrentes = state.recurrentes.filter(r => r.id !== id); return Promise.resolve(); }
    return userRef(uid(), `recurrentes/${id}`).remove();
}

export function toggleActivoRecurrente(id, activo) {
    if (state.isDemo) { const r = state.recurrentes.find(x => x.id === id); if (r) r.activo = activo; return Promise.resolve(); }
    return userRef(uid(), `recurrentes/${id}/activo`).set(activo);
}

// Un recurrente "vence" cuando pasó suficiente tiempo desde su última
// ocurrencia generada, según su frecuencia. Nunca se genera nada solo:
// esta función solo calcula la lista, la UI decide si el usuario confirma.
export function calcularVencidos(hoy = new Date()) {
    return state.recurrentes.filter(r => r.activo !== false).filter(r => {
        if (!r.ultimaGeneracion) return true;
        const last = new Date(r.ultimaGeneracion + 'T12:00:00');
        const diffDias = Math.floor((hoy - last) / 86400000);
        return diffDias >= (UMBRAL_DIAS[r.frecuencia] || 30);
    });
}

function actualizarUltimaGeneracion(id) {
    const hoy = new Date().toISOString().split('T')[0];
    if (state.isDemo) { const r = state.recurrentes.find(x => x.id === id); if (r) r.ultimaGeneracion = hoy; return Promise.resolve(); }
    return userRef(uid(), `recurrentes/${id}/ultimaGeneracion`).set(hoy);
}

// Genera la transacción real para un recurrente vencido, reutilizando
// exactamente los mismos escritores de gasto/ingreso que el formulario
// manual usa — así la lógica de saldos nunca se duplica.
export async function generarOcurrencia(r) {
    if (r.tipo === 'gasto') {
        await guardarGasto({ monto: r.monto, desc: r.desc, cat: r.cat || 'Otros', cuentaId: r.cuentaId });
    } else {
        await guardarIngreso({ monto: r.monto, desc: r.desc, cuentaId: r.cuentaId });
    }
    return actualizarUltimaGeneracion(r.id);
}
