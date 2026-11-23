// Biblioteca de instituciones financieras (México): nombre, color de marca y dominio
// (o `logo`) para su logo. Las cuentas guardan `institucion` (id) y, si quieres otro tono,
// `color`. Las cuentas viejas se reconocen por el texto de `banco`.

export const INSTITUCIONES = [
    // Bancos
    { id: 'bbva', nombre: 'BBVA', color: '#004481', dominio: 'bbva.mx', alias: ['bbva', 'bancomer'] },
    { id: 'santander', nombre: 'Santander', color: '#ec0000', dominio: 'santander.com.mx', alias: ['santander'] },
    { id: 'banorte', nombre: 'Banorte', color: '#eb0029', dominio: 'banorte.com', alias: ['banorte'] },
    { id: 'banamex', nombre: 'Banamex', color: '#0b4ea2', dominio: 'banamex.com', alias: ['banamex', 'citibanamex', 'citi'] },
    { id: 'hsbc', nombre: 'HSBC', color: '#db0011', dominio: 'hsbc.com.mx', alias: ['hsbc'] },
    { id: 'scotiabank', nombre: 'Scotiabank', color: '#ec111a', dominio: 'scotiabank.com.mx', alias: ['scotiabank', 'scotia'] },
    { id: 'azteca', nombre: 'Banco Azteca', color: '#00965e', dominio: 'bancoazteca.com.mx', alias: ['azteca'] },
    { id: 'bienestar', nombre: 'Banco del Bienestar', color: '#1e7b4b', dominio: 'bancodelbienestar.gob.mx', alias: ['bienestar', 'babien'],
        logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/46/Logo_Banco_del_Bienestar.png/330px-Logo_Banco_del_Bienestar.png' },
    { id: 'bancoppel', nombre: 'BanCoppel', color: '#0057a8', dominio: 'bancoppel.com', alias: ['bancoppel'] },
    { id: 'inbursa', nombre: 'Inbursa', color: '#003b71', dominio: 'www.inbursa.com', alias: ['inbursa'] },
    { id: 'banregio', nombre: 'Banregio', color: '#f37021', dominio: 'banregio.com', alias: ['banregio'] },
    { id: 'afirme', nombre: 'Afirme', color: '#00843d', dominio: 'www.afirme.com', alias: ['afirme'] },
    { id: 'bajio', nombre: 'BanBajío', color: '#5c2d91', dominio: 'bb.com.mx', alias: ['bajio', 'banbajio'] },
    { id: 'invex', nombre: 'Invex', color: '#002f6c', dominio: 'invex.com', alias: ['invex'] },
    { id: 'amex', nombre: 'American Express', color: '#2e77bc', dominio: 'americanexpress.com', alias: ['amex', 'american express'] },
    // Bancos y tarjetas digitales
    { id: 'nu', nombre: 'Nu', color: '#820ad1', dominio: 'nu.com.mx', alias: ['nu', 'nubank'] },
    { id: 'hey', nombre: 'Hey Banco', color: '#1d1d1b', dominio: 'heybanco.com', alias: ['hey'],
        logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Hey_Banco.svg/330px-Hey_Banco.svg.png' },
    { id: 'openbank', nombre: 'Openbank', color: '#e50014', dominio: 'openbank.mx', alias: ['openbank', 'open bank', 'open'] },
    { id: 'klar', nombre: 'Klar', color: '#111111', dominio: 'klar.mx', alias: ['klar'] },
    { id: 'stori', nombre: 'Stori', color: '#00a19a', dominio: 'storicard.com', alias: ['stori'] },
    { id: 'plata', nombre: 'Plata', color: '#ff6b13', dominio: 'platacard.mx', alias: ['plata', 'platacard', 'plata card'] },
    { id: 'rappi', nombre: 'RappiCard', color: '#ff441f', dominio: 'rappicard.mx', alias: ['rappi', 'rappicard'] },
    { id: 'didi', nombre: 'DiDi Card', color: '#fc4c02', dominio: 'didiglobal.com', alias: ['didi'] },
    { id: 'vexi', nombre: 'Vexi', color: '#6c2bd9', dominio: 'vexi.mx', alias: ['vexi'] },
    { id: 'revolut', nombre: 'Revolut', color: '#191c1f', dominio: 'revolut.com', alias: ['revolut'] },
    { id: 'uala', nombre: 'Ualá', color: '#3e4cf5', dominio: 'uala.mx', alias: ['uala', 'ualá'] },
    { id: 'mercadopago', nombre: 'Mercado Pago', color: '#00b1ea', dominio: 'mercadopago.com.mx', alias: ['mercado pago', 'mercadopago'] },
    { id: 'spin', nombre: 'Spin by OXXO', color: '#e30613', dominio: 'www.spinbyoxxo.com.mx', alias: ['spin', 'oxxo'] },
    { id: 'albo', nombre: 'albo', color: '#00c389', dominio: 'albo.mx', alias: ['albo'] },
    { id: 'fondeadora', nombre: 'Fondeadora', color: '#ffc700', dominio: 'fondeadora.com', alias: ['fondeadora'] },
    { id: 'finsus', nombre: 'Finsus', color: '#00a19a', dominio: 'finsus.mx', alias: ['finsus'] },
    { id: 'mifel', nombre: 'Mifel', color: '#002d62', dominio: 'mifel.com.mx', alias: ['mifel'] },
    // Tiendas
    { id: 'liverpool', nombre: 'Liverpool', color: '#e10098', dominio: 'liverpool.com.mx', alias: ['liverpool'] },
    { id: 'palacio', nombre: 'El Palacio de Hierro', color: '#1a1a1a', dominio: 'elpalaciodehierro.com', alias: ['palacio'] },
    { id: 'coppel', nombre: 'Coppel', color: '#ffd100', dominio: 'coppel.com', alias: ['coppel'] },
    { id: 'walmart', nombre: 'Walmart', color: '#0071ce', dominio: 'walmart.com.mx', alias: ['walmart'] },
    // Inversión
    { id: 'cetes', nombre: 'Cetesdirecto', color: '#0f5132', dominio: 'cetesdirecto.com', alias: ['cetes'] },
    { id: 'gbm', nombre: 'GBM', color: '#000000', dominio: 'gbm.com', alias: ['gbm'] },
    { id: 'kubo', nombre: 'Kubo Financiero', color: '#0090d4', dominio: 'kubofinanciero.com', alias: ['kubo'] },
    // Sin institución
    { id: 'efectivo', nombre: 'Efectivo', color: '#3f9d5a', dominio: null, alias: ['efectivo', 'cartera'], logo: 'logos/efectivo.svg' },   // ícono propio de Morralla
];

// Colores para elegir a mano (además del de la institución).
export const COLORES_CUENTA = ['#004481', '#0b4ea2', '#00b1ea', '#00965e', '#1e7b4b', '#3f9d5a', '#ffc700', '#ff6b13', '#ec0000', '#e10098', '#820ad1', '#5c2d91', '#1d1d1b', '#6b7280', '#a3a3a3'];

const norm = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export const institucionPorId = (id) => INSTITUCIONES.find(i => i.id === id) || null;

// La institución de una cuenta: la elegida, o la que coincida con su texto de banco.
export function institucionDe(cuenta) {
    if (!cuenta) return null;
    if (cuenta.institucion) return institucionPorId(cuenta.institucion);
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
// decides cuál usar (la pregunta se hace una sola vez, al llegar la biblioteca).
export function cuentasParaBiblioteca(cuentas) {
    return cuentas.filter(c => c.icono && !c.bibliotecaDecidida && logoDeInstitucion(institucionDe(c)));
}
