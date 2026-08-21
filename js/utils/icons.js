// Helper para referenciar el sprite de íconos SVG definido en index.html
// (<symbol id="i-NOMBRE">). Cero emojis: todo ícono es vectorial y se ve
// idéntico en cualquier dispositivo/SO.
//
// `name` a veces viene de datos guardados por el usuario (p.ej. el ícono de
// una meta de ahorro, restaurable desde un respaldo .json). Se valida contra
// un patrón estricto antes de insertarlo en el atributo href: así un
// respaldo manipulado no puede inyectar HTML/atributos aunque no pase por
// escapeHtml.
const NOMBRE_VALIDO = /^[a-z0-9-]+$/;

export function icon(name, cls = '') {
    const safeName = NOMBRE_VALIDO.test(name) ? name : 'tag';
    const safeCls = String(cls).replace(/[^a-z0-9 _-]/gi, '');
    return `<svg class="icon ${safeCls}" aria-hidden="true"><use href="#i-${safeName}"></use></svg>`;
}
