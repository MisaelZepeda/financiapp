import { sel } from '../core/store.js';
import { icon } from '../lib/icons.js';
import { money } from '../lib/format.js';
import { cuentaFilaHTML, vacioHTML } from '../components/piezas.js';

export const titulo = () => ({ titulo: 'Cuentas', subtitulo: 'Débito, efectivo y crédito' });

export function render() {
    const cuentas = sel.cuentas();
    const p = sel.patrimonio();
    const grupo = (t, lista, total, etiqueta) => lista.length ? `<section class="card">
        <div class="card-head"><h2 class="card-title">${t}</h2><span class="card-meta">${etiqueta} <b class="num privado" style="color:var(--text)">${money(total)}</b></span></div>
        <div class="lista">${lista.map(c => cuentaFilaHTML(c)).join('')}</div>
    </section>` : '';
    return `
        <div class="acciones-top"><button class="btn btn-primary" data-action="nuevaCuenta">${icon('plus')}Nueva cuenta</button></div>
        ${cuentas.length ? `<div class="stack">
            ${grupo('Débito y efectivo', cuentas.filter(c => c.tipo !== 'credito'), p.activos, 'Total')}
            ${grupo('Tarjetas de crédito', cuentas.filter(c => c.tipo === 'credito'), p.deudas, 'Deuda')}
        </div>` : `<section class="card">${vacioHTML('landmark', 'Aún no tienes cuentas. Agrega tu cuenta de nómina, tu efectivo o tus tarjetas.')}</section>`}`;
}
