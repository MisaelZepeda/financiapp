import { state } from '../state.js';
import { userRef, auth } from '../firebase-init.js';

export function guardarPresupuestos(nuevos) {
    if (state.isDemo) { state.presupuestos = nuevos; return Promise.resolve(); }
    return userRef(auth.currentUser?.uid, 'presupuestos').set(nuevos);
}
