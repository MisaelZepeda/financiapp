// Ajustes: perfil, apariencia, categorías, datos y sesión.

import { store, sel } from '../core/store.js';
import { on } from '../core/eventos.js';
import * as A from '../core/actions.js';
import { icon } from '../lib/icons.js';
import { escapeHtml, money } from '../lib/format.js';
import { avatarHTML } from '../components/piezas.js';
import { toast, confirmar, abrirHoja, cerrarHoja } from '../components/capas.js';
import { exportarRespaldo } from '../lib/exportar.js';
import { migrarV1 } from '../domain/migracion.js';
import { aplicarApariencia, temaElegido, elegirTema, hayTemaDeSesion, temaEfectivo } from '../lib/apariencia.js';

export const titulo = () => ({ titulo: 'Ajustes' });

// Selector Automático / Claro / Oscuro (también se usa en el menú).
export function selectorTema(tema) {
    return `<div class="seg seg-tema">${[['auto', 'sparkle', 'Automático'], ['claro', 'sun', 'Claro'], ['oscuro', 'moon', 'Oscuro']]
        .map(([v, i, t]) => `<button class="${tema === v ? 'activo' : ''}" data-action="ajTema" data-v="${v}">${icon(i)} ${t}</button>`).join('')}</div>`;
}

const ACENTOS = [['lima', '#c6f432', 'Lima'], ['menta', '#5eead4', 'Menta'], ['cielo', '#7cc4ff', 'Cielo'], ['violeta', '#b69cff', 'Violeta'], ['coral', '#ff9b7a', 'Coral']];

export function render() {
    const p = sel.perfil();
    const aj = sel.ajustes();
    const tema = temaElegido();
    const acento = aj.acento || 'lima';
    return `<div class="ajustes">
        <section class="card">
            <h2 class="card-title" style="margin-bottom:14px;">Perfil</h2>
            <form data-submit="guardarPerfil" class="perfil-form">
                <label class="perfil-foto" title="Cambiar foto">${avatarHTML(p)}<span class="perfil-editar">${icon('edit')}</span><input type="file" accept="image/*" data-change="fotoPerfil" hidden></label>
                <div class="field" style="flex:1; margin:0;"><label for="aj-nombre">Nombre</label><input id="aj-nombre" name="nombre" value="${escapeHtml(p.nombre || '')}" required></div>
                <button class="btn btn-soft" type="submit">Guardar</button>
            </form>
            ${store.usuario?.email ? `<p class="hint" style="margin-top:10px;">${escapeHtml(store.usuario.email)}</p>` : ''}
        </section>

        <section class="card">
            <h2 class="card-title" style="margin-bottom:14px;">Apariencia</h2>
            <div class="field"><span class="label">Tema</span>${selectorTema(tema)}
                <span class="hint">Automático sigue la configuración de tu teléfono o computadora.${hayTemaDeSesion() ? ` Ahora ves el tema ${temaEfectivo()} solo en esta sesión (botón del encabezado).` : ''}</span></div>
            <div class="field" style="margin:0;"><span class="label">Color de acento</span><div class="acentos">
                ${ACENTOS.map(([id, color, n]) => `<button class="acento ${acento === id ? 'activo' : ''}" style="--c:${color}" data-action="ajAcento" data-v="${id}" title="${n}" aria-label="${n}"></button>`).join('')}
            </div></div>
        </section>

        <section class="card">
            <div class="card-head"><h2 class="card-title">Categorías</h2><button class="link" data-action="nuevaCategoria">${icon('plus')}Nueva</button></div>
            <div class="lista">${sel.categorias().map(c => `<div class="fila fila-link" data-action="editarCategoria" data-id="${escapeHtml(c.id)}">
                <div class="fila-ico">${icon(c.icono || 'tag')}</div>
                <div class="fila-body"><div class="fila-titulo">${escapeHtml(c.nombre)}</div><div class="fila-sub">${c.presupuesto ? `Presupuesto <span class="privado">${money(c.presupuesto)}</span>` : 'Sin presupuesto'}</div></div>
                ${icon('chevron-right', 'chev')}</div>`).join('')}</div>
        </section>

        <section class="card">
            <h2 class="card-title" style="margin-bottom:6px;">Tus datos</h2>
            <p class="card-desc" style="margin:0 0 14px;">Descarga una copia o restaura una anterior (acepta respaldos de la versión anterior de la app).</p>
            <div class="botones-col">
                <button class="btn btn-soft" data-action="ajRespaldo">${icon('download')}Descargar respaldo (.json)</button>
                <label class="btn btn-soft">${icon('upload')}Restaurar desde archivo<input type="file" accept=".json,application/json" data-change="ajRestaurar" hidden></label>
                ${store.demo ? '' : `<button class="btn btn-soft" data-action="ajRecopiar">${icon('repeat')}Volver a copiar mis datos de la versión actual</button>
                <p class="hint">Estás probando la versión nueva. Tus datos originales no se modifican; esta opción reemplaza la copia de prueba con lo que tengas hoy en la versión publicada.</p>`}
            </div>
        </section>

        <section class="card zona-peligro">
            <h2 class="card-title" style="margin-bottom:14px;">Zona de peligro</h2>
            <div class="botones-col">
                <button class="btn btn-danger-soft" data-action="ajBorrarMovs">Borrar todos los movimientos</button>
            </div>
        </section>

        <button class="btn btn-ghost btn-block" data-action="cerrarSesion">${icon('log-out')}${store.demo ? 'Salir de la demo' : 'Cerrar sesión'}</button>
        <p class="hint" style="text-align:center; margin-top:14px;">FinanciApp v4</p>
    </div>`;
}

// Reduce la foto a 300 px antes de guardarla (se guarda como data URL).
function comprimirImagen(file) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const max = 300, k = Math.min(1, max / Math.max(img.width, img.height));
            const c = Object.assign(document.createElement('canvas'), { width: Math.round(img.width * k), height: Math.round(img.height * k) });
            c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
            URL.revokeObjectURL(img.src);
            resolve(c.toDataURL('image/jpeg', 0.75));
        };
        img.onerror = reject;
        img.src = URL.createObjectURL(file);
    });
}

on('guardarPerfil', async (form) => { await A.guardarPerfil({ nombre: form.elements.nombre.value.trim() }); toast('Perfil guardado'); }, 'submit');
on('fotoPerfil', async (el) => {
    const f = el.files[0]; if (!f) return;
    try { await A.guardarPerfil({ foto: await comprimirImagen(f) }); toast('Foto actualizada'); }
    catch { toast('No se pudo leer la imagen', { tipo: 'error' }); }
}, 'change');

on('ajTema', async (el) => { elegirTema(el.dataset.v); await A.guardarAjustes({ tema: el.dataset.v }); });
on('ajAcento', async (el) => { aplicarApariencia({ acento: el.dataset.v }); await A.guardarAjustes({ acento: el.dataset.v }); });

on('ajRespaldo', () => { exportarRespaldo(store.datos); toast('Respaldo descargado'); });

// Muestra el resultado de una migración y pide confirmación antes de escribir.
export function confirmarMigracion({ titulo, resultado, alAceptar }) {
    const { reporte, ok, resumen } = resultado;
    abrirHoja({
        titulo,
        html: `<p class="hint" style="margin-bottom:12px;">${resumen.cuentas} cuentas · ${resumen.transacciones} movimientos · ${resumen.metas} metas · ${resumen.recurrentes} recurrentes${resumen.huerfanas ? ` · ${resumen.huerfanas} movimiento(s) de cuentas ya borradas` : ''}</p>
            <table class="tabla-migracion"><thead><tr><th>Cuenta</th><th>Saldo actual</th><th>Calculado</th><th></th></tr></thead><tbody>
            ${reporte.map(r => `<tr><td>${escapeHtml(r.nombre)}</td><td class="num">${money(r.antes)}</td><td class="num">${money(r.despues)}</td><td>${r.ok ? `<span class="pos">${icon('check')}</span>` : `<span class="neg">${icon('x')}</span>`}</td></tr>`).join('')}
            </tbody></table>
            <p class="hint" style="margin:12px 0;">${ok ? 'Todos los saldos cuadran.' : 'Algún saldo no cuadra; no se guardará nada. Revisa los datos o avísame.'}</p>
            <div class="hoja-foot"><button class="btn btn-soft" data-action="cerrarHoja">Cancelar</button>${ok ? '<button class="btn btn-primary" data-action="aceptarMigracion">Continuar</button>' : ''}</div>`,
    });
    on('aceptarMigracion', async () => { cerrarHoja(); await alAceptar(); });
}

on('ajRestaurar', async (el) => {
    const f = el.files[0]; el.value = ''; if (!f) return;
    let datos;
    try { datos = JSON.parse(await f.text()); } catch { return toast('El archivo no es un respaldo válido', { tipo: 'error' }); }
    if (datos?.meta?.version === 4) {
        if (!(await confirmar({ titulo: 'Restaurar respaldo', texto: 'Reemplazará todos tus datos actuales por los del archivo.', aceptar: 'Restaurar', peligro: true }))) return;
        delete datos.exportadoEn;
        await A.restaurar(datos); toast('Respaldo restaurado');
    } else if (datos?.cuentas || datos?.transacciones) {
        confirmarMigracion({ titulo: 'Restaurar respaldo anterior', resultado: migrarV1(datos), alAceptar: async () => { await A.restaurar(migrarV1(datos).v4); toast('Respaldo restaurado'); } });
    } else toast('El archivo no es un respaldo de FinanciApp', { tipo: 'error' });
}, 'change');

on('ajBorrarMovs', async () => {
    if (!(await confirmar({ titulo: 'Borrar todos los movimientos', texto: 'Se eliminará todo tu historial y los saldos de todas las cuentas quedarán en $0. No se puede deshacer.', aceptar: 'Borrar todo', peligro: true }))) return;
    await A.borrarMovimientos(); toast('Movimientos borrados');
});
