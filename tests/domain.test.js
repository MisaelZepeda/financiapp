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
    const { tx, proximaFecha } = generarOcurrencia(recs[0], '2026-09-28');
    assert.equal(tx.fecha, '2026-09-28');                 // fecha en que se registra, no la programada
    assert.equal(tx.categoriaId, 'suscripciones');
    assert.equal(proximaFecha, '2026-10-12');
    // Registrarlo antes de tiempo: fecha de hoy y avanza al periodo siguiente.
    const antes = generarOcurrencia({ ...recs[0], proximaFecha: '2026-10-12' }, '2026-09-28');
    assert.equal(antes.tx.fecha, '2026-09-28');
    assert.equal(antes.proximaFecha, '2026-11-12');
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

import { teclear, evaluar, expresionLegible, normalizarTexto, tieneOperacion } from '../js/domain/calculadora.js';

const escribir = (teclas) => teclas.reduce((e, t) => teclear(e, t), '');

test('calculadora: precedencia, decimales y edición', () => {
    assert.equal(evaluar('120+35×2'), 190);
    assert.equal(evaluar('500−120.50'), 379.5);
    assert.equal(evaluar('3×2×1.5+1'), 10);
    assert.equal(evaluar('100+'), 100);          // operador al final se ignora
    assert.equal(evaluar(''), null);
    assert.equal(evaluar('0.1+0.2'), 0.3);        // sin errores de coma flotante visibles
    assert.equal(escribir(['+', '5', '+', '×', '2']), '5×2');   // no empieza con operador; cambia operador
    assert.equal(escribir(['.', '5']), '0.5');
    assert.equal(escribir(['1', '.', '2', '3', '4']), '1.23');   // máximo 2 decimales
    assert.equal(escribir(['0', '5']), '5');
    assert.equal(escribir(['9', '9', '×', '3', '=']), '297');
    assert.equal(escribir(['1', '2', 'del']), '1');
    assert.equal(expresionLegible('1500+35.5'), '1,500 + 35.5');
    assert.equal(normalizarTexto('1,200*3-50'), '1200×3−50');
    assert.equal(tieneOperacion('1200'), false);
    assert.equal(tieneOperacion('1200+5'), true);
});

import { evaluarSalud } from '../js/domain/salud.js';
import { CONSEJOS, consejoAlAzar } from '../js/domain/consejos.js';

const tdcSalud = { id: 'tdc', tipo: 'credito', limite: 10000, diaCorte: 18, diaPago: 5 };
const debSalud = { id: 'deb', tipo: 'debito' };
const basesSalud = (txs, extra = {}) => ({ cuentas: [debSalud, tdcSalud], saldos: { deb: 30000, tdc: 1000 }, transacciones: txs, categorias: [], metas: [], ...extra });

test('salud: tranquilo sin movimientos y contento con balance positivo', () => {
    const t = evaluarSalud(basesSalud([]), HOY);
    assert.equal(t.estado, 'tranquilo');
    const c = evaluarSalud(basesSalud([{ tipo: 'ingreso', monto: 10000, fecha: '2026-09-01', cuentaId: 'deb' }, { tipo: 'gasto', monto: 8500, fecha: '2026-09-27', cuentaId: 'deb' }]), HOY);
    assert.equal(c.estado, 'contento');
    assert.match(c.mensaje, /\+\$1,500/);
    assert.ok(c.puntaje > 0 && c.puntaje <= 100);
});

test('salud: celebrando con ahorro ≥ 30 % y con meta cumplida este mes', () => {
    const txs = [{ tipo: 'ingreso', monto: 10000, fecha: '2026-09-01', cuentaId: 'deb' }, { tipo: 'gasto', monto: 6000, fecha: '2026-09-02', cuentaId: 'deb' }];
    assert.equal(evaluarSalud(basesSalud(txs), HOY).estado, 'celebrando');
    const meta = { nombre: 'Viaje', montoObjetivo: 500, montoActual: 500, historial: { a: { fecha: '2026-09-10', monto: 100 } } };
    const m = evaluarSalud(basesSalud([], { metas: [meta] }), HOY);
    assert.equal(m.estado, 'celebrando');
    assert.match(m.mensaje, /Viaje/);
});

test('salud: preocupado por tarjeta próxima y por presupuesto al 90 %', () => {
    const cerca = new Date(2026, 9, 3, 12); // 3 oct: Platino (corte 18 sep) vence el 5 oct
    const compra = [{ tipo: 'gasto', monto: 2000, fecha: '2026-09-10', cuentaId: 'tdc' }];
    const p = evaluarSalud(basesSalud(compra), cerca);
    assert.equal(p.estado, 'preocupado');
    assert.equal(p.accion.action, 'pagarTarjeta');
    const cat = [{ id: 'comida', nombre: 'Comida', presupuesto: 1000 }];
    const p2 = evaluarSalud(basesSalud([{ tipo: 'gasto', monto: 950, fecha: '2026-09-02', cuentaId: 'deb', categoriaId: 'comida' }], { categorias: cat }), HOY);
    assert.equal(p2.estado, 'preocupado');
    assert.match(p2.sugerencia, /\$50/);
});

test('salud: triste gana a todo (gastos > ingresos o pago vencido)', () => {
    const txs = [{ tipo: 'ingreso', monto: 1000, fecha: '2026-09-01', cuentaId: 'deb' }, { tipo: 'gasto', monto: 3000, fecha: '2026-09-02', cuentaId: 'deb' }];
    const t = evaluarSalud(basesSalud(txs), HOY);
    assert.equal(t.estado, 'triste');
    // Pago vencido: estado del 18 ago se pagaba el 5 sep y no se cubrió.
    const vencido = evaluarSalud(basesSalud([{ tipo: 'gasto', monto: 500, fecha: '2026-08-10', cuentaId: 'tdc' }]), new Date(2026, 8, 10, 12));
    assert.equal(vencido.estado, 'triste');
    assert.match(vencido.mensaje, /venció/);
});

test('consejos: hay suficientes y no se repite el anterior', () => {
    assert.ok(CONSEJOS.length >= 30);
    const a = consejoAlAzar();
    for (let i = 0; i < 20; i++) assert.notEqual(consejoAlAzar(a), a);
});

import { detalleMSI, msiDeCuenta } from '../js/domain/msi.js';
import { eventosMes, semanasMes } from '../js/domain/calendario.js';

test('msi: mensualidades facturadas, restantes y liberación', () => {
    const tdc = cuentas[1]; // corte 18, pago 5
    const d = detalleMSI(tdc, { tipo: 'gasto', monto: 1200, fecha: '2026-07-15', msi: 12, cuentaId: 'tdc' }, HOY);
    assert.deepEqual([d.mensualidad, d.facturadas, d.restantes, d.pendiente], [100, 3, 9, 900]);
    assert.equal(d.ultimoCorte, '2027-06-18');
    assert.equal(d.ultimoPago, '2027-07-05');
    // Compra el mismo día del corte: entra en ese corte. Después del corte: en el siguiente.
    assert.equal(detalleMSI(tdc, { monto: 600, fecha: '2026-09-18', msi: 6 }, HOY).facturadas, 1);
    assert.equal(detalleMSI(tdc, { monto: 600, fecha: '2026-09-20', msi: 6 }, HOY).facturadas, 0);
    const resumen = msiDeCuenta(tdc, [
        { tipo: 'gasto', monto: 1200, fecha: '2026-07-15', msi: 12, cuentaId: 'tdc' },
        { tipo: 'gasto', monto: 300, fecha: '2026-01-10', msi: 3, cuentaId: 'tdc' },   // ya terminó
        { tipo: 'gasto', monto: 50, fecha: '2026-09-10', cuentaId: 'tdc' },            // de contado: no cuenta
    ], HOY);
    assert.equal(resumen.activas.length, 1);
    assert.equal(resumen.terminadas.length, 1);
    assert.deepEqual([resumen.mensualidadTotal, resumen.pendienteTotal], [100, 900]);
});

test('calendario: cortes, pagos con monto, recurrentes y semanas', () => {
    const tdc = cuentas[1];
    const datos = {
        cuentas: [cuentas[0], tdc],
        transacciones: [{ tipo: 'gasto', monto: 1000, fecha: '2026-09-10', cuentaId: 'tdc' }],
        recurrentes: [
            { id: 'n', tipo: 'gasto', desc: 'Netflix', monto: 219, frecuencia: 'mensual', diaMes: 12, activo: true, proximaFecha: '2026-09-12' },
            { id: 'q', tipo: 'ingreso', desc: 'Nómina', monto: 9000, frecuencia: 'quincenal', activo: true, proximaFecha: '2026-10-01' },
            { id: 'p', tipo: 'gasto', desc: 'Pausado', monto: 1, frecuencia: 'mensual', activo: false, proximaFecha: '2026-10-02' },
        ],
    };
    const ev = eventosMes('2026-10', datos, HOY);
    const pago = ev.find(e => e.tipo === 'pago');
    assert.deepEqual([pago.fecha, pago.monto, pago.pagado], ['2026-10-05', 1000, false]);
    assert.ok(ev.some(e => e.tipo === 'corte' && e.fecha === '2026-10-18'));
    assert.deepEqual(ev.filter(e => e.recurrenteId === 'n').map(e => e.fecha), ['2026-10-12']);
    assert.deepEqual(ev.filter(e => e.recurrenteId === 'q').map(e => e.fecha), ['2026-10-01', '2026-10-16', '2026-10-31']);
    assert.ok(!ev.some(e => e.recurrenteId === 'p'));
    const semanas = semanasMes('2026-10', ev);
    assert.equal(semanas[0].desde, '2026-09-28');            // la semana empieza en lunes
    assert.equal(semanas[1].total, 1000);                     // 5–11 oct: pago de tarjeta
    assert.equal(semanas.reduce((a, s) => a + s.total, 0), 1219);
});

import { proyectarFinDeMes, gastoDiarioVariable } from '../js/domain/proyeccion.js';

test('proyección: simula hasta fin de mes con nómina, renta, tarjeta y gasto diario', () => {
    const dia20 = new Date(2026, 8, 20, 12);
    const datos = (saldoDeb) => ({
        cuentas: [{ id: 'deb', tipo: 'debito' }, { id: 'tdc', tipo: 'credito', diaCorte: 18, diaPago: 5 }],
        saldos: { deb: saldoDeb, tdc: 800 },
        transacciones: [
            { tipo: 'gasto', monto: 9200, fecha: '2026-07-10', cuentaId: 'deb' },  // 92 días → $100 diarios
            { tipo: 'gasto', monto: 800, fecha: '2026-08-10', cuentaId: 'tdc' },   // estado del 18 ago, vence 5 sep, sin pagar
            { tipo: 'gasto', monto: 50, fecha: '2026-09-02', cuentaId: 'deb', recurrenteId: 'x' }, // recurrente: no es variable
        ],
        recurrentes: [
            { id: 'nom', tipo: 'ingreso', monto: 9000, frecuencia: 'mensual', diaMes: 30, activo: true, proximaFecha: '2026-09-30', cuentaId: 'deb' },
            { id: 'renta', tipo: 'gasto', monto: 3000, frecuencia: 'mensual', diaMes: 25, activo: true, proximaFecha: '2026-09-25', cuentaId: 'deb' },
            { id: 'netflix', tipo: 'gasto', monto: 219, frecuencia: 'mensual', diaMes: 22, activo: true, proximaFecha: '2026-09-22', cuentaId: 'tdc' },
        ],
    });
    assert.equal(gastoDiarioVariable(datos(0).cuentas, datos(0).transacciones, dia20), 100);
    const p = proyectarFinDeMes(datos(5000), dia20);
    assert.equal(p.diasRestantes, 10);
    assert.deepEqual(p.minimo, { fecha: '2026-09-29', saldo: 300 });
    assert.equal(p.cierre, 9200);
    assert.equal(p.negativo, false);
    assert.deepEqual(p.detalle, { ingresos: 9000, recurrentes: 3000, tarjetas: 800, variable: 1000 });
    const apretado = proyectarFinDeMes(datos(3000), dia20);
    assert.equal(apretado.negativo, true);
    assert.deepEqual(apretado.minimo, { fecha: '2026-09-29', saldo: -1700 });
});

test('salud: proyección negativa preocupa a Tlaco', () => {
    const dia20 = new Date(2026, 8, 20, 12);
    const s = evaluarSalud({
        cuentas: [{ id: 'deb', tipo: 'debito' }], saldos: { deb: 500 },
        transacciones: [{ tipo: 'gasto', monto: 9200, fecha: '2026-07-10', cuentaId: 'deb' }, { tipo: 'ingreso', monto: 100, fecha: '2026-09-01', cuentaId: 'deb' }],
        recurrentes: [],
    }, dia20);
    assert.equal(s.estado, 'preocupado');
    assert.match(s.mensaje, /te faltarían/);
    assert.equal(s.factores.find(f => f.id === 'fin').nivel, 'mal');
});

import { sugerirCategoria, buscarPorNombre } from '../js/domain/autocategoria.js';
import { partesDe } from '../js/domain/analisis.js';

test('autocategoría: historial primero, luego diccionario', () => {
    const historial = [
        { tipo: 'gasto', desc: 'Tacos El Güero', categoriaId: 'ocio' },
        { tipo: 'gasto', desc: 'Tacos El Güero', categoriaId: 'ocio' },
    ];
    assert.deepEqual(sugerirCategoria('tacos el guero', historial), { categoriaId: 'ocio', fuente: 'historial' });
    assert.equal(sugerirCategoria('Tacos de canasta', []).categoriaId, 'comida');
    assert.equal(sugerirCategoria('OXXO Insurgentes', []).categoriaId, 'comida');
    assert.equal(sugerirCategoria('Uber al aeropuerto', []).categoriaId, 'transporte');
    assert.equal(sugerirCategoria('Uber Eats', []).categoriaId, 'comida');
    assert.equal(sugerirCategoria('Recibo CFE', []).categoriaId, 'servicios');
    assert.equal(sugerirCategoria('gas natural', []).categoriaId, 'servicios');
    assert.equal(sugerirCategoria('Netflix', []).categoriaId, 'suscripciones');
    assert.equal(sugerirCategoria('zzz', []), null);
    assert.equal(sugerirCategoria('Netflix', [], ['comida']), null);   // solo categorías existentes
    const cats = [{ id: 'comida', nombre: 'Comida' }, { id: 'transporte', nombre: 'Transporte' }];
    assert.equal(buscarPorNombre('comida', cats).id, 'comida');
    assert.equal(buscarPorNombre('Transp', cats).id, 'transporte');
});

test('gastos divididos: el resumen reparte por categoría y el total no cambia', () => {
    const tx = { tipo: 'gasto', monto: 1000, fecha: '2026-09-05', categoriaId: 'comida', partes: [{ categoriaId: 'comida', monto: 700 }, { categoriaId: 'vivienda', monto: 300 }] };
    const r = resumenMes([tx], '2026-09');
    assert.equal(r.gastos, 1000);
    assert.deepEqual(r.porCategoria, { comida: 700, vivienda: 300 });
    assert.deepEqual(partesDe({ tipo: 'gasto', monto: 50, categoriaId: 'ocio' }), [{ categoriaId: 'ocio', monto: 50 }]);
});

// ---------- Fase 4 ----------
import { porEtiqueta, comparativoAnual, gastoPorDia, nivelCalor } from '../js/domain/analisis.js';
import { evaluarReto, sugerirRetos, tituloReto } from '../js/domain/retos.js';
import { datosResumenMes, tonoResumen } from '../js/domain/historias.js';

test('etiquetas: total por etiqueta, solo gastos y en el rango', () => {
    const txs = [
        { tipo: 'gasto', monto: 500, fecha: '2026-08-10', etiquetas: ['vacaciones'] },
        { tipo: 'gasto', monto: 300, fecha: '2026-08-11', etiquetas: ['vacaciones', 'playa'] },
        { tipo: 'ingreso', monto: 900, fecha: '2026-08-11', etiquetas: ['vacaciones'] },
        { tipo: 'gasto', monto: 100, fecha: '2026-06-01', etiquetas: ['playa'] },
    ];
    const r = porEtiqueta(txs);
    assert.deepEqual(r.map(g => [g.etiqueta, g.total, g.veces]), [['vacaciones', 800, 2], ['playa', 400, 2]]);
    assert.equal(r[1].desde, '2026-06-01');
    assert.deepEqual(porEtiqueta(txs, '2026-08', '2026-08').map(g => g.total), [800, 300]);
});

test('comparativo anual: meses futuros en null y mismo mes del año pasado', () => {
    const txs = [
        { tipo: 'gasto', monto: 1000, fecha: '2025-09-03' },
        { tipo: 'gasto', monto: 1500, fecha: '2026-09-03' },
        { tipo: 'gasto', monto: 200, fecha: '2026-01-15' },
        { tipo: 'gasto', monto: 999, fecha: '2025-12-15' },
    ];
    const c = comparativoAnual(txs, HOY);
    assert.equal(c.serieActual[8], 1500);
    assert.equal(c.serieActual[9], null);
    assert.equal(c.serieAnterior[11], 999);
    assert.equal(c.serieAnterior[7], null);     // agosto 2025: antes del primer movimiento
    assert.equal(c.variacionMes, 50);
    assert.equal(c.acumuladoActual, 1700);
    assert.equal(c.acumuladoAnterior, 1000);   // diciembre pasado no entra al acumulado a septiembre
    assert.ok(c.hayAnterior);
});

test('mapa de calor: gasto por día y niveles 0–4', () => {
    const { dias, maximo } = gastoPorDia([
        { tipo: 'gasto', monto: 100, fecha: '2026-09-02' }, { tipo: 'gasto', monto: 300, fecha: '2026-09-02' },
        { tipo: 'gasto', monto: 50, fecha: '2026-09-05' }, { tipo: 'ingreso', monto: 9000, fecha: '2026-09-05' },
    ], '2026-09');
    assert.deepEqual(dias, { '2026-09-02': 400, '2026-09-05': 50 });
    assert.equal(maximo, 400);
    const conRenta = gastoPorDia([9000, 100, 120, 90, 110, 80, 95].map((m, i) => ({ tipo: 'gasto', monto: m, fecha: `2026-09-0${i + 1}` })), '2026-09');
    assert.equal(conRenta.referencia, 120);                 // la renta no fija la escala
    assert.equal(nivelCalor(9000, conRenta.referencia), 4);
    assert.equal(nivelCalor(0, 400), 0);
    assert.equal(nivelCalor(50, 400), 1);
    assert.equal(nivelCalor(400, 400), 4);
});

test('retos: sin gastar en una categoría', () => {
    const reto = { tipo: 'sin-categoria', categoriaId: 'ocio', dias: 7, inicio: '2026-09-25' };
    const limpio = [{ tipo: 'gasto', monto: 80, fecha: '2026-09-26', categoriaId: 'comida' }];
    const e = evaluarReto(reto, limpio, HOY);
    assert.equal(e.estado, 'activo');
    assert.equal(e.diasOk, 3);            // 25, 26, 27; hoy (28) aún no termina
    assert.equal(e.fin, '2026-10-01');
    const roto = [...limpio, { tipo: 'gasto', monto: 1000, fecha: '2026-09-27', categoriaId: 'comida', partes: [{ categoriaId: 'comida', monto: 800 }, { categoriaId: 'ocio', monto: 200 }] }];
    const f = evaluarReto(reto, roto, HOY);
    assert.equal(f.estado, 'fallido');
    assert.equal(f.falloEn, '2026-09-27');
    assert.equal(evaluarReto(reto, limpio, new Date(2026, 9, 2, 12)).estado, 'cumplido');
    assert.equal(tituloReto(reto, 'Ocio'), '7 días sin gastar en Ocio');
});

test('retos: tope diario ignora recurrentes y registrar todos los días', () => {
    const tope = { tipo: 'tope-diario', tope: 300, dias: 3, inicio: '2026-09-26' };
    const txs = [
        { tipo: 'gasto', monto: 250, fecha: '2026-09-26' },
        { tipo: 'gasto', monto: 8000, fecha: '2026-09-27', recurrenteId: 'renta' },
        { tipo: 'gasto', monto: 120, fecha: '2026-09-28' },
    ];
    const e = evaluarReto(tope, txs, HOY);
    assert.equal(e.estado, 'activo');
    assert.equal(e.hoyGastado, 120);
    assert.equal(evaluarReto(tope, [...txs, { tipo: 'gasto', monto: 200, fecha: '2026-09-28' }], HOY).estado, 'fallido');

    const reg = { tipo: 'registrar-diario', dias: 3, inicio: '2026-09-26' };
    assert.equal(evaluarReto(reg, txs.slice(0, 2), HOY).estado, 'activo');        // hoy aún puede registrar
    assert.equal(evaluarReto(reg, txs, HOY).estado, 'cumplido');                  // los 3 días tienen registro
    assert.equal(evaluarReto(reg, [txs[0], txs[2]], HOY).estado, 'fallido');      // faltó el 27
});

test('retos sugeridos: categoría variable con más gasto y tope redondeado', () => {
    const txs = [
        { tipo: 'gasto', monto: 9000, fecha: '2026-08-01', categoriaId: 'vivienda' },
        { tipo: 'gasto', monto: 2700, fecha: '2026-08-05', categoriaId: 'ocio' },
        { tipo: 'gasto', monto: 900, fecha: '2026-07-05', categoriaId: 'comida' },
    ];
    const s = sugerirRetos(txs, HOY);
    assert.equal(s.categoriaId, 'ocio');
    assert.equal(s.tope % 50, 0);
    assert.ok(s.tope >= 50);
});

test('tu mes en resumen: cifras y tono', () => {
    const txs = [
        { tipo: 'ingreso', monto: 20000, fecha: '2026-08-15' },
        { tipo: 'gasto', monto: 3000, fecha: '2026-08-02', categoriaId: 'comida' },
        { tipo: 'gasto', monto: 1000, fecha: '2026-08-02', categoriaId: 'ocio' },
        { tipo: 'gasto', monto: 2000, fecha: '2026-07-02', categoriaId: 'comida' },
    ];
    const metas = [{ nombre: 'Viaje', montoObjetivo: 1000, montoActual: 900 }, { nombre: 'Auto', montoObjetivo: 10000, montoActual: 100 }];
    const d = datosResumenMes(txs, metas, '2026-08');
    assert.equal(d.gastos, 4000);
    assert.equal(d.top.categoriaId, 'comida');
    assert.equal(d.top.porcentaje, 75);
    assert.equal(d.top.variacion, 50);
    assert.deepEqual(d.masCaro, { fecha: '2026-08-02', monto: 4000 });
    assert.equal(d.diasSinGasto, 30);
    assert.equal(d.meta.nombre, 'Viaje');
    assert.equal(tonoResumen(d), 'celebrando');
    assert.equal(tonoResumen({ ingresos: 0, balance: -50 }), 'preocupado');
});

// ---------- Fase 5 ----------
test('salud: Tlaco dormido sin registros en 3 días y sorprendido con un gasto atípico', () => {
    const base = { cuentas: [{ id: 'd', tipo: 'debito' }], saldos: { d: 5000 } };
    const dormido = evaluarSalud({ ...base, transacciones: [{ tipo: 'gasto', monto: 50, fecha: '2026-09-24', cuentaId: 'd', categoriaId: 'comida' }] }, HOY);
    assert.equal(dormido.estado, 'dormido');
    assert.match(dormido.mensaje, /4 días/);

    const rutina = Array.from({ length: 30 }, (_, i) => ({ tipo: 'gasto', monto: 100, fecha: `2026-08-${String(i + 1).padStart(2, '0')}`, cuentaId: 'd', categoriaId: 'comida' }));
    const ingreso = { tipo: 'ingreso', monto: 50000, fecha: '2026-09-01', cuentaId: 'd' };
    const normal = evaluarSalud({ ...base, transacciones: [...rutina, ingreso, { tipo: 'gasto', monto: 80, fecha: '2026-09-28', cuentaId: 'd', categoriaId: 'comida' }] }, HOY);
    assert.notEqual(normal.estado, 'sorprendido');
    const grande = evaluarSalud({ ...base, transacciones: [...rutina, ingreso, { tipo: 'gasto', monto: 2000, fecha: '2026-09-28', cuentaId: 'd', categoriaId: 'ocio' }] }, HOY);
    assert.equal(grande.estado, 'sorprendido');
});

test('ingreso grande: la quincena sí, el cashback no', async () => {
    const { esIngresoGrande } = await import('../js/domain/analisis.js');
    const historial = [7, 8].map(m => ({ tipo: 'ingreso', monto: 30000, fecha: `2026-0${m}-15` }));
    assert.equal(esIngresoGrande(15000, historial, HOY), true);
    assert.equal(esIngresoGrande(2500, historial, HOY), false);
    assert.equal(esIngresoGrande(5000, historial, HOY), false);   // menos del 40 % de $30,000
    assert.equal(esIngresoGrande(3500, [], HOY), true);           // sin historial basta con $3,000
});

// ---------- Fase 6 ----------
import { calcularRecordatorios, interpretarDictado, proximoMomento, momento } from '../js/domain/recordatorios.js';

test('recordatorios: tarjeta un día antes y el mismo día; nada si ya está pagada', () => {
    const tdc = { id: 'tdc', nombre: 'Platino', tipo: 'credito', diaCorte: 18, diaPago: 5, saldoInicial: 0, fechaInicial: '2026-01-01' };
    const txs = [{ tipo: 'gasto', monto: 1200, fecha: '2026-09-10', cuentaId: 'tdc', categoriaId: 'comida' }];
    const a = calcularRecordatorios({ cuentas: [tdc], transacciones: txs }, HOY);
    const ids = a.map(x => x.id);
    assert.ok(ids.includes('tdc:tdc:2026-10-05:antes'));
    assert.ok(ids.includes('tdc:tdc:2026-10-05:hoy'));
    const hoyAviso = a.find(x => x.id === 'tdc:tdc:2026-10-05:hoy');
    assert.equal(hoyAviso.at, momento('2026-10-05', 9));
    assert.match(hoyAviso.body, /\$1,200/);
    const pagada = calcularRecordatorios({ cuentas: [{ ...tdc, pagadoPeriodo: '2026-09' }], transacciones: txs }, HOY);
    assert.ok(!pagada.some(x => x.id.startsWith('tdc:')));
});

test('recordatorios: recurrentes, presupuesto al 90 % y resumen del domingo', () => {
    const deb = { id: 'd', nombre: 'Nómina', tipo: 'debito', saldoInicial: 50000, fechaInicial: '2026-01-01' };
    const rec = { id: 'net', tipo: 'gasto', desc: 'Netflix', monto: 219, cuentaId: 'd', frecuencia: 'mensual', diaMes: 2, activo: true, proximaFecha: '2026-10-02' };
    const txs = [{ tipo: 'gasto', monto: 950, fecha: '2026-09-28', cuentaId: 'd', categoriaId: 'comida' }];
    const cats = [{ id: 'comida', nombre: 'Comida', presupuesto: 1000 }];
    const a = calcularRecordatorios({ cuentas: [deb], saldos: { d: 49050 }, transacciones: txs, recurrentes: [rec], categorias: cats }, HOY);
    const net = a.find(x => x.id === 'rec:net:2026-10-02');
    assert.equal(net.title, 'Hoy toca: Netflix');
    assert.ok(a.find(x => x.id === 'm:pres90:comida:2026-09'));
    const sem = a.find(x => x.id.startsWith('sem:'));
    assert.equal(sem.id, 'sem:2026-10-04');                // HOY es lunes 28; el domingo es el 4
    assert.equal(sem.at, momento('2026-10-04', 19));
    assert.match(sem.body, /Comida/);
    // Avisos de estado: de día salen ya; de noche esperan a las 9:00.
    assert.equal(proximoMomento(new Date(2026, 8, 28, 23, 0)), momento('2026-09-29', 9));
    assert.equal(proximoMomento(HOY), HOY.getTime() + 60000);
});

test('Siri: interpretar lo dictado', () => {
    assert.deepEqual(interpretarDictado('250 oxxo'), { tipo: 'gasto', monto: 250, desc: 'Oxxo' });
    assert.deepEqual(interpretarDictado('$1,250.50 en el súper'), { tipo: 'gasto', monto: 1250.5, desc: 'Súper' });
    assert.deepEqual(interpretarDictado('gasté 80 pesos en tacos'), { tipo: 'gasto', monto: 80, desc: 'Tacos' });
    assert.deepEqual(interpretarDictado('ingreso 5000 nómina'), { tipo: 'ingreso', monto: 5000, desc: 'Nómina' });
    assert.deepEqual(interpretarDictado('Uber 135'), { tipo: 'gasto', monto: 135, desc: 'Uber' });
    assert.equal(interpretarDictado('café'), null);
});
