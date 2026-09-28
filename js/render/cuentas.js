import { state } from '../state.js';
import { bankCardHTML } from '../ui/bank-card.js';
import { icon } from '../utils/icons.js';

export function renderCuentasMaestro() {
    const html = state.cuentas.map(c => bankCardHTML(c, { mostrarAcciones: true })).join('');
    document.getElementById('listaMaestraCuentas').innerHTML = html || `<div class="empty-state">${icon('landmark')}Aún no registras ninguna cuenta.</div>`;
}

export function toggleCamposCuenta() {
    const tipo = document.getElementById('cuTipo').value;
    // Se oculta el contenedor .field completo (no solo el input) para que el
    // campo vecino ocupe el ancho libre.
    const campo = (id) => document.getElementById(id)?.closest('.field');
    const mostrar = (el, visible, display = 'flex') => { if (el) el.style.display = visible ? display : 'none'; };
    mostrar(document.getElementById('grupoDigitos'), tipo !== 'efectivo', 'block');
    mostrar(campo('cuClabe'), tipo === 'debito');
    mostrar(campo('cuLimite'), tipo === 'credito');
    mostrar(document.getElementById('grupoFechas'), tipo === 'credito');
}

export function poblarFormularioCuenta(c) {
    document.getElementById('cuNombre').value = c.nombre || '';
    document.getElementById('cuBanco').value = c.banco || '';
    document.getElementById('cuTipo').value = c.tipo || 'debito';
    document.getElementById('cuSaldo').value = c.saldo || 0;
    document.getElementById('cuDigitos').value = c.digitos || '';
    document.getElementById('cuClabe').value = c.clabe || '';
    document.getElementById('cuLimite').value = c.limite || '';
    document.getElementById('cuPago').value = c.diaPago || '';
    document.getElementById('cuCorte').value = c.diaCorte || '';
    document.getElementById('grupoIcon').style.display = 'block';
    document.getElementById('cuIcon').value = c.icon || '';
    toggleCamposCuenta();
}

export function limpiarFormularioCuenta() {
    document.getElementById('formCuenta').reset();
    document.getElementById('cuentaFormTitle').innerText = 'Registrar cuenta';
    document.getElementById('btnGuardarCuenta').innerText = 'Añadir cuenta';
    document.getElementById('btnCancelarEdicionCuenta').style.display = 'none';
    document.getElementById('grupoIcon').style.display = 'none';
    document.getElementById('cuIcon').value = '';
    toggleCamposCuenta();
}
