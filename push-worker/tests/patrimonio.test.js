import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularSaldos, patrimonio, porCobrar, msiPorVenir } from '../../js/domain/saldos.js';

test('el dinero en total resta solo las mensualidades que ya corrieron', () => {
  const cuentas = [{ id: 'nom', tipo: 'debito', saldoInicial: 20000 }, { id: 'tdc', tipo: 'credito', limite: 50000 }];
  const txs = [{ tipo: 'gasto', fecha: '2026-11-10', monto: 6000, msi: 6, cuentaId: 'tdc' }];
  const saldos = calcularSaldos(cuentas, txs);
  assert.equal(saldos.tdc, 6000);                      // la tarjeta debe el total
  const futuro = msiPorVenir(cuentas, txs, '2026-11-30');
  assert.equal(futuro, 5000);
  const p = patrimonio(cuentas, saldos, porCobrar(txs, cuentas), futuro);
  assert.equal(p.deudas, 6000);
  assert.equal(p.neto, 19000);
  assert.equal(msiPorVenir(cuentas, txs, '2027-04-30'), 0);
});
