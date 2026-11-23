// API personal (push-worker/src/api.js): funciones puras, sin red.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { validarMovimiento, respTeDeben, respPresupuestos, validarTopes, respMovimientos, leerFiltros, validarCuenta, respCuentas } from '../push-worker/src/api.js';
import { topeEnMes } from '../js/domain/topes.js';
import { pendientesPorCompra, compraPorSaldar } from '../js/domain/terceros.js';

const HOY = new Date(2026, 10, 22, 12);   // 22 nov 2026

// Datos de prueba con la forma de Firebase (objetos por id).
function base() {
    return {
        cuentas: {
            mp: { nombre: 'MercadoPago', tipo: 'debito', saldoInicial: 1000, fechaInicial: '2026-01-01' },
            efe: { nombre: 'Efectivo', tipo: 'efectivo', saldoInicial: 500, fechaInicial: '2026-01-01' },
            rappi: { nombre: 'RappiCard', banco: 'Rappi', tipo: 'credito', digitos: '0852', limite: 20000, diaCorte: 10, diaPago: 30, saldoInicial: 0, fechaInicial: '2026-01-01' },
        },
        categorias: {
            comida: { nombre: 'Comida', presupuesto: 3000 }, hogar: { nombre: 'Hogar' },
            suscripciones: { nombre: 'Suscripciones', presupuesto: 120 }, otros: { nombre: 'Otros' },
        },
        transacciones: {
            c1: { tipo: 'gasto', monto: 239.79, fecha: '2026-11-15', cuentaId: 'rappi', categoriaId: 'otros', desc: 'Audífonos', paraTercero: 'Maria Alvarado' },
            g1: { tipo: 'gasto', monto: 349, fecha: '2026-11-05', cuentaId: 'rappi', categoriaId: 'suscripciones', desc: 'Anthropic Claude' },
            g2: { tipo: 'gasto', monto: 80, fecha: '2026-11-06', cuentaId: 'efe', categoriaId: 'comida', desc: 'Tacos' },
            g3: { tipo: 'gasto', monto: 120, fecha: '2026-10-30', cuentaId: 'efe', categoriaId: 'comida', desc: 'Súper' },
        },
        topes: {},
    };
}
// Simula guardar en Firebase lo que la API valida.
const guardar = (v4, id, tx) => ({ ...v4, transacciones: { ...v4.transacciones, [id]: tx } });

test('API 1 · abonoDe: liga el abono a su compra y Te deben lo refleja; null lo desliga', () => {
    let v4 = base();
    const r = validarMovimiento({ tipo: 'ingreso', monto: 239.79, cuenta: 'MercadoPago', descripcion: 'Pago de Maria Alvarado', abonoDe: 'c1' }, v4, { hoy: HOY });
    assert.equal(r.error, undefined);
    assert.equal(r.tx.abonoDe, 'Maria Alvarado');
    assert.equal(r.tx.abonoCompra, 'c1');
    v4 = guardar(v4, 'a1', r.tx);
    const [maria] = respTeDeben(v4, HOY).personas;
    assert.equal(maria.pagado, 239.79);
    assert.equal(maria.pendiente, 0);
    assert.equal(maria.abonos.length, 1);
    assert.equal(maria.abonos[0].abonoDe, 'c1');
    assert.equal(maria.abonos[0].cuenta.nombre, 'MercadoPago');
    assert.equal(maria.abonos.reduce((a, x) => a + x.monto, 0), maria.pagado);

    // Desligar con PATCH "abonoDe": null → la compra vuelve a quedar pendiente.
    const p = validarMovimiento({ abonoDe: null }, v4, { previo: v4.transacciones.a1, previoId: 'a1', hoy: HOY });
    assert.equal(p.tx.abonoDe, null);
    v4 = guardar(v4, 'a1', p.tx);
    assert.equal(respTeDeben(v4, HOY).personas[0].pendiente, 239.79);

    // Ligar un ingreso ya creado con PATCH.
    const l = validarMovimiento({ abonoDe: 'c1' }, v4, { previo: v4.transacciones.a1, previoId: 'a1', hoy: HOY });
    assert.equal(l.tx.abonoCompra, 'c1');
});

test('API 1 · abonoDe: errores', () => {
    const v4 = base();
    const e = (b) => validarMovimiento(b, v4, { hoy: HOY }).error;
    assert.match(e({ tipo: 'gasto', monto: 10, cuenta: 'Efectivo', abonoDe: 'c1' }), /solo aplica a ingresos/);
    assert.match(e({ tipo: 'transferencia', monto: 10, cuenta: 'Efectivo', cuentaDestino: 'MercadoPago', abonoDe: 'c1' }), /solo aplica a ingresos/);
    assert.match(e({ tipo: 'ingreso', monto: 10, cuenta: 'Efectivo', abonoDe: 'nada' }), /no existe/);
    assert.match(e({ tipo: 'ingreso', monto: 10, cuenta: 'Efectivo', abonoDe: 'g1' }), /paraQuien/);
    assert.match(e({ tipo: 'ingreso', monto: 300, cuenta: 'Efectivo', abonoDe: 'c1' }), /supera lo pendiente.*239.79/);
    const saldado = guardar(v4, 'a1', { tipo: 'ingreso', monto: 239.79, fecha: '2026-11-22', cuentaId: 'mp', abonoDe: 'Maria Alvarado', abonoCompra: 'c1' });
    assert.match(validarMovimiento({ tipo: 'ingreso', monto: 10, cuenta: 'Efectivo', abonoDe: 'c1' }, saldado, { hoy: HOY }).error, /ya está saldada/);
    // Sin abonoDe, un ingreso se crea igual que antes.
    assert.equal(validarMovimiento({ tipo: 'ingreso', monto: 100, cuenta: 'Efectivo' }, v4, { hoy: HOY }).tx.abonoDe, null);
});

test('Te deben: abonos sueltos (de la app) se reparten de la compra más antigua', () => {
    const txs = [
        { id: 'x1', tipo: 'gasto', monto: 100, fecha: '2026-10-01', paraTercero: 'Ana' },
        { id: 'x2', tipo: 'gasto', monto: 50, fecha: '2026-11-01', paraTercero: 'Ana' },
        { id: 'a', tipo: 'ingreso', monto: 120, fecha: '2026-11-02', abonoDe: 'Ana' },
    ];
    const p = pendientesPorCompra(txs);
    assert.equal(p.x1.pendiente, 0);
    assert.equal(p.x2.pendiente, 30);
    assert.equal(compraPorSaldar(txs, 'ana').id, 'x2');
});

test('API 2 · topes por mes: a partir del mes indicado, atómico, 0 y null válidos', () => {
    const v4 = base();
    const r = validarTopes({ topes: [{ categoria: 'suscripciones', tope: 90 }, { categoria: 'Hogar', tope: 600 }, { categoria: 'Comida', tope: 0 }] }, v4);
    assert.deepEqual(r.cambios, { suscripciones: 90, hogar: 600, comida: 0 });
    const conTopes = { ...v4, topes: { '2026-12': r.cambios } };
    const dic = respPresupuestos(conTopes, '2026-12').presupuestos;
    assert.equal(dic.find(p => p.categoria.id === 'suscripciones').tope, 90);
    assert.equal(dic.find(p => p.categoria.id === 'comida').tope, 0);
    // Noviembre no cambia; enero hereda diciembre.
    assert.equal(respPresupuestos(conTopes, '2026-11').presupuestos.find(p => p.categoria.id === 'suscripciones').tope, 120);
    assert.equal(topeEnMes({ id: 'hogar' }, conTopes.topes, '2027-01'), 600);
    // null quita el tope.
    assert.equal(validarTopes({ topes: [{ categoria: 'comida', tope: null }] }, v4).cambios.comida, -1);
    assert.equal(topeEnMes({ id: 'comida', presupuesto: 3000 }, { '2026-12': { comida: -1 } }, '2026-12'), null);
    // Errores: categoría inexistente, negativo, lista vacía (y nada se aplica).
    assert.match(validarTopes({ topes: [{ categoria: 'comida', tope: 10 }, { categoria: 'Viajes', tope: 5 }] }, v4).error, /topes\[1\].*Viajes/);
    assert.match(validarTopes({ topes: [{ categoria: 'comida', tope: -5 }] }, v4).error, /mayor o igual a 0/);
    assert.match(validarTopes({ topes: [] }, v4).error, /topes/);
});

test('API 3 · cuentas: alta y corrección', () => {
    const v4 = base();
    const r = validarCuenta({ nombre: 'Mercado Pago Débito', banco: 'Mercado Pago', tipo: 'debito', digitos: '0000' }, v4, { hoy: HOY });
    assert.equal(r.cuenta.digitos, '0000');
    assert.equal(r.cuenta.saldoInicial, 0);
    assert.equal(r.cuenta.fechaInicial, '2026-11-22');
    const p = validarCuenta({ digitos: '0582' }, v4, { previo: { ...v4.cuentas.rappi, id: 'rappi' } });
    assert.equal(p.cuenta.digitos, '0582');
    assert.equal(p.cuenta.limite, 20000);   // lo demás se conserva
    const e = (b, o) => validarCuenta(b, v4, o).error;
    assert.match(e({ banco: 'X', tipo: 'debito' }), /nombre/);
    assert.match(e({ nombre: 'Azteca' }), /tipo/);
    assert.match(e({ nombre: 'mercadopago', tipo: 'debito' }), /Ya existe/);
    assert.match(e({ nombre: 'Azteca', tipo: 'debito', digitos: '501' }), /4 números/);
    assert.match(e({ nombre: 'Azteca', tipo: 'debito', limite: 100 }), /crédito/);
    assert.match(e({ tipo: 'debito' }, { previo: { ...v4.cuentas.rappi, id: 'rappi' } }), /No se puede cambiar tipo/);
    assert.match(e({ saldoInicial: 5 }, { previo: { ...v4.cuentas.rappi, id: 'rappi' } }), /No se puede cambiar/);
    // La cuenta nueva aparece en GET /cuentas con su saldo.
    const c = respCuentas({ ...v4, cuentas: { ...v4.cuentas, mpd: r.cuenta } }, HOY).cuentas.find(x => x.id === 'mpd');
    assert.equal(c.saldo, 0);
});

test('API 4 · búsqueda con filtros', () => {
    const v4 = base();
    const q = (params, mes = '2026-11') => { const f = leerFiltros(new URLSearchParams(params)); return f.error ? f : respMovimientos(v4, mes, f.filtros); };
    assert.deepEqual(q('cuenta=RappiCard&q=anthropic').movimientos.map(m => m.id), ['g1']);
    assert.deepEqual(q('categoria=Suscripciones&montoMin=300&montoMax=400').movimientos.map(m => m.id), ['g1']);
    const rango = q('desde=2026-10-30&hasta=2026-11-06&tipo=gasto');
    assert.equal(rango.mes, null);
    assert.deepEqual(rango.movimientos.map(m => m.id), ['g2', 'g1', 'g3']);
    assert.deepEqual(q('paraQuien=Maria Alvarado').movimientos.map(m => m.id), ['c1']);
    assert.deepEqual(rango.filtros, { tipo: 'gasto', desde: '2026-10-30', hasta: '2026-11-06' });
    // Sin filtros: igual que antes (sin el objeto filtros).
    const sin = q('');
    assert.equal(sin.filtros, undefined);
    assert.equal(sin.total, 3);
    assert.match(q('desde=2026-11-31x').error, /desde/);
    assert.match(q('desde=2026-11-10&hasta=2026-11-01').error, /anterior/);
    assert.match(q('montoMin=abc').error, /montoMin/);
});

test('API 5 · gastos divididos: cada parte cuenta en su categoría', () => {
    let v4 = base();
    const r = validarMovimiento({ tipo: 'gasto', monto: 341, cuenta: 'Efectivo', descripcion: 'Tres B', partes: [{ categoria: 'Hogar', monto: 250 }, { categoria: 'Comida', monto: 91 }] }, v4, { hoy: HOY });
    assert.equal(r.error, undefined);
    assert.equal(r.tx.categoriaId, 'hogar');
    const antes = respPresupuestos(v4, '2026-11').presupuestos;
    v4 = guardar(v4, 'd1', r.tx);
    const despues = respPresupuestos(v4, '2026-11').presupuestos;
    const gasto = (lista, id) => lista.find(p => p.categoria.id === id).gastado;
    assert.equal(gasto(despues, 'hogar') - gasto(antes, 'hogar'), 250);
    assert.equal(gasto(despues, 'comida') - gasto(antes, 'comida'), 91);
    // PATCH con partes null las quita; con partes nuevas las reemplaza.
    assert.equal(validarMovimiento({ partes: null }, v4, { previo: v4.transacciones.d1, previoId: 'd1', hoy: HOY }).tx.partes, null);
    const e = (b) => validarMovimiento({ tipo: 'gasto', monto: 341, cuenta: 'Efectivo', ...b }, v4, { hoy: HOY }).error;
    assert.match(e({ partes: [{ categoria: 'Hogar', monto: 250 }, { categoria: 'Comida', monto: 90 }] }), /suma/);
    assert.match(e({ partes: [{ categoria: 'Hogar', monto: 341 }] }), /al menos 2/);
    assert.match(e({ partes: [{ categoria: 'Hogar', monto: 241 }, { categoria: 'hogar', monto: 100 }] }), /repetida/);
    assert.match(e({ partes: [{ categoria: 'Viajes', monto: 241 }, { categoria: 'Comida', monto: 100 }] }), /no encontrada/);
    assert.match(validarMovimiento({ tipo: 'ingreso', monto: 10, cuenta: 'Efectivo', partes: [] }, v4, { hoy: HOY }).error, /solo aplica a gastos/);
});

test('API 6 · Te deben por persona con ?persona', () => {
    const v4 = base();
    assert.equal(respTeDeben(v4, HOY, 'maria alvarado').personas.length, 1);
    assert.equal(respTeDeben(v4, HOY, 'Nadie').personas.length, 0);
    assert.deepEqual(respTeDeben(v4, HOY).personas[0].abonos, []);
});
