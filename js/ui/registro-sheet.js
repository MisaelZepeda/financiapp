import { state, todasLasCategorias } from '../state.js';
import { money, escapeHtml } from '../utils/format.js';

let currentEditId = null;
let currentMovMode = 'pago';

export function getEditId() { return currentEditId; }
export function setEditId(v) { currentEditId = v; }
export function getMovMode() { return currentMovMode; }

export function actualizarSelectsRegistro() {
    const optDeb = state.cuentas.filter(c => c.tipo === 'debito' || c.tipo === 'efectivo').map(c => `<option value="${c.id}">${escapeHtml(c.nombre)} (${money(c.saldo)})</option>`).join('');
    const optCre = state.cuentas.filter(c => c.tipo === 'credito').map(c => `<option value="${c.id}">${escapeHtml(c.nombre)}</option>`).join('');
    const optAll = state.cuentas.map(c => `<option value="${c.id}">${escapeHtml(c.nombre)}</option>`).join('');

    const inCuenta = document.getElementById('inCuenta'); if (inCuenta) inCuenta.innerHTML = optDeb;
    const gaFuente = document.getElementById('gaFuente'); if (gaFuente) gaFuente.innerHTML = optAll;
    const movOrigen = document.getElementById('movOrigen'); if (movOrigen) movOrigen.innerHTML = optDeb;
    const movDestino = document.getElementById('movDestino'); if (movDestino) movDestino.innerHTML = currentMovMode === 'pago' ? optCre : optDeb;

    // Rendimiento (débito) o cashback (crédito); efectivo no genera ninguno.
    const reCuenta = document.getElementById('reCuenta');
    if (reCuenta) {
        const previo = reCuenta.value;
        const deb = state.cuentas.filter(c => c.tipo === 'debito').map(c => `<option value="${c.id}">${escapeHtml(c.nombre)}</option>`).join('');
        const cre = state.cuentas.filter(c => c.tipo === 'credito').map(c => `<option value="${c.id}">${escapeHtml(c.nombre)}</option>`).join('');
        reCuenta.innerHTML = (deb ? `<optgroup label="Débito · rendimiento">${deb}</optgroup>` : '') + (cre ? `<optgroup label="Crédito · cashback">${cre}</optgroup>` : '');
        if (previo && reCuenta.querySelector(`option[value="${CSS.escape(previo)}"]`)) reCuenta.value = previo;
        actualizarHintRecompensa();
    }

    const gaCat = document.getElementById('gaCat');
    if (gaCat) gaCat.innerHTML = todasLasCategorias().map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
}

export function handleGaFuenteChange(accountId) {
    const c = state.cuentas.find(x => x.id == accountId);
    const msiContainer = document.getElementById('msiContainer');
    if (!msiContainer) return;
    if (c && c.tipo === 'credito') {
        msiContainer.style.display = 'block';
    } else {
        msiContainer.style.display = 'none';
        document.getElementById('gaIsMSI').checked = false;
        document.getElementById('gaMesesContainer').style.display = 'none';
        document.getElementById('gaMeses').value = '';
    }
}

export function actualizarHintRecompensa() {
    const hint = document.getElementById('reHint');
    const c = state.cuentas.find(x => x.id == document.getElementById('reCuenta')?.value);
    if (!hint) return;
    if (!c) { hint.innerText = 'Agrega una cuenta de débito o crédito para registrar rendimientos o cashback.'; return; }
    hint.innerText = c.tipo === 'credito'
        ? `Cashback: se restará de la deuda de ${c.nombre} (hoy ${money(c.saldo)}).`
        : `Rendimiento: se sumará al saldo de ${c.nombre} (hoy ${money(c.saldo)}).`;
}

export function setMovMode(mode) {
    currentMovMode = mode;
    document.getElementById('btnModoPago').classList.toggle('active', mode === 'pago');
    document.getElementById('btnModoTras').classList.toggle('active', mode !== 'pago');
    document.getElementById('lblDestino').innerText = mode === 'pago' ? 'Destino (Crédito):' : 'Destino (Débito/Efectivo):';
    actualizarSelectsRegistro();
}

export function abrirModalRegistro(tipo) {
    document.getElementById('sheetRegistroOverlay').style.display = 'flex';
    document.getElementById('formGastoContainer').style.display = tipo === 'gasto' ? 'block' : 'none';
    document.getElementById('formIngresoContainer').style.display = tipo === 'ingreso' ? 'block' : 'none';
    document.getElementById('formMovContainer').style.display = tipo === 'movimiento' ? 'block' : 'none';
    document.getElementById('formRecompensaContainer').style.display = tipo === 'recompensa' ? 'block' : 'none';

    if (!currentEditId) {
        document.getElementById('formGasto')?.reset();
        document.getElementById('formIngreso')?.reset();
        document.getElementById('formMovimiento')?.reset();
        document.getElementById('formRecompensa')?.reset();
        if (tipo === 'gasto') { document.getElementById('modalRegTitle').innerText = 'Nuevo gasto'; handleGaFuenteChange(''); }
        if (tipo === 'ingreso') document.getElementById('modalRegTitle').innerText = 'Nuevo ingreso';
        if (tipo === 'movimiento') { document.getElementById('modalRegTitle').innerText = 'Nuevo pago o traspaso'; setMovMode('pago'); }
        if (tipo === 'recompensa') document.getElementById('modalRegTitle').innerText = 'Rendimiento o cashback';
        ['inCuenta', 'gaFuente', 'movOrigen', 'movDestino', 'reCuenta'].forEach(id => { const el = document.getElementById(id); if (el) el.disabled = false; });
    }
    actualizarSelectsRegistro();
}

export function cerrarModalRegistro() {
    document.getElementById('sheetRegistroOverlay').style.display = 'none';
    currentEditId = null;
    ['inCuenta', 'gaFuente', 'movOrigen', 'movDestino', 'reCuenta'].forEach(id => { const el = document.getElementById(id); if (el) el.disabled = false; });
}

// Abre el registro de rendimiento/cashback con la cuenta ya elegida (desde
// el botón de la tarjeta de cuenta).
export function abrirRecompensa(cuentaId) {
    abrirModalRegistro('recompensa');
    const sel = document.getElementById('reCuenta');
    if (sel && cuentaId != null) { sel.value = cuentaId; actualizarHintRecompensa(); }
    setTimeout(() => document.getElementById('reMonto')?.focus(), 50);
}

export function editRecompensa(fid) {
    const t = state.transacciones.find(x => x.firebaseId === fid);
    if (!t) return;
    currentEditId = fid;
    abrirModalRegistro('recompensa');
    document.getElementById('reMonto').value = t.monto;
    document.getElementById('reDesc').value = t.desc;
    const sel = document.getElementById('reCuenta');
    sel.value = t.cuentaId;
    sel.disabled = true;
    actualizarHintRecompensa();
    document.getElementById('modalRegTitle').innerText = t.subtipo === 'cashback' ? 'Editar cashback' : 'Editar rendimiento';
}

export function editIngreso(fid) {
    const t = state.transacciones.find(x => x.firebaseId === fid);
    if (!t) return;
    document.getElementById('inDesc').value = t.desc;
    document.getElementById('inMonto').value = t.monto;
    currentEditId = fid;
    abrirModalRegistro('ingreso');
    document.getElementById('inCuenta').value = t.cuentaId;
    document.getElementById('inCuenta').disabled = true;
    document.getElementById('modalRegTitle').innerText = 'Editando Ingreso';
}

export function editGasto(fid) {
    const t = state.transacciones.find(x => x.firebaseId === fid);
    if (!t) return;
    document.getElementById('gaDesc').value = t.desc;
    document.getElementById('gaMonto').value = t.monto;
    currentEditId = fid;
    abrirModalRegistro('gasto');
    document.getElementById('gaCat').value = t.cat;
    document.getElementById('gaFuente').value = t.cuentaId;
    document.getElementById('gaFuente').disabled = true;
    handleGaFuenteChange(t.cuentaId);
    if (t.isMSI) { document.getElementById('gaIsMSI').checked = true; document.getElementById('gaMesesContainer').style.display = 'block'; document.getElementById('gaMeses').value = t.meses; }
    document.getElementById('modalRegTitle').innerText = 'Editando Gasto';
}

export function editMovimiento(fid) {
    const t = state.transacciones.find(x => x.firebaseId === fid);
    if (!t) return;
    currentEditId = fid;
    setMovMode(t.subtipo || 'traspaso');
    abrirModalRegistro('movimiento');
    document.getElementById('movOrigen').value = t.origenId;
    document.getElementById('movDestino').value = t.destinoId;
    document.getElementById('movMonto').value = t.monto;
    document.getElementById('movOrigen').disabled = true;
    document.getElementById('movDestino').disabled = true;
    document.getElementById('modalRegTitle').innerText = 'Editando Movimiento';
}
