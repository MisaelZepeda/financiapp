// Helper para referenciar el sprite de íconos SVG definido en index.html
// (<symbol id="i-NOMBRE">). Cero emojis: todo ícono es vectorial y se ve
// idéntico en cualquier dispositivo/SO.
export function icon(name, cls = '') {
    return `<svg class="icon ${cls}" aria-hidden="true"><use href="#i-${name}"></use></svg>`;
}
