// Piezas de HTML reutilizadas por varias vistas.

import { icon } from '../lib/icons.js';
import { money, moneyPartes, escapeHtml, colorBanco, TIPO_CUENTA, etiquetaDia } from '../lib/format.js';
import { sel } from '../core/store.js';
import { accionesSwipeHTML } from './gestos.js';

export function vacioHTML(ico, texto, extra = '') {
    return `<div class="vacio">${icon(ico)}<div>${escapeHtml(texto)}</div>${extra}</div>`;
}

export function monogramaHTML(cuenta) {
    const color = colorBanco(cuenta.banco);
    const inicial = escapeHtml((cuenta.banco || cuenta.nombre || '?').charAt(0).toUpperCase());
    const contenido = cuenta.icono
        ? `<img src="${escapeHtml(cuenta.icono)}" alt="" data-fallback="${inicial}" onerror="this.onerror=null; this.replaceWith(document.createTextNode(this.dataset.fallback));">`
        : inicial;
    return `<div class="fila-ico" style="background:color-mix(in srgb, ${color} 18%, transparent); color:color-mix(in srgb, ${color} 60%, var(--text));">${contenido}</div>`;
}

// Fila de cuenta (toca → detalle).
// Tarjeta visual de una cuenta: color del banco, nombre, saldo y últimos 4 dígitos.
// Con `enlace`, toda la tarjeta lleva al detalle de la cuenta.
const CHIP = '<svg class="tv-chip" viewBox="0 0 34 26" aria-hidden="true"><rect x="0.5" y="0.5" width="33" height="25" rx="5" fill="#e9c46a" stroke="#b8923a"/><path d="M0.5 9h10v8h-10M33.5 9h-10v8h10M10.5 0.5v25M23.5 0.5v25M10.5 13h13" stroke="#b8923a" fill="none"/></svg>';
export function tarjetaVisualHTML(c, { enlace = false } = {}) {
    const saldo = sel.saldo(c.id);
    const color = colorBanco(c.banco);
    const cred = c.tipo === 'credito';
    const p = moneyPartes(saldo);
    const etiqueta = cred ? 'Deuda' : c.tipo === 'efectivo' ? 'En la cartera' : 'Saldo';
    const banco = escapeHtml(c.banco && c.banco.toLowerCase() !== 'efectivo' ? c.banco : (c.tipo === 'efectivo' ? 'Efectivo' : c.nombre));
    const inner = `
        <div class="tv-top"><span class="tv-banco">${banco}</span><span class="tv-tipo">${TIPO_CUENTA[c.tipo] || ''}</span></div>
        ${c.tipo === 'efectivo' ? `<span class="tv-chip tv-billete">${icon('coin')}</span>` : CHIP}
        <div class="tv-saldo"><small>${etiqueta}</small><b class="num privado">${p.signo}${p.entero}<span class="cent">${p.decimales}</span></b></div>
        <div class="tv-pie"><span class="tv-nombre">${escapeHtml(c.nombre)}</span>${c.digitos ? `<span class="tv-digitos num">•••• ${escapeHtml(c.digitos)}</span>` : ''}</div>`;
    const estilo = `--tv:${color}`;
    return enlace
        ? `<a class="tarjeta-visual tv-${c.tipo}" href="#/cuenta/${encodeURIComponent(c.id)}" style="${estilo}" aria-label="${escapeHtml(c.nombre)}">${inner}</a>`
        : `<div class="tarjeta-visual tv-${c.tipo}" style="${estilo}">${inner}</div>`;
}

export function cuentaFilaHTML(c, { secundario } = {}) {
    const saldo = sel.saldo(c.id);
    // Banco y últimos dígitos (el tipo ya lo dice el grupo donde aparece la fila).
    const banco = c.banco && c.banco.toLowerCase() !== c.nombre.toLowerCase() ? escapeHtml(c.banco) : '';
    const sub = [banco, c.digitos ? `•• ${escapeHtml(c.digitos)}` : ''].filter(Boolean).join(' · ') || TIPO_CUENTA[c.tipo];
    const der = secundario ?? (c.tipo === 'credito' && c.limite > 0 ? `<small class="privado">Disp. ${money(c.limite - saldo)}</small>` : '');
    return `<a class="fila fila-link" href="#/cuenta/${encodeURIComponent(c.id)}">
        ${monogramaHTML(c)}
        <div class="fila-body"><div class="fila-titulo">${escapeHtml(c.nombre)}</div><div class="fila-sub">${sub}</div></div>
        <div class="fila-der"><span class="num privado">${money(saldo)}</span>${der}</div>
    </a>`;
}

const SUBTIPO = { pago_tdc: 'Pago de tarjeta', traspaso: 'Traspaso', rendimiento: 'Rendimiento', cashback: 'Cashback' };

// Ícono, color y textos de un movimiento.
export function describirTx(tx) {
    const origen = sel.cuenta(tx.cuentaId);
    const destino = sel.cuenta(tx.cuentaDestinoId);
    if (tx.tipo === 'transferencia') {
        return {
            icono: tx.subtipo === 'pago_tdc' ? 'credit-card' : 'repeat', tono: '',
            titulo: tx.desc || SUBTIPO[tx.subtipo] || 'Transferencia',
            sub: `${origen?.nombre || 'Cuenta'} → ${destino?.nombre || 'Cuenta'}`,
            signo: '', clase: '',
        };
    }
    if (tx.tipo === 'ingreso') {
        return {
            icono: tx.subtipo === 'cashback' ? 'gift' : (tx.subtipo === 'rendimiento' ? 'trending-up' : 'coin'), tono: 'tono-pos',
            titulo: tx.desc || SUBTIPO[tx.subtipo] || 'Ingreso',
            sub: [SUBTIPO[tx.subtipo], origen?.nombre].filter(Boolean).join(' · ') || 'Ingreso',
            signo: '+', clase: 'pos',
        };
    }
    const cat = sel.categoria(tx.categoriaId);
    const dividido = Array.isArray(tx.partes) && tx.partes.length > 1;
    return {
        icono: dividido ? 'list' : (cat.icono || 'tag'), tono: '',
        titulo: tx.desc || cat.nombre,
        sub: [dividido ? tx.partes.map(p => sel.categoria(p.categoriaId).nombre).join(' + ') : cat.nombre, origen?.nombre, tx.msi > 1 ? `${tx.msi} MSI` : ''].filter(Boolean).join(' · '),
        signo: '−', clase: '',
    };
}

export function txFilaHTML(tx) {
    const d = describirTx(tx);
    return `<div class="swipe">${accionesSwipeHTML(escapeHtml(tx.id))}<div class="fila fila-link swipe-fila" data-action="editarTx" data-id="${escapeHtml(tx.id)}" role="button" tabindex="0">
        <div class="fila-ico ${d.tono}">${icon(d.icono)}</div>
        <div class="fila-body"><div class="fila-titulo">${escapeHtml(d.titulo)}</div><div class="fila-sub">${escapeHtml(d.sub)}${tx.etiquetas?.length ? ` ${tx.etiquetas.map(e => `<span class="tag">#${escapeHtml(e)}</span>`).join(' ')}` : ''}</div></div>
        <div class="fila-der"><span class="num privado ${d.clase}">${d.signo}${money(Math.abs(tx.monto))}</span></div>
    </div></div>`;
}

// Lista de movimientos agrupada por día, con el neto del día.
export function txAgrupadasHTML(txs) {
    let html = '', dia = null, grupo = [];
    const cerrar = () => {
        if (!grupo.length) return;
        const neto = grupo.reduce((a, t) => a + (t.tipo === 'ingreso' ? t.monto : t.tipo === 'gasto' ? -t.monto : 0), 0);
        html += `<div class="grupo-fecha"><span>${etiquetaDia(dia)}</span><span class="num privado">${neto ? (neto > 0 ? '+' : '') + money(neto) : ''}</span></div>`;
        html += grupo.map(txFilaHTML).join('');
    };
    txs.forEach(t => { if (t.fecha !== dia) { cerrar(); dia = t.fecha; grupo = []; } grupo.push(t); });
    cerrar();
    return html;
}

export function avatarHTML(perfil) {
    const inicial = escapeHtml((perfil.nombre || 'U').trim().charAt(0).toUpperCase());
    return perfil.foto
        ? `<span class="avatar"><img src="${escapeHtml(perfil.foto)}" alt=""></span>`
        : `<span class="avatar">${inicial}</span>`;
}
