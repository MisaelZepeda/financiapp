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
import { aplicarApariencia, leerApariencia, temaElegido, elegirTema, hayTemaDeSesion, temaEfectivo } from '../lib/apariencia.js';
import * as Push from '../lib/push.js';

export const titulo = () => ({ titulo: 'Ajustes', atras: '#/mas' });

// Selector Automático / Claro / Oscuro (también se usa en el menú).
export function selectorTema(tema) {
    return `<div class="seg seg-tema">${[['auto', 'sparkle', 'Automático'], ['claro', 'sun', 'Claro'], ['oscuro', 'moon', 'Oscuro']]
        .map(([v, i, t]) => `<button class="${tema === v ? 'activo' : ''}" data-action="ajTema" data-v="${v}">${icon(i)} ${t}</button>`).join('')}</div>`;
}

const ACENTOS = [['violeta', '#5b3df5', 'Violeta'], ['cielo', '#3b8cf0', 'Cielo'], ['menta', '#2fb89a', 'Menta'], ['cobre', '#e8894a', 'Cobre'], ['laton', '#f2b544', 'Latón']];

export function render() {
    const p = sel.perfil();
    const aj = sel.ajustes();
    const tema = temaElegido();
    const acento = ACENTOS.some(a => a[0] === leerApariencia().acento) ? leerApariencia().acento : 'violeta';
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
            <h2 class="card-title" style="margin-bottom:6px;">Favoritos</h2>
            <p class="card-desc" style="margin:0 0 10px;">Aparecen arriba del registro para llenarlo con un toque. Se crean marcando "Guardar también como favorito" al registrar.</p>
            ${favoritosAjustesHTML()}
        </section>

        <section class="card">
            <h2 class="card-title" style="margin-bottom:6px;">Avisos</h2>
            <p class="card-desc" style="margin:0 0 12px;">Tlaco te avisa cuando vence una tarjeta, toca un pago recurrente, te acercas a un presupuesto o tu fin de mes se ve apretado, y cada domingo te resume la semana. Llegan aunque la app esté cerrada.</p>
            ${avisosHTML()}
        </section>

        <section class="card">
            <h2 class="card-title" style="margin-bottom:6px;">Siri</h2>
            <p class="card-desc" style="margin:0 0 12px;">Di "Oye Siri, gasto" y dicta algo como "250 Oxxo". Siri lo anota sin abrir nada y te confirma en voz alta; se guarda en Morralla la próxima vez que la abras.</p>
            ${siriHTML()}
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
        <p class="hint" style="text-align:center; margin-top:14px;">Morralla · tu dinero, hasta la última moneda</p>
    </div>`;
}

function favoritosAjustesHTML() {
    const favs = sel.plantillas();
    if (!favs.length) return '<p class="hint">Todavía no tienes favoritos.</p>';
    const nombreCat = (id) => sel.categorias().find(c => c.id === id)?.nombre;
    return `<div class="lista">${favs.map(f => `<div class="fila">
        <div class="fila-ico">${icon('star')}</div>
        <div class="fila-body"><div class="fila-titulo">${escapeHtml(f.desc || nombreCat(f.categoriaId) || 'Favorito')}</div>
            <div class="fila-sub">${[f.monto ? `<span class="privado">${money(f.monto)}</span>` : 'Sin monto fijo', nombreCat(f.categoriaId), sel.cuenta(f.cuentaId)?.nombre].filter(Boolean).map(x => x.startsWith('<') ? x : escapeHtml(x)).join(' · ')}</div></div>
        <button class="icon-btn" data-action="ajBorrarFav" data-id="${escapeHtml(f.id)}" aria-label="Quitar favorito">${icon('trash')}</button></div>`).join('')}</div>`;
}

on('ajBorrarFav', async (el) => {
    if (!(await confirmar({ titulo: 'Quitar favorito', texto: 'Se quita de la lista de favoritos. Tus movimientos no cambian.', aceptar: 'Quitar', peligro: true }))) return;
    await A.borrarPlantilla(el.dataset.id); toast('Favorito quitado');
});

// ---------- Avisos ----------
function avisosHTML() {
    if (store.demo) return '<p class="hint">Disponible al iniciar sesión con tu cuenta.</p>';
    if (!Push.soportado()) return '<p class="hint">Este navegador no admite avisos. En iPhone necesitas iOS 16.4 o más reciente y abrir Morralla desde su ícono en la pantalla de inicio.</p>';
    if (Push.avisosActivos()) return `<p class="aviso-estado pos">${icon('check-circle')}Activos en este dispositivo</p>
        <div class="botones-fila"><button class="btn btn-soft" data-action="ajAvisoPrueba">${icon('bell')}Enviar aviso de prueba</button>
        <button class="btn btn-ghost" data-action="ajAvisosOff">Desactivar</button></div>`;
    const iphoneSinInstalar = /iPhone|iPad/.test(navigator.userAgent) && !Push.enAppInstalada();
    return iphoneSinInstalar
        ? '<p class="hint">Abre Morralla desde su ícono en la pantalla de inicio para activar los avisos (Safari no los permite).</p>'
        : `<button class="btn btn-primary" data-action="ajAvisosOn">${icon('bell')}Activar avisos</button>`;
}

on('ajAvisosOn', async (el) => {
    el.disabled = true;
    try { await Push.activarAvisos(); toast('¡Listo! Tlaco te avisará'); repintar(); }
    catch (e) { toast(e.message, { tipo: 'error' }); el.disabled = false; }
});
on('ajAvisosOff', async () => {
    try { await Push.desactivarAvisos(); toast('Avisos desactivados'); }
    catch (e) { toast(e.message, { tipo: 'error' }); }
    repintar();
});
on('ajAvisoPrueba', async (el) => {
    el.disabled = true;
    try {
        const r = await Push.avisoDePrueba();
        toast(r.delivered ? 'Aviso enviado: debe llegar en unos segundos' : 'No se pudo entregar; desactiva y vuelve a activar los avisos', { tipo: r.delivered ? undefined : 'error' });
    } catch (e) { toast(e.message, { tipo: 'error' }); }
    el.disabled = false;
});

const repintar = () => { const v = document.getElementById('vista'); if (v && location.hash.startsWith('#/ajustes')) v.innerHTML = render(); };

// ---------- Siri ----------
function siriHTML() {
    if (store.demo) return '<p class="hint">Disponible al iniciar sesión con tu cuenta.</p>';
    const cuentas = sel.cuentas();
    if (!Push.siriActiva()) return `<button class="btn btn-primary" data-action="ajSiriActivar">${icon('sparkle')}Configurar Siri</button>
        <p class="hint" style="margin-top:10px;">¿Prefieres revisar antes de guardar? <button class="link" data-action="ajSiri">Usa el atajo que abre el registro lleno</button>.</p>`;
    return `<p class="aviso-estado pos">${icon('check-circle')}Siri está lista</p>
        <div class="field"><label for="aj-cuenta-siri">Cuenta para lo que dictes</label>
            <select id="aj-cuenta-siri" data-change="ajCuentaSiri">${cuentas.map(c => `<option value="${escapeHtml(c.id)}" ${c.id === Push.cuentaSiri() ? 'selected' : ''}>${escapeHtml(c.nombre)}</option>`).join('')}</select>
            <span class="hint">La categoría se elige sola con la descripción; puedes cambiarla después en Movimientos.</span></div>
        <div class="botones-fila"><button class="btn btn-soft" data-action="ajSiriActivar">${icon('repeat')}Nueva clave e instrucciones</button>
        <button class="btn btn-ghost" data-action="ajSiriOff">Desactivar</button></div>`;
}

on('ajCuentaSiri', async (el) => { await A.guardarAjustes({ cuentaSiri: el.value }); toast('Cuenta para Siri actualizada'); }, 'change');
on('ajSiriOff', async () => {
    if (!(await confirmar({ titulo: 'Desactivar Siri', texto: 'La clave actual deja de funcionar; tu atajo ya no podrá anotar movimientos.', aceptar: 'Desactivar', peligro: true }))) return;
    try { await Push.revocarSiri(); toast('Siri desactivada'); } catch (e) { toast(e.message, { tipo: 'error' }); }
});
on('ajSiriActivar', async (el) => {
    if (Push.siriActiva() && !(await confirmar({ titulo: 'Nueva clave', texto: 'La clave anterior deja de funcionar: tendrás que pegar la nueva en tu atajo.', aceptar: 'Generar' }))) return;
    el.disabled = true;
    let clave;
    try { clave = await Push.crearClaveSiri(); }
    catch (e) { toast(e.message, { tipo: 'error' }); el.disabled = false; return; }
    const url = `${Push.WORKER_URL}/movimiento`;
    const paso = (n, t) => `<li><b>${n}.</b> ${t}</li>`;
    const copiar = (t) => `<div class="copiar"><code>${escapeHtml(t)}</code><button class="btn btn-soft btn-sm" data-action="ajCopiar" data-t="${escapeHtml(t)}">${icon('copy')}Copiar</button></div>`;
    abrirHoja({
        titulo: 'Siri: "Oye Siri, gasto"',
        html: `<div class="siri">
            <p class="hint" style="margin-top:0;"><b>Tu clave personal</b> (solo se muestra ahora; guárdala en el atajo):</p>
            ${copiar(`Bearer ${clave}`)}
            <h3>Arma el atajo</h3>
            <ol class="pasos">
                ${paso(1, 'Abre la app <b>Atajos</b> y toca <b>+</b>.')}
                ${paso(2, 'Agrega <b>Dictar texto</b> (idioma: Español).')}
                ${paso(3, 'Agrega <b>Obtener contenido de URL</b> y pega esta dirección:')}
            </ol>
            ${copiar(url)}
            <ol class="pasos" start="4">
                ${paso(4, 'En esa misma acción toca <b>Mostrar más</b>: Método <b>POST</b>.')}
                ${paso(5, 'En <b>Encabezados</b> agrega uno: clave <b>Authorization</b>, valor tu clave de arriba (empieza con "Bearer").')}
                ${paso(6, 'En <b>Cuerpo de la solicitud</b> elige <b>JSON</b> y agrega un campo de texto: clave <b>texto</b>, valor la variable <b>Texto dictado</b>.')}
                ${paso(7, 'Agrega <b>Obtener valor del diccionario</b>: clave <b>mensaje</b>.')}
                ${paso(8, 'Agrega <b>Mostrar resultado</b> con ese valor: Siri te lo dice en voz alta.')}
                ${paso(9, 'Nombra el atajo <b>Gasto</b>. Di "Oye Siri, gasto" y dicta "250 Oxxo" o "ingreso 5000 nómina".')}
            </ol>
            <p class="hint">Lo dictado se guarda en la cuenta elegida en Ajustes cuando abres Morralla. Si alguien más ve tu clave, genera una nueva.</p>
        </div>`,
    });
    el.disabled = false;
});

// Atajo alternativo: la URL #/nuevo abre el registro prellenado (en Safari).
const urlBase = () => `${location.origin}${location.pathname}`;
on('ajSiri', () => {
    const gasto = `${urlBase()}#/nuevo?tipo=gasto&monto=`;
    const saldo = `${urlBase()}#/inicio`;
    const paso = (n, t) => `<li><b>${n}.</b> ${t}</li>`;
    abrirHoja({
        titulo: 'Siri y Atajos',
        html: `<div class="siri">
            <h3>"Oye Siri, gasto"</h3>
            <ol class="pasos">
                ${paso(1, 'Abre la app <b>Atajos</b> y toca <b>+</b> para crear uno nuevo.')}
                ${paso(2, 'Agrega la acción <b>Pedir entrada</b>: tipo <b>Número</b>, pregunta "¿Cuánto gastaste?".')}
                ${paso(3, 'Agrega <b>Texto</b> y pega la dirección de abajo; al final inserta la variable <b>Entrada proporcionada</b>.')}
                ${paso(4, 'Agrega <b>Abrir URL</b> (usa el Texto anterior).')}
                ${paso(5, 'Nombra el atajo <b>Gasto</b>. Ya puedes decir "Oye Siri, gasto" y dictar el monto.')}
            </ol>
            <div class="copiar"><code>${escapeHtml(gasto)}</code><button class="btn btn-soft btn-sm" data-action="ajCopiar" data-t="${escapeHtml(gasto)}">${icon('copy')}Copiar</button></div>
            <p class="hint">Puedes agregar más datos a la dirección: <code>&amp;cat=comida</code> (categoría), <code>&amp;cuenta=nu</code> (cuenta), <code>&amp;desc=Oxxo</code>. Se buscan por nombre; si no se encuentran, eliges tú.</p>
            <h3>"Oye Siri, mi saldo"</h3>
            <ol class="pasos">
                ${paso(1, 'Crea otro atajo con la acción <b>Abrir URL</b> y esta dirección.')}
                ${paso(2, 'Nómbralo <b>Mi saldo</b>.')}
            </ol>
            <div class="copiar"><code>${escapeHtml(saldo)}</code><button class="btn btn-soft btn-sm" data-action="ajCopiar" data-t="${escapeHtml(saldo)}">${icon('copy')}Copiar</button></div>
            <p class="hint"><b>Importante:</b> iOS abre los atajos en Safari, no en la app de la pantalla de inicio (Apple no lo permite). Inicia sesión una vez en Morralla desde Safari; lo que guardes ahí aparece en la app al instante.</p>
        </div>`,
    });
});
on('ajCopiar', async (el) => {
    try { await navigator.clipboard.writeText(el.dataset.t); toast('Copiado'); }
    catch { toast('No se pudo copiar; mantén presionada la dirección para copiarla', { tipo: 'error' }); }
});

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

// Se guarda en ajustes/apariencia (las claves tema y acento eran del estilo anterior).
const guardarApariencia = () => { const { tema, acento } = leerApariencia(); return A.guardarAjustes({ apariencia: { tema: tema || 'claro', acento: acento || 'violeta' } }); };
on('ajTema', async (el) => { elegirTema(el.dataset.v); await guardarApariencia(); });
on('ajAcento', async (el) => { aplicarApariencia({ acento: el.dataset.v }); await guardarApariencia(); });

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
    } else toast('El archivo no es un respaldo de Morralla', { tipo: 'error' });
}, 'change');

on('ajBorrarMovs', async () => {
    if (!(await confirmar({ titulo: 'Borrar todos los movimientos', texto: 'Se eliminará todo tu historial y los saldos de todas las cuentas quedarán en $0. No se puede deshacer.', aceptar: 'Borrar todo', peligro: true }))) return;
    await A.borrarMovimientos(); toast('Movimientos borrados');
});
