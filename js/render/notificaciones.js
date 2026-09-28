import { state, todasLasCategorias } from '../state.js';
import { money, escapeHtml } from '../utils/format.js';
import { icon } from '../utils/icons.js';
import { calcularVencidos } from '../data/recurrentes.js';

// Claves válidas para Firebase (sin . # $ / [ ]).
const clave = (...partes) => partes.join('_').replace(/[.#$/[\]\s]/g, '-');

// Cada aviso lleva una clave que describe su situación concreta: si el
// usuario lo descarta y la situación cambia (p. ej. "paga en 3 días" pasa a
// "atrasado", o llega un mes nuevo), la clave cambia y el aviso reaparece.
function construirNotificaciones() {
    const items = [];
    const hoy = new Date();
    const diaHoy = hoy.getDate();
    const mesAct = hoy.getMonth();
    const prefijoMes = `${hoy.getFullYear()}-${(hoy.getMonth() + 1).toString().padStart(2, '0')}`;

    // Tarjetas de crédito por vencer / atrasadas
    state.cuentas.filter(c => c.tipo === 'credito' && c.diaPago > 0).forEach(c => {
        if (c.mesPagado === mesAct) return;
        const vence = c.diaPago - diaHoy;
        if (vence <= 5) {
            const estado = vence < 0 ? 'atrasado' : (vence === 0 ? 'hoy' : 'pronto');
            items.push({
                key: clave('tdc', c.id, prefijoMes, estado),
                ico: vence < 0 ? 'alert-triangle' : 'credit-card', bg: vence < 0 ? 'var(--danger-soft)' : 'var(--warning-soft)', color: vence < 0 ? 'var(--danger)' : 'var(--warning)',
                titulo: vence < 0 ? `${c.nombre}: pago atrasado` : (vence === 0 ? `${c.nombre}: paga hoy` : `${c.nombre}: paga en ${vence} día${vence === 1 ? '' : 's'}`),
                sub: 'Tarjeta de crédito',
            });
        }
    });

    // Presupuestos cerca o sobre el límite
    const txMes = state.transacciones.filter(t => t.tipo === 'gasto' && t.fecha?.startsWith(prefijoMes));
    todasLasCategorias().forEach(cat => {
        const limite = Number(state.presupuestos[cat]) || 0;
        if (limite <= 0) return;
        const gastado = txMes.filter(t => t.cat === cat).reduce((a, b) => a + Number(b.monto || 0), 0);
        const pct = (gastado / limite) * 100;
        if (pct >= 90) items.push({ key: clave('pres', cat, prefijoMes, pct >= 100 ? 'excedido' : 'casi'), ico: 'alert-circle', bg: pct >= 100 ? 'var(--danger-soft)' : 'var(--warning-soft)', color: pct >= 100 ? 'var(--danger)' : 'var(--warning)', titulo: `Presupuesto de ${cat} ${pct >= 100 ? 'excedido' : 'casi al límite'}`, sub: `${money(gastado)} de ${money(limite)}` });
    });

    // Recurrentes vencidos (la clave cambia al generar cada ocurrencia)
    const vencidos = calcularVencidos(hoy);
    if (vencidos.length > 0) items.push({ key: clave('rec', ...vencidos.map(r => `${r.id}@${r.ultimaGeneracion || ''}`).sort()), ico: 'repeat', bg: 'var(--info-soft)', color: 'var(--info)', titulo: `${vencidos.length} pago${vencidos.length > 1 ? 's' : ''} recurrente${vencidos.length > 1 ? 's' : ''} pendiente${vencidos.length > 1 ? 's' : ''}`, sub: 'Ve a Recurrentes para generarlos' });

    // Metas cerca de completarse
    state.metas.forEach(m => {
        if (m.montoObjetivo <= 0) return;
        const pct = (m.montoActual / m.montoObjetivo) * 100;
        if (pct >= 90 && pct < 100) items.push({ key: clave('meta', m.id, 'casi'), ico: 'target', bg: 'var(--primary-soft)', color: 'var(--primary)', titulo: `Meta "${m.nombre}" casi lista`, sub: `${pct.toFixed(0)}% completada` });
    });

    const descartadas = state.notifDescartadas || {};
    return items.filter(n => !descartadas[n.key]);
}

let clavesVisibles = [];
export function clavesNotificacionesVisibles() { return clavesVisibles.slice(); }

export function renderNotificaciones() {
    const items = construirNotificaciones();
    clavesVisibles = items.map(n => n.key);
    const lista = document.getElementById('notifList');
    const dot = document.getElementById('notifDot');
    const borrarTodas = document.getElementById('notifClearAll');
    if (dot) dot.style.display = items.length > 0 ? 'block' : 'none';
    if (borrarTodas) borrarTodas.style.display = items.length > 1 ? 'inline-flex' : 'none';
    if (!lista) return items.length;
    lista.innerHTML = items.length
        ? items.map(n => `<div class="notif-item">
            <div class="notif-ico" style="background:${n.bg}; color:${n.color};">${icon(n.ico)}</div>
            <div class="notif-text"><b>${escapeHtml(n.titulo)}</b><span>${escapeHtml(n.sub)}</span></div>
            <button class="notif-dismiss" data-action="descartarNotif" data-key="${escapeHtml(n.key)}" title="Borrar" aria-label="Borrar notificación">${icon('x')}</button>
        </div>`).join('')
        : `<div class="empty-state" style="padding:24px 16px;">${icon('bell')}Sin notificaciones por ahora.</div>`;
    return items.length;
}
