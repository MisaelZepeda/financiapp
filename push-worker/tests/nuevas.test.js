import { test } from 'node:test';
import assert from 'node:assert/strict';
import { interpretarMonto, sugerirCuentaWallet } from '../../js/domain/applepay.js';

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
