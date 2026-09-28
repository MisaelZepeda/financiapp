// Piezas de HTML reutilizadas por varias vistas.

import { icon } from '../lib/icons.js';
import { money, escapeHtml, colorBanco, TIPO_CUENTA, etiquetaDia } from '../lib/format.js';
import { sel } from '../core/store.js';

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
    return {
        icono: cat.icono || 'tag', tono: '',
        titulo: tx.desc || cat.nombre,
        sub: [cat.nombre, origen?.nombre, tx.msi > 1 ? `${tx.msi} MSI` : ''].filter(Boolean).join(' · '),
        signo: '−', clase: '',
    };
}

export function txFilaHTML(tx) {
    const d = describirTx(tx);
    return `<div class="fila fila-link" data-action="editarTx" data-id="${escapeHtml(tx.id)}" role="button" tabindex="0">
        <div class="fila-ico ${d.tono}">${icon(d.icono)}</div>
        <div class="fila-body"><div class="fila-titulo">${escapeHtml(d.titulo)}</div><div class="fila-sub">${escapeHtml(d.sub)}</div></div>
        <div class="fila-der"><span class="num privado ${d.clase}">${d.signo}${money(Math.abs(tx.monto))}</span></div>
    </div>`;
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
