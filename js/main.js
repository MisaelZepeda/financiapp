import { auth } from './firebase-init.js';
import { state, frasesFinancieras } from './state.js';
import { buildDemoData } from './utils/demo-data.js';
import { money } from './utils/format.js';
import { mostrarAlerta, mostrarConfirmacion, mostrarPromptCard } from './ui/modals.js';
import { cambiarTab, toggleUserMenu, toggleNotifPanel, closeDropdowns, abrirMenuRegistro, cerrarMenuRegistro, openMoreSheet, closeMoreSheet, toggleThemeSwitch, initThemePreference, togglePrivacy, subscribeTabChange } from './ui/nav.js';
import { compartirTarjeta } from './utils/share-card.js';
import { exportarCSV } from './utils/csv-export.js';
import { generarPDFMes } from './utils/pdf-export.js';

import { renderResumen } from './render/resumen.js';
import { renderReportes, renderListas, setReportMode, loadMore, resetReportesUI } from './render/reportes.js';
import { renderPresupuestos } from './render/presupuestos.js';
import { renderCuentasMaestro, toggleCamposCuenta, poblarFormularioCuenta, limpiarFormularioCuenta } from './render/cuentas.js';
import { renderPerfil } from './render/perfil.js';
import { renderMetas } from './render/metas.js';
import { renderRecurrentes, chequearVencidosBanner } from './render/recurrentes.js';
import { renderNotificaciones } from './render/notificaciones.js';

import { guardarCuenta, eliminarCuenta, marcarPagado, desmarcarPagado, sumarInteres } from './data/cuentas.js';
import { guardarIngreso, guardarGasto, guardarMovimiento, eliminarTransaccion } from './data/transacciones.js';
import { guardarPresupuestos } from './data/presupuestos.js';
import { guardarPerfil, guardarCategoriasCustom } from './data/perfil.js';
import { guardarMeta, eliminarMeta, abonarMeta, retirarMeta } from './data/metas.js';
import { guardarRecurrente, eliminarRecurrente, toggleActivoRecurrente, calcularVencidos, generarOcurrencia } from './data/recurrentes.js';
import { exportarBackup, importarBackup, resetearCuenta, eliminarUsuario } from './data/mantenimiento.js';

import { actualizarSelectsRegistro, handleGaFuenteChange, setMovMode, getMovMode, abrirModalRegistro, cerrarModalRegistro, editIngreso, editGasto, editMovimiento, getEditId, setEditId } from './ui/registro-sheet.js';
import { abrirSheetMeta, cerrarSheetMeta, seleccionarIconoMeta, abrirSheetRecurrente, cerrarSheetRecurrente, actualizarSelectsRecurrente, toggleCampoCategoria } from './ui/extra-sheets.js';

let currentCuentaEditId = null;
let vencidosPrompted = false;

/* ==================== RENDER ORQUESTADOR ==================== */
function aplicarPerfilAlDOM() {
    const p = state.perfil;
    document.documentElement.style.setProperty('--primary', p.color);
    document.getElementById('headerGreeting').innerText = `Hola ${p.nombre} :)`;
    document.getElementById('headerFoto').src = p.foto;
    document.getElementById('perfDisplayNombre').innerText = p.nombre;
    document.getElementById('perfDisplayFoto').src = p.foto;
    if (document.getElementById('perfNombre')) document.getElementById('perfNombre').value = p.nombre;
}

function renderAll() {
    aplicarPerfilAlDOM();
    renderResumen();
    renderReportes();
    renderPresupuestos();
    renderCuentasMaestro();
    renderPerfil();
    renderMetas();
    renderRecurrentes();
    chequearVencidosBanner();
    renderNotificaciones();
    actualizarSelectsRegistro();
}

subscribeTabChange((tabId) => { if (tabId !== '__theme__') resetReportesUI(); renderAll(); });

/* ==================== AUTH ==================== */
function translateAuthError(code) {
    const dict = {
        'auth/user-not-found': 'Este correo no está registrado en el sistema.',
        'auth/wrong-password': 'La contraseña es incorrecta.',
        'auth/invalid-credential': 'El correo o la contraseña son incorrectos.',
        'auth/invalid-email': 'El formato del correo electrónico no es válido.',
        'auth/email-already-in-use': 'Ya existe una cuenta registrada con este correo.',
        'auth/weak-password': 'La contraseña es muy débil. Debe tener al menos 6 caracteres.',
        'auth/internal-error': 'Error interno de conexión. Revisa tu internet.',
        'auth/network-request-failed': 'No hay conexión a internet. Verifica tu red.',
    };
    return dict[code] || 'Ocurrió un error inesperado. Intenta de nuevo.';
}

function toggleAuthForm(type) {
    document.getElementById('loginForm').style.display = type === 'login' ? 'block' : 'none';
    document.getElementById('registerForm').style.display = type === 'register' ? 'block' : 'none';
    document.getElementById('resetForm').style.display = type === 'reset' ? 'block' : 'none';
}

let regBase64 = '';

function comprimirImagen(file, callback) {
    const reader = new FileReader();
    reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
            const MAX = 300;
            let w = img.width, h = img.height;
            if (w > h) { if (w > MAX) { h *= MAX / w; w = MAX; } } else { if (h > MAX) { w *= MAX / h; h = MAX; } }
            const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            callback(canvas.toDataURL('image/jpeg', 0.7));
        };
        img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
}

document.getElementById('regFoto')?.addEventListener('change', (e) => { if (e.target.files[0]) comprimirImagen(e.target.files[0], (b64) => regBase64 = b64); });
document.getElementById('perfFile')?.addEventListener('change', (e) => { if (e.target.files[0]) comprimirImagen(e.target.files[0], (b64) => { state.currentBase64 = b64; document.getElementById('perfDisplayFoto').src = b64; }); });
document.getElementById('fileRestore')?.addEventListener('change', (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        try {
            const data = JSON.parse(ev.target.result);
            mostrarConfirmacion('Restaurar Datos', 'Esto reemplazará TODOS tus datos actuales por los del respaldo. ¿Estás completamente seguro?', () => {
                importarBackup(data).then(() => {
                    mostrarAlerta('Éxito', state.isDemo ? 'Datos restaurados en el demo.' : 'Datos restaurados. Recargando app...', 'success');
                    if (state.isDemo) renderAll(); else setTimeout(() => window.location.reload(), 1300);
                }).catch(err => mostrarAlerta('Error', err.message, 'error'));
            });
        } catch (err) { mostrarAlerta('Archivo Inválido', 'El archivo cargado no es compatible.', 'error'); }
    };
    reader.readAsText(file);
});

document.getElementById('loginForm').addEventListener('submit', (e) => {
    e.preventDefault();
    auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
        .then(() => auth.signInWithEmailAndPassword(document.getElementById('logEmail').value, document.getElementById('logPass').value))
        .catch(err => mostrarAlerta('Error de Acceso', translateAuthError(err.code), 'error'));
});

document.getElementById('registerForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('regEmail').value;
    const pass = document.getElementById('regPass').value;
    const nombre = document.getElementById('regNombre').value;
    if (!nombre) { mostrarAlerta('Atención', 'El nombre es obligatorio', 'error'); return; }
    auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
        .then(() => auth.createUserWithEmailAndPassword(email, pass))
        .then((cred) => {
            const defaultPic = `https://ui-avatars.com/api/?name=${encodeURIComponent(nombre)}&background=6c63ff&color=fff&size=128`;
            return firebase.database().ref(`Usuarios/${cred.user.uid}/perfil`).set({ nombre, foto: regBase64 || defaultPic, color: '#6c63ff' })
                .then(() => mostrarAlerta('¡Éxito!', `Cuenta creada. ¡Bienvenido ${nombre}!`, 'success'));
        }).catch(err => mostrarAlerta('Error al registrar', translateAuthError(err.code), 'error'));
});

document.getElementById('resetForm').addEventListener('submit', (e) => {
    e.preventDefault();
    auth.sendPasswordResetEmail(document.getElementById('resetEmail').value)
        .then(() => { mostrarAlerta('Correo Enviado', 'Revisa tu bandeja de entrada.', 'success'); toggleAuthForm('login'); })
        .catch(err => mostrarAlerta('Error', translateAuthError(err.code), 'error'));
});

function handleLogout() {
    if (state.isDemo) { window.location.reload(); return; }
    // Limpiar el respaldo local de datos financieros antes de salir: en un
    // equipo compartido, si no se borra, la siguiente persona que use el
    // navegador podría leerlo desde localStorage aunque ya no haya sesión.
    const uid = auth.currentUser?.uid;
    if (uid) localStorage.removeItem(`dashpro_data_${uid}`);
    auth.signOut().then(() => window.location.reload());
}

function entrarModoDemo() {
    state.isDemo = true;
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('appDashboard').style.display = 'flex';
    document.getElementById('loader').style.display = 'none';
    const badge = document.getElementById('demoBadge');
    if (badge) badge.style.display = 'inline-flex';
    // procesarDatos puede disparar el modal de "recurrentes vencidos"; no debe
    // competir por el mismo overlay con ninguna otra alerta, así que aquí solo
    // usamos el badge persistente del header para señalar el modo demo.
    procesarDatos(buildDemoData());
}

/* ==================== CARGA DE DATOS (Firebase) ==================== */
function rotarFrase() {
    const el = document.getElementById('fraseMotivadora');
    if (el) el.innerText = frasesFinancieras[Math.floor(Math.random() * frasesFinancieras.length)];
}

function procesarDatos(data) {
    state.cuentas = data.cuentas ? Object.values(data.cuentas) : [];
    state.transacciones = data.transacciones ? Object.entries(data.transacciones).map(([id, val]) => ({ ...val, firebaseId: id })) : [];
    state.presupuestos = data.presupuestos || {};
    state.categoriasCustom = data.categoriasCustom ? Object.values(data.categoriasCustom) : [];
    state.metas = data.metas ? Object.values(data.metas) : [];
    state.recurrentes = data.recurrentes ? Object.values(data.recurrentes) : [];

    const p = data.perfil || { nombre: 'Usuario', foto: 'https://via.placeholder.com/100', color: '#6c63ff' };
    state.perfil = p;
    state.selectedColor = p.color;

    renderAll();

    if (!vencidosPrompted) {
        vencidosPrompted = true;
        const vencidos = calcularVencidos();
        if (vencidos.length > 0) {
            const total = vencidos.reduce((a, r) => a + Number(r.monto || 0), 0);
            mostrarConfirmacion('Pagos Recurrentes Pendientes', `Tienes ${vencidos.length} movimiento(s) recurrente(s) por generar (≈ ${money(total)}). ¿Los generamos ahora?`, () => {
                Promise.all(vencidos.map(r => generarOcurrencia(r))).then(() => { renderAll(); mostrarAlerta('Listo', 'Movimientos recurrentes generados.', 'success'); });
            });
        }
    }
}

let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; const btn = document.getElementById('btnInstalarApp'); if (btn) btn.style.display = 'block'; });
document.getElementById('btnInstalarApp')?.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') document.getElementById('btnInstalarApp').style.display = 'none';
    deferredPrompt = null;
});

auth.onAuthStateChanged((user) => {
    if (state.isDemo) return;
    if (user) {
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('appDashboard').style.display = 'flex';
        const loader = document.getElementById('loader');
        if (loader) loader.style.display = 'flex';
        rotarFrase();

        const cacheLocal = localStorage.getItem(`dashpro_data_${user.uid}`);
        if (cacheLocal) procesarDatos(JSON.parse(cacheLocal));

        firebase.database().ref('Usuarios/' + user.uid).on('value', (snap) => {
            const data = snap.val() || {};
            localStorage.setItem(`dashpro_data_${user.uid}`, JSON.stringify(data));
            procesarDatos(data);
        });

        setTimeout(() => { if (loader) loader.style.display = 'none'; }, 1200);
    } else {
        document.getElementById('loginScreen').style.display = 'flex';
        document.getElementById('appDashboard').style.display = 'none';
        if (document.getElementById('loader')) document.getElementById('loader').style.display = 'none';
    }
});

/* ==================== FORM HANDLERS ==================== */
function withPromise(promise, msgTitulo, msgTexto, after) {
    promise.then(() => { mostrarAlerta(msgTitulo, msgTexto, 'success'); if (after) after(); renderAll(); })
        .catch(err => mostrarAlerta('Error', err.message || 'Ocurrió un problema.', 'error'));
}

function onSubmitByAction(action, form, e) {
    e.preventDefault();
    switch (action) {
        case 'guardarCuenta': {
            const tipo = document.getElementById('cuTipo').value;
            const id = currentCuentaEditId || Date.now();
            const existente = state.cuentas.find(x => x.id == id);
            const cuenta = {
                id, nombre: document.getElementById('cuNombre').value, banco: document.getElementById('cuBanco').value, tipo,
                saldo: parseFloat(document.getElementById('cuSaldo').value) || 0,
                limite: tipo === 'credito' ? (parseFloat(document.getElementById('cuLimite').value) || 0) : 0,
                digitos: (tipo === 'debito' || tipo === 'credito') ? (document.getElementById('cuDigitos').value || '') : '',
                clabe: tipo === 'debito' ? (document.getElementById('cuClabe').value || '') : '',
                diaPago: tipo === 'credito' ? (parseInt(document.getElementById('cuPago').value) || 0) : 0,
                diaCorte: tipo === 'credito' ? (parseInt(document.getElementById('cuCorte').value) || 0) : 0,
            };
            if (existente?.mesPagado != null) cuenta.mesPagado = existente.mesPagado;
            const iconUrl = currentCuentaEditId ? (document.getElementById('cuIcon').value || existente?.icon || '') : (existente?.icon || '');
            if (iconUrl) cuenta.icon = iconUrl;
            withPromise(guardarCuenta(cuenta), 'Guardado', 'Cuenta registrada.', () => { currentCuentaEditId = null; limpiarFormularioCuenta(); });
            break;
        }
        case 'handleGasto': {
            const editId = getEditId();
            const monto = parseFloat(document.getElementById('gaMonto').value);
            const isMSI = document.getElementById('gaIsMSI')?.checked || false;
            const meses = parseInt(document.getElementById('gaMeses')?.value) || 1;
            withPromise(guardarGasto({ monto, desc: document.getElementById('gaDesc').value, cat: document.getElementById('gaCat').value, cuentaId: document.getElementById('gaFuente').value, editId, isMSI, meses }), 'Gasto', 'Cobro descontado.', () => { form.reset(); setEditId(null); document.getElementById('gaFuente').disabled = false; cerrarModalRegistro(); });
            break;
        }
        case 'handleIngreso': {
            const editId = getEditId();
            withPromise(guardarIngreso({ monto: parseFloat(document.getElementById('inMonto').value), desc: document.getElementById('inDesc').value, cuentaId: document.getElementById('inCuenta').value, editId }), 'Ingreso', 'Registrado exitosamente.', () => { form.reset(); setEditId(null); document.getElementById('inCuenta').disabled = false; cerrarModalRegistro(); });
            break;
        }
        case 'handleMovimiento': {
            const editId = getEditId();
            withPromise(guardarMovimiento({ monto: parseFloat(document.getElementById('movMonto').value), origenId: document.getElementById('movOrigen').value, destinoId: document.getElementById('movDestino').value, subtipo: getMovMode(), editId }), 'Completado', 'Movimiento exitoso.', () => { form.reset(); setEditId(null); document.getElementById('movOrigen').disabled = false; document.getElementById('movDestino').disabled = false; cerrarModalRegistro(); });
            break;
        }
        case 'guardarPresupuestos': {
            const nuevos = {};
            form.querySelectorAll('input[data-cat]').forEach(inp => { if (inp.value) nuevos[inp.dataset.cat] = parseFloat(inp.value); });
            withPromise(guardarPresupuestos(nuevos), 'Actualizados', 'Tus límites fueron guardados.', null);
            break;
        }
        case 'guardarPerfil': {
            const foto = state.currentBase64 || document.getElementById('perfDisplayFoto').src;
            withPromise(guardarPerfil({ nombre: document.getElementById('perfNombre').value, foto, color: state.selectedColor }), 'Perfil Guardado', 'Datos actualizados.', () => cambiarTab('resumen'));
            break;
        }
        case 'agregarCategoriaCustom': {
            const nueva = document.getElementById('nuevaCatInput').value.trim();
            if (!nueva || state.categoriasCustom.includes(nueva)) return;
            withPromise(guardarCategoriasCustom([...state.categoriasCustom, nueva]), 'Listo', 'Etiqueta registrada.', () => document.getElementById('nuevaCatInput').value = '');
            break;
        }
        case 'guardarMeta': {
            const editId = document.getElementById('metaEditId').value;
            const id = editId || `meta_${Date.now()}`;
            const meta = {
                id, nombre: document.getElementById('metaNombre').value, emoji: document.getElementById('metaEmoji').value,
                montoObjetivo: parseFloat(document.getElementById('metaObjetivo').value) || 0,
                montoActual: parseFloat(document.getElementById('metaActual').value) || 0,
                fechaLimite: document.getElementById('metaFecha').value || '',
            };
            withPromise(guardarMeta(meta), 'Meta guardada', '¡Vas por buen camino!', () => cerrarSheetMeta());
            break;
        }
        case 'guardarRecurrente': {
            const editId = document.getElementById('recEditId').value;
            const id = editId || `rec_${Date.now()}`;
            const existente = state.recurrentes.find(r => r.id === id);
            const recurrente = {
                id, tipo: document.getElementById('recTipo').value, desc: document.getElementById('recDesc').value,
                monto: parseFloat(document.getElementById('recMonto').value) || 0,
                cat: document.getElementById('recCat').value, cuentaId: document.getElementById('recCuenta').value,
                frecuencia: document.getElementById('recFrecuencia').value, diaMes: parseInt(document.getElementById('recDia').value) || null,
                activo: existente?.activo !== false, ultimaGeneracion: existente?.ultimaGeneracion || null,
            };
            withPromise(guardarRecurrente(recurrente), 'Recurrente guardado', 'Lo veremos llegado su turno.', () => cerrarSheetRecurrente());
            break;
        }
    }
}

document.addEventListener('submit', (e) => {
    const form = e.target.closest('form[data-action]');
    if (form) onSubmitByAction(form.dataset.action, form, e);
});

/* ==================== CLICK / CHANGE / INPUT DELEGADO ==================== */
document.addEventListener('change', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    switch (el.dataset.action) {
        case 'toggleTheme': toggleThemeSwitch(el.checked); break;
        case 'handleGaFuenteChange': handleGaFuenteChange(el.value); break;
        case 'toggleCamposCuenta': toggleCamposCuenta(); break;
        case 'toggleCampoCategoria': toggleCampoCategoria(); break;
        case 'toggleMesesMSI': document.getElementById('gaMesesContainer').style.display = el.checked ? 'block' : 'none'; break;
    }
});

document.addEventListener('input', (e) => {
    const el = e.target.closest('[data-action="renderListas"]');
    if (el) renderListas();
});

document.addEventListener('click', (e) => {
    const tabEl = e.target.closest('[data-tab]');
    const actionEl = e.target.closest('[data-action]');

    if (tabEl && (!actionEl || actionEl === tabEl)) { cambiarTab(tabEl.dataset.tab); return; }

    if (actionEl) {
        const id = actionEl.dataset.id;
        switch (actionEl.dataset.action) {
            case 'toggleAuthForm': toggleAuthForm(actionEl.dataset.form); break;
            case 'entrarModoDemo': entrarModoDemo(); break;
            case 'toggleUserMenu': toggleUserMenu(e); break;
            case 'toggleNotifPanel': toggleNotifPanel(e); renderNotificaciones(); break;
            case 'togglePrivacy': togglePrivacy(); break;
            case 'exportarBackup': exportarBackup(); mostrarAlerta('Respaldo Creado', 'Tus datos se han guardado con éxito.', 'success'); break;
            case 'handleLogout': handleLogout(); break;
            case 'abrirMenuRegistro': abrirMenuRegistro(); break;
            case 'cerrarMenuRegistro': cerrarMenuRegistro(); break;
            case 'openMoreSheet': openMoreSheet(); break;
            case 'closeMoreSheet': closeMoreSheet(); break;
            case 'abrirRegistro': cerrarMenuRegistro(); abrirModalRegistro(actionEl.dataset.tipo); closeDropdowns(); break;
            case 'cerrarModalRegistro': cerrarModalRegistro(); break;
            case 'setReportMode': setReportMode(actionEl.dataset.mode); break;
            case 'loadMore': loadMore(actionEl.dataset.tipo); break;
            case 'editGasto': editGasto(id); break;
            case 'editIngreso': editIngreso(id); break;
            case 'editMovimiento': editMovimiento(id); break;
            case 'eliminarTransaccion': mostrarConfirmacion('Eliminar Registro', '¿Seguro que deseas borrar este movimiento y revertir los saldos?', () => withPromise(eliminarTransaccion(id), 'Eliminado', 'Saldos ajustados.', null)); break;
            case 'editCuenta': { const c = state.cuentas.find(x => x.id == id); if (!c) return; cambiarTab('cuentas'); poblarFormularioCuenta(c); currentCuentaEditId = id; document.getElementById('cuentaFormTitle').innerText = 'Editando Cuenta'; document.getElementById('btnGuardarCuenta').innerText = 'Guardar Cambios'; document.getElementById('btnCancelarEdicionCuenta').style.display = 'block'; window.scrollTo(0, 0); break; }
            case 'sumarInteres': { const c = state.cuentas.find(x => x.id == id); if (!c) return; mostrarPromptCard('Generar Rendimiento', 'Ingresa el interés generado hoy ($):', (val) => { const m = parseFloat(val); if (!m || m <= 0) return; withPromise(sumarInteres(c, m), 'Intereses Sumados', 'Ganancias actualizadas.', null); }); break; }
            case 'confirmarBorrarCuenta': mostrarConfirmacion('Eliminar Cuenta', 'Se borrará permanentemente de tu lista. Sus transacciones perderán la referencia. ¿Continuar?', () => withPromise(eliminarCuenta(id), 'Borrada', 'La cuenta fue eliminada.', null)); break;
            case 'marcarPagado': withPromise(marcarPagado(id, new Date().getMonth()), 'Marcado', 'Cuenta marcada como pagada.', null); break;
            case 'desmarcarPagado': withPromise(desmarcarPagado(id), 'Deshecho', 'Se quitó la marca de pagado.', null); break;
            case 'compartirTarjeta': compartirTarjeta(id); break;
            case 'cancelarEdicionCuenta': currentCuentaEditId = null; limpiarFormularioCuenta(); break;
            case 'selectColor': state.selectedColor = actionEl.dataset.color; document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active')); actionEl.classList.add('active'); document.documentElement.style.setProperty('--primary', actionEl.dataset.color); break;
            case 'eliminarCategoriaCustom': mostrarConfirmacion('Borrar Categoría', `¿Eliminar la etiqueta "${actionEl.dataset.cat}"?`, () => withPromise(guardarCategoriasCustom(state.categoriasCustom.filter(c => c !== actionEl.dataset.cat)), 'Eliminada', 'Categoría removida.', null)); break;
            case 'seleccionarRestore': document.getElementById('fileRestore').click(); break;
            case 'resetearCuenta': mostrarConfirmacion('Mantenimiento Mayor', 'Esto borrará TODO tu historial de movimientos y dejará los saldos de todas las cuentas en $0. ¿Estás seguro?', () => withPromise(resetearCuenta(), 'Limpio', 'Saldos restablecidos a cero.', null)); break;
            case 'eliminarUsuario': mostrarConfirmacion('¡Peligro extremo!', 'Esto eliminará tu cuenta y TODOS tus datos permanentemente. No hay marcha atrás. ¿Seguro?', () => { const uidPrevio = auth.currentUser?.uid; eliminarUsuario().then(() => { if (uidPrevio) localStorage.removeItem(`dashpro_data_${uidPrevio}`); window.location.reload(); }).catch(err => mostrarAlerta('Error', 'Debes volver a iniciar sesión para hacer esto.', 'error')); }); break;
            case 'generarPDFMes': generarPDFMes(); break;
            case 'exportarCSV': exportarCSV(); break;
            case 'nuevaMeta': abrirSheetMeta(); break;
            case 'editarMeta': abrirSheetMeta(state.metas.find(m => m.id === id)); break;
            case 'eliminarMeta': mostrarConfirmacion('Eliminar Meta', '¿Seguro que quieres eliminar esta meta de ahorro?', () => withPromise(eliminarMeta(id), 'Eliminada', 'Meta eliminada.', null)); break;
            case 'abonarMeta': mostrarPromptCard('Abonar a la meta', '¿Cuánto quieres abonar?', (val) => { const m = parseFloat(val); if (!m || m <= 0) return; withPromise(abonarMeta(id, m), 'Abonado', '¡Sigue así!', null); }); break;
            case 'retirarMeta': mostrarPromptCard('Retirar de la meta', '¿Cuánto quieres retirar?', (val) => { const m = parseFloat(val); if (!m || m <= 0) return; withPromise(retirarMeta(id, m), 'Retirado', 'Monto actualizado.', null); }); break;
            case 'cerrarSheetMeta': cerrarSheetMeta(); break;
            case 'seleccionarIconoMeta': seleccionarIconoMeta(actionEl.dataset.icon); break;
            case 'nuevoRecurrente': abrirSheetRecurrente(); break;
            case 'editarRecurrente': abrirSheetRecurrente(state.recurrentes.find(r => r.id === id)); break;
            case 'eliminarRecurrente': mostrarConfirmacion('Eliminar Recurrente', '¿Seguro que quieres eliminarlo?', () => withPromise(eliminarRecurrente(id), 'Eliminado', 'Recurrente eliminado.', null)); break;
            case 'toggleRecurrente': { const r = state.recurrentes.find(x => x.id === id); if (!r) return; withPromise(toggleActivoRecurrente(id, r.activo === false), r.activo === false ? 'Reactivado' : 'Pausado', 'Recurrente actualizado.', null); break; }
            case 'cerrarSheetRecurrente': cerrarSheetRecurrente(); break;
            case 'generarVencidos': { const vencidos = calcularVencidos(); if (!vencidos.length) return; Promise.all(vencidos.map(r => generarOcurrencia(r))).then(() => { renderAll(); mostrarAlerta('Listo', 'Movimientos recurrentes generados.', 'success'); }); break; }
            case 'setMovMode': setMovMode(actionEl.dataset.mode); break;
        }
    }

    const dentroDropdown = e.target.closest('.dropdown-panel, [data-action="toggleUserMenu"], [data-action="toggleNotifPanel"]');
    if (!dentroDropdown) closeDropdowns();
});

/* ==================== INIT ==================== */
initThemePreference();

if ('serviceWorker' in navigator && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(() => {});
    });
}
