import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumenMes } from '../../js/domain/analisis.js';

test('una compra a MSI cuenta una mensualidad por mes', () => {
  const txs = [
    { tipo: 'gasto', fecha: '2026-11-10', monto: 6000, msi: 6, categoriaId: 'tec' },
    { tipo: 'gasto', fecha: '2026-11-12', monto: 300, categoriaId: 'comida' },
  ];
  assert.equal(resumenMes(txs, '2026-10').gastos, 0);
  assert.deepEqual(resumenMes(txs, '2026-11').porCategoria, { tec: 1000, comida: 300 });
  assert.equal(resumenMes(txs, '2027-04').gastos, 1000);
  assert.equal(resumenMes(txs, '2027-05').gastos, 0);
});
