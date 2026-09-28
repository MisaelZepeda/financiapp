// Pantallas fuera de la app: acceso (login, registro, recuperar) y migración.

import { auth } from '../firebase-init.js';
import { on } from '../core/eventos.js';
import { icon } from '../lib/icons.js';
import { escapeHtml, money } from '../lib/format.js';
import { toast } from '../components/capas.js';

const raiz = () => document.getElementById('acceso');
let modo = 'login';
export let nombreRegistro = '';

const ERRORES = {
    'auth/user-not-found': 'Ese correo no está registrado.',
    'auth/wrong-password': 'La contraseña es incorrecta.',
    'auth/invalid-credential': 'El correo o la contraseña son incorrectos.',
    'auth/invalid-login-credentials': 'El correo o la contraseña son incorrectos.',
    'auth/invalid-email': 'El correo no tiene un formato válido.',
    'auth/email-already-in-use': 'Ya existe una cuenta con ese correo.',
    'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
    'auth/network-request-failed': 'Sin conexión a internet.',
    'auth/too-many-requests': 'Demasiados intentos. Espera un momento.',
};
const error = (e) => ERRORES[e.code] || 'Ocurrió un error. Intenta de nuevo.';

function formHTML() {
    if (modo === 'registro') return `<form data-submit="accRegistro">
        <h2>Crea tu cuenta</h2><p class="acc-lede">Empieza a ordenar tu dinero hoy.</p>
        <div class="field"><label for="ac-nombre">Nombre</label><input id="ac-nombre" name="nombre" autocomplete="name" required></div>
        <div class="field"><label for="ac-email">Correo</label><input id="ac-email" name="email" type="email" autocomplete="email" required></div>
        <div class="field"><label for="ac-pass">Contraseña</label><input id="ac-pass" name="pass" type="password" autocomplete="new-password" minlength="6" required></div>
        <button class="btn btn-primary btn-block btn-lg" type="submit">Crear cuenta</button>
        <p class="acc-pie">¿Ya tienes cuenta? <button type="button" class="link" data-action="accModo" data-m="login">Entrar</button></p>
    </form>`;
    if (modo === 'reset') return `<form data-submit="accReset">
        <h2>Recuperar acceso</h2><p class="acc-lede">Te enviaremos un correo para restablecer tu contraseña.</p>
        <div class="field"><label for="ac-email">Correo</label><input id="ac-email" name="email" type="email" autocomplete="email" required></div>
        <button class="btn btn-primary btn-block btn-lg" type="submit">Enviar enlace</button>
        <p class="acc-pie"><button type="button" class="link" data-action="accModo" data-m="login">Volver</button></p>
    </form>`;
    return `<form data-submit="accLogin">
        <h2>Bienvenido</h2><p class="acc-lede">Entra para ver tus finanzas.</p>
        <div class="field"><label for="ac-email">Correo</label><input id="ac-email" name="email" type="email" autocomplete="email" required></div>
        <div class="field"><label for="ac-pass">Contraseña</label><input id="ac-pass" name="pass" type="password" autocomplete="current-password" required></div>
        <p style="text-align:right; margin:-4px 0 16px;"><button type="button" class="link" data-action="accModo" data-m="reset">¿Olvidaste tu contraseña?</button></p>
        <button class="btn btn-primary btn-block btn-lg" type="submit">Entrar</button>
        <button class="btn btn-soft btn-block" type="button" data-action="entrarDemo" style="margin-top:10px;">${icon('eye')}Explorar la demo</button>
        <p class="acc-pie">¿No tienes cuenta? <button type="button" class="link" data-action="accModo" data-m="registro">Regístrate</button></p>
    </form>`;
}

export function mostrarAcceso() {
    const el = raiz();
    el.hidden = false;
    el.innerHTML = `<div class="acceso">
        <div class="acc-panel">
            <div class="brand"><img src="logo.svg" alt="">FinanciApp</div>
            <div class="acc-form">${formHTML()}</div>
        </div>
        <aside class="acc-lado">
            <p class="acc-eyebrow">Tu dinero, claro</p>
            <h1>Cuentas, tarjetas, metas y análisis en un solo lugar.</h1>
            <div class="acc-muestra card">
                <small class="muted">Patrimonio neto</small>
                <p class="num acc-num">$66,880<span class="cent">.50</span></p>
                <div class="acc-fila"><span>Ingresos del mes</span><b class="num pos">+$37,000.00</b></div>
                <div class="acc-fila"><span>Gastos del mes</span><b class="num">$21,480.00</b></div>
                <div class="acc-fila"><span>Tasa de ahorro</span><b class="num accent-ink">42%</b></div>
            </div>
        </aside>
    </div>`;
}

export function ocultarAcceso() { const el = raiz(); el.hidden = true; el.innerHTML = ''; }

on('accModo', (el) => { modo = el.dataset.m; mostrarAcceso(); });
on('accLogin', (f) => {
    auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
        .then(() => auth.signInWithEmailAndPassword(f.elements.email.value, f.elements.pass.value))
        .catch(e => toast(error(e), { tipo: 'error' }));
}, 'submit');
on('accRegistro', (f) => {
    nombreRegistro = f.elements.nombre.value.trim();
    auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
        .then(() => auth.createUserWithEmailAndPassword(f.elements.email.value, f.elements.pass.value))
        .catch(e => toast(error(e), { tipo: 'error' }));
}, 'submit');
on('accReset', (f) => {
    auth.sendPasswordResetEmail(f.elements.email.value)
        .then(() => { toast('Te enviamos un correo'); modo = 'login'; mostrarAcceso(); })
        .catch(e => toast(error(e), { tipo: 'error' }));
}, 'submit');

// Pantalla de migración: muestra saldos actuales contra calculados y pide confirmar.
export function mostrarMigracion(resultado, alAceptar) {
    const el = raiz();
    el.hidden = false;
    const { reporte, ok, resumen } = resultado;
    el.innerHTML = `<div class="migracion">
        <div class="brand"><img src="logo.svg" alt="">FinanciApp</div>
        <h1>Bienvenido a la nueva versión</h1>
        <p class="muted">Vamos a crear una <b>copia de prueba</b> de tus datos en el formato nuevo. Tus datos originales no se modifican: la versión publicada sigue funcionando igual.</p>
        <div class="card" style="margin:18px 0;">
            <p class="hint" style="margin-bottom:10px;">${resumen.cuentas} cuentas · ${resumen.transacciones} movimientos · ${resumen.metas} metas · ${resumen.recurrentes} recurrentes</p>
            <table class="tabla-migracion"><thead><tr><th>Cuenta</th><th>Saldo actual</th><th>Calculado</th><th></th></tr></thead><tbody>
            ${reporte.map(r => `<tr><td>${escapeHtml(r.nombre)}</td><td class="num">${money(r.antes)}</td><td class="num">${money(r.despues)}</td><td>${r.ok ? `<span class="pos">${icon('check')}</span>` : `<span class="neg">${icon('x')}</span>`}</td></tr>`).join('')}
            </tbody></table>
            ${resumen.huerfanas ? `<p class="hint" style="margin-top:10px;">${resumen.huerfanas} movimiento(s) pertenecen a cuentas que ya borraste; se conservan en el historial.</p>` : ''}
        </div>
        ${ok ? `<button class="btn btn-primary btn-block btn-lg" data-action="accMigrar">Crear copia y entrar</button>`
             : `<p class="neg" style="margin-bottom:12px;">Algún saldo no cuadra, así que no se guardó nada. Toma una captura de esta pantalla y compártela para revisarlo.</p>`}
        <button class="btn btn-ghost btn-block" data-action="cerrarSesion" style="margin-top:10px;">Salir</button>
    </div>`;
    on('accMigrar', async (b) => { b.disabled = true; b.textContent = 'Creando copia…'; await alAceptar(); });
}
