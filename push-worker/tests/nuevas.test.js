import { test } from 'node:test';
import assert from 'node:assert/strict';
import { interpretarMonto, sugerirCuentaWallet } from '../../js/domain/applepay.js';
import { puedesGastar, siguienteIngreso } from '../../js/domain/puedes-gastar.js';
import { calcularSaldos } from '../../js/domain/saldos.js';

test('interpreta montos como los manda el iPhone', () => {
  assert.equal(interpretarMonto('$1,234.50'), 1234.5);
  assert.equal(interpretarMonto('MX$ 1.234,50'), 1234.5);
  assert.equal(interpretarMonto('$85'), 85);
  assert.equal(interpretarMonto('85,5'), 85.5);
  assert.equal(interpretarMonto('1,250'), 1250);
  assert.equal(interpretarMonto('1.250'), 1250);
  assert.equal(interpretarMonto('$0.00'), null);
  assert.equal(interpretarMonto('hola'), null);
  assert.equal(interpretarMonto(99.9), 99.9);
});

test('sugiere la cuenta de una tarjeta de la Cartera', () => {
  const cuentas = [
    { id: 'nom', nombre: 'Nómina', banco: 'BBVA', tipo: 'debito', digitos: '4821' },
    { id: 'pla', nombre: 'Platino', banco: 'Santander', tipo: 'credito', digitos: '5567' },
    { id: 'nu', nombre: 'Nu', banco: 'Nu', tipo: 'credito' },
  ];
  assert.equal(sugerirCuentaWallet('Santander Platino', cuentas), 'pla');
  assert.equal(sugerirCuentaWallet('BBVA Débito •••• 4821', cuentas), 'nom');
  assert.equal(sugerirCuentaWallet('Nu', cuentas), 'nu');
  assert.equal(sugerirCuentaWallet('Tarjeta rara', cuentas, { 'tarjeta rara': 'pla' }), 'pla');
  assert.equal(sugerirCuentaWallet('Otra', cuentas), null);
});

test('siguiente ingreso: pago fijo o quincena', () => {
  const cuentas = [{ id: 'nom', tipo: 'debito' }];
  const hoy = new Date(2026, 10, 10);
  assert.equal(siguienteIngreso(cuentas, [], hoy).fecha, '2026-11-15');
  assert.equal(siguienteIngreso(cuentas, [], new Date(2026, 10, 20)).fecha, '2026-11-30');
  assert.equal(siguienteIngreso(cuentas, [], new Date(2026, 10, 30)).fecha, '2026-12-15');
  const recs = [{ tipo: 'ingreso', cuentaId: 'nom', proximaFecha: '2026-11-13', frecuencia: 'quincenal', monto: 9000 }];
  assert.equal(siguienteIngreso(cuentas, recs, hoy).fecha, '2026-11-13');
});

test('puedes gastar hoy descuenta pagos fijos y tarjetas antes del ingreso', () => {
  const cuentas = [
    { id: 'nom', tipo: 'debito', saldoInicial: 10000 },
    { id: 'pla', tipo: 'credito', diaCorte: 1, diaPago: 12 },
  ];
  const txs = [
    { tipo: 'gasto', fecha: '2026-10-20', monto: 2000, cuentaId: 'pla', categoriaId: 'x' },   // estado 1 nov, paga 12 nov
    { tipo: 'gasto', fecha: '2026-11-10', monto: 300, cuentaId: 'nom', categoriaId: 'x' },    // hoy
  ];
  const recs = [
    { tipo: 'gasto', cuentaId: 'nom', proximaFecha: '2026-11-11', monto: 1000, frecuencia: 'mensual', diaMes: 11, desc: 'Renta' },
    { tipo: 'ingreso', cuentaId: 'nom', proximaFecha: '2026-11-15', monto: 9000, frecuencia: 'mensual', diaMes: 15 },
  ];
  const r = puedesGastar({ cuentas, saldos: calcularSaldos(cuentas, txs), transacciones: txs, recurrentes: recs }, new Date(2026, 10, 10));
  assert.equal(r.disponible, 9700);
  assert.equal(r.comprometido, 3000);
  assert.equal(r.libre, 6700);
  assert.equal(r.dias, 5);
  assert.equal(r.porDia, 1400);        // (6700 + 300) / 5
  assert.equal(r.hoyQueda, 1100);
});
