// Interpreta lo que se le dicta a Siri ("llamar al dentista mañana a las 5")
// y saca título, fecha y hora. Autocontenido (sin imports): el Worker de avisos
// usa una copia exacta de este archivo (push-worker/src/tlacuilo-dictado.js en Morralla).

const DIAS_SEMANA = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const NUMEROS = { una: 1, uno: 1, un: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12 };

const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const deISO = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 12); };
const masDias = (s, n) => { const d = deISO(s); d.setDate(d.getDate() + n); return iso(d); };
const sinAcentos = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '');
const num = (t) => (/^\d+$/.test(t) ? Number(t) : NUMEROS[t]);

// texto: lo dictado. hoy: 'AAAA-MM-DD' local. ahora: 'HH:MM' local (para no programar en el pasado).
export function interpretarPendiente(texto, hoy, ahora = '00:00') {
    // NFC: así quitar acentos no cambia la longitud y las posiciones coinciden con el original.
    let t = ` ${String(texto || '').normalize('NFC').trim()} `;
    let fecha = null, hora = null;
    // Se busca sobre una versión sin acentos y en minúsculas, y se recorta lo mismo del original.
    const quitar = (re, fn) => {
        const base = sinAcentos(t).toLowerCase();
        const m = base.match(re);
        if (!m) return false;
        fn(m);
        t = `${t.slice(0, m.index)} ${t.slice(m.index + m[0].length)}`;
        return true;
    };

    // ----- Hora -----
    quitar(/\b(?:a\s+las?|a\s+la)\s+(\d{1,2}|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce)(?:(?::|\s+y\s+)(\d{2}|media|cuarto))?(?:\s+(de\s+la\s+manana|de\s+la\s+tarde|de\s+la\s+noche|am|pm|a\.?\s?m\.?|p\.?\s?m\.?))?\b/, (m) => {
        let h = num(m[1]);
        const min = m[2] === 'media' ? 30 : m[2] === 'cuarto' ? 15 : m[2] ? Number(m[2]) : 0;
        const parte = (m[3] || '').replace(/[\s.]/g, '');
        if (/tarde|noche|pm/.test(parte) && h < 12) h += 12;
        else if (/manana|am/.test(parte) && h === 12) h = 0;
        else if (!parte && h >= 1 && h <= 7) h += 12;   // "a las 5" casi siempre es de la tarde
        if (h >= 0 && h < 24 && min < 60) hora = `${pad(h)}:${pad(min)}`;
    }) || quitar(/\b(?:a\s+)?(?:las\s+)?(\d{1,2}):(\d{2})\b/, (m) => { const h = Number(m[1]); if (h < 24) hora = `${pad(h)}:${m[2]}`; })
      || quitar(/\b(?:al?\s+)?medio\s?dia\b/, () => { hora = '12:00'; });

    // ----- Fecha -----
    quitar(/\bpasado\s+manana\b/, () => { fecha = masDias(hoy, 2); })
    || quitar(/\bmanana\b(?!\s+(?:en|por)\s+la)/, () => { fecha = masDias(hoy, 1); })
    || quitar(/\b(?:para\s+)?hoy\b/, () => { fecha = hoy; })
    || quitar(/\ben\s+(\d+|un|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s+(dias?|semanas?)\b/, (m) => { fecha = masDias(hoy, num(m[1]) * (m[2].startsWith('semana') ? 7 : 1)); })
    || quitar(/\b(?:la\s+)?(?:proxima|siguiente)\s+semana\b/, () => { const dow = deISO(hoy).getDay(); fecha = masDias(hoy, ((8 - dow) % 7) || 7); })
    || quitar(/\b(?:el\s+)?(?:(proximo|siguiente)\s+)?(domingo|lunes|martes|miercoles|jueves|viernes|sabado)(?:\s+que\s+viene)?\b/, (m) => {
        const objetivo = DIAS_SEMANA.indexOf(m[2]);
        let dif = (objetivo - deISO(hoy).getDay() + 7) % 7;
        if (dif === 0 && m[1]) dif = 7;
        fecha = masDias(hoy, dif);
    })
    || quitar(/\b(?:el\s+)?(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\b/, (m) => {
        const d = Number(m[1]), mes = MESES.indexOf(m[2]);
        let y = deISO(hoy).getFullYear();
        let f = `${y}-${pad(mes + 1)}-${pad(d)}`;
        if (f < hoy) f = `${y + 1}-${pad(mes + 1)}-${pad(d)}`;
        if (d >= 1 && d <= 31) fecha = f;
    })
    || quitar(/\bel\s+(?:dia\s+)?(\d{1,2})\b/, (m) => {
        const d = Number(m[1]);
        if (d < 1 || d > 31) return;
        const [y, mm] = hoy.split('-').map(Number);
        let f = `${y}-${pad(mm)}-${pad(d)}`;
        if (f < hoy) { const sig = new Date(y, mm, 1); f = `${sig.getFullYear()}-${pad(sig.getMonth() + 1)}-${pad(d)}`; }
        fecha = f;
    });

    // Con hora pero sin fecha: hoy, o mañana si esa hora ya pasó.
    if (hora && !fecha) fecha = hora > ahora ? hoy : masDias(hoy, 1);

    // ----- Título -----
    let titulo = t.replace(/\s+/g, ' ').trim()
        .replace(/^(?:(?:recuerdame|recuérdame|recordarme|recordar|tengo\s+que|hay\s+que|pendiente|agrega|agregar|anota|anotar)\s+)+/i, '')
        .replace(/^(?:que|de)\s+/i, '')
        .replace(/[\s,.;:]+$/, '').replace(/^[\s,.;:]+/, '');
    if (!titulo) return null;
    titulo = titulo.charAt(0).toUpperCase() + titulo.slice(1);
    return { titulo: titulo.slice(0, 120), fecha, hora };
}

// Texto para que Siri lo diga: "mañana a las 17:00", "el viernes 14 de noviembre".
export function describirCuando(fecha, hora, hoy) {
    if (!fecha) return '';
    let dia;
    if (fecha === hoy) dia = 'hoy';
    else if (fecha === masDias(hoy, 1)) dia = 'mañana';
    else {
        const d = deISO(fecha);
        const semana = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'][d.getDay()];
        dia = `el ${semana} ${d.getDate()} de ${MESES[d.getMonth()]}`;
    }
    return hora ? `${dia} a las ${hora}` : dia;
}
