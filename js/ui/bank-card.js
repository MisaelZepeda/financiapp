import { money, moneyRounded, getBankColorsArray } from '../utils/format.js';
import { icon } from '../utils/icons.js';

// Construye el HTML de una fila de cuenta (débito/crédito/efectivo), estilo
// "renglón de estado de cuenta": panel con borde fino y una franja de color
// de acento por institución (nada de fondos degradados ni emojis).
export function bankCardHTML(c, { mostrarAcciones = false, mostrarCompartir = false } = {}) {
    const hoy = new Date();
    const diaHoy = hoy.getDate();
    const mesAct = hoy.getMonth();
    let aviso = '';

    if (c.diaPago && c.diaPago > 0) {
        const yaPagado = c.mesPagado === mesAct;
        const vence = c.diaPago - diaHoy;
        if (yaPagado) {
            aviso = `<div class="acc-due" style="color:var(--success);">${icon('check-circle')}Pagado <span data-action="desmarcarPagado" data-id="${c.id}" style="cursor:pointer; text-decoration:underline; font-weight:600;">(Deshacer)</span></div>`;
        } else {
            const texto = vence < 0 ? 'Atrasado' : (vence === 0 ? '¡Paga hoy!' : `Faltan ${vence}d`);
            const color = vence <= 3 ? 'var(--danger)' : 'var(--text-muted)';
            aviso = `<div class="acc-due" style="color:${color};">${icon('alert-circle')}${texto}</div><button class="chip-btn" style="margin-top:6px;" data-action="marcarPagado" data-id="${c.id}">Marcar pagado</button>`;
        }
    }

    const tituloSaldo = c.tipo === 'credito' ? 'Deuda actual' : 'Saldo disponible';
    let limiteInfo = '';
    if (c.tipo === 'credito' && c.limite > 0) {
        const disponible = c.limite - c.saldo;
        limiteInfo = `<div class="acc-limit"><div>Límite: ${moneyRounded(c.limite)}</div><div class="money-blur">Disp: ${money(disponible)}</div></div>`;
    }
    const digitosHtml = c.tipo !== 'efectivo' ? `<div class="acc-digits">•••• ${c.digitos || '0000'}</div>` : '';
    const accentColor = getBankColorsArray(c.banco)[0];
    const monogram = c.icon
        ? `<img src="${c.icon}" onerror="this.onerror=null; this.replaceWith(document.createTextNode('${(c.banco || '?').charAt(0).toUpperCase()}'));" alt="" style="width:100%; height:100%; object-fit:contain; border-radius:inherit;">`
        : (c.banco || '?').charAt(0).toUpperCase();
    const shareIcon = mostrarCompartir ? `<div class="acc-share" data-action="compartirTarjeta" data-id="${c.id}">${icon('share')}</div>` : '';

    const acciones = mostrarAcciones ? `<div class="acc-actions">
        <button class="chip-btn" data-action="editCuenta" data-id="${c.id}">${icon('edit')}Editar</button>
        <button class="chip-btn" data-action="sumarInteres" data-id="${c.id}">${icon('plus-circle')}Interés</button>
        <button class="chip-btn danger" data-action="confirmarBorrarCuenta" data-id="${c.id}">${icon('trash')}Borrar</button>
    </div>` : '';

    return `<div class="acc-row" style="--acc-color:${accentColor};">
        <div class="acc-row-top">
            <div class="acc-id">
                <div class="acc-monogram">${monogram}</div>
                <div style="min-width:0;">
                    <div class="acc-name">${c.banco.toUpperCase()}</div>
                    ${digitosHtml}
                </div>
            </div>
            <div class="acc-badge">${c.tipo}</div>
        </div>
        <div>
            <div class="acc-balance-label">${tituloSaldo}</div>
            <div class="acc-balance money-blur tabular-nums">${money(c.saldo)}</div>
        </div>
        <div class="acc-bottom">
            <div><div class="acc-owner">${c.nombre}</div>${aviso}</div>
            <div style="display:flex; align-items:flex-end; gap:10px;">${limiteInfo}${shareIcon}</div>
        </div>
        ${acciones}
    </div>`;
}
