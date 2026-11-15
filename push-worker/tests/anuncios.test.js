// El canal de anuncios: sale una sola vez por usuario aunque la app reemplace sus avisos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import worker from '../src/index.js';

test('anuncios: una vez por usuario y sin depender de la cola de avisos', async () => {
    const kv = new Map();
    const PUSH = { get: async (k, t) => { const v = kv.get(k); return v == null ? null : t === 'json' ? JSON.parse(v) : v; }, put: async (k, v) => { kv.set(k, v); }, delete: async (k) => { kv.delete(k); } };
    const par = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign']);
    const env = { PUSH, VAPID_PUBLIC_KEY: Buffer.from(await webcrypto.subtle.exportKey('raw', par.publicKey)).toString('base64url'), VAPID_PRIVATE_JWK: JSON.stringify(await webcrypto.subtle.exportKey('jwk', par.privateKey)), VAPID_SUBJECT: 'https://x' };
    const ecdh = await webcrypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
    const keys = { p256dh: Buffer.from(await webcrypto.subtle.exportKey('raw', ecdh.publicKey)).toString('base64url'), auth: Buffer.from(webcrypto.getRandomValues(new Uint8Array(16))).toString('base64url') };
    kv.set('users', JSON.stringify(['a', 'b']));
    kv.set('u:a', JSON.stringify({ subs: { d: { sub: { endpoint: 'https://push/a', keys }, updated: 1 } }, reminders: [] }));
    kv.set('u:b', JSON.stringify({ subs: { d: { sub: { endpoint: 'https://push/b', keys }, updated: 1 } }, reminders: [] }));
    kv.set('anuncios:morralla', JSON.stringify([
        { id: 'v1', at: Date.now() - 1000, title: 'Morralla se actualizó', body: 'Toca Actualizar', url: '#/ajustes' },
        { id: 'viejo', at: Date.now() - 3 * 86400000, title: 'Ya no', body: 'vencido' },
        { id: 'futuro', at: Date.now() + 3600e3, title: 'Luego', body: 'todavía no' },
    ]));
    const enviados = [];
    globalThis.fetch = async (url) => { enviados.push(url); return new Response(null, { status: 201 }); };
    const ctx = { waitUntil: (p) => p };
    await worker.scheduled({}, env, ctx);
    // La app sincroniza y reemplaza sus avisos: el anuncio no se repite ni se pierde.
    kv.set('u:a', JSON.stringify({ ...JSON.parse(kv.get('u:a')), reminders: [] }));
    await worker.scheduled({}, env, ctx);
    assert.deepEqual(enviados.sort(), ['https://push/a', 'https://push/b']);
    assert.ok(JSON.parse(kv.get('anunciados:morralla:a')).v1);
});
