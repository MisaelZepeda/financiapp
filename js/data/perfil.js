import { state } from '../state.js';
import { userRef, auth } from '../firebase-init.js';

function uid() { return auth.currentUser?.uid; }

export function guardarPerfil({ nombre, foto, color }) {
    if (state.isDemo) { state.perfil = { nombre, foto, color }; return Promise.resolve(); }
    return userRef(uid(), 'perfil').set({ nombre, foto, color });
}

export function guardarCategoriasCustom(lista) {
    if (state.isDemo) { state.categoriasCustom = lista; return Promise.resolve(); }
    return userRef(uid(), 'categoriasCustom').set(lista);
}
