import { state } from '../state.js';
import { mostrarAlerta } from '../ui/modals.js';

export async function generarPDFMes() {
    if (!window.jspdf) { mostrarAlerta('Cargando...', 'Espera un momento e inténtalo de nuevo.', 'error'); return; }
    const loader = document.getElementById('loader');
    if (loader) loader.style.display = 'flex';
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ putOnlyUsedFonts: true, orientation: 'portrait' });
        const logoDataUrl = await new Promise((resolve) => {
            const img = new Image();
            img.onload = () => { const canvas = document.createElement('canvas'); canvas.width = 100; canvas.height = 100; canvas.getContext('2d').drawImage(img, 0, 0, 100, 100); resolve(canvas.toDataURL('image/png')); };
            img.onerror = () => resolve(null);
            img.src = 'logo.svg';
        });
        const limpiar = (txt) => txt ? txt.replace(/[^\x00-\x7F\xC0-\xFF]/g, '').trim() : '';
        const selectorMes = document.getElementById('mesReporte')?.value;
        let fechaObjetivo = new Date();
        if (selectorMes) { const p = selectorMes.split('-'); fechaObjetivo = new Date(p[0], p[1] - 1, 10); }
        const year = fechaObjetivo.getFullYear();
        const nombreMes = fechaObjetivo.toLocaleString('es-ES', { month: 'long' }).toUpperCase();
        const prefijoMes = `${year}-${(fechaObjetivo.getMonth() + 1).toString().padStart(2, '0')}`;
        const userName = limpiar(document.getElementById('perfDisplayNombre')?.innerText || '');
        const userPhotoBase64 = document.getElementById('perfDisplayFoto')?.src;
        const colorPrimarioHex = getComputedStyle(document.body).getPropertyValue('--primary').trim() || '#7c3aed';
        const hexToRgb = (hex) => { let c = hex.trim().substring(1).split(''); if (c.length === 3) c = [c[0], c[0], c[1], c[1], c[2], c[2]]; c = '0x' + c.join(''); return [(c >> 16) & 255, (c >> 8) & 255, c & 255]; };
        const rgbPrimario = hexToRgb(colorPrimarioHex);

        const txMes = state.transacciones.filter(t => t.fecha && t.fecha.startsWith(prefijoMes));
        let ingMes = 0, gasMes = 0;
        txMes.forEach(t => { if (t.tipo === 'ingreso') ingMes += Number(t.monto || 0); else gasMes += Number(t.monto || 0); });

        let activos = 0, deudas = 0; const cuentasDebito = [], cuentasCredito = [];
        state.cuentas.forEach(c => { if (c.tipo === 'debito' || c.tipo === 'efectivo') { activos += Number(c.saldo || 0); cuentasDebito.push(c); } else { deudas += Number(c.saldo || 0); cuentasCredito.push(c); } });
        const patrimonio = activos - deudas;
        let yPos = 50;

        doc.setTextColor(0); doc.setFontSize(14); doc.setFont(undefined, 'bold'); doc.text('BALANCE GENERAL', 15, yPos); yPos += 5;
        doc.setFillColor(240, 253, 244); doc.roundedRect(15, yPos, 55, 18, 3, 3, 'F'); doc.setTextColor(5, 150, 105); doc.setFontSize(9); doc.text('ACTIVOS (TENGO)', 18, yPos + 6); doc.setFontSize(12); doc.text(`$${activos.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 18, yPos + 14);
        doc.setFillColor(255, 228, 230); doc.roundedRect(75, yPos, 55, 18, 3, 3, 'F'); doc.setTextColor(225, 29, 72); doc.setFontSize(9); doc.text('DEUDAS (DEBO)', 78, yPos + 6); doc.setFontSize(12); doc.text(`$${deudas.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 78, yPos + 14);
        doc.setDrawColor(rgbPrimario[0], rgbPrimario[1], rgbPrimario[2]); doc.setFillColor(255, 255, 255); doc.roundedRect(135, yPos, 60, 18, 3, 3, 'FD'); doc.setTextColor(rgbPrimario[0], rgbPrimario[1], rgbPrimario[2]); doc.setFontSize(9); doc.text('PATRIMONIO TOTAL', 138, yPos + 6); doc.setFontSize(12); doc.text(`$${patrimonio.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 138, yPos + 14); yPos += 22;
        doc.setFillColor(240, 253, 244); doc.roundedRect(15, yPos, 85, 18, 3, 3, 'F'); doc.setTextColor(5, 150, 105); doc.setFontSize(9); doc.text('INGRESOS DEL MES', 18, yPos + 6); doc.setFontSize(14); doc.text(`+ $${ingMes.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 18, yPos + 14);
        doc.setFillColor(255, 228, 230); doc.roundedRect(110, yPos, 85, 18, 3, 3, 'F'); doc.setTextColor(225, 29, 72); doc.setFontSize(9); doc.text('GASTOS Y MOVS DEL MES', 113, yPos + 6); doc.setFontSize(14); doc.text(`- $${gasMes.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 113, yPos + 14); yPos += 28;

        const crearTablaCuentas = (titulo, datos, totalSaldos, startY) => {
            doc.setTextColor(0); doc.setFontSize(13); doc.setFont(undefined, 'bold'); doc.text(titulo, 15, startY);
            const body = datos.map(c => [limpiar(c.nombre) || 'Cuenta', limpiar(c.banco || 'N/A').toUpperCase(), `$${Number(c.saldo || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`]);
            if (body.length === 0) body.push(['-', 'NO HAY CUENTAS', '$0.00']);
            body.push([{ content: 'TOTAL', colSpan: 2, styles: { halign: 'right', fontStyle: 'bold', fillColor: [240, 240, 240] } }, { content: `$${totalSaldos.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }]);
            doc.autoTable({ startY: startY + 4, head: [['Cuenta', 'Institución', 'Saldo']], body, theme: 'striped', headStyles: { fillColor: rgbPrimario, textColor: [255, 255, 255], fontStyle: 'bold' }, styles: { valign: 'middle', fontSize: 9 }, columnStyles: { 2: { halign: 'right', fontStyle: 'bold' } }, margin: { top: 45, bottom: 25 } });
            return doc.lastAutoTable.finalY + 12;
        };
        yPos = crearTablaCuentas('CUENTAS DE DÉBITO Y EFECTIVO (ACTIVOS)', cuentasDebito, activos, yPos);
        yPos = crearTablaCuentas('CUENTAS DE CRÉDITO Y TDC (DEUDAS)', cuentasCredito, deudas, yPos);
        if (yPos > doc.internal.pageSize.height - 40) { doc.addPage(); yPos = 55; }

        doc.setTextColor(0); doc.setFontSize(13); doc.setFont(undefined, 'bold'); doc.text(`DETALLE DE MOVIMIENTOS - ${nombreMes}`, 15, yPos);
        const bodyMovs = txMes.map(t => {
            let catDisplay = limpiar(t.cat || 'Ingreso');
            if (t.tipo === 'movimiento') catDisplay = t.subtipo === 'pago' ? 'PAGO TDC' : 'TRASPASO';
            const esIngreso = t.tipo === 'ingreso';
            return [t.fecha, catDisplay.toUpperCase(), limpiar(t.desc) || 'Sin detalle', { content: `${esIngreso ? '+' : '-'} $${Number(t.monto || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, styles: { textColor: esIngreso ? [5, 150, 105] : [225, 29, 72], fontStyle: 'bold' } }];
        });
        if (bodyMovs.length === 0) bodyMovs.push(['-', 'SIN MOVIMIENTOS ESTE MES', '-', '$0.00']);
        bodyMovs.push([{ content: 'BALANCE DEL MES (INGRESOS - GASTOS)', colSpan: 3, styles: { halign: 'right', fontStyle: 'bold', fillColor: [240, 240, 240] } }, { content: `$${(ingMes - gasMes).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }]);
        doc.autoTable({ startY: yPos + 4, head: [['Fecha', 'Categoría', 'Concepto', 'Monto']], body: bodyMovs, theme: 'grid', headStyles: { fillColor: rgbPrimario, textColor: [255, 255, 255], fontStyle: 'bold' }, styles: { valign: 'middle', fontSize: 8 }, columnStyles: { 3: { halign: 'right' } }, margin: { top: 45, bottom: 25 } });

        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFillColor(rgbPrimario[0], rgbPrimario[1], rgbPrimario[2]); doc.rect(0, 0, 210, 40, 'F');
            doc.setTextColor(255, 255, 255); doc.setFontSize(10); doc.setFont(undefined, 'normal'); doc.text('ESTADO DE CUENTA MÓVIL', 45, 15);
            doc.setFontSize(20); doc.setFont(undefined, 'bold'); doc.text(userName.toUpperCase(), 45, 23);
            doc.setFontSize(10); doc.setFont(undefined, 'normal'); doc.text(`Período reportado: ${nombreMes} ${year}`, 45, 30);
            if (logoDataUrl) doc.addImage(logoDataUrl, 'PNG', 15, 10, 20, 20);
            if (i === 1) { try { if (userPhotoBase64 && userPhotoBase64.startsWith('data:image')) doc.addImage(userPhotoBase64, 'JPEG', 170, 8, 24, 24, 'perfil', 'FAST'); } catch (e) {} }
            const pageHeight = doc.internal.pageSize.height;
            doc.setFillColor(rgbPrimario[0], rgbPrimario[1], rgbPrimario[2]); doc.rect(0, pageHeight - 15, 210, 15, 'F');
            doc.setTextColor(255, 255, 255); doc.setFontSize(8);
            doc.text(`Generado el ${new Date().toLocaleDateString()} a las ${new Date().toLocaleTimeString()}`, 15, pageHeight - 6);
            doc.text(`Página ${i} de ${pageCount}`, 195, pageHeight - 6, { align: 'right' });
        }
        doc.save(`EstadoCuenta_${limpiar(nombreMes)}_${year}.pdf`);
    } catch (error) {
        mostrarAlerta('Error', 'Problema al generar el reporte.', 'error');
    } finally {
        if (loader) loader.style.display = 'none';
    }
}
