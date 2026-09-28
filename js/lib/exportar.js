// Exportaciones: estado de cuenta mensual en PDF y todos los movimientos en CSV.

import { sel } from '../core/store.js';
import { calcularSaldos, patrimonio } from '../domain/saldos.js';
import { resumenMes } from '../domain/analisis.js';
import { ultimoDiaMes, mesKey, hoyISO } from '../domain/fechas.js';
import { nombreMesAnio } from './format.js';

const TIPO = { gasto: 'Gasto', ingreso: 'Ingreso', transferencia: 'Transferencia' };
const SUB = { pago_tdc: 'Pago TDC', traspaso: 'Traspaso', rendimiento: 'Rendimiento', cashback: 'Cashback' };

function descargar(nombre, contenido, tipo) {
    const url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
    const a = Object.assign(document.createElement('a'), { href: url, download: nombre });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportarCSV() {
    const celda = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const filas = [['Fecha', 'Tipo', 'Subtipo', 'Descripción', 'Categoría', 'Cuenta', 'Cuenta destino', 'Monto', 'MSI']];
    sel.transacciones().forEach(t => filas.push([
        t.fecha, TIPO[t.tipo] || t.tipo, SUB[t.subtipo] || '', t.desc || '',
        t.tipo === 'gasto' ? sel.categoria(t.categoriaId).nombre : '',
        sel.cuenta(t.cuentaId)?.nombre || '', sel.cuenta(t.cuentaDestinoId)?.nombre || '',
        (t.tipo === 'gasto' ? -1 : 1) * t.monto, t.msi || '',
    ]));
    // BOM para que Excel respete los acentos.
    descargar(`FinanciApp_movimientos_${hoyISO()}.csv`, '﻿' + filas.map(f => f.map(celda).join(',')).join('\r\n'), 'text/csv;charset=utf-8');
}

export function exportarRespaldo(datos) {
    descargar(`FinanciApp_respaldo_${hoyISO()}.json`, JSON.stringify({ ...datos, exportadoEn: new Date().toISOString() }, null, 2), 'application/json');
}

// Estado de cuenta del mes `key` ('AAAA-MM'), con saldos al cierre de ese mes.
export async function generarPDF(key = mesKey()) {
    if (!window.jspdf) throw new Error('El generador de PDF aún no carga; intenta de nuevo.');
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait' });
    const limpiar = (t) => (t ? String(t).replace(/[^\x00-\x7F\xC0-\xFF]/g, '').trim() : '');
    const fmt = (n) => '$' + Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const OSCURO = [14, 15, 18], ACENTO = [198, 244, 50], GRIS = [110, 114, 125];
    const VERDE = [21, 128, 61], ROJO = [220, 38, 38];

    const cierre = key === mesKey() ? hoyISO() : ultimoDiaMes(key);
    const cuentas = sel.cuentas();
    const todas = sel.transacciones();
    const saldos = calcularSaldos(cuentas, todas, cierre);
    const p = patrimonio(cuentas, saldos);
    const r = resumenMes(todas, key);
    const txMes = todas.filter(t => t.fecha?.startsWith(key)).slice().reverse();
    const movMes = txMes.filter(t => t.tipo === 'transferencia').reduce((a, t) => a + t.monto, 0);
    const periodo = limpiar(nombreMesAnio(key));
    let y = 52;

    const tarjeta = (x, w, etiqueta, valor, color) => {
        doc.setFillColor(244, 245, 247); doc.roundedRect(x, y, w, 20, 3, 3, 'F');
        doc.setTextColor(...GRIS); doc.setFontSize(8); doc.setFont(undefined, 'normal'); doc.text(etiqueta, x + 4, y + 7);
        doc.setTextColor(...color); doc.setFontSize(13); doc.setFont(undefined, 'bold'); doc.text(valor, x + 4, y + 15);
    };
    const titulo = (t) => { doc.setTextColor(...OSCURO); doc.setFontSize(12); doc.setFont(undefined, 'bold'); doc.text(t, 15, y); y += 4; };

    titulo(`BALANCE AL ${cierre.split('-').reverse().join('/')}`);
    tarjeta(15, 58, 'ACTIVOS', fmt(p.activos), OSCURO);
    tarjeta(76, 58, 'DEUDAS', fmt(p.deudas), OSCURO);
    tarjeta(137, 58, 'PATRIMONIO NETO', fmt(p.neto), p.neto >= 0 ? VERDE : ROJO);
    y += 30;
    titulo(`FLUJO DE ${periodo.toUpperCase()}`);
    tarjeta(15, 58, 'INGRESOS', '+' + fmt(r.ingresos), VERDE);
    tarjeta(76, 58, 'GASTOS', '-' + fmt(r.gastos), ROJO);
    tarjeta(137, 58, 'BALANCE', fmt(r.balance), r.balance >= 0 ? VERDE : ROJO);
    y += 25;
    doc.setFontSize(7.5); doc.setFont(undefined, 'italic'); doc.setTextColor(...GRIS);
    doc.text(`Traspasos y pagos de tarjeta del mes: ${fmt(movMes)}. No cuentan como gasto: solo mueven dinero entre tus cuentas.`, 15, y, { maxWidth: 180 });
    y += 10;

    const cabecera = { fillColor: OSCURO, textColor: [255, 255, 255], fontStyle: 'bold' };
    const tabla = (t, filas, total) => {
        titulo(t);
        const body = filas.length ? filas : [['-', 'Sin cuentas', '']];
        body.push([{ content: 'TOTAL', colSpan: 2, styles: { halign: 'right', fontStyle: 'bold' } }, { content: fmt(total), styles: { fontStyle: 'bold' } }]);
        doc.autoTable({ startY: y, head: [['Cuenta', 'Institución', 'Saldo']], body, theme: 'striped', headStyles: cabecera, styles: { fontSize: 9 }, columnStyles: { 2: { halign: 'right' } }, margin: { top: 45, bottom: 22 } });
        y = doc.lastAutoTable.finalY + 10;
    };
    tabla('CUENTAS DE DÉBITO Y EFECTIVO', cuentas.filter(c => c.tipo !== 'credito').map(c => [limpiar(c.nombre), limpiar(c.banco), fmt(saldos[c.id])]), p.activos);
    tabla('TARJETAS DE CRÉDITO (DEUDA)', cuentas.filter(c => c.tipo === 'credito').map(c => [limpiar(c.nombre), limpiar(c.banco), fmt(saldos[c.id])]), p.deudas);
    if (y > doc.internal.pageSize.height - 50) { doc.addPage(); y = 55; }

    titulo(`MOVIMIENTOS DE ${periodo.toUpperCase()}`);
    const body = txMes.map(t => {
        const cat = t.tipo === 'gasto' ? sel.categoria(t.categoriaId).nombre : (SUB[t.subtipo] || TIPO[t.tipo]);
        const color = t.tipo === 'ingreso' ? VERDE : t.tipo === 'gasto' ? ROJO : GRIS;
        const signo = t.tipo === 'ingreso' ? '+' : t.tipo === 'gasto' ? '-' : '';
        return [t.fecha.split('-').reverse().join('/'), limpiar(cat), limpiar(t.desc) || '-', limpiar(sel.cuenta(t.cuentaId)?.nombre || ''), { content: signo + fmt(t.monto), styles: { textColor: color, fontStyle: 'bold' } }];
    });
    if (!body.length) body.push(['-', 'Sin movimientos', '', '', '']);
    doc.autoTable({ startY: y, head: [['Fecha', 'Categoría', 'Concepto', 'Cuenta', 'Monto']], body, theme: 'grid', headStyles: cabecera, styles: { fontSize: 8 }, columnStyles: { 4: { halign: 'right' } }, margin: { top: 45, bottom: 22 } });

    const nombre = limpiar(sel.perfil().nombre || '');
    const paginas = doc.internal.getNumberOfPages();
    for (let i = 1; i <= paginas; i++) {
        doc.setPage(i);
        doc.setFillColor(...OSCURO); doc.rect(0, 0, 210, 38, 'F');
        doc.setFillColor(...ACENTO); doc.rect(0, 38, 210, 1.5, 'F');
        doc.setTextColor(...ACENTO); doc.setFontSize(9); doc.setFont(undefined, 'bold'); doc.text('FINANCIAPP · ESTADO DE CUENTA', 15, 14);
        doc.setTextColor(255, 255, 255); doc.setFontSize(18); doc.text(nombre.toUpperCase() || 'MIS FINANZAS', 15, 24);
        doc.setFontSize(9); doc.setFont(undefined, 'normal'); doc.text(`Periodo: ${periodo}`, 15, 31);
        const alto = doc.internal.pageSize.height;
        doc.setTextColor(...GRIS); doc.setFontSize(7.5);
        doc.text(`Generado el ${new Date().toLocaleString('es-MX')}`, 15, alto - 8);
        doc.text(`Página ${i} de ${paginas}`, 195, alto - 8, { align: 'right' });
    }
    doc.save(`EstadoCuenta_${key}.pdf`);
}
