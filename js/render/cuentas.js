import { state } from '../state.js';
import { bankCardHTML } from '../ui/bank-card.js';
import { icon } from '../utils/icons.js';

export function renderCuentasMaestro() {
    const html = state.cuentas.map(c => bankCardHTML(c, { mostrarAcciones: true })).join('');
    document.getElementById('listaMaestraCuentas').innerHTML = html || `<div class="empty-state">${icon('landmark')}Aún no registras ninguna cuenta.</div>`;
}

export function toggleCamposCuenta() {
    const tipo = document.getElementById('cuTipo').value;
    const grupoDigitos = document.getElementById('grupoDigitos');
    const cuLimite = document.getElementById('cuLimite');
    const grupoFechas = document.getElementById('grupoFechas');
    const cuClabe = document.getElementById('cuClabe');
    if (tipo === 'efectivo') { grupoDigitos.style.display = 'none'; cuLimite.style.display = 'none'; grupoFechas.style.display = 'none'; cuClabe.style.display = 'none'; }
    else if (tipo === 'debito') { grupoDigitos.style.display = 'block'; cuLimite.style.display = 'none'; grupoFechas.style.display = 'none'; cuClabe.style.display = 'block'; }
    else { grupoDigitos.style.display = 'block'; cuLimite.style.display = 'block'; grupoFechas.style.display = 'grid'; cuClabe.style.display = 'none'; }
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
    document.getElementById('cuentaFormTitle').innerText = 'Registrar Cuenta';
    document.getElementById('btnGuardarCuenta').innerText = 'Añadir Cuenta';
    document.getElementById('btnCancelarEdicionCuenta').style.display = 'none';
    document.getElementById('grupoIcon').style.display = 'none';
    document.getElementById('cuIcon').value = '';
    toggleCamposCuenta();
}
