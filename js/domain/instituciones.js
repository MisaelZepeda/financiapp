// Biblioteca de instituciones financieras (México): nombre, color de marca y dominio
// (o `logo`) para su logo. Las cuentas guardan `institucion` (id) y, si quieres otro tono,
// `color`. Las cuentas viejas se reconocen por el texto de `banco`.

// grupo: banco | fintech | tienda | inversion | otro (secciones del selector).
const WM = 'https://upload.wikimedia.org/wikipedia/commons/thumb';
export const INSTITUCIONES = [
    // Bancos
    { id: 'afirme', nombre: 'Afirme', grupo: 'banco', color: '#00843d', dominio: 'www.afirme.com', alias: ['afirme'] },
    { id: 'amex', nombre: 'American Express', grupo: 'banco', color: '#2e77bc', dominio: 'americanexpress.com', alias: ['amex', 'american express'] },
    { id: 'azteca', nombre: 'Banco Azteca', grupo: 'banco', color: '#00965e', dominio: 'bancoazteca.com.mx', alias: ['azteca'] },
    { id: 'base', nombre: 'Banco Base', grupo: 'banco', color: '#00205b', dominio: 'bancobase.com', alias: ['banco base'] },
    { id: 'bienestar', nombre: 'Banco del Bienestar', grupo: 'banco', color: '#1e7b4b', dominio: 'bancodelbienestar.gob.mx', alias: ['bienestar', 'babien'],
        logo: `${WM}/4/46/Logo_Banco_del_Bienestar.png/330px-Logo_Banco_del_Bienestar.png` },
    { id: 'banamex', nombre: 'Banamex', grupo: 'banco', color: '#0b4ea2', dominio: 'banamex.com', alias: ['banamex', 'citibanamex', 'citi'] },
    { id: 'bajio', nombre: 'BanBajío', grupo: 'banco', color: '#5c2d91', dominio: 'bb.com.mx', alias: ['bajio', 'banbajio'] },
    { id: 'bancoppel', nombre: 'BanCoppel', grupo: 'banco', color: '#0057a8', dominio: 'bancoppel.com', alias: ['bancoppel'] },
    { id: 'banorte', nombre: 'Banorte', grupo: 'banco', color: '#eb0029', dominio: 'banorte.com', alias: ['banorte'] },
    { id: 'banregio', nombre: 'Banregio', grupo: 'banco', color: '#f37021', dominio: 'banregio.com', alias: ['banregio'] },
    { id: 'bbva', nombre: 'BBVA', grupo: 'banco', color: '#004481', dominio: 'bbva.mx', alias: ['bbva', 'bancomer'] },
    { id: 'cpm', nombre: 'Caja Popular Mexicana', grupo: 'banco', color: '#00539b', dominio: 'cpm.coop', alias: ['caja popular', 'cpm'] },
    { id: 'compartamos', nombre: 'Compartamos Banco', grupo: 'banco', color: '#c8102e', dominio: 'compartamos.com.mx', alias: ['compartamos'] },
    { id: 'hsbc', nombre: 'HSBC', grupo: 'banco', color: '#db0011', dominio: 'hsbc.com.mx', alias: ['hsbc'] },
    { id: 'inbursa', nombre: 'Inbursa', grupo: 'banco', color: '#003b71', dominio: 'www.inbursa.com', alias: ['inbursa'] },
    { id: 'invex', nombre: 'Invex', grupo: 'banco', color: '#002f6c', dominio: 'invex.com', alias: ['invex'] },
    { id: 'mifel', nombre: 'Mifel', grupo: 'banco', color: '#002d62', dominio: 'mifel.com.mx', alias: ['mifel'] },
    { id: 'multiva', nombre: 'Multiva', grupo: 'banco', color: '#0f2a5f', dominio: 'multiva.com.mx', alias: ['multiva'] },
    { id: 'santander', nombre: 'Santander', grupo: 'banco', color: '#ec0000', dominio: 'santander.com.mx', alias: ['santander'] },
    { id: 'scotiabank', nombre: 'Scotiabank', grupo: 'banco', color: '#ec111a', dominio: 'scotiabank.com.mx', alias: ['scotiabank', 'scotia'] },
    // Apps, bancos digitales y fintech
    { id: 'albo', nombre: 'albo', grupo: 'fintech', color: '#00c389', dominio: 'albo.mx', alias: ['albo'] },
    { id: 'aplazo', nombre: 'Aplazo', grupo: 'fintech', color: '#1f2a55', dominio: 'aplazo.mx', alias: ['aplazo'] },
    { id: 'baubap', nombre: 'Baubap', grupo: 'fintech', color: '#00b39b', dominio: 'baubap.com', alias: ['baubap'] },
    { id: 'bitso', nombre: 'Bitso', grupo: 'fintech', color: '#00c28c', dominio: 'bitso.com', alias: ['bitso'] },
    { id: 'cashi', nombre: 'Cashi', grupo: 'fintech', color: '#ff5f1f', dominio: 'cashi.com.mx', alias: ['cashi'] },
    { id: 'clip', nombre: 'Clip', grupo: 'fintech', color: '#fc4c02', dominio: 'clip.mx', alias: ['clip'] },
    { id: 'cuenca', nombre: 'Cuenca', grupo: 'fintech', color: '#1c1c1c', dominio: 'cuenca.com', alias: ['cuenca'] },
    { id: 'didiprestamos', nombre: 'DiDi Préstamos', grupo: 'fintech', color: '#fc4c02', dominio: 'didiglobal.com', alias: ['didi prestamos', 'didi dinero', 'didi cuenta'] },
    { id: 'didi', nombre: 'DiDi Card', grupo: 'fintech', color: '#fc4c02', dominio: 'didiglobal.com', alias: ['didi card', 'didi'] },
    { id: 'finsus', nombre: 'Finsus', grupo: 'fintech', color: '#00a19a', dominio: 'finsus.mx', alias: ['finsus'] },
    { id: 'flink', nombre: 'Flink', grupo: 'fintech', color: '#5b2be0', dominio: 'flink.com.mx', alias: ['flink'] },
    { id: 'fondeadora', nombre: 'Fondeadora', grupo: 'fintech', color: '#ffc700', dominio: 'fondeadora.com', alias: ['fondeadora'] },
    { id: 'hey', nombre: 'Hey Banco', grupo: 'fintech', color: '#1d1d1b', dominio: 'heybanco.com', alias: ['hey'],
        logo: `${WM}/5/5a/Hey_Banco.svg/330px-Hey_Banco.svg.png` },
    { id: 'kapital', nombre: 'Kapital', grupo: 'fintech', color: '#111111', dominio: 'kapital.mx', alias: ['kapital'] },
    { id: 'klar', nombre: 'Klar', grupo: 'fintech', color: '#111111', dominio: 'klar.mx', alias: ['klar'] },
    { id: 'konfio', nombre: 'Konfío', grupo: 'fintech', color: '#00b2a9', dominio: 'konfio.mx', alias: ['konfio'] },
    { id: 'kueski', nombre: 'Kueski', grupo: 'fintech', color: '#1d4ed8', dominio: 'kueski.com', alias: ['kueski', 'kueski pay'] },
    { id: 'mercadopago', nombre: 'Mercado Pago', grupo: 'fintech', color: '#00b1ea', dominio: 'mercadopago.com.mx', alias: ['mercado pago', 'mercadopago', 'mercado credito', 'mp'] },
    { id: 'nu', nombre: 'Nu', grupo: 'fintech', color: '#820ad1', dominio: 'nu.com.mx', alias: ['nu', 'nubank'] },
    { id: 'openbank', nombre: 'Openbank', grupo: 'fintech', color: '#e50014', dominio: 'openbank.mx', alias: ['openbank', 'open bank', 'open'] },
    { id: 'paypal', nombre: 'PayPal', grupo: 'fintech', color: '#003087', dominio: 'paypal.com', alias: ['paypal'] },
    { id: 'plata', nombre: 'Plata', grupo: 'fintech', color: '#ff6b13', dominio: 'platacard.mx', alias: ['plata', 'platacard', 'plata card'] },
    { id: 'rappi', nombre: 'RappiCard', grupo: 'fintech', color: '#ff441f', dominio: 'rappicard.mx', alias: ['rappi', 'rappicard'] },
    { id: 'revolut', nombre: 'Revolut', grupo: 'fintech', color: '#191c1f', dominio: 'revolut.com', alias: ['revolut'] },
    { id: 'spin', nombre: 'Spin by OXXO', grupo: 'fintech', color: '#e30613', dominio: 'www.spinbyoxxo.com.mx', alias: ['spin', 'oxxo'] },
    { id: 'stori', nombre: 'Stori', grupo: 'fintech', color: '#00a19a', dominio: 'storicard.com', alias: ['stori'] },
    { id: 'tala', nombre: 'Tala', grupo: 'fintech', color: '#00a0af', dominio: 'tala.co', alias: ['tala'] },
    { id: 'uala', nombre: 'Ualá', grupo: 'fintech', color: '#3e4cf5', dominio: 'uala.mx', alias: ['uala', 'ualá'] },
    { id: 'vexi', nombre: 'Vexi', grupo: 'fintech', color: '#6c2bd9', dominio: 'vexi.mx', alias: ['vexi'] },
    // Tiendas
    { id: 'coppel', nombre: 'Coppel', grupo: 'tienda', color: '#ffd100', dominio: 'coppel.com', alias: ['coppel'] },
    { id: 'palacio', nombre: 'El Palacio de Hierro', grupo: 'tienda', color: '#1a1a1a', dominio: 'elpalaciodehierro.com', alias: ['palacio'] },
    { id: 'liverpool', nombre: 'Liverpool', grupo: 'tienda', color: '#e10098', dominio: 'liverpool.com.mx', alias: ['liverpool'] },
    { id: 'walmart', nombre: 'Walmart', grupo: 'tienda', color: '#0071ce', dominio: 'walmart.com.mx', alias: ['walmart'] },
    // Inversión
    { id: 'cetes', nombre: 'Cetesdirecto', grupo: 'inversion', color: '#0f5132', dominio: 'cetesdirecto.com', alias: ['cetes'] },
    { id: 'gbm', nombre: 'GBM', grupo: 'inversion', color: '#000000', dominio: 'gbm.com', alias: ['gbm'] },
    { id: 'hapi', nombre: 'Hapi', grupo: 'inversion', color: '#5b2be0', dominio: 'hapi.trade', alias: ['hapi'] },
    { id: 'kubo', nombre: 'Kubo Financiero', grupo: 'inversion', color: '#0090d4', dominio: 'kubofinanciero.com', alias: ['kubo'] },
    // Sin institución
    { id: 'alcancia', nombre: 'Alcancía', grupo: 'otro', color: '#ec8aa3', dominio: null, alias: ['alcancia', 'cochinito', 'puerquito'], logo: 'logos/alcancia.svg' },   // ícono propio de Morralla
    { id: 'efectivo', nombre: 'Efectivo', grupo: 'otro', color: '#3f9d5a', dominio: null, alias: ['efectivo', 'cartera'], logo: 'logos/efectivo.svg' },   // ícono propio de Morralla
];

export const GRUPOS_INSTITUCION = [['banco', 'Bancos'], ['fintech', 'Apps y fintech'], ['tienda', 'Tiendas'], ['inversion', 'Inversión'], ['otro', 'Otros']];

// Colores para elegir a mano (además del de la institución).
export const COLORES_CUENTA = ['#004481', '#0b4ea2', '#00b1ea', '#00965e', '#1e7b4b', '#3f9d5a', '#ffc700', '#ff6b13', '#ec0000', '#e10098', '#820ad1', '#5c2d91', '#1d1d1b', '#6b7280', '#a3a3a3'];

const norm = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export const institucionPorId = (id) => INSTITUCIONES.find(i => i.id === id) || null;

// La institución de una cuenta: la elegida, o la que coincida con su texto de banco.
export function institucionDe(cuenta) {
    if (!cuenta) return null;
    if (cuenta.institucion) return institucionPorId(cuenta.institucion);
    if (cuenta.alcancia) return institucionPorId('alcancia');   // la alcancía de morralla
    if (cuenta.tipo === 'efectivo' && !cuenta.banco) return institucionPorId('efectivo');
    const b = norm(cuenta.banco);
    if (!b) return null;
    // Primero coincidencia exacta; luego por palabra (para "Nu" no confundir con "Nuevo").
    return INSTITUCIONES.find(i => i.alias.some(a => norm(a) === b))
        || INSTITUCIONES.find(i => i.alias.some(a => a.length > 2 && b.includes(norm(a))))
        || INSTITUCIONES.find(i => i.alias.some(a => b.split(/[^a-z0-9]+/).includes(norm(a))))
        || null;
}

// Color de la cuenta: el elegido, el de su institución o uno neutro.
export function colorDeCuenta(cuenta) {
    return cuenta?.color || institucionDe(cuenta)?.color || '#14b8a6';
}

// Logo de la institución: uno propio de la biblioteca (Wikimedia Commons, para las que el
// servicio de íconos no tiene) o el ícono de su sitio. Si falla, se ve la inicial.
export function logoDeInstitucion(inst, tam = 128) {
    if (inst?.logo) return inst.logo;
    return inst?.dominio ? `https://www.google.com/s2/favicons?domain=${inst.dominio}&sz=${tam}` : null;
}

// Búsqueda para el selector (nombre o alias, sin acentos).
export function buscarInstituciones(q) {
    const t = norm(q);
    if (!t) return INSTITUCIONES;
    return INSTITUCIONES.filter(i => norm(i.nombre).includes(t) || i.alias.some(a => norm(a).includes(t)));
}

// Cuentas con un logo puesto a mano que también están en la biblioteca y aún no
// decides cuál usar. La pregunta se hace una vez por ronda (RONDA_BIBLIOTECA): al
// ampliar la biblioteca se vuelve a preguntar.
export const RONDA_BIBLIOTECA = 2;
export function cuentasParaBiblioteca(cuentas) {
    return cuentas.filter(c => c.icono && (Number(c.bibliotecaRonda) || (c.bibliotecaDecidida ? 1 : 0)) < RONDA_BIBLIOTECA && logoDeInstitucion(institucionDe(c)));
}
