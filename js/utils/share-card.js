import { state } from '../state.js';
import { getBankColorsArray } from './format.js';
import { mostrarAlerta } from '../ui/modals.js';

export function compartirTarjeta(id) {
    const c = state.cuentas.find(x => x.id == id);
    if (!c) return;

    const canvas = document.createElement('canvas');
    canvas.width = 1080; canvas.height = 680;
    const ctx = canvas.getContext('2d');
    const [colA, colB] = getBankColorsArray(c.banco);
    const grad = ctx.createLinearGradient(0, 0, 1080, 680);
    grad.addColorStop(0, colA); grad.addColorStop(1, colB);
    ctx.fillStyle = grad; ctx.fillRect(0, 0, 1080, 680);

    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.beginPath(); ctx.arc(150, -50, 350, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(950, 650, 250, 0, Math.PI * 2); ctx.fill();

    ctx.save();
    ctx.beginPath(); ctx.arc(940, 140, 80, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.restore();

    ctx.fillStyle = colB;
    ctx.font = 'bold 100px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(c.banco.charAt(0).toUpperCase(), 940, 145);

    const muted = 'rgba(255,255,255,0.75)';
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';

    ctx.fillStyle = muted; ctx.font = 'bold 36px sans-serif';
    ctx.fillText('DATOS DE DEPÓSITO', 70, 120);

    ctx.fillStyle = muted; ctx.font = 'bold 24px sans-serif';
    ctx.fillText('INSTITUCIÓN', 70, 230);
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 45px sans-serif';
    ctx.fillText(c.banco.toUpperCase(), 70, 280);

    ctx.fillStyle = muted; ctx.font = 'bold 24px sans-serif';
    ctx.fillText('BENEFICIARIO', 70, 370);
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 45px sans-serif';
    const titular = document.getElementById('perfDisplayNombre')?.innerText || 'Titular';
    ctx.fillText(titular.toUpperCase(), 70, 420);

    ctx.fillStyle = muted; ctx.font = 'bold 24px sans-serif';
    ctx.fillText(c.clabe ? 'CLABE INTERBANCARIA' : 'NÚMERO DE CUENTA / TARJETA', 70, 520);
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 55px monospace';
    const numOriginal = c.clabe || c.digitos || 'No registrado';
    const numFormateado = numOriginal === 'No registrado' ? numOriginal : numOriginal.replace(/(.{4})/g, '$1 ').trim();
    ctx.fillText(numFormateado, 70, 580);

    const dataUrl = canvas.toDataURL('image/png');
    const arr = dataUrl.split(','), mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]); let n = bstr.length; const u8arr = new Uint8Array(n);
    while (n--) u8arr[n] = bstr.charCodeAt(n);
    const file = new File([u8arr], `Datos_${c.banco}.png`, { type: mime });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({ title: `Datos de depósito ${c.banco}`, files: [file] }).catch(() => {});
    } else {
        const a = document.createElement('a');
        a.href = dataUrl; a.download = `Datos_Deposito_${c.banco}.png`; a.click();
        mostrarAlerta('Tarjeta Descargada', 'Revisa tus descargas.', 'success');
    }
}
