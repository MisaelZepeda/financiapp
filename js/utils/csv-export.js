import { state } from '../state.js';
import { mostrarAlerta } from '../ui/modals.js';

export function exportarCSV() {
    let csv = 'data:text/csv;charset=utf-8,';
    csv += 'Fecha,Tipo,Categoria o Concepto,Monto,Cuenta ID\n';

    const ordenadas = state.transacciones.slice().sort((a, b) => {
        const dA = new Date(a.fecha || 0), dB = new Date(b.fecha || 0);
        if (dB > dA) return 1; if (dB < dA) return -1;
        return (b.firebaseId > a.firebaseId) ? 1 : -1;
    });

    ordenadas.forEach(t => {
        let tipoDisplay = t.tipo === 'movimiento' ? (t.subtipo === 'pago' ? 'Pago TDC' : 'Traspaso') : t.tipo;
        let detalle = (t.desc || '').replace(/,/g, '');
        if (t.tipo === 'gasto' && t.cat) detalle = `${t.cat} - ${detalle}`;
        csv += `${t.fecha},${tipoDisplay.toUpperCase()},${detalle},${t.monto},${t.cuentaId ?? ''}\n`;
    });

    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csv));
    link.setAttribute('download', `Mis_Finanzas_CSV_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    mostrarAlerta('Exportado', 'Archivo CSV descargado.', 'success');
}
