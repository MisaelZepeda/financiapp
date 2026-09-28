// Acceso a datos con la misma interfaz para Firebase y para el modo demo.
// Todas las rutas son relativas a Usuarios/{uid}/v4 (en demo, a un objeto
// en memoria). Las escrituras se hacen con update() de rutas planas.

import { userRef } from '../firebase-init.js';

export const RAIZ_V4 = 'v4';

let modo = null;          // 'firebase' | 'demo'
let refV4 = null;
let alCambiar = null;
let memoria = null;       // datos del modo demo

export function conectarFirebase(uid, callback) {
    desconectar();
    modo = 'firebase';
    alCambiar = callback;
    refV4 = userRef(uid, RAIZ_V4);
    refV4.on('value', snap => alCambiar?.(snap.val() || {}));
}

export function conectarDemo(datos, callback) {
    desconectar();
    modo = 'demo';
    alCambiar = callback;
    memoria = structuredClone(datos);
    queueMicrotask(() => alCambiar?.(structuredClone(memoria)));
}

export function desconectar() {
    if (refV4) refV4.off();
    refV4 = null; memoria = null; alCambiar = null; modo = null;
}

export function esDemo() { return modo === 'demo'; }

// Id nuevo, ordenable por tiempo (Firebase push key; en demo, uno equivalente).
export function nuevoId() {
    if (modo === 'firebase') return refV4.push().key;
    return 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// Firebase rechaza `undefined`: se eliminan antes de escribir.
function limpiar(v) {
    if (Array.isArray(v)) return v.map(limpiar);
    if (v && typeof v === 'object') {
        const out = {};
        Object.entries(v).forEach(([k, x]) => { if (x !== undefined) out[k] = limpiar(x); });
        return out;
    }
    return v;
}

// updates: { 'ruta/relativa': valor | null }
export function actualizar(updates) {
    const limpio = limpiar(updates);
    if (modo === 'firebase') return refV4.update(limpio);
    if (modo === 'demo') {
        Object.entries(limpio).forEach(([ruta, valor]) => asignarRuta(memoria, ruta.split('/'), valor));
        alCambiar?.(structuredClone(memoria));
        return Promise.resolve();
    }
    return Promise.reject(new Error('Sin conexión a datos'));
}

function asignarRuta(obj, partes, valor) {
    const [k, ...resto] = partes;
    if (!resto.length) { if (valor === null) delete obj[k]; else obj[k] = valor; return; }
    if (obj[k] == null || typeof obj[k] !== 'object') { if (valor === null) return; obj[k] = {}; }
    asignarRuta(obj[k], resto, valor);
}

// Reemplaza todo el nodo v4 (migración y restauración de respaldo).
export function reemplazarTodo(datos) {
    const limpio = limpiar(datos);
    if (modo === 'firebase') return refV4.set(limpio);
    memoria = structuredClone(limpio);
    alCambiar?.(structuredClone(memoria));
    return Promise.resolve();
}

// ---------- Lectura puntual de la raíz del usuario (datos v1) ----------
export async function leerV1(uid) {
    const snap = await userRef(uid).once('value');
    const todo = snap.val() || {};
    delete todo[RAIZ_V4];
    return todo;
}

export async function existeV4(uid) {
    const snap = await userRef(uid, `${RAIZ_V4}/meta`).once('value');
    return snap.exists();
}

export async function escribirV4(uid, datos) {
    return userRef(uid, RAIZ_V4).set(limpiar(datos));
}
