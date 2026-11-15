// Pruebas de la API personal: funciones puras y el Worker completo con Firebase y KV simulados.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { respMovimientos, respCuentas, respPresupuestos, respTeDeben, validarMovimiento } from '../src/api.js';
import worker from '../src/index.js';

const HOY = new Date(2026, 10, 15, 12);
const v4 = () => ({
    cuentas: {
        nomina: { nombre: 'Nómina', tipo: 'debito', saldoInicial: 10000, fechaInicial: '2026-01-01' },
        platino: { nombre: 'Platino', tipo: 'credito', limite: 30000, diaCorte: 18, diaPago: 5, saldoInicial: 0, fechaInicial: '2026-01-01' },
    },
    categorias: { comida: { nombre: 'Comida', presupuesto: 3000 }, transporte: { nombre: 'Transporte' }, otros: { nombre: 'Otros' } },
    transacciones: {
        t1: { tipo: 'gasto', monto: 800, fecha: '2026-11-03', cuentaId: 'nomina', categoriaId: 'comida', desc: 'Súper', etiquetas: ['casa'], creadoEn: 1 },
        t2: { tipo: 'gasto', monto: 6000, msi: 6, fecha: '2026-10-10', cuentaId: 'platino', categoriaId: 'otros', desc: 'Celular', paraTercero: 'Juan', creadoEn: 2 },
        t3: { tipo: 'ingreso', monto: 20000, fecha: '2026-11-01', cuentaId: 'nomina', desc: 'Nómina', creadoEn: 3 },
        t4: { tipo: 'gasto', monto: 1200, fecha: '2026-10-20', cuentaId: 'platino', categoriaId: 'transporte', desc: 'Gasolina', creadoEn: 4 },
    },
});

test('GET: movimientos, cuentas, presupuestos y te-deben', () => {
    const m = respMovimientos(v4(), '2026-11');
    assert.equal(m.total, 2);
    assert.deepEqual(m.movimientos[0], {
        id: 't1', fecha: '2026-11-03', tipo: 'gasto', subtipo: null, monto: 800, cuenta: { id: 'nomina', nombre: 'Nómina' }, cuentaDestino: null,
        categoria: { id: 'comida', nombre: 'Comida' }, partes: null, descripcion: 'Súper', etiquetas: ['casa'], msi: null, paraQuien: null, abonoDe: null,
        creadoEn: new Date(1).toISOString(),
    });
    const c = respCuentas(v4(), HOY).cuentas;
    assert.equal(c.find(x => x.id === 'nomina').saldo, 29200);
    const p = c.find(x => x.id === 'platino');
    assert.equal(p.deuda, 7200);
    assert.equal(p.disponible, 22800);
    assert.equal(p.ultimoCorte, '2026-10-18');
    assert.equal(p.proximoCorte, '2026-11-18');
    assert.equal(p.proximoPago.fechaLimite, '2026-11-05');
    assert.equal(p.proximoPago.monto, 1000);              // la mensualidad; la gasolina (20 oct) va al siguiente corte
    const pr = respPresupuestos(v4(), '2026-11');
    assert.deepEqual(pr.presupuestos[0], { categoria: { id: 'comida', nombre: 'Comida' }, tope: 3000, gastado: 800, restante: 2200, porcentaje: 27 });
    const td = respTeDeben(v4(), HOY);
    assert.equal(td.totalPendiente, 6000);
    assert.equal(td.personas[0].nombre, 'Juan');
    assert.ok(td.personas[0].proximaMensualidad);
});

test('POST/PATCH: validación como en el formulario', () => {
    const ok = validarMovimiento({ tipo: 'gasto', monto: 150.5, cuenta: 'Platino', descripcion: 'Uber al centro', msi: 0, etiquetas: ['#Viaje'] }, v4(), { hoy: HOY });
    assert.equal(ok.tx.cuentaId, 'platino');
    assert.equal(ok.tx.fecha, '2026-11-15');
    assert.equal(ok.tx.categoriaId, 'transporte');           // sugerida por la descripción
    assert.deepEqual(ok.tx.etiquetas, ['viaje']);
    assert.equal(validarMovimiento({ tipo: 'gasto', monto: 100, cuenta: 'nomina', categoria: 'comida', msi: 3 }, v4()).error, 'los meses sin intereses solo aplican a tarjetas de crédito');
    assert.match(validarMovimiento({ tipo: 'gasto', monto: -5, cuenta: 'nomina' }, v4()).error, /monto/);
    assert.match(validarMovimiento({ tipo: 'regalo', monto: 5, cuenta: 'nomina' }, v4()).error, /tipo/);
    assert.match(validarMovimiento({ tipo: 'gasto', monto: 5, cuenta: 'Banamex' }, v4()).error, /cuenta/);
    const pago = validarMovimiento({ tipo: 'transferencia', monto: 2200, cuenta: 'nomina', cuentaDestino: 'Platino' }, v4(), { hoy: HOY }).tx;
    assert.equal(pago.subtipo, 'pago_tdc');
    assert.equal(pago.desc, 'Pago a Platino');
    assert.equal(validarMovimiento({ tipo: 'ingreso', monto: 50, cuenta: 'nomina', subtipo: 'cashback' }, v4()).error, 'el cashback solo aplica a tarjetas de crédito');
    // PATCH: solo cambia lo que se manda; lo demás se conserva.
    const previo = v4().transacciones.t1;
    const p = validarMovimiento({ monto: 850 }, v4(), { previo }).tx;
    assert.deepEqual([p.monto, p.categoriaId, p.cuentaId, p.desc, p.creadoEn], [850, 'comida', 'nomina', 'Súper', 1]);
});

test('Worker: llave, lectura y escrituras contra Firebase simulado', async () => {
    const kv = new Map();
    const PUSH = { get: async (k, t) => { const v = kv.get(k); return v == null ? null : t === 'json' ? JSON.parse(v) : v; }, put: async (k, v) => { kv.set(k, v); }, delete: async (k) => { kv.delete(k); } };
    const env = { PUSH, FIREBASE_API_KEY: 'k', FIREBASE_DB_URL: 'https://db', FIREBASE_PROJECT_ID: 'x', ALLOWED_ORIGINS: '*' };
    const llave = 'mrl_prueba123';
    kv.set('ka:' + createHash('sha256').update(llave).digest('hex'), 'uid1');
    kv.set('u:uid1', JSON.stringify({ api: { refresh: 'r1', tz: 360 } }));
    const db = v4();
    const llamadas = [];
    globalThis.fetch = async (url, op = {}) => {
        llamadas.push(`${op.method || 'GET'} ${url}`);
        if (url.startsWith('https://securetoken')) return Response.json({ id_token: 'tok', refresh_token: 'r1', expires_in: '3600', user_id: 'uid1' });
        const m = url.match(/^https:\/\/db\/Usuarios\/uid1\/v4\/([^.]+)\.json\?auth=tok$/);
        if (!m) return new Response('no', { status: 403 });
        const [nodo, id] = m[1].split('/');
        if (op.method === 'POST') { const nuevo = 'nuevo1'; db[nodo][nuevo] = JSON.parse(op.body); return Response.json({ name: nuevo }); }
        if (op.method === 'PUT') { db[nodo][id] = JSON.parse(op.body); return Response.json(db[nodo][id]); }
        if (op.method === 'DELETE') { delete db[nodo][id]; return Response.json(null); }
        return Response.json(id ? db[nodo][id] ?? null : db[nodo]);
    };
    const pedir = (metodo, ruta, cuerpo, auth = llave) => worker.fetch(new Request('https://w' + ruta, { method: metodo, headers: { Authorization: `Bearer ${auth}`, 'Content-Type': 'application/json' }, body: cuerpo ? JSON.stringify(cuerpo) : undefined }), env);

    assert.equal((await pedir('GET', '/api/cuentas', null, 'mrl_otra')).status, 401);
    const m = await (await pedir('GET', '/api/movimientos?mes=2026-11')).json();
    assert.equal(m.total, 2);
    assert.equal((await pedir('GET', '/api/movimientos?mes=noviembre')).status, 400);
    const creado = await pedir('POST', '/api/movimientos', { tipo: 'gasto', monto: 99, cuenta: 'nomina', categoria: 'Comida', descripcion: 'Café', fecha: '2026-11-14' });
    assert.equal(creado.status, 201);
    assert.equal((await creado.json()).id, 'nuevo1');
    assert.equal(db.transacciones.nuevo1.monto, 99);
    assert.equal((await pedir('POST', '/api/movimientos', { tipo: 'gasto', monto: 0, cuenta: 'nomina' })).status, 400);
    const corregido = await (await pedir('PATCH', '/api/movimientos/nuevo1', { monto: 105 })).json();
    assert.equal(corregido.monto, 105);
    assert.equal(db.transacciones.nuevo1.desc, 'Café');
    assert.equal((await pedir('PATCH', '/api/movimientos/noexiste', { monto: 1 })).status, 404);
    assert.equal((await pedir('DELETE', '/api/movimientos/nuevo1')).status, 200);
    assert.equal(db.transacciones.nuevo1, undefined);
    // El id token se reusa: un solo canje en toda la prueba.
    assert.equal(llamadas.filter(l => l.includes('securetoken')).length, 1);
});
