import { money, moneyRounded, getBankGradient, initialsAvatar } from '../utils/format.js';

// Construye el HTML de una tarjeta bancaria (débito/crédito/efectivo).
// `mostrarAcciones` agrega los botones editar/interés/borrar (lista maestra),
// `mostrarCompartir` agrega el ícono para generar la tarjeta de datos de depósito.
export function bankCardHTML(c, { mostrarAcciones = false, mostrarCompartir = false } = {}) {
    const hoy = new Date();
    const diaHoy = hoy.getDate();
    const mesAct = hoy.getMonth();
    let aviso = '';

    if (c.diaPago && c.diaPago > 0) {
        const yaPagado = c.mesPagado === mesAct;
        const vence = c.diaPago - diaHoy;
        if (yaPagado) {
            aviso = `<br><small style="color:#bbf7d0; font-weight:800;">✅ Pagado</small> <span data-action="desmarcarPagado" data-id="${c.id}" style="font-size:9px; cursor:pointer; text-decoration:underline;">(Deshacer)</span>`;
        } else {
            const texto = vence < 0 ? '⚠️ Atrasado' : (vence === 0 ? '🔥 ¡Paga HOY!' : `Faltan: ${vence}d`);
            const color = vence <= 3 ? '#fca5a5' : '#e5e5f5';
            aviso = `<br><small style="color:${color}; font-weight:800;">${texto}</small><br><button class="chip-btn" style="margin-top:4px; ${vence <= 0 ? 'background:rgba(225,29,72,0.9)' : ''}" data-action="marcarPagado" data-id="${c.id}">Marcar Pagado</button>`;
        }
    }

    const tituloSaldo = c.tipo === 'credito' ? 'DEUDA ACTUAL' : 'SALDO DISPONIBLE';
    let limiteInfo = '';
    if (c.tipo === 'credito' && c.limite > 0) {
        const disponible = c.limite - c.saldo;
        limiteInfo = `<div class="bank-card-limit"><div>Límite: ${moneyRounded(c.limite)}</div><div class="money-blur">Disp: ${money(disponible)}</div></div>`;
    }
    const digitosHtml = c.tipo !== 'efectivo' ? `<div class="bank-card-digits">**** ${c.digitos || '0000'}</div>` : '';
    const uiAvatars = initialsAvatar(c.banco);
    const finalSrc = c.icon || uiAvatars;
    const imgTag = `<img src="${finalSrc}" onerror="this.onerror=null; this.src='${uiAvatars}';" alt="">`;
    const shareIcon = mostrarCompartir ? `<div class="bank-card-share" data-action="compartirTarjeta" data-id="${c.id}"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 3H6a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h4M16 17l5-5-5-5M19.8 12H9"/></svg></div>` : '';

    const acciones = mostrarAcciones ? `<div class="bank-card-actions">
        <button class="chip-btn" data-action="editCuenta" data-id="${c.id}">✏️ Editar</button>
        <button class="chip-btn" data-action="sumarInteres" data-id="${c.id}">+ Interés</button>
        <button class="chip-btn danger" data-action="confirmarBorrarCuenta" data-id="${c.id}">Borrar</button>
    </div>` : '';

    return `<div class="bank-card" style="background:${getBankGradient(c.banco)};">
        <div class="bg-shape shape-1"></div><div class="bg-shape shape-2"></div>
        <div class="bank-card-inner">
            <div class="bank-card-top">
                <div class="bank-card-id">
                    ${imgTag}
                    <div style="min-width:0;">
                        <div class="bank-card-name">${c.banco.toUpperCase()}</div>
                        ${digitosHtml}
                    </div>
                </div>
                <div class="bank-card-badge">${c.tipo.toUpperCase()}</div>
            </div>
            <div>
                <div class="bank-card-balance-label">${tituloSaldo}</div>
                <div class="bank-card-balance money-blur">${money(c.saldo)}</div>
            </div>
            <div class="bank-card-bottom">
                <div><div class="bank-card-owner">${c.nombre}</div>${aviso}</div>
                <div style="display:flex; align-items:flex-end; gap:10px;">${limiteInfo}${shareIcon}</div>
            </div>
        </div>
        ${acciones}
    </div>`;
}
