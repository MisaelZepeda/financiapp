// Manda un anuncio a todos los dispositivos con avisos activos de una app.
// El cron del Worker lo envía en el siguiente minuto (una sola vez por usuario).
//
//   npm run anunciar -- morralla "Morralla se actualizó" "Ya puedes …" "#/ajustes"
//
// Requiere sesión de wrangler (npx wrangler login). Guarda en el KV `anuncios:<app>`.

import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [app, title, body, url] = process.argv.slice(2);
if (app !== 'morralla' || !title || !body) {
  console.error('Uso: npm run anunciar -- morralla "Título" "Texto" ["#/ruta"]');
  process.exit(1);
}
if (url && !/^#\/[\w/?=&%-]*$/.test(url)) { console.error('La ruta debe ser como "#/ajustes"'); process.exit(1); }

const clave = `anuncios:${app}`;
const wrangler = (args) => execFileSync('npx', ['wrangler', 'kv', 'key', ...args, '--binding', 'PUSH', '--remote'], { encoding: 'utf8', shell: process.platform === 'win32', stdio: ['ignore', 'pipe', 'ignore'] });

let lista = [];
try { lista = JSON.parse(wrangler(['get', clave]) || '[]'); } catch { lista = []; }
if (!Array.isArray(lista)) lista = [];
const ahora = Date.now();
// Se conservan solo los de la última semana (los vigentes duran 2 días).
lista = lista.filter(a => ahora - a.at < 7 * 86400000);
const anuncio = { id: ahora.toString(36), at: ahora, title, body, url: url || null };
lista.push(anuncio);

const archivo = join(mkdtempSync(join(tmpdir(), 'anuncio-')), 'anuncios.json');
writeFileSync(archivo, JSON.stringify(lista));
wrangler(['put', clave, '--path', archivo]);
console.log(`Anuncio ${anuncio.id} en cola para ${app}: "${title}". Sale en el próximo minuto.`);
