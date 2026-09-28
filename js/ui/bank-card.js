import { money, moneyRounded, getBankColorsArray, escapeHtml } from '../utils/format.js';
import { icon } from '../utils/icons.js';

const TIPO_LABEL = { debito: 'Débito', credito: 'Crédito', efectivo: 'Efectivo' };

// Monograma de la institución: logo (si el usuario dio un enlace) o inicial.
// Sin JS embebido con datos del usuario en el atributo onerror: el texto de
// respaldo se lee de un data-attribute (ya escapado), nunca se concatena
// directo al código del manejador de error.
function monogramHTML(c) {
    const inicial = escapeHtml((c.banco || '?').charAt(0).toUpperCase());
    const contenido = c.icon
        ? `<img src="${escapeHtml(c.icon)}" data-fallback="${inicial}" onerror="this.onerror=null; this.replaceWith(document.createTextNode(this.dataset.fallback));" alt="" style="width:100%; height:100%; object-fit:contain; border-radius:inherit;">`
        : inicial;
    return `<div class="acc-monogram" style="--acc-color:${getBankColorsArray(c.banco)[0]};">${contenido}</div>`;
}

function metaCuenta(c) {
    const partes = [escapeHtml(c.nombre)];
    if (c.tipo !== 'efectivo' && c.digitos) partes.push(`•••• ${escapeHtml(c.digitos)}`);
    return partes.join(' · ');
}

// Aviso de fecha de pago para tarjetas de crédito (o vacío si no aplica).
function avisoPagoHTML(c) {
    if (!c.diaPago || c.diaPago <= 0) return '';
    const hoy = new Date();
    if (c.mesPagado === hoy.getMonth()) {
        return `<span class="acc-due text-success">${icon('check-circle')}Pagada este mes · <span class="acc-due-action" data-action="desmarcarPagado" data-id="${c.id}">Deshacer</span></span>`;
    }
    const vence = c.diaPago - hoy.getDate();
    const texto = vence < 0 ? 'Pago atrasado' : (vence === 0 ? 'Se paga hoy' : `Pagar en ${vence} día${vence === 1 ? '' : 's'}`);
    const color = vence <= 3 ? 'var(--danger)' : 'var(--text-muted)';
    return `<span class="acc-due" style="color:${color};">${icon('calendar')}${texto} · <span class="acc-due-action" data-action="marcarPagado" data-id="${c.id}">Marcar pagada</span></span>`;
}

// Fila compacta para la tarjeta "Cuentas" del Inicio.
export function accountRowHTML(c, { mostrarCompartir = false } = {}) {
    const esCredito = c.tipo === 'credito';
    const aviso = esCredito ? avisoPagoHTML(c) : '';
    const secundario = esCredito && c.limite > 0
        ? `<small class="money-blur">Disp. ${moneyRounded(c.limite - c.saldo)}</small>`
        : `<small>${TIPO_LABEL[c.tipo] || ''}</small>`;
    const share = mostrarCompartir
        ? `<button class="mini-icon-btn" data-action="compartirTarjeta" data-id="${c.id}" title="Compartir datos de depósito" aria-label="Compartir datos de depósito">${icon('share')}</button>`
        : '';

    return `<div class="acc-item">
        ${monogramHTML(c)}
        <div class="acc-item-body">
            <div class="acc-item-name">${escapeHtml(c.banco)}</div>
            <div class="acc-item-meta">${metaCuenta(c)}</div>
            ${aviso}
        </div>
        <div class="acc-item-right">
            <b class="money-blur tabular-nums">${money(c.saldo)}</b>
            ${secundario}
        </div>
        ${share}
    </div>`;
}

// Tarjeta completa para la pestaña Cuentas (con acciones).
export function bankCardHTML(c, { mostrarAcciones = false, mostrarCompartir = false } = {}) {
    const esCredito = c.tipo === 'credito';
    const tituloSaldo = esCredito ? 'Deuda actual' : 'Saldo disponible';

    let uso = '';
    if (esCredito && c.limite > 0) {
        const pct = Math.max(0, Math.min(100, (c.saldo / c.limite) * 100));
        const color = pct > 80 ? 'var(--danger)' : (pct > 50 ? 'var(--warning)' : 'var(--primary)');
        uso = `<div class="acc-usage">
            <div class="progress-bar-track"><div class="progress-bar-fill" style="width:${pct}%; background:${color};"></div></div>
            <div class="acc-usage-meta"><span>${pct.toFixed(0)}% usado</span><span class="money-blur">Disponible ${money(c.limite - c.saldo)} de ${moneyRounded(c.limite)}</span></div>
        </div>`;
    }

    const aviso = avisoPagoHTML(c);
    const share = mostrarCompartir || c.tipo === 'debito'
        ? `<button class="mini-icon-btn" data-action="compartirTarjeta" data-id="${c.id}" title="Compartir datos de depósito" aria-label="Compartir datos de depósito">${icon('share')}</button>`
        : '';

    const acciones = mostrarAcciones ? `<div class="acc-actions">
        <button class="chip-btn" data-action="editCuenta" data-id="${c.id}">${icon('edit')}Editar</button>
        ${c.tipo === 'debito' ? `<button class="chip-btn" data-action="registrarRecompensa" data-id="${c.id}">${icon('plus-circle')}Rendimiento</button>` : ''}
        ${esCredito ? `<button class="chip-btn" data-action="registrarRecompensa" data-id="${c.id}">${icon('coin')}Cashback</button>` : ''}
        <button class="chip-btn danger" data-action="confirmarBorrarCuenta" data-id="${c.id}">${icon('trash')}Eliminar</button>
    </div>` : '';

    return `<div class="acc-card">
        <div class="acc-card-top">
            ${monogramHTML(c)}
            <div class="acc-item-body">
                <div class="acc-item-name">${escapeHtml(c.banco)}</div>
                <div class="acc-item-meta">${metaCuenta(c)}</div>
            </div>
            <span class="badge badge-neutral">${TIPO_LABEL[c.tipo] || escapeHtml(c.tipo)}</span>
            ${share}
        </div>
        <div>
            <div class="acc-balance-label">${tituloSaldo}</div>
            <div class="acc-balance money-blur tabular-nums">${money(c.saldo)}</div>
        </div>
        ${uso}
        ${aviso ? `<div class="acc-card-foot">${aviso}</div>` : ''}
        ${acciones}
    </div>`;
}
