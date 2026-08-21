import { state, todasLasCategorias } from '../state.js';
import { money } from '../utils/format.js';

let currentEditId = null;
let currentMovMode = 'pago';

export function getEditId() { return currentEditId; }
export function setEditId(v) { currentEditId = v; }
export function getMovMode() { return currentMovMode; }

export function actualizarSelectsRegistro() {
    const optDeb = state.cuentas.filter(c => c.tipo === 'debito' || c.tipo === 'efectivo').map(c => `<option value="${c.id}">${c.nombre} (${money(c.saldo)})</option>`).join('');
    const optCre = state.cuentas.filter(c => c.tipo === 'credito').map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
    const optAll = state.cuentas.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');

    const inCuenta = document.getElementById('inCuenta'); if (inCuenta) inCuenta.innerHTML = optDeb;
    const gaFuente = document.getElementById('gaFuente'); if (gaFuente) gaFuente.innerHTML = optAll;
    const movOrigen = document.getElementById('movOrigen'); if (movOrigen) movOrigen.innerHTML = optDeb;
    const movDestino = document.getElementById('movDestino'); if (movDestino) movDestino.innerHTML = currentMovMode === 'pago' ? optCre : optDeb;

    const gaCat = document.getElementById('gaCat');
    if (gaCat) gaCat.innerHTML = todasLasCategorias().map(c => `<option value="${c}">${c}</option>`).join('');
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

    if (!currentEditId) {
        document.getElementById('formGasto')?.reset();
        document.getElementById('formIngreso')?.reset();
        document.getElementById('formMovimiento')?.reset();
        if (tipo === 'gasto') { document.getElementById('modalRegTitle').innerText = 'Nuevo Gasto'; handleGaFuenteChange(''); }
        if (tipo === 'ingreso') document.getElementById('modalRegTitle').innerText = 'Nuevo Ingreso';
        if (tipo === 'movimiento') { document.getElementById('modalRegTitle').innerText = 'Nuevo Pago o Traspaso'; setMovMode('pago'); }
        ['inCuenta', 'gaFuente', 'movOrigen', 'movDestino'].forEach(id => { const el = document.getElementById(id); if (el) el.disabled = false; });
    }
    actualizarSelectsRegistro();
}

export function cerrarModalRegistro() {
    document.getElementById('sheetRegistroOverlay').style.display = 'none';
    currentEditId = null;
    ['inCuenta', 'gaFuente', 'movOrigen', 'movDestino'].forEach(id => { const el = document.getElementById(id); if (el) el.disabled = false; });
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
