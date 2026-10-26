// Proyección de fin de mes: simula día a día cuánto dinero disponible
// (débito + efectivo) tendrás hasta el último día del mes.
//
// Entra:  ingresos recurrentes programados a débito/efectivo.
// Sale:   gastos recurrentes de débito/efectivo, pagos de tarjeta con fecha
//         límite este mes (lo pendiente) y el gasto variable estimado.
// Los recurrentes cargados a tarjeta no salen ese día: salen al pagar la
// tarjeta, que ya está contemplada en sus fechas límite.

import { hoyISO, mesKey, sumarMeses, sumarDias, ultimoDiaMes, diasEntre, fechaEnMes } from './fechas.js';
import { siguienteFecha } from './recurrentes.js';
import { fechaPagoDe, montoEstado, abonadoDesde } from './tarjetas.js';

const r2 = (n) => Math.round(n * 100) / 100;
const esLiquida = (c) => c && c.tipo !== 'credito';

// Promedio diario de gasto variable (no recurrente) pagado con débito/efectivo
// en los últimos 3 meses completos; si no hay historia, el del mes en curso.
export function gastoDiarioVariable(cuentas, transacciones, hoy = new Date()) {
    const liquidas = new Set(cuentas.filter(esLiquida).map(c => c.id));
    const mes = mesKey(hoy);
    const variable = (t) => t.tipo === 'gasto' && !t.recurrenteId && liquidas.has(t.cuentaId);
    const desde = `${sumarMeses(mes, -3)}-01`, hasta = `${mes}-01`;
    const previos = transacciones.filter(t => variable(t) && t.fecha >= desde && t.fecha < hasta);
    if (previos.length) {
        const dias = diasEntre(desde, hasta);
        return r2(previos.reduce((a, t) => a + (Number(t.monto) || 0), 0) / dias);
    }
    const h = hoyISO(hoy);
    const delMes = transacciones.filter(t => variable(t) && t.fecha >= `${mes}-01` && t.fecha <= h);
    const transcurridos = Number(h.slice(8));
    return delMes.length ? r2(delMes.reduce((a, t) => a + (Number(t.monto) || 0), 0) / transcurridos) : 0;
}

export function proyectarFinDeMes({ cuentas = [], saldos = {}, transacciones = [], recurrentes = [] }, hoy = new Date()) {
    const h = hoyISO(hoy);
    const mes = mesKey(hoy);
    const fin = ultimoDiaMes(mes);
    const porId = Object.fromEntries(cuentas.map(c => [c.id, c]));
    const disponible = r2(cuentas.filter(esLiquida).reduce((a, c) => a + (saldos[c.id] || 0), 0));
    const diario = gastoDiarioVariable(cuentas, transacciones, hoy);

    const movimientos = {}; // fecha → delta
    const sumar = (fecha, delta) => { movimientos[fecha] = (movimientos[fecha] || 0) + delta; };
    const detalle = { ingresos: 0, recurrentes: 0, tarjetas: 0, variable: 0 };
    const manana = sumarDias(h, 1);

    // Recurrentes programados desde mañana (los pendientes de días pasados se registran hoy).
    recurrentes.filter(r => r.activo !== false && r.proximaFecha).forEach(r => {
        const cuenta = porId[r.cuentaId];
        if (cuenta && !esLiquida(cuenta)) return;
        let fecha = r.proximaFecha, vueltas = 0;
        while (fecha <= fin && vueltas++ < 40) {
            const cuando = fecha < manana ? manana : fecha;
            if (cuando <= fin) {
                const m = Number(r.monto) || 0;
                if (r.tipo === 'ingreso') { sumar(cuando, m); detalle.ingresos += m; }
                else { sumar(cuando, -m); detalle.recurrentes += m; }
            }
            fecha = siguienteFecha(r, fecha);
        }
    });

    // Pagos de tarjeta: lo pendiente de cada estado cuya fecha límite cae este mes.
    // (Su estado puede cerrar el mes pasado o este.) Si la fecha ya pasó, se cuenta mañana.
    cuentas.filter(c => c.tipo === 'credito' && c.diaPago).forEach(c => {
        [sumarMeses(mes, -1), mes].forEach(mesCorte => {
            const corte = fechaEnMes(mesCorte, c.diaCorte || 1);
            const limite = fechaPagoDe(c, corte);
            if (limite < `${mes}-01` || limite > fin) return;
            const marcada = c.pagadoPeriodo === mesKey(corte);
            const abonado = corte <= h ? abonadoDesde(c, transacciones, corte) : 0;
            const pendiente = marcada ? 0 : r2(montoEstado(c, transacciones, corte) - abonado);
            if (pendiente <= 0) return;
            const cuando = limite < manana ? manana : limite;
            if (cuando > fin) return;
            sumar(cuando, -pendiente); detalle.tarjetas += pendiente;
        });
    });

    // Simulación día a día.
    const serie = [{ fecha: h, saldo: disponible }];
    let saldo = disponible, minimo = { fecha: h, saldo: disponible };
    for (let f = manana; f <= fin; f = sumarDias(f, 1)) {
        saldo += (movimientos[f] || 0) - diario;
        detalle.variable += diario;
        serie.push({ fecha: f, saldo: r2(saldo) });
        if (saldo < minimo.saldo) minimo = { fecha: f, saldo: r2(saldo) };
    }
    Object.keys(detalle).forEach(k => { detalle[k] = r2(detalle[k]); });
    return {
        disponible, cierre: r2(saldo), minimo, negativo: minimo.saldo < 0,
        diario, diasRestantes: diasEntre(h, fin), serie, detalle, fin,
    };
}
