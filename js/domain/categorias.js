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

// Colores para elegir; se ven bien en tema claro y oscuro.
export const COLORES_CATEGORIA = [
    { hex: '#3b82f6', nombre: 'Azul' }, { hex: '#06b6d4', nombre: 'Cian' }, { hex: '#22c55e', nombre: 'Verde' },
    { hex: '#84cc16', nombre: 'Lima' }, { hex: '#f59e0b', nombre: 'Ámbar' }, { hex: '#f97316', nombre: 'Naranja' },
    { hex: '#ef4444', nombre: 'Rojo' }, { hex: '#ec4899', nombre: 'Rosa' }, { hex: '#a855f7', nombre: 'Morado' },
    { hex: '#6366f1', nombre: 'Índigo' }, { hex: '#a16207', nombre: 'Café' }, { hex: '#64748b', nombre: 'Gris' },
];

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
