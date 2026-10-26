// Avisos para el iPhone de los próximos 14 días. Función pura: la app los
// calcula y los manda al Worker, que los envía a su hora aunque la app esté cerrada.
//
//   tarjeta      un día antes de la fecha límite y el mismo día, a las 9:00, si falta pagar
//   recurrente   el día que toca, a las 9:00
//   presupuesto  al llegar al 90 % y al rebasarlo (una vez por categoría y mes)
//   fin de mes   si la proyección queda en negativo (una vez por mes)
//   semanal      domingo a las 19:00, Tlaco resume la semana
//
// Los ids que empiezan con "m:" se envían una sola vez por mes (el Worker los recuerda).

import { hoyISO, mesKey, sumarMeses, sumarDias, aFecha } from './fechas.js';
import { eventosMes } from './calendario.js';
import { resumenMes } from './analisis.js';
import { proyectarFinDeMes } from './proyeccion.js';

const DIAS = 14;
const fmt = (n) => '$' + Number(Math.abs(n) || 0).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

// Fecha ISO + hora local → milisegundos.
export function momento(iso, hora, minuto = 0) {
    const d = aFecha(iso);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), hora, minuto).getTime();
}

// Para avisos por estado (presupuesto, proyección): ya mismo si es de día; si no, a las 9:00.
export function proximoMomento(ahora) {
    const h = ahora.getHours() + ahora.getMinutes() / 60;
    if (h >= 9 && h < 21.5) return ahora.getTime() + 60000;
    const dia = h < 9 ? hoyISO(ahora) : sumarDias(hoyISO(ahora), 1);
    return momento(dia, 9);
}

export function calcularRecordatorios({ cuentas = [], saldos = {}, transacciones = [], recurrentes = [], categorias = [] }, ahora = new Date()) {
    const h = hoyISO(ahora);
    const hasta = sumarDias(h, DIAS);
    const desdeMs = ahora.getTime() - 60000;
    const porId = Object.fromEntries(cuentas.map(c => [c.id, c]));
    const avisos = [];
    const agregar = (a) => { if (a.at >= desdeMs && a.at <= momento(hasta, 23, 59)) avisos.push(a); };

    // Eventos del calendario de este mes y el siguiente (cubren los 14 días).
    const mes = mesKey(ahora);
    const eventos = [mes, sumarMeses(mes, 1)].flatMap(k => eventosMes(k, { cuentas, transacciones, recurrentes }, ahora))
        .filter(e => e.fecha >= h && e.fecha <= hasta);

    eventos.filter(e => e.tipo === 'pago' && !e.pagado && e.monto > 0).forEach(e => {
        const c = porId[e.cuentaId];
        const nombre = c?.nombre || 'tu tarjeta';
        const cuanto = `${e.estimado ? 'Aprox. ' : ''}${fmt(e.monto)} para no generar intereses.`;
        const url = `#/cuenta/${e.cuentaId}`;
        agregar({ id: `tdc:${e.cuentaId}:${e.fecha}:antes`, at: momento(sumarDias(e.fecha, -1), 9), title: `Mañana vence ${nombre}`, body: `Paga ${cuanto}`, url });
        agregar({ id: `tdc:${e.cuentaId}:${e.fecha}:hoy`, at: momento(e.fecha, 9), title: `Hoy vence ${nombre}`, body: `Último día: paga ${cuanto}`, url });
    });

    eventos.filter(e => e.tipo === 'recurrente').forEach(e => {
        const cuenta = porId[e.cuentaId]?.nombre;
        agregar({
            id: `rec:${e.recurrenteId}:${e.fecha}`, at: momento(e.fecha, 9),
            title: e.ingreso ? `Hoy llega: ${e.titulo}` : `Hoy toca: ${e.titulo}`,
            body: `${fmt(e.monto)}${cuenta ? ` · ${cuenta}` : ''}. Abre Morralla para registrarlo.`,
            url: '#/planear/recurrentes',
        });
    });

    // Presupuestos del mes.
    const r = resumenMes(transacciones, mes);
    categorias.filter(c => Number(c.presupuesto) > 0).forEach(c => {
        const gastado = r.porCategoria[c.id] || 0;
        const pct = (gastado / c.presupuesto) * 100;
        if (pct > 100) agregar({ id: `m:pres100:${c.id}:${mes}`, at: proximoMomento(ahora), title: `Te pasaste en ${c.nombre}`, body: `Llevas ${fmt(gastado)} de ${fmt(c.presupuesto)} este mes.`, url: '#/planear/presupuestos' });
        else if (pct >= 90) agregar({ id: `m:pres90:${c.id}:${mes}`, at: proximoMomento(ahora), title: `${c.nombre} ya va al ${Math.round(pct)} %`, body: `Te quedan ${fmt(c.presupuesto - gastado)} para el resto del mes.`, url: '#/planear/presupuestos' });
    });

    // Proyección de fin de mes.
    if (cuentas.some(c => c.tipo !== 'credito')) {
        const p = proyectarFinDeMes({ cuentas, saldos, transacciones, recurrentes }, ahora);
        if (p.negativo) agregar({ id: `m:fin:${mes}`, at: proximoMomento(ahora), title: 'Tlaco está preocupado', body: `A este ritmo, el día ${Number(p.minimo.fecha.slice(8))} te faltarían ${fmt(p.minimo.saldo)}.`, url: '#/inicio' });
    }

    // Resumen semanal: el próximo domingo a las 19:00 (hoy, si es domingo y aún no son las 7).
    const dow = aFecha(h).getDay();
    let domingo = sumarDias(h, (7 - dow) % 7);
    if (momento(domingo, 19) < ahora.getTime()) domingo = sumarDias(domingo, 7);
    const lunes = sumarDias(domingo, -6);
    const semana = transacciones.filter(t => t.tipo === 'gasto' && t.fecha >= lunes && t.fecha <= domingo);
    if (semana.length) {
        const total = semana.reduce((a, t) => a + (Number(t.monto) || 0), 0);
        const porCat = {};
        semana.forEach(t => { porCat[t.categoriaId] = (porCat[t.categoriaId] || 0) + (Number(t.monto) || 0); });
        const top = Object.entries(porCat).sort((a, b) => b[1] - a[1])[0];
        const nombreTop = categorias.find(c => c.id === top?.[0])?.nombre;
        agregar({ id: `sem:${domingo}`, at: momento(domingo, 19), title: 'Tu semana con Tlaco', body: `Esta semana gastaste ${fmt(total)}${nombreTop ? `; lo que más, ${nombreTop}` : ''}. ¿Le damos un vistazo?`, url: '#/analisis' });
    }

    return avisos.sort((a, b) => a.at - b.at);
}

// Separa "250 oxxo", "$1,250.50 en el súper" o "ingreso 5000 nómina" en tipo, monto y descripción.
// (Lo usa el Worker para registrar con Siri.)
export function interpretarDictado(texto) {
    let t = String(texto || '').trim();
    let tipo = 'gasto';
    // (\b no reconoce letras acentuadas: se usa el espacio o el final como límite)
    const INGRESO = /^(ingreso|me pagaron|cobr[eé]|recib[ií])(?=\s|$)/i, GASTO = /^(gasto|gast[eé]|pagu[eé])(?=\s|$)/i;
    if (INGRESO.test(t)) { tipo = 'ingreso'; t = t.replace(INGRESO, ''); }
    else t = t.replace(GASTO, '');
    const m = t.match(/\$?\s*(\d{1,3}(?:[,\s]\d{3})+|\d+)(?:[.,](\d{1,2}))?(?!\d)/);
    if (!m) return null;
    const entero = m[1].replace(/[,\s]/g, '');
    const monto = Math.round(parseFloat(`${entero}.${m[2] || '0'}`) * 100) / 100;
    if (!(monto > 0)) return null;
    const desc = (t.slice(0, m.index) + ' ' + t.slice(m.index + m[0].length))
        .replace(/\b(pesos?|mxn|varos)\b/gi, ' ')
        .replace(/\s+/g, ' ').trim();
    // Quita "en", "en el", "de la"… del principio.
    const limpia = desc.replace(/^((en|de|del|para|por|a|el|la|los|las)\s+)+/i, '').trim();
    return { tipo, monto, desc: limpia ? limpia.charAt(0).toUpperCase() + limpia.slice(1) : '' };
}
