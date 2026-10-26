// Salud financiera del mes: estado de Tlaco (la mascota), puntaje 0–100,
// factores que lo explican y una sugerencia concreta. Función pura.
//
// Estados de Tlaco, del más urgente al más tranquilo:
//   triste      gastos > ingresos del mes (si ya hubo ingresos), pago vencido o presupuesto rebasado
//   preocupado  presupuesto al 90 %, tarjeta que vence en ≤3 días sin cubrir o crédito usado > 70 %
//   celebrando  meta cumplida este mes o ahorro ≥ 30 % de lo que entró
//   contento    balance del mes positivo
//   tranquilo   sin movimientos este mes, o ingresos y gastos parejos

import { mesKey, sumarMeses } from './fechas.js';
import { resumenMes } from './analisis.js';
import { estadoPago } from './tarjetas.js';

const r0 = (n) => Math.round(n);
const fmt = (n) => '$' + Number(Math.abs(n) || 0).toLocaleString('es-MX', { maximumFractionDigits: 0 });

// Cada factor: { id, titulo, detalle, valor, nivel: 'bien'|'regular'|'mal'|'sin', peso, puntos (0–1) }
export function evaluarSalud({ cuentas = [], saldos = {}, transacciones = [], categorias = [], metas = [] }, hoy = new Date()) {
    const mes = mesKey(hoy);
    const r = resumenMes(transacciones, mes);
    const hayMovs = r.ingresos > 0 || r.gastos > 0;
    const factores = [];
    const motivos = { triste: [], preocupado: [], celebrando: [] };

    // 1. Balance del mes
    if (!hayMovs) factores.push({ id: 'balance', titulo: 'Balance del mes', detalle: 'Aún sin movimientos', valor: '—', nivel: 'sin', peso: 25, puntos: 0.6 });
    else if (r.ingresos === 0) {
        // Antes de cobrar, gastar no es "gastar de más": solo se informa.
        factores.push({ id: 'balance', titulo: 'Balance del mes', detalle: 'Aún no registras ingresos este mes', valor: `−${fmt(r.gastos)}`, nivel: 'regular', peso: 25, puntos: 0.5 });
    } else {
        const nivel = r.balance > 0 ? 'bien' : r.balance === 0 ? 'regular' : 'mal';
        factores.push({ id: 'balance', titulo: 'Balance del mes', detalle: r.balance >= 0 ? 'Entró más de lo que salió' : 'Salió más de lo que entró', valor: `${r.balance >= 0 ? '+' : '−'}${fmt(r.balance)}`, nivel, peso: 25, puntos: nivel === 'bien' ? 1 : nivel === 'regular' ? 0.5 : 0 });
        if (r.gastos > r.ingresos) motivos.triste.push({ texto: `Este mes van ${fmt(r.gastos - r.ingresos)} más de gastos que de ingresos.`, sugerencia: 'Revisa tus gastos más grandes del mes y pausa lo que no sea necesario.', ruta: '#/analisis' });
    }

    // 2. Tasa de ahorro
    const tasa = r.ingresos > 0 ? (r.balance / r.ingresos) * 100 : null;
    if (tasa == null) factores.push({ id: 'ahorro', titulo: 'Tasa de ahorro', detalle: 'Registra tus ingresos del mes', valor: '—', nivel: 'sin', peso: 20, puntos: 0.5 });
    else {
        const nivel = tasa >= 20 ? 'bien' : tasa >= 10 ? 'regular' : 'mal';
        factores.push({ id: 'ahorro', titulo: 'Tasa de ahorro', detalle: 'Meta sugerida: 20 %', valor: `${r0(Math.max(tasa, -999))} %`, nivel, peso: 20, puntos: Math.max(0, Math.min(1, tasa / 20)) });
        if (tasa >= 30) motivos.celebrando.push({ texto: `¡Este mes ahorraste ${r0(tasa)} % de lo que entró!`, sugerencia: 'Aparta ese excedente en una meta antes de que se gaste.', ruta: '#/planear/metas' });
    }

    // 3. Tarjetas de crédito
    const tarjetas = cuentas.filter(c => c.tipo === 'credito' && c.diaPago);
    if (!tarjetas.length) factores.push({ id: 'tarjetas', titulo: 'Tarjetas', detalle: 'Sin tarjetas con fecha de pago', valor: '—', nivel: 'sin', peso: 20, puntos: 1 });
    else {
        let peor = null;
        tarjetas.forEach(c => {
            const e = estadoPago(c, transacciones, hoy);
            if (!e || e.pagada || e.pendiente <= 0) return;
            const gravedad = e.dias < 0 ? 2 : e.dias <= 3 ? 1 : 0;
            if (!peor || gravedad > peor.gravedad || (gravedad === peor.gravedad && e.dias < peor.e.dias)) peor = { c, e, gravedad };
        });
        if (!peor || peor.gravedad === 0) factores.push({ id: 'tarjetas', titulo: 'Tarjetas', detalle: peor ? `${peor.c.nombre} vence en ${peor.e.dias} días` : 'Pagos al corriente', valor: peor ? fmt(peor.e.pendiente) : 'Al día', nivel: 'bien', peso: 20, puntos: 1 });
        else if (peor.gravedad === 1) {
            const cuando = peor.e.dias === 0 ? 'vence hoy' : `vence en ${peor.e.dias} día${peor.e.dias === 1 ? '' : 's'}`;
            factores.push({ id: 'tarjetas', titulo: 'Tarjetas', detalle: `${peor.c.nombre} ${cuando}`, valor: fmt(peor.e.pendiente), nivel: 'regular', peso: 20, puntos: 0.5 });
            motivos.preocupado.push({ texto: `Tu tarjeta ${peor.c.nombre} ${cuando} y faltan ${fmt(peor.e.pendiente)} por pagar.`, sugerencia: `Paga ${peor.c.nombre} antes de la fecha límite para no generar intereses.`, ruta: `#/cuenta/${peor.c.id}`, accion: { texto: `Pagar ${peor.c.nombre}`, action: 'pagarTarjeta', id: peor.c.id } });
        } else {
            factores.push({ id: 'tarjetas', titulo: 'Tarjetas', detalle: `${peor.c.nombre}: pago vencido`, valor: fmt(peor.e.pendiente), nivel: 'mal', peso: 20, puntos: 0 });
            motivos.triste.push({ texto: `El pago de ${peor.c.nombre} ya venció y faltan ${fmt(peor.e.pendiente)}.`, sugerencia: `Paga ${peor.c.nombre} cuanto antes: cada día suma intereses.`, ruta: `#/cuenta/${peor.c.id}`, accion: { texto: `Pagar ${peor.c.nombre}`, action: 'pagarTarjeta', id: peor.c.id } });
        }
    }

    // 4. Presupuestos
    const conPres = categorias.filter(c => Number(c.presupuesto) > 0);
    if (!conPres.length) factores.push({ id: 'presupuestos', titulo: 'Presupuestos', detalle: 'Sin límites definidos', valor: '—', nivel: 'sin', peso: 15, puntos: 0.6 });
    else {
        const usos = conPres.map(c => ({ c, pct: ((r.porCategoria[c.id] || 0) / c.presupuesto) * 100 })).sort((a, b) => b.pct - a.pct);
        const rebasados = usos.filter(u => u.pct > 100);
        const cerca = usos.filter(u => u.pct >= 90 && u.pct <= 100);
        const p = usos[0];
        if (rebasados.length) {
            factores.push({ id: 'presupuestos', titulo: 'Presupuestos', detalle: `${p.c.nombre} al ${r0(p.pct)} %`, valor: `${rebasados.length} de ${usos.length} rebasado${rebasados.length === 1 ? '' : 's'}`, nivel: 'mal', peso: 15, puntos: Math.max(0, 1 - rebasados.length / usos.length) * 0.5 });
            motivos.triste.push({ texto: `Te pasaste del presupuesto de ${p.c.nombre} (${r0(p.pct)} %).`, sugerencia: `Frena ${p.c.nombre} lo que resta del mes o ajusta su límite si era muy bajo.`, ruta: '#/planear/presupuestos' });
        } else if (cerca.length) {
            const queda = p.c.presupuesto - (r.porCategoria[p.c.id] || 0);
            factores.push({ id: 'presupuestos', titulo: 'Presupuestos', detalle: `${p.c.nombre} al ${r0(p.pct)} %`, valor: `${cerca.length} de ${usos.length} al límite`, nivel: 'regular', peso: 15, puntos: 0.6 });
            motivos.preocupado.push({ texto: `${p.c.nombre} ya va al ${r0(p.pct)} % de su presupuesto.`, sugerencia: `Te quedan ${fmt(queda)} en ${p.c.nombre} para el resto del mes.`, ruta: '#/planear/presupuestos' });
        } else factores.push({ id: 'presupuestos', titulo: 'Presupuestos', detalle: `El más usado: ${p.c.nombre} (${r0(p.pct)} %)`, valor: 'En orden', nivel: 'bien', peso: 15, puntos: 1 });
    }

    // 5. Uso de crédito
    const limite = tarjetas.concat(cuentas.filter(c => c.tipo === 'credito' && !c.diaPago)).reduce((a, c) => a + (Number(c.limite) || 0), 0);
    const deuda = cuentas.filter(c => c.tipo === 'credito').reduce((a, c) => a + Math.max(0, saldos[c.id] || 0), 0);
    if (!(limite > 0)) factores.push({ id: 'credito', titulo: 'Uso de crédito', detalle: 'Sin límites de crédito registrados', valor: '—', nivel: 'sin', peso: 10, puntos: 1 });
    else {
        const uso = (deuda / limite) * 100;
        const nivel = uso < 30 ? 'bien' : uso <= 70 ? 'regular' : 'mal';
        factores.push({ id: 'credito', titulo: 'Uso de crédito', detalle: 'Ideal: menos de 30 %', valor: `${r0(uso)} %`, nivel, peso: 10, puntos: uso < 30 ? 1 : uso <= 70 ? 0.6 : 0.2 });
        if (uso > 70) motivos.preocupado.push({ texto: `Estás usando ${r0(uso)} % de tu crédito disponible.`, sugerencia: 'Bajar el uso de crédito de 30 % mejora tu historial y te da margen.', ruta: '#/cuentas' });
    }

    // 6. Fondo de emergencia: meses de gasto que cubre tu dinero disponible
    const disponible = cuentas.filter(c => c.tipo !== 'credito').reduce((a, c) => a + Math.max(0, saldos[c.id] || 0), 0);
    const gastoProm = [1, 2, 3].map(i => resumenMes(transacciones, sumarMeses(mes, -i)).gastos).filter(g => g > 0);
    if (!gastoProm.length) factores.push({ id: 'fondo', titulo: 'Fondo de emergencia', detalle: 'Necesita un mes completo de gastos', valor: '—', nivel: 'sin', peso: 10, puntos: 0.5 });
    else {
        const meses = disponible / (gastoProm.reduce((a, b) => a + b, 0) / gastoProm.length);
        const nivel = meses >= 3 ? 'bien' : meses >= 1 ? 'regular' : 'mal';
        factores.push({ id: 'fondo', titulo: 'Fondo de emergencia', detalle: 'Meta sugerida: 3 meses de gastos', valor: `${meses >= 10 ? r0(meses) : meses.toFixed(1)} meses`, nivel, peso: 10, puntos: Math.min(1, meses / 3) });
    }

    // Metas cumplidas este mes (con abono en el mes)
    metas.forEach(m => {
        if (!(m.montoObjetivo > 0) || m.montoActual < m.montoObjetivo) return;
        const abonoEsteMes = Object.values(m.historial || {}).some(h => h.monto > 0 && String(h.fecha).startsWith(mes));
        if (abonoEsteMes) motivos.celebrando.unshift({ texto: `¡Meta cumplida! «${m.nombre}» ya está completa.`, sugerencia: 'Elige tu siguiente meta mientras traes el impulso.', ruta: '#/planear/metas' });
    });

    const puntaje = r0(factores.reduce((a, f) => a + f.peso * f.puntos, 0) / factores.reduce((a, f) => a + f.peso, 0) * 100);

    let estado, motivo;
    if (motivos.triste.length) { estado = 'triste'; motivo = motivos.triste[0]; }
    else if (motivos.preocupado.length) { estado = 'preocupado'; motivo = motivos.preocupado[0]; }
    else if (motivos.celebrando.length) { estado = 'celebrando'; motivo = motivos.celebrando[0]; }
    else if (hayMovs && r.balance > 0) { estado = 'contento'; motivo = { texto: `Vas bien: llevas +${fmt(r.balance)} este mes.`, sugerencia: tasa != null && tasa < 20 ? 'Si apartas un poco más llegarás al 20 % de ahorro sugerido.' : 'Mantén el ritmo y aparta lo que sobre en una meta.', ruta: '#/planear/metas' }; }
    else { estado = 'tranquilo'; motivo = hayMovs
        ? { texto: 'Este mes tus ingresos y gastos van parejos.', sugerencia: 'Un presupuesto por categoría te ayuda a decidir dónde recortar.', ruta: '#/planear/presupuestos' }
        : { texto: 'Aún no hay movimientos este mes.', sugerencia: 'Registra tu primer ingreso o gasto con el botón +.', ruta: '#/movimientos' }; }

    const etiqueta = puntaje >= 80 ? 'Excelente' : puntaje >= 65 ? 'Bien' : puntaje >= 45 ? 'Regular' : 'Necesita atención';
    return { estado, puntaje, etiqueta, factores, mensaje: motivo.texto, sugerencia: motivo.sugerencia, ruta: motivo.ruta, accion: motivo.accion || null, mes };
}
