// Sugiere la categoría de un gasto a partir de su descripción.
// 1) Tu historial: qué categoría usas con descripciones parecidas (pesa más).
// 2) Un diccionario base de comercios y conceptos comunes en México.

import { slugCategoria } from './categorias.js';

// palabra clave (sin acentos, minúsculas) → id de categoría base
const DICCIONARIO = {
    comida: ['oxxo', 'seven', '7eleven', 'super', 'supermercado', 'despensa', 'walmart', 'soriana', 'chedraui', 'costco', 'sams', 'heb', 'bodega', 'aurrera', 'mercado', 'tienda', 'abarrotes', 'restaurante', 'tacos', 'taqueria', 'pizza', 'cafe', 'starbucks', 'comida', 'cena', 'desayuno', 'rappi', 'didi food', 'uber eats', 'ubereats', 'panaderia', 'tortilleria', 'carniceria', 'frutas'],
    transporte: ['uber', 'didi', 'cabify', 'taxi', 'gasolina', 'gas', 'pemex', 'shell', 'bp', 'mobil', 'estacionamiento', 'caseta', 'peaje', 'metro', 'camion', 'autobus', 'ado', 'tenencia', 'verificacion', 'refaccion', 'llantas', 'servicio auto'],
    servicios: ['cfe', 'luz', 'agua', 'telmex', 'izzi', 'totalplay', 'megacable', 'internet', 'telefono', 'celular', 'telcel', 'att', 'movistar', 'gas natural', 'naturgy', 'predial', 'mantenimiento'],
    suscripciones: ['netflix', 'spotify', 'disney', 'hbo', 'prime', 'amazon prime', 'youtube', 'apple', 'icloud', 'google one', 'xbox', 'playstation', 'chatgpt', 'claude', 'suscripcion'],
    vivienda: ['renta', 'hipoteca', 'infonavit', 'muebles', 'home depot', 'ferreteria', 'plomero', 'limpieza'],
    salud: ['farmacia', 'similares', 'benavides', 'guadalajara', 'del ahorro', 'doctor', 'medico', 'consulta', 'dentista', 'hospital', 'laboratorio', 'analisis', 'gimnasio', 'gym', 'smart fit', 'seguro medico'],
    ocio: ['cine', 'cinepolis', 'cinemex', 'concierto', 'boletos', 'ticketmaster', 'bar', 'antro', 'cerveza', 'juego', 'steam', 'viaje', 'hotel', 'airbnb', 'vuelo', 'aeromexico', 'volaris', 'vivaaerobus'],
    mascotas: ['veterinario', 'croquetas', 'petco', '+kota', 'mascota', 'perro', 'gato'],
};

export const normalizar = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const palabras = (t) => normalizar(t).split(/[^a-z0-9+]+/).filter(p => p.length > 1);

// Devuelve { categoriaId, fuente: 'historial'|'diccionario' } o null.
export function sugerirCategoria(desc, transacciones = [], categoriasValidas = null) {
    const texto = normalizar(desc);
    if (texto.length < 2) return null;
    const valida = (id) => !categoriasValidas || categoriasValidas.includes(id);

    // Historial: descripción idéntica gana; si no, las que compartan palabras.
    const conteo = {};
    const mias = palabras(texto);
    for (const t of transacciones) {
        if (t.tipo !== 'gasto' || !t.categoriaId || !t.desc || !valida(t.categoriaId)) continue;
        const otra = normalizar(t.desc);
        let puntos = 0;
        if (otra === texto) puntos = 5;
        else {
            const comunes = palabras(otra).filter(p => mias.includes(p)).length;
            if (comunes) puntos = comunes / Math.max(mias.length, 1);
        }
        if (puntos) conteo[t.categoriaId] = (conteo[t.categoriaId] || 0) + puntos;
    }
    const mejor = Object.entries(conteo).sort((a, b) => b[1] - a[1])[0];
    if (mejor && mejor[1] >= 1) return { categoriaId: mejor[0], fuente: 'historial' };

    // Diccionario base: primero frases ("uber eats", "gas natural"), luego palabras sueltas.
    for (const frases of [true, false]) {
        for (const [cat, claves] of Object.entries(DICCIONARIO)) {
            const id = slugCategoria(cat);
            if (!valida(id)) continue;
            const hay = claves.some(k => frases ? (k.includes(' ') && texto.includes(k)) : (!k.includes(' ') && mias.includes(k)));
            if (hay) return { categoriaId: id, fuente: 'diccionario' };
        }
    }
    return mejor ? { categoriaId: mejor[0], fuente: 'historial' } : null;
}

// Busca una categoría o cuenta por nombre aproximado (para Siri/Atajos).
export function buscarPorNombre(texto, items, campo = 'nombre') {
    const q = normalizar(texto);
    if (!q) return null;
    return items.find(i => normalizar(i[campo]) === q)
        || items.find(i => normalizar(i[campo]).startsWith(q) || q.startsWith(normalizar(i[campo])))
        || items.find(i => normalizar(i[campo]).includes(q) || q.includes(normalizar(i[campo])))
        || null;
}
