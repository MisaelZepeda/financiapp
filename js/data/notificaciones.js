import { state } from '../state.js';
import { userRef, auth } from '../firebase-init.js';

function uid() { return auth.currentUser?.uid; }

// Los descartes se guardan como { clave: timestamp } en Firebase (se
// sincronizan entre dispositivos). Los de más de 120 días se purgan en cada
// escritura para que el nodo no crezca sin límite.
const VIGENCIA_MS = 120 * 24 * 60 * 60 * 1000;

export function descartarNotificaciones(claves) {
    if (!claves.length) return Promise.resolve();
    const ahora = Date.now();
    const updates = {};
    Object.entries(state.notifDescartadas || {}).forEach(([k, t]) => { if (ahora - t > VIGENCIA_MS) updates[`notifDescartadas/${k}`] = null; });
    claves.forEach(k => { updates[`notifDescartadas/${k}`] = ahora; });

    if (state.isDemo) {
        Object.entries(updates).forEach(([path, val]) => {
            const k = path.slice('notifDescartadas/'.length);
            if (val === null) delete state.notifDescartadas[k]; else state.notifDescartadas[k] = val;
        });
        return Promise.resolve();
    }
    return userRef(uid()).update(updates);
}
