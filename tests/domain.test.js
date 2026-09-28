import { test } from 'node:test';
import assert from 'node:assert/strict';

import { hoyISO, fechaEnMes, sumarMeses, ultimosMeses, diasEntre } from '../js/domain/fechas.js';
import { calcularSaldos, patrimonio, seriePatrimonio } from '../js/domain/saldos.js';
import { ultimoCorte, fechaPagoDe, pagoSinIntereses, porFacturar, estadoPago } from '../js/domain/tarjetas.js';
import { siguienteFecha, pendientes, generarOcurrencia, primeraFecha } from '../js/domain/recurrentes.js';
import { resumenMes, comparativaCategorias, gastosFrecuentes, tasaAhorro } from '../js/domain/analisis.js';
import { construirAvisos } from '../js/domain/notificaciones.js';
import { migrarV1 } from '../js/domain/migracion.js';
import { slugCategoria } from '../js/domain/categorias.js';

const HOY = new Date(2026, 8, 28, 12); // 28 sep 2026

test('fechas: día recortado al fin de mes y meses', () => {
    assert.equal(fechaEnMes('2026-02', 31), '2026-02-28');
    assert.equal(sumarMeses('2026-01', -1), '2025-12');
    assert.deepEqual(ultimosMeses(3, '2026-02'), ['2025-12', '2026-01', '2026-02']);
    assert.equal(diasEntre('2026-09-28', '2026-10-05'), 7);
    assert.equal(hoyISO(new Date(2026, 8, 28, 23, 30)), '2026-09-28'); // hora local, no UTC
});

const cuentas = [
    { id: 'deb', tipo: 'debito', saldoInicial: 1000 },
    { id: 'tdc', tipo: 'credito', saldoInicial: 0, limite: 10000, diaCorte: 18, diaPago: 5 },
];

test('saldos: gasto, ingreso, pago de tarjeta y cashback', () => {
    const txs = [
        { tipo: 'ingreso', monto: 500, cuentaId: 'deb', fecha: '2026-09-01' },
        { tipo: 'gasto', monto: 200, cuentaId: 'deb', fecha: '2026-09-02' },
        { tipo: 'gasto', monto: 3000, cuentaId: 'tdc', fecha: '2026-09-03' },
        { tipo: 'transferencia', subtipo: 'pago_tdc', monto: 1000, cuentaId: 'deb', cuentaDestinoId: 'tdc', fecha: '2026-09-04' },
        { tipo: 'ingreso', subtipo: 'cashback', monto: 50, cuentaId: 'tdc', fecha: '2026-09-05' },
    ];
    const s = calcularSaldos(cuentas, txs);
    assert.equal(s.deb, 1000 + 500 - 200 - 1000);
    assert.equal(s.tdc, 3000 - 1000 - 50);
    const p = patrimonio(cuentas, s);
    assert.deepEqual(p, { activos: 300, deudas: 1950, creditoLibre: 8050, neto: -1650 });
    assert.equal(calcularSaldos(cuentas, txs, '2026-09-02').deb, 1300);
});

test('saldos: serie de patrimonio por mes', () => {
    const txs = [{ tipo: 'ingreso', monto: 100, cuentaId: 'deb', fecha: '2026-08-10' }];
    const serie = seriePatrimonio(cuentas, txs, 3, HOY);
    assert.deepEqual(serie.map(x => x.neto), [1000, 1100, 1100]);
});

test('tarjetas: ciclo de corte, MSI, cashback y estado de pago', () => {
    const tdc = cuentas[1]; // corte 18, pago 5 → el estado del 18 sep se paga el 5 oct
    assert.equal(ultimoCorte(tdc, HOY), '2026-09-18');
    assert.equal(ultimoCorte(tdc, new Date(2026, 8, 10, 12)), '2026-08-18');
    assert.equal(fechaPagoDe(tdc, '2026-09-18'), '2026-10-05');
    assert.equal(fechaPagoDe({ diaCorte: 2, diaPago: 22 }, '2026-09-02'), '2026-09-22');
    const txs = [
        { tipo: 'gasto', monto: 1000, cuentaId: 'tdc', fecha: '2026-09-10' },         // ciclo 18 ago–18 sep
        { tipo: 'gasto', monto: 500, cuentaId: 'tdc', fecha: '2026-08-10' },          // ciclo anterior
        { tipo: 'gasto', monto: 700, cuentaId: 'tdc', fecha: '2026-09-20' },          // por facturar
        { tipo: 'gasto', monto: 1200, cuentaId: 'tdc', fecha: '2026-07-15', msi: 6 }, // 200 por corte desde el 18 jul
        { tipo: 'ingreso', subtipo: 'cashback', monto: 100, cuentaId: 'tdc', fecha: '2026-09-01' },
    ];
    assert.equal(pagoSinIntereses(tdc, txs, HOY), 1000 + 200 - 100);
    assert.equal(porFacturar(tdc, txs, HOY), 700);
    const e = estadoPago(tdc, txs, HOY);
    assert.deepEqual([e.corte, e.fechaPago, e.dias, e.pendiente, e.pagada], ['2026-09-18', '2026-10-05', 7, 1100, false]);
    const parcial = estadoPago(tdc, [...txs, { tipo: 'transferencia', monto: 600, cuentaId: 'deb', cuentaDestinoId: 'tdc', fecha: '2026-09-25' }], HOY);
    assert.deepEqual([parcial.abonado, parcial.pendiente, parcial.pagada], [600, 500, false]);
    // Un pago hecho ANTES del corte corresponde al estado anterior, no a este.
    const viejo = estadoPago(tdc, [...txs, { tipo: 'transferencia', monto: 5000, cuentaId: 'deb', cuentaDestinoId: 'tdc', fecha: '2026-09-05' }], HOY);
    assert.equal(viejo.pendiente, 1100);
    const total = estadoPago(tdc, [...txs, { tipo: 'transferencia', monto: 1100, cuentaId: 'deb', cuentaDestinoId: 'tdc', fecha: '2026-09-25' }], HOY);
    assert.equal(total.pagada, true);
    assert.equal(estadoPago({ ...tdc, pagadoPeriodo: '2026-09' }, txs, HOY).pagada, true);
});

test('recurrentes: próximas fechas, pendientes y generación', () => {
    assert.equal(siguienteFecha({ frecuencia: 'mensual', diaMes: 31 }, '2026-01-31'), '2026-02-28');
    assert.equal(siguienteFecha({ frecuencia: 'quincenal' }, '2026-09-01'), '2026-09-16');
    assert.equal(primeraFecha({ frecuencia: 'mensual', diaMes: 30 }, HOY), '2026-09-30');
    assert.equal(primeraFecha({ frecuencia: 'mensual', diaMes: 5 }, HOY), '2026-10-05');
    const recs = [
        { id: 'a', tipo: 'gasto', monto: 199, desc: 'Netflix', cuentaId: 'tdc', frecuencia: 'mensual', diaMes: 12, activo: true, proximaFecha: '2026-09-12', categoriaId: 'suscripciones' },
        { id: 'b', tipo: 'gasto', monto: 1, frecuencia: 'mensual', activo: false, proximaFecha: '2026-09-01' },
        { id: 'c', tipo: 'ingreso', monto: 1, frecuencia: 'mensual', activo: true, proximaFecha: '2026-10-01' },
    ];
    assert.deepEqual(pendientes(recs, HOY).map(r => r.id), ['a']);
    const { tx, proximaFecha } = generarOcurrencia(recs[0]);
    assert.equal(tx.fecha, '2026-09-12');
    assert.equal(tx.categoriaId, 'suscripciones');
    assert.equal(proximaFecha, '2026-10-12');
});

test('análisis: los traspasos no cuentan como gasto ni ingreso', () => {
    const txs = [
        { tipo: 'ingreso', monto: 1000, fecha: '2026-09-01' },
        { tipo: 'gasto', monto: 300, fecha: '2026-09-02', categoriaId: 'comida' },
        { tipo: 'transferencia', monto: 5000, fecha: '2026-09-03' },
        { tipo: 'gasto', monto: 100, fecha: '2026-08-02', categoriaId: 'comida' },
        { tipo: 'gasto', monto: 50, fecha: '2026-07-02', categoriaId: 'comida', desc: 'Café' },
        { tipo: 'gasto', monto: 60, fecha: '2026-09-03', categoriaId: 'comida', desc: 'café ' },
    ];
    const r = resumenMes(txs, '2026-09');
    assert.deepEqual([r.ingresos, r.gastos, r.balance], [1000, 360, 640]);
    assert.equal(tasaAhorro(r), 64);
    const comida = comparativaCategorias(txs, HOY).find(c => c.categoriaId === 'comida');
    assert.equal(comida.promedio, 50);
    assert.equal(gastosFrecuentes(txs, HOY)[0].veces, 2);
});

test('avisos: presupuesto excedido y descartes', () => {
    const datos = {
        cuentas: [], metas: [], recurrentes: [],
        categorias: [{ id: 'comida', nombre: 'Comida', presupuesto: 100 }],
        transacciones: [{ tipo: 'gasto', monto: 150, fecha: '2026-09-02', categoriaId: 'comida' }],
    };
    const avisos = construirAvisos(datos, HOY);
    assert.equal(avisos.length, 1);
    assert.match(avisos[0].titulo, /excedido/);
    assert.equal(construirAvisos({ ...datos, descartadas: { [avisos[0].key]: 1 } }, HOY).length, 0);
});

test('categorías: slug estable', () => {
    assert.equal(slugCategoria('Comida rápida'), 'comida-rapida');
    assert.equal(slugCategoria('  '), 'otros');
});

// Datos con la forma exacta de v1 (cuentas como objeto, transacciones por clave de Firebase).
const v1 = {
    perfil: { nombre: 'Misa', foto: 'x', color: '#6c63ff' },
    cuentas: {
        1: { id: 1, nombre: 'Nómina', banco: 'BBVA', tipo: 'debito', saldo: 24850.5, digitos: '4821' },
        2: { id: 2, nombre: 'Efectivo', banco: 'Efectivo', tipo: 'efectivo', saldo: 1350 },
        4: { id: 4, nombre: 'Platino', banco: 'Santander', tipo: 'credito', saldo: 8420.13, limite: 30000, diaCorte: 18, diaPago: 5, mesPagado: 8 },
        9: { id: 9, nombre: 'Sin movimientos', banco: 'Nu', tipo: 'debito', saldo: 777.77 },
    },
    transacciones: {
        '-Na': { tipo: 'ingreso', desc: 'Nómina', monto: 18500, cuentaId: 1, fecha: '2026-09-01' },
        '-Nb': { tipo: 'gasto', desc: 'Súper', cat: 'Comida', monto: 850.35, cuentaId: 4, fecha: '2026-09-02', isMSI: false, meses: 1 },
        '-Nc': { tipo: 'gasto', desc: 'Laptop', cat: 'Tecnología', monto: 12000, cuentaId: 4, fecha: '2026-06-02', isMSI: true, meses: 12 },
        '-Nd': { tipo: 'movimiento', subtipo: 'pago', desc: 'Pago a Platino', monto: 3000, origenId: 1, destinoId: 4, fecha: '2026-09-04' },
        '-Ne': { tipo: 'movimiento', subtipo: 'traspaso', desc: 'Traspaso a Efectivo', monto: 500, origenId: 1, destinoId: 2, fecha: '2026-09-05' },
        '-Nf': { tipo: 'ingreso', subtipo: 'cashback', desc: 'Cashback', monto: 45.2, cuentaId: 4, fecha: '2026-09-06' },
        '-Ng': { tipo: 'ingreso', desc: 'Rendimiento', monto: 12.34, cuentaId: 1, fecha: '2026-09-07' },
        '-Nh': { tipo: 'gasto', desc: 'Cuenta borrada', cat: 'Otros', monto: 99, cuentaId: 77, fecha: '2026-09-08' },
    },
    presupuestos: { Comida: 4500, Mascotas: 800 },
    categoriasCustom: ['Mascotas'],
    metas: { m1: { id: 'm1', nombre: 'Viaje', emoji: 'calendar', montoObjetivo: 45000, montoActual: 12800, fechaLimite: '2027-04-01' } },
    recurrentes: {
        r1: { id: 'r1', desc: 'Netflix', monto: 199, tipo: 'gasto', cat: 'Suscripciones', cuentaId: 4, frecuencia: 'mensual', diaMes: 12, activo: true, ultimaGeneracion: '2026-08-12' },
        r2: { id: 'r2', desc: 'Nómina', monto: 9250, tipo: 'ingreso', cat: '', cuentaId: 1, frecuencia: 'quincenal', activo: true },
    },
    notifDescartadas: { 'meta_m1_casi': 123 },
};

test('migración v1 → v4: todos los saldos cuadran al centavo', () => {
    const { v4, reporte, ok, resumen } = migrarV1(v1, HOY);
    assert.equal(ok, true, JSON.stringify(reporte));
    assert.equal(reporte.length, 4);
    reporte.forEach(r => assert.equal(r.antes, r.despues, r.nombre));
    assert.equal(resumen.huerfanas, 1);
    assert.equal(resumen.transacciones, 8);

    // Recalcular desde el resultado migrado también debe cuadrar.
    const s = calcularSaldos(Object.values(v4.cuentas), Object.values(v4.transacciones));
    assert.equal(s['4'], 8420.13);
    assert.equal(s['9'], 777.77);
});

test('migración v1 → v4: esquema de transacciones, categorías y recurrentes', () => {
    const { v4 } = migrarV1(v1, HOY);
    const t = v4.transacciones;
    assert.deepEqual([t['-Nd'].tipo, t['-Nd'].subtipo, t['-Nd'].cuentaId, t['-Nd'].cuentaDestinoId], ['transferencia', 'pago_tdc', '1', '4']);
    assert.equal(t['-Nc'].msi, 12);
    assert.equal(t['-Nb'].msi, undefined);
    assert.equal(t['-Ng'].subtipo, 'rendimiento');
    assert.equal(t['-Nc'].categoriaId, 'tecnologia');
    assert.equal(v4.categorias.tecnologia.nombre, 'Tecnología');
    assert.equal(v4.categorias.comida.presupuesto, 4500);
    assert.equal(v4.categorias.mascotas.icono, 'paw');
    assert.equal(v4.cuentas['4'].pagadoPeriodo, '2026-09');
    assert.equal(v4.recurrentes.r1.proximaFecha, '2026-09-12');
    assert.equal(v4.recurrentes.r2.proximaFecha, '2026-09-28');
    assert.equal(v4.metas.m1.icono, 'calendar');
    assert.deepEqual(v4.notifDescartadas, { 'meta_m1_casi': 123 });
    assert.equal(v4.meta.version, 4);
    // Nada con undefined (Firebase rechaza undefined).
    assert.ok(!JSON.stringify(v4, (k, v) => (v === undefined ? '__UNDEF__' : v)).includes('__UNDEF__'));
});
