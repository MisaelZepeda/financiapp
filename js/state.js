// Estado central de la app (una sola fuente de verdad en memoria, igual que la
// versión anterior) más las constantes compartidas entre módulos de render.

export const state = {
    uid: null,
    isDemo: false,
    perfil: { nombre: "Usuario", foto: "https://via.placeholder.com/100", color: "#7c3aed" },
    cuentas: [],
    transacciones: [],
    presupuestos: {},
    categoriasCustom: [],
    metas: [],
    recurrentes: [],
    currentBase64: "",
    selectedColor: "#7c3aed",
};

export const categoriasBase = ['Comida', 'Servicios', 'Transporte', 'Vivienda', 'Ocio', 'Otros'];

export const iconosCategoria = {
    'Comida': '🍔', 'Servicios': '⚡', 'Transporte': '🚗', 'Vivienda': '🏠', 'Ocio': '🍿',
    'Otros': '📦', 'Mascotas': '🐶', 'Salud': '💊', 'Ropa': '👕', 'Suscripciones': '📺', 'Gimnasio': '🏋️'
};

export const iconosMeta = ['🎯', '✈️', '🏠', '🚗', '💍', '🎓', '💻', '🏖️', '🛡️', '🎁'];

export const frasesFinancieras = [
    "Ser bueno con el dinero no significa acumularlo, sino saber cuándo dejarlo ir.",
    "El dinero es una herramienta, no el destino final.",
    "Cuida tus pequeños gastos; un pequeño agujero hunde un gran barco.",
    "Una meta sin un plan es solo un deseo.",
    "No ahorres lo que te sobra, gasta lo que te queda después de ahorrar.",
    "Invierte en ti hoy, el interés compuesto hará el resto.",
    "El presupuesto es decirle a tu dinero a dónde ir, en lugar de preguntarte a dónde fue.",
    "La paciencia y la disciplina son los mejores activos de tu portafolio.",
    "Controla tu dinero o él te controlará a ti."
];

export function todasLasCategorias() {
    return [...categoriasBase, ...state.categoriasCustom];
}

export function getIconCategoria(cat) {
    return iconosCategoria[cat] || '🏷️';
}
