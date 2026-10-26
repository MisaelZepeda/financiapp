// Tlaco, la mascota: una moneda de cobre con siete expresiones.
// tlacoSVG(estado, { tamano }) → SVG en texto (sin datos del usuario).

const CUERPO = (dy = 0) => `
    <circle cx="100" cy="${112 + dy}" r="82" fill="#a9552a"/><circle cx="100" cy="${112 + dy}" r="74" fill="#d9773a"/>
    <circle cx="100" cy="${112 + dy}" r="62" fill="none" stroke="#c4662f" stroke-width="3"/>
    <path d="M48 ${82 + dy} a62 62 0 0 1 38 -30" stroke="#f4b27a" stroke-width="7" fill="none" stroke-linecap="round" opacity="0.7"/>`;
const PIES = '<ellipse cx="78" cy="206" rx="15" ry="9" fill="#a9552a"/><ellipse cx="122" cy="206" rx="15" ry="9" fill="#a9552a"/>';
const SOMBRA = '<ellipse class="tlaco-sombra" cx="100" cy="218" rx="50" ry="8" fill="#000" opacity="0.25"/>';
const brazo = (d) => `<path d="${d}" stroke="#a9552a" stroke-width="11" fill="none" stroke-linecap="round"/>`;
const MEJILLAS = (op = 0.55) => `<ellipse cx="62" cy="134" rx="10" ry="6.5" fill="#f29c7a" opacity="${op}"/><ellipse cx="138" cy="134" rx="10" ry="6.5" fill="#f29c7a" opacity="${op}"/>`;
const OJOS = (ry = 11, dy = 0) => `<g class="tlaco-ojos"><ellipse cx="78" cy="${106 + dy}" rx="8" ry="${ry}" fill="#3a1f0e"/><ellipse cx="122" cy="${106 + dy}" rx="8" ry="${ry}" fill="#3a1f0e"/>
    <circle cx="81" cy="${101 + dy}" r="3" fill="#fff"/><circle cx="125" cy="${101 + dy}" r="3" fill="#fff"/></g>`;
const BOCA_ABIERTA = '<path d="M78 130 q22 30 44 0 z" fill="#3a1f0e"/><path d="M90 143 q10 7 20 0 q-10 -6 -20 0z" fill="#e5675a"/>';
const GOTA = (x, y) => `<path d="M${x} ${y} q9 13 0 20 q-9 -7 0 -20z" fill="#8ec9f0"/>`;

const CARAS = {
    celebrando: () => `
        <path class="tlaco-brillo" d="M36 44 l4 9 9 4 -9 4 -4 9 -4 -9 -9 -4 9 -4z" fill="#f2b544"/>
        <path class="tlaco-brillo" d="M168 30 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3z" fill="#f2b544"/>
        <rect x="18" y="96" width="8" height="4" rx="1" fill="#6fd3a0" transform="rotate(30 22 98)"/>
        <rect x="150" y="12" width="8" height="4" rx="1" fill="#ff7a6b" transform="rotate(-20 154 14)"/>
        <rect x="58" y="14" width="7" height="4" rx="1" fill="#7cc4ff" transform="rotate(15 61 16)"/>
        ${PIES}${brazo('M30 98 q-20 -16 -10 -42')}${brazo('M170 98 q20 -16 10 -42')}${CUERPO()}${MEJILLAS(0.6)}
        <path d="M67 108 q11 -13 22 0" stroke="#3a1f0e" stroke-width="5.5" fill="none" stroke-linecap="round"/>
        <path d="M111 108 q11 -13 22 0" stroke="#3a1f0e" stroke-width="5.5" fill="none" stroke-linecap="round"/>
        <path d="M74 126 q26 38 52 0 z" fill="#3a1f0e"/><path d="M88 142 q12 10 24 0 q-12 -7 -24 0z" fill="#e5675a"/>`,
    contento: () => `${PIES}${brazo('M26 120 q-16 14 -6 34')}<g class="tlaco-saludo">${brazo('M174 120 q20 -6 22 -30')}</g>${CUERPO()}${MEJILLAS()}${OJOS()}${BOCA_ABIERTA}`,
    tranquilo: () => `${PIES}${brazo('M26 120 q-16 14 -6 34')}${brazo('M174 120 q16 14 6 34')}${CUERPO()}${MEJILLAS(0.45)}${OJOS(9, 2)}
        <path d="M84 134 q16 12 32 0" stroke="#3a1f0e" stroke-width="5" fill="none" stroke-linecap="round"/>`,
    preocupado: () => `${PIES}${brazo('M26 120 q-16 14 -6 34')}${brazo('M174 120 q-4 26 -26 30')}${CUERPO()}${GOTA(162, 62)}
        <path d="M63 91 l22 -8" stroke="#3a1f0e" stroke-width="5" fill="none" stroke-linecap="round"/>
        <path d="M137 91 l-22 -8" stroke="#3a1f0e" stroke-width="5" fill="none" stroke-linecap="round"/>
        ${OJOS(10, 3)}
        <path d="M80 140 q10 -8 20 0 q10 8 20 0" stroke="#3a1f0e" stroke-width="5" fill="none" stroke-linecap="round"/>`,
    triste: () => `${PIES}${brazo('M28 124 q-10 18 2 36')}${brazo('M172 124 q10 18 -2 36')}${CUERPO(2)}
        <path d="M62 96 l22 -9" stroke="#3a1f0e" stroke-width="5" fill="none" stroke-linecap="round"/>
        <path d="M138 96 l-22 -9" stroke="#3a1f0e" stroke-width="5" fill="none" stroke-linecap="round"/>
        <g class="tlaco-ojos"><ellipse cx="78" cy="114" rx="7" ry="8" fill="#3a1f0e"/><ellipse cx="122" cy="114" rx="7" ry="8" fill="#3a1f0e"/>
        <circle cx="79" cy="117" r="2.3" fill="#fff"/><circle cx="123" cy="117" r="2.3" fill="#fff"/></g>
        ${GOTA(70, 124)}
        <path d="M82 150 q18 -16 36 0" stroke="#3a1f0e" stroke-width="5" fill="none" stroke-linecap="round"/>`,
    sorprendido: () => `${PIES}${brazo('M30 112 q-22 -6 -20 -34')}${brazo('M170 112 q22 -6 20 -34')}${CUERPO()}${MEJILLAS(0.5)}
        <path d="M64 82 q14 -12 28 -2" stroke="#3a1f0e" stroke-width="5" fill="none" stroke-linecap="round"/>
        <path d="M136 82 q-14 -12 -28 -2" stroke="#3a1f0e" stroke-width="5" fill="none" stroke-linecap="round"/>
        <g class="tlaco-ojos"><circle cx="78" cy="106" r="12" fill="#fff"/><circle cx="122" cy="106" r="12" fill="#fff"/>
        <circle cx="78" cy="107" r="6.5" fill="#3a1f0e"/><circle cx="122" cy="107" r="6.5" fill="#3a1f0e"/></g>
        <ellipse cx="100" cy="142" rx="10" ry="13" fill="#3a1f0e"/>`,
    dormido: () => `${PIES}${brazo('M26 124 q-14 14 -4 32')}${brazo('M174 124 q14 14 4 32')}${CUERPO(2)}${MEJILLAS(0.4)}
        <path d="M66 112 q12 9 24 0" stroke="#3a1f0e" stroke-width="5" fill="none" stroke-linecap="round"/>
        <path d="M110 112 q12 9 24 0" stroke="#3a1f0e" stroke-width="5" fill="none" stroke-linecap="round"/>
        <ellipse cx="100" cy="140" rx="7" ry="5" fill="#3a1f0e"/>
        <g class="tlaco-zzz" fill="#f2b544" font-family="Bricolage Grotesque, Inter, sans-serif" font-weight="700">
            <text x="136" y="62" font-size="26">Z</text><text x="158" y="40" font-size="19">z</text><text x="174" y="22" font-size="14">z</text></g>`,
};

export const NOMBRE_ESTADO = { celebrando: 'celebrando', contento: 'contento', tranquilo: 'tranquilo', preocupado: 'preocupado', triste: 'triste', sorprendido: 'sorprendido', dormido: 'dormido' };

export function tlacoSVG(estado = 'tranquilo', { tamano = 96, animado = true } = {}) {
    const cara = (CARAS[estado] || CARAS.tranquilo)();
    const alto = Math.round(tamano * 1.15);
    return `<svg class="tlaco ${animado ? 'tlaco-animado' : ''} tlaco-${estado}" width="${tamano}" height="${alto}" viewBox="0 0 200 230" role="img" aria-label="Tlaco ${NOMBRE_ESTADO[estado] || ''}">${SOMBRA}<g class="tlaco-cuerpo">${cara}</g></svg>`;
}
