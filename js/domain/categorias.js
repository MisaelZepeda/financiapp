// Catálogo de categorías de gasto. En v4 cada categoría es un objeto con id,
// nombre, ícono, orden y presupuesto mensual opcional.

export const CATEGORIAS_BASE = [
    { nombre: 'Comida', icono: 'utensils' },
    { nombre: 'Servicios', icono: 'zap' },
    { nombre: 'Transporte', icono: 'car' },
    { nombre: 'Vivienda', icono: 'home' },
    { nombre: 'Ocio', icono: 'film' },
    { nombre: 'Salud', icono: 'medical' },
    { nombre: 'Suscripciones', icono: 'repeat' },
    { nombre: 'Otros', icono: 'box' },
];

// Íconos sugeridos para nombres conocidos de categorías propias.
const ICONOS_CONOCIDOS = {
    mascotas: 'paw', salud: 'medical', ropa: 'shirt', gimnasio: 'dumbbell', gym: 'dumbbell',
    viajes: 'plane', regalos: 'gift', suscripciones: 'repeat', educacion: 'file-text', escuela: 'file-text',
};

export const ICONOS_CATEGORIA = ['utensils', 'zap', 'car', 'home', 'film', 'medical', 'repeat', 'box', 'paw', 'shirt', 'dumbbell', 'plane', 'gift', 'heart', 'tag', 'coin', 'file-text', 'shield', 'target', 'credit-card'];

// Id estable a partir del nombre: 'Comida rápida' → 'comida-rapida'.
export function slugCategoria(nombre) {
    return String(nombre || 'otros').normalize('NFD').replace(/[̀-ͯ]/g, '')
        .toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'otros';
}

export function iconoSugerido(nombre) {
    return ICONOS_CONOCIDOS[slugCategoria(nombre)] || 'tag';
}

export function categoriasIniciales() {
    const out = {};
    CATEGORIAS_BASE.forEach((c, i) => { const id = slugCategoria(c.nombre); out[id] = { id, nombre: c.nombre, icono: c.icono, orden: i }; });
    return out;
}
