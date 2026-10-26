/* Morralla — avisos en el iPhone y registro con Siri (Cloudflare Worker, plan gratuito).
 * Adaptado del servidor de notificaciones de Latidia.
 *
 * - La app manda (con su sesión de Firebase) los avisos de los próximos 14 días y la
 *   suscripción Web Push de cada dispositivo. Un cron cada minuto envía los que tocan.
 * - Siri: el Atajo manda lo dictado ("250 oxxo") con una clave personal. El Worker lo
 *   interpreta, sugiere la categoría y lo deja en una cola; la app lo guarda en Firebase
 *   al abrirse. Así el Worker no necesita credenciales de administrador de Firebase.
 * - Web Push estándar: cifrado aes128gcm (RFC 8291) + VAPID (RFC 8292) con WebCrypto.
 *
 * Almacenamiento (KV "PUSH"):
 *   users      → ["uid", ...]
 *   u:<uid>    → { subs: { deviceId: { sub, updated } }, reminders: [...], sent: { id: ts },
 *                  config: { tz, cuentaSiri, categorias: [{id,nombre}], historial: [{desc,categoriaId}] },
 *                  siri: { hash }, pendientes: [...] }
 *   k:<sha256> → uid   (clave de Siri)
 *
 * Variables: FIREBASE_PROJECT_ID, VAPID_PUBLIC_KEY, VAPID_SUBJECT, ALLOWED_ORIGINS
 * Secretos:  VAPID_PRIVATE_JWK
 */

import { enc, b64u, encryptPayload, vapidAuthorization } from './webpush.js';
import { interpretarDictado } from '../../js/domain/recordatorios.js';
import { sugerirCategoria } from '../../js/domain/autocategoria.js';

const WINDOW_MS = 60 * 60 * 1000;           // un aviso atrasado se envía hasta 1 h después
const MAX_REMINDERS = 300;
const MAX_PENDIENTES = 60;
const DIA = 86400000;

function cors(req, env) {
  const origin = req.headers.get('Origin') || '';
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim());
  return {
    'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : allowed[0] || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}
const json = (data, status, headers) => new Response(JSON.stringify(data), { status: status || 200, headers: { 'Content-Type': 'application/json', ...headers } });

// ---------------------------------------------------------------- Firebase ID token
let jwksCache = null;
async function googleKeys() {
  if (jwksCache && jwksCache.exp > Date.now()) return jwksCache.keys;
  const r = await fetch('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com');
  const data = await r.json();
  const maxAge = +((r.headers.get('Cache-Control') || '').match(/max-age=(\d+)/) || [0, 3600])[1];
  jwksCache = { keys: data.keys, exp: Date.now() + maxAge * 1000 };
  return data.keys;
}

async function verifyIdToken(token, projectId) {
  const [h, p, s] = String(token || '').split('.');
  if (!h || !p || !s) throw new Error('token inválido');
  const header = JSON.parse(new TextDecoder().decode(b64u.dec(h)));
  const payload = JSON.parse(new TextDecoder().decode(b64u.dec(p)));
  const now = Math.floor(Date.now() / 1000);
  if (header.alg !== 'RS256') throw new Error('alg');
  if (payload.aud !== projectId || payload.iss !== `https://securetoken.google.com/${projectId}`) throw new Error('aud/iss');
  if (payload.exp < now - 60 || payload.iat > now + 300 || !payload.sub) throw new Error('exp');
  const jwk = (await googleKeys()).find(k => k.kid === header.kid);
  if (!jwk) throw new Error('kid');
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64u.dec(s), enc.encode(`${h}.${p}`));
  if (!ok) throw new Error('firma');
  return payload.sub;
}

async function authUid(req, env) {
  const m = (req.headers.get('Authorization') || '').match(/^Bearer (.+)$/);
  if (!m) return null;
  try { return await verifyIdToken(m[1], env.FIREBASE_PROJECT_ID); } catch (_) { return null; }
}

const sha256 = async (texto) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(texto)))].map(b => b.toString(16).padStart(2, '0')).join('');

// ---------------------------------------------------------------- Web Push
async function sendPush(sub, message, env) {
  const body = await encryptPayload(sub, JSON.stringify(message));
  const r = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      'Authorization': await vapidAuthorization(sub.endpoint, env.VAPID_PRIVATE_JWK, env.VAPID_PUBLIC_KEY, env.VAPID_SUBJECT),
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      'TTL': '3600',
      'Urgency': 'normal',
      'Topic': String(message.tag || 'morralla').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32) || 'morralla'
    },
    body
  });
  return r.status;
}

// Envía a todos los dispositivos del usuario; elimina suscripciones vencidas (404/410)
async function sendToUser(user, message, env) {
  let delivered = 0, changed = false;
  const seen = new Set();
  const entries = Object.entries(user.subs || {}).sort((a, b) => (b[1].updated || 0) - (a[1].updated || 0));
  for (const [id, d] of entries) {
    if (seen.has(d.sub.endpoint)) { delete user.subs[id]; changed = true; continue; }
    seen.add(d.sub.endpoint);
    try {
      const st = await sendPush(d.sub, message, env);
      if (st === 404 || st === 410) { delete user.subs[id]; changed = true; }
      else if (st >= 200 && st < 300) delivered++;
    } catch (_) { /* error de red: se intenta en el siguiente minuto */ }
  }
  return { delivered, changed };
}

// ---------------------------------------------------------------- almacenamiento
const nuevoUsuario = () => ({ subs: {}, reminders: [], sent: {}, config: {}, siri: null, pendientes: [] });
const getUser = async (env, uid) => ({ ...nuevoUsuario(), ...((await env.PUSH.get('u:' + uid, 'json')) || {}) });
const putUser = (env, uid, u) => env.PUSH.put('u:' + uid, JSON.stringify(u));
async function indexAdd(env, uid) {
  const list = (await env.PUSH.get('users', 'json')) || [];
  if (!list.includes(uid)) { list.push(uid); await env.PUSH.put('users', JSON.stringify(list)); }
}
async function indexRemove(env, uid) {
  const list = (await env.PUSH.get('users', 'json')) || [];
  const next = list.filter(u => u !== uid);
  if (next.length !== list.length) await env.PUSH.put('users', JSON.stringify(next));
}

const texto = (v, n) => String(v || '').slice(0, n);
const cleanReminder = r => ({ id: texto(r.id, 200), at: +r.at, title: texto(r.title, 120), body: texto(r.body, 300), url: /^#\/[\w/?=&%-]*$/.test(r.url || '') ? r.url : '#/inicio' });
const cleanConfig = c => ({
  tz: Number.isFinite(+c.tz) ? Math.max(-840, Math.min(840, +c.tz)) : 360,
  cuentaSiri: texto(c.cuentaSiri, 60),
  categorias: (Array.isArray(c.categorias) ? c.categorias : []).slice(0, 60).map(x => ({ id: texto(x.id, 60), nombre: texto(x.nombre, 60) })),
  historial: (Array.isArray(c.historial) ? c.historial : []).slice(0, 300).map(x => ({ tipo: 'gasto', desc: texto(x.desc, 80), categoriaId: texto(x.categoriaId, 60) })),
});

// Fecha local del usuario ('AAAA-MM-DD') a partir de su desfase (minutos, como getTimezoneOffset).
const fechaLocal = (tz) => new Date(Date.now() - (tz || 0) * 60000).toISOString().slice(0, 10);
const fmt = (n) => '$' + Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

// ---------------------------------------------------------------- Siri
async function registrarDictado(req, env, body, H) {
  const m = (req.headers.get('Authorization') || '').match(/^Bearer (.+)$/);
  const uid = m ? await env.PUSH.get('k:' + await sha256(m[1].trim())) : null;
  if (!uid) return json({ ok: false, mensaje: 'La clave de Siri no es válida. Genera una nueva en Morralla, en Ajustes.' }, 401, H);
  const u = await getUser(env, uid);
  if ((u.pendientes || []).length >= MAX_PENDIENTES) return json({ ok: false, mensaje: 'Tienes muchos movimientos pendientes. Abre Morralla para guardarlos.' }, 429, H);

  const d = body.monto ? { tipo: body.tipo === 'ingreso' ? 'ingreso' : 'gasto', monto: Math.round(+body.monto * 100) / 100, desc: texto(body.desc, 80) } : interpretarDictado(texto(body.texto, 200));
  if (!d || !(d.monto > 0) || d.monto > 10000000) return json({ ok: false, mensaje: 'No entendí el monto. Prueba con algo como "250 Oxxo".' }, 400, H);

  const cfg = u.config || {};
  let categoriaId = null;
  if (d.tipo === 'gasto') {
    const ids = (cfg.categorias || []).map(c => c.id);
    categoriaId = sugerirCategoria(d.desc, cfg.historial || [], ids.length ? ids : null)?.categoriaId || (ids.includes('otros') ? 'otros' : ids[0] || 'otros');
  }
  const mov = { id: crypto.randomUUID(), tipo: d.tipo, monto: d.monto, desc: d.desc || (d.tipo === 'ingreso' ? 'Ingreso' : ''), categoriaId, cuentaId: cfg.cuentaSiri || null, fecha: fechaLocal(cfg.tz), creadoEn: Date.now() };
  u.pendientes = [...(u.pendientes || []), mov];
  await putUser(env, uid, u);
  const cat = (cfg.categorias || []).find(c => c.id === categoriaId)?.nombre;
  const mensaje = d.tipo === 'ingreso'
    ? `Listo, anoté un ingreso de ${fmt(d.monto)}${d.desc ? ` por ${d.desc}` : ''}.`
    : `Listo, anoté ${fmt(d.monto)}${d.desc ? ` de ${d.desc}` : ''}${cat ? ` en ${cat}` : ''}.`;
  return json({ ok: true, mensaje }, 200, H);
}

// ---------------------------------------------------------------- HTTP
async function handle(req, env) {
  const url = new URL(req.url);
  const H = cors(req, env);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: H });
  if (req.method === 'GET' && url.pathname === '/') return json({ ok: true, service: 'morralla-push', vapidPublicKey: env.VAPID_PUBLIC_KEY }, 200, H);

  let body = {};
  if (req.method === 'POST') { try { body = await req.json(); } catch (_) { body = {}; } }

  // El Atajo de Siri se autentica con su clave personal, no con la sesión de Firebase.
  if (url.pathname === '/movimiento' && req.method === 'POST') return registrarDictado(req, env, body, H);

  const uid = await authUid(req, env);
  if (!uid) return json({ error: 'no autorizado' }, 401, H);

  if (url.pathname === '/sync' && req.method === 'POST') {
    const u = await getUser(env, uid);
    const { deviceId, subscription } = body;
    if (deviceId && subscription && subscription.endpoint && subscription.keys) {
      for (const [id, d] of Object.entries(u.subs)) if (id !== deviceId && d.sub.endpoint === subscription.endpoint) delete u.subs[id];
      u.subs[deviceId] = { sub: { endpoint: subscription.endpoint, keys: subscription.keys }, updated: Date.now() };
    }
    if (Array.isArray(body.reminders)) {
      u.reminders = body.reminders.map(cleanReminder).filter(r => r.at > Date.now() - WINDOW_MS).sort((a, b) => a.at - b.at).slice(0, MAX_REMINDERS);
    }
    if (body.config && typeof body.config === 'object') u.config = cleanConfig(body.config);
    await putUser(env, uid, u);
    if (Object.keys(u.subs).length) await indexAdd(env, uid);
    return json({ ok: true, devices: Object.keys(u.subs).length, reminders: u.reminders.length, pendientes: (u.pendientes || []).length }, 200, H);
  }

  if (url.pathname === '/unsubscribe' && req.method === 'POST') {
    const u = await getUser(env, uid);
    if (body.deviceId) delete u.subs[body.deviceId];
    if (!Object.keys(u.subs).length) { u.reminders = []; await indexRemove(env, uid); }
    await putUser(env, uid, u);
    return json({ ok: true }, 200, H);
  }

  if (url.pathname === '/test' && req.method === 'POST') {
    const u = await getUser(env, uid);
    const r = await sendToUser(u, { title: 'Tlaco te saluda', body: 'Los avisos de Morralla funcionan aunque la app esté cerrada.', tag: 'prueba', data: { url: '#/inicio' } }, env);
    if (r.changed) await putUser(env, uid, u);
    return json({ ok: true, delivered: r.delivered, devices: Object.keys(u.subs).length }, 200, H);
  }

  // Siri: crear (o reemplazar) la clave personal. Solo se muestra una vez.
  if (url.pathname === '/siri/clave' && req.method === 'POST') {
    const u = await getUser(env, uid);
    if (u.siri?.hash) await env.PUSH.delete('k:' + u.siri.hash);
    const clave = b64u.enc(crypto.getRandomValues(new Uint8Array(24)));
    const hash = await sha256(clave);
    await env.PUSH.put('k:' + hash, uid);
    u.siri = { hash, creada: Date.now() };
    await putUser(env, uid, u);
    return json({ ok: true, clave }, 200, H);
  }

  if (url.pathname === '/siri/revocar' && req.method === 'POST') {
    const u = await getUser(env, uid);
    if (u.siri?.hash) await env.PUSH.delete('k:' + u.siri.hash);
    u.siri = null;
    await putUser(env, uid, u);
    return json({ ok: true }, 200, H);
  }

  if (url.pathname === '/siri/estado' && req.method === 'POST') {
    const u = await getUser(env, uid);
    return json({ ok: true, activa: !!u.siri?.hash, creada: u.siri?.creada || null, pendientes: (u.pendientes || []).length, dispositivos: Object.keys(u.subs).length }, 200, H);
  }

  // La app recoge lo dictado a Siri y lo guarda en Firebase.
  if (url.pathname === '/pendientes/tomar' && req.method === 'POST') {
    const u = await getUser(env, uid);
    const pendientes = u.pendientes || [];
    if (pendientes.length) { u.pendientes = []; await putUser(env, uid, u); }
    return json({ ok: true, pendientes }, 200, H);
  }

  return json({ error: 'no encontrado' }, 404, H);
}

// ---------------------------------------------------------------- cron (cada minuto)
async function tick(env) {
  const now = Date.now();
  const users = (await env.PUSH.get('users', 'json')) || [];
  for (const uid of users) {
    const u = await getUser(env, uid);
    if (!Object.keys(u.subs || {}).length) continue;
    let changed = false;
    for (const r of u.reminders || []) {
      if (r.at > now || now - r.at >= WINDOW_MS || u.sent[r.id]) continue;
      const res = await sendToUser(u, { title: r.title, body: r.body, tag: r.id.split(':').slice(0, 2).join('-'), data: { url: r.url } }, env);
      u.sent[r.id] = now; changed = true;
      if (res.changed) changed = true;
    }
    // Limpieza: los avisos "m:" (una vez al mes) se recuerdan 40 días; el resto, 3.
    for (const k of Object.keys(u.sent)) if (u.sent[k] < now - (k.startsWith('m:') ? 40 : 3) * DIA) { delete u.sent[k]; changed = true; }
    const antes = (u.reminders || []).length;
    u.reminders = (u.reminders || []).filter(r => r.at > now - WINDOW_MS);
    if (u.reminders.length !== antes) changed = true;
    if (changed) await putUser(env, uid, u);
  }
}

export default {
  fetch: (req, env) => handle(req, env).catch(e => json({ error: String(e && e.message || e) }, 500, cors(req, env))),
  scheduled: (event, env, ctx) => ctx.waitUntil(tick(env))
};
