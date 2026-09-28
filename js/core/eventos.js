// Delegación de eventos: los elementos declaran data-action="nombre" (clic),
// data-input="nombre" (escritura) o data-change="nombre" (cambio), y los
// módulos registran el manejador con on(). Así el HTML generado no lleva JS.

const handlers = { click: {}, input: {}, change: {}, submit: {} };

export function on(nombre, fn, tipo = 'click') { handlers[tipo][nombre] = fn; }

export function iniciarEventos() {
    document.addEventListener('click', (e) => {
        const el = e.target.closest('[data-action]');
        if (!el || el.disabled) return;
        const fn = handlers.click[el.dataset.action];
        if (fn) { e.preventDefault(); fn(el, e); }
    });
    ['input', 'change'].forEach(tipo => document.addEventListener(tipo, (e) => {
        const el = e.target.closest(`[data-${tipo}]`);
        const fn = el && handlers[tipo][el.dataset[tipo]];
        if (fn) fn(el, e);
    }));
    document.addEventListener('submit', (e) => {
        const form = e.target.closest('form[data-submit]');
        const fn = form && handlers.submit[form.dataset.submit];
        if (fn) { e.preventDefault(); fn(form, e); }
    });
}
