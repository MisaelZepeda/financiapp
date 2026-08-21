// Sistema de modales propio (alerta/confirmación/prompt) — mismo comportamiento
// que la versión anterior, solo con la marcación y estilos nuevos.

export function mostrarAlerta(titulo, mensaje, tipo = 'success') {
    const overlay = document.getElementById('cmOverlay');
    const iconWrap = document.getElementById('cmIconWrap');
    const icon = document.getElementById('cmIcon');
    const btns = document.getElementById('cmButtons');

    document.getElementById('cmTitle').innerText = titulo;
    document.getElementById('cmText').innerText = mensaje;
    btns.style.display = 'none';

    if (tipo === 'success') { iconWrap.style.background = 'var(--success)'; icon.innerText = '✔️'; }
    else if (tipo === 'error') { iconWrap.style.background = 'var(--danger)'; icon.innerText = '✖️'; }

    overlay.style.display = 'flex';
    setTimeout(() => { overlay.style.display = 'none'; btns.style.display = 'flex'; }, 1400);
}

export function mostrarConfirmacion(titulo, mensaje, callback) {
    const overlay = document.getElementById('cmOverlay');
    const iconWrap = document.getElementById('cmIconWrap');
    const icon = document.getElementById('cmIcon');
    const btns = document.getElementById('cmButtons');
    const btnConfirm = document.getElementById('cmBtnConfirm');
    const btnCancel = document.getElementById('cmBtnCancel');

    document.getElementById('cmTitle').innerText = titulo;
    document.getElementById('cmText').innerText = mensaje;

    btns.style.display = 'flex';
    btnCancel.style.display = 'block';
    btnCancel.onclick = () => overlay.style.display = 'none';

    btnConfirm.innerText = 'Confirmar';
    btnConfirm.onclick = () => { overlay.style.display = 'none'; callback(); };

    iconWrap.style.background = 'var(--warning)';
    btnConfirm.className = 'btn';
    btnConfirm.style.background = 'var(--warning)';
    btnConfirm.style.color = '#fff';
    icon.innerText = '⚠️';

    overlay.style.display = 'flex';
}

export function mostrarPromptCard(titulo, mensaje, callback) {
    const overlay = document.getElementById('cpOverlay');
    document.getElementById('cpTitle').innerText = titulo;
    document.getElementById('cpText').innerText = mensaje;
    const input = document.getElementById('cpInput');
    input.value = '';

    document.getElementById('cpBtnCancel').onclick = () => overlay.style.display = 'none';
    document.getElementById('cpBtnConfirm').onclick = () => {
        const val = input.value;
        if (val) { overlay.style.display = 'none'; callback(val); }
        else mostrarAlerta('Atención', 'Debes ingresar una cantidad válida.', 'error');
    };
    overlay.style.display = 'flex';
    setTimeout(() => input.focus(), 100);
}

export function cerrarTodosLosModales() {
    ['cmOverlay', 'cpOverlay'].forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
}
