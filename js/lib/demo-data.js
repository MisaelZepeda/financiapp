// Datos ficticios del modo demo, ya en formato v4. Viven solo en memoria.

import { hoyISO, sumarDias, mesKey, fechaEnMes, sumarMeses } from '../domain/fechas.js';
import { categoriasIniciales } from '../domain/categorias.js';

export function construirDemo(hoy = new Date()) {
    const h = hoyISO(hoy);
    const hace = (d) => sumarDias(h, -d);
    const mes = mesKey(hoy);

    const cuentas = {
        nomina: { nombre: 'Nómina', banco: 'BBVA', tipo: 'debito', digitos: '4821', clabe: '012180004821000011', saldoInicial: 3200, fechaInicial: hace(360) },
        ahorro: { nombre: 'Ahorros', banco: 'Nu', tipo: 'debito', digitos: '1190', saldoInicial: 9000, fechaInicial: hace(360) },
        efectivo: { nombre: 'Efectivo', banco: 'Efectivo', tipo: 'efectivo', saldoInicial: 900, fechaInicial: hace(360) },
        platino: { nombre: 'Platino', banco: 'Santander', tipo: 'credito', digitos: '5567', limite: 30000, diaCorte: 18, diaPago: 5, saldoInicial: 4200, fechaInicial: hace(360) },
        viajes: { nombre: 'Viajes', banco: 'Hey Banco', tipo: 'credito', digitos: '3302', limite: 15000, diaCorte: 2, diaPago: 22, saldoInicial: 0, fechaInicial: hace(360) },
    };

    const categorias = categoriasIniciales();
    categorias.comida.presupuesto = 4500;
    categorias.transporte.presupuesto = 1200;
    categorias.ocio.presupuesto = 1000;
    categorias.servicios.presupuesto = 1800;
    categorias.mascotas = { nombre: 'Mascotas', icono: 'paw', orden: 8 };

    const transacciones = {};
    let n = 0;
    const tx = (t) => { transacciones[`demo${String(n++).padStart(4, '0')}`] = { creadoEn: n, ...t }; };

    // 12 meses de historia con algo de variación.
    for (let m = 11; m >= 0; m--) {
        const key = sumarMeses(mes, -m);
        const f = (dia) => { const d = fechaEnMes(key, dia); return d <= h ? d : null; };
        const v = 1 + ((m * 7) % 5) / 20;
        const add = (dia, t) => { const fecha = f(dia); if (fecha) tx({ ...t, fecha }); };
        add(1, { tipo: 'ingreso', monto: 14500, desc: 'Nómina', cuentaId: 'nomina' });
        add(15, { tipo: 'ingreso', monto: 14500, desc: 'Nómina', cuentaId: 'nomina' });
        if (m % 3 === 0) add(20, { tipo: 'ingreso', monto: 4200, desc: 'Proyecto freelance', cuentaId: 'nomina' });
        add(2, { tipo: 'gasto', monto: 9800, desc: 'Renta', categoriaId: 'vivienda', cuentaId: 'nomina' });
        add(4, { tipo: 'gasto', monto: Math.round(1150 * v), desc: 'Supermercado', categoriaId: 'comida', cuentaId: 'platino' });
        add(11, { tipo: 'gasto', monto: Math.round(980 * v), desc: 'Supermercado', categoriaId: 'comida', cuentaId: 'platino' });
        add(19, { tipo: 'gasto', monto: Math.round(1320 * v), desc: 'Supermercado', categoriaId: 'comida', cuentaId: 'platino' });
        add(6, { tipo: 'gasto', monto: Math.round(420 * v), desc: 'Restaurante', categoriaId: 'comida', cuentaId: 'viajes' });
        add(8, { tipo: 'gasto', monto: Math.round(640 * v), desc: 'Luz y agua', categoriaId: 'servicios', cuentaId: 'nomina' });
        add(9, { tipo: 'gasto', monto: 599, desc: 'Internet', categoriaId: 'servicios', cuentaId: 'nomina' });
        add(12, { tipo: 'gasto', monto: 219, desc: 'Netflix', categoriaId: 'suscripciones', cuentaId: 'platino' });
        add(13, { tipo: 'gasto', monto: 129, desc: 'Spotify', categoriaId: 'suscripciones', cuentaId: 'platino' });
        add(7, { tipo: 'gasto', monto: Math.round(310 * v), desc: 'Uber', categoriaId: 'transporte', cuentaId: 'viajes' });
        add(16, { tipo: 'gasto', monto: Math.round(700 * v), desc: 'Gasolina', categoriaId: 'transporte', cuentaId: 'platino' });
        add(21, { tipo: 'gasto', monto: Math.round(560 * v), desc: 'Cine y cena', categoriaId: 'ocio', cuentaId: 'viajes' });
        add(24, { tipo: 'gasto', monto: 380, desc: 'Croquetas', categoriaId: 'mascotas', cuentaId: 'efectivo' });
        add(10, { tipo: 'gasto', monto: 85, desc: 'Café', categoriaId: 'comida', cuentaId: 'efectivo' });
        add(17, { tipo: 'gasto', monto: 85, desc: 'Café', categoriaId: 'comida', cuentaId: 'efectivo' });
        add(3, { tipo: 'transferencia', subtipo: 'traspaso', monto: 600, desc: 'Retiro de cajero', cuentaId: 'nomina', cuentaDestinoId: 'efectivo' });
        add(5, { tipo: 'transferencia', subtipo: 'pago_tdc', monto: 5400, desc: 'Pago a Platino', cuentaId: 'nomina', cuentaDestinoId: 'platino' });
        add(22, { tipo: 'transferencia', subtipo: 'pago_tdc', monto: 1500, desc: 'Pago a Viajes', cuentaId: 'nomina', cuentaDestinoId: 'viajes' });
        add(16, { tipo: 'transferencia', subtipo: 'traspaso', monto: 8000, desc: 'Ahorro del mes', cuentaId: 'nomina', cuentaDestinoId: 'ahorro' });
        add(28, { tipo: 'ingreso', subtipo: 'rendimiento', monto: Math.round(310 + (11 - m) * 14), desc: 'Rendimiento', cuentaId: 'ahorro' });
        add(26, { tipo: 'ingreso', subtipo: 'cashback', monto: 64, desc: 'Cashback', cuentaId: 'platino' });
    }
    tx({ tipo: 'gasto', monto: 14400, desc: 'Laptop', categoriaId: 'otros', cuentaId: 'platino', msi: 12, fecha: hace(95) });
    tx({ tipo: 'gasto', monto: 2350, desc: 'Veterinario', categoriaId: 'mascotas', cuentaId: 'viajes', fecha: hace(1) });

    const metas = {
        emergencia: { nombre: 'Fondo de emergencia', icono: 'shield', montoObjetivo: 60000, montoActual: 32500, fechaLimite: `${Number(mes.slice(0, 4))}-12-31` },
        japon: { nombre: 'Viaje a Japón', icono: 'plane', montoObjetivo: 45000, montoActual: 12800, fechaLimite: fechaEnMes(sumarMeses(mes, 7), 1) },
        laptop: { nombre: 'Cámara nueva', icono: 'box', montoObjetivo: 18000, montoActual: 16900 },
    };

    const recurrentes = {
        netflix: { tipo: 'gasto', desc: 'Netflix', monto: 219, categoriaId: 'suscripciones', cuentaId: 'platino', frecuencia: 'mensual', diaMes: 12, activo: true, proximaFecha: hace(2) },
        gym: { tipo: 'gasto', desc: 'Gimnasio', monto: 650, categoriaId: 'salud', cuentaId: 'nomina', frecuencia: 'mensual', diaMes: 30, activo: true, proximaFecha: sumarDias(h, 3) },
        internet: { tipo: 'gasto', desc: 'Internet', monto: 599, categoriaId: 'servicios', cuentaId: 'nomina', frecuencia: 'mensual', diaMes: 9, activo: true, proximaFecha: sumarDias(h, 8) },
        nomina: { tipo: 'ingreso', desc: 'Nómina', monto: 18500, cuentaId: 'nomina', frecuencia: 'quincenal', activo: false, proximaFecha: sumarDias(h, 5) },
    };

    return {
        meta: { version: 4, origen: 'demo' },
        perfil: { nombre: 'Cuenta Demo', foto: '' },
        ajustes: {}, cuentas, categorias, transacciones, metas, recurrentes, notifDescartadas: {},
    };
}
