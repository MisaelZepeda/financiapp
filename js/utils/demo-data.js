// Datos ficticios para el "Modo Demo": permiten recorrer toda la interfaz sin
// iniciar sesión ni tocar Firebase. Se generan en memoria, nunca se escriben
// a ningún lado.

function daysAgoISO(days) {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().split('T')[0];
}

export function buildDemoData() {
    const cuentas = [
        { id: 1, nombre: 'Nómina', banco: 'BBVA', tipo: 'debito', saldo: 24850.5, digitos: '4821', clabe: '', mesPagado: null },
        { id: 2, nombre: 'Ahorros', banco: 'Nu', tipo: 'debito', saldo: 51200, digitos: '1190', clabe: '', mesPagado: null },
        { id: 3, nombre: 'Efectivo', banco: 'Efectivo', tipo: 'efectivo', saldo: 1350, digitos: '', clabe: '' },
        { id: 4, nombre: 'Platino', banco: 'Santander', tipo: 'credito', saldo: 8420, limite: 30000, digitos: '5567', diaCorte: 18, diaPago: 5, mesPagado: null },
        { id: 5, nombre: 'Viajes', banco: 'Hey Banco', tipo: 'credito', saldo: 2100, limite: 15000, digitos: '3302', diaCorte: 2, diaPago: 20, mesPagado: new Date().getMonth() },
    ];

    const cats = ['Comida', 'Servicios', 'Transporte', 'Vivienda', 'Ocio', 'Otros', 'Salud'];
    const transacciones = [];
    let tid = 0;
    for (let m = 0; m < 6; m++) {
        const base = m * 30;
        transacciones.push({ firebaseId: `demo_${tid++}`, tipo: 'ingreso', desc: 'Pago de nómina', monto: 18500 + m * 120, cuentaId: 1, fecha: daysAgoISO(base + 2) });
        if (m % 2 === 0) transacciones.push({ firebaseId: `demo_${tid++}`, tipo: 'ingreso', desc: 'Trabajo freelance', monto: 2400, cuentaId: 1, fecha: daysAgoISO(base + 14) });
        for (let g = 0; g < 6; g++) {
            const cat = cats[(m + g) % cats.length];
            const cuentaId = g % 3 === 0 ? 4 : (g % 3 === 1 ? 1 : 3);
            transacciones.push({
                firebaseId: `demo_${tid++}`, tipo: 'gasto', cat,
                desc: ['Supermercado', 'Renta departamento', 'Uber', 'Netflix', 'Café', 'Gimnasio'][g],
                monto: [850, 6200, 180, 199, 65, 450][g] + m * 5,
                cuentaId, fecha: daysAgoISO(base + g * 3),
            });
        }
    }
    transacciones.push({ firebaseId: `demo_${tid++}`, tipo: 'movimiento', subtipo: 'pago', desc: 'Pago a Platino', monto: 3000, origenId: 1, destinoId: 4, fecha: daysAgoISO(6) });

    const presupuestos = { Comida: 4500, Transporte: 1200, Ocio: 1000, Servicios: 2000 };

    const metas = [
        { id: 'm1', nombre: 'Fondo de emergencia', emoji: 'shield', montoObjetivo: 60000, montoActual: 32500, fechaLimite: '2026-12-31' },
        { id: 'm2', nombre: 'Viaje a Japón', emoji: 'calendar', montoObjetivo: 45000, montoActual: 12800, fechaLimite: '2027-04-01' },
        { id: 'm3', nombre: 'Laptop nueva', emoji: 'box', montoObjetivo: 28000, montoActual: 27100, fechaLimite: '' },
    ];

    const recurrentes = [
        { id: 'r1', desc: 'Netflix', monto: 199, tipo: 'gasto', cat: 'Suscripciones', cuentaId: 4, frecuencia: 'mensual', diaMes: 12, activo: true, ultimaGeneracion: daysAgoISO(35) },
        { id: 'r2', desc: 'Renta', monto: 6200, tipo: 'gasto', cat: 'Vivienda', cuentaId: 1, frecuencia: 'mensual', diaMes: 1, activo: true, ultimaGeneracion: daysAgoISO(32) },
        { id: 'r3', desc: 'Nómina quincenal', monto: 9250, tipo: 'ingreso', cat: '', cuentaId: 1, frecuencia: 'quincenal', diaMes: 15, activo: true, ultimaGeneracion: daysAgoISO(20) },
    ];

    return {
        perfil: { nombre: 'Cuenta Demo', foto: 'https://ui-avatars.com/api/?name=Demo&background=6c63ff&color=fff&size=128', color: '#6c63ff' },
        cuentas, transacciones, presupuestos, categoriasCustom: ['Mascotas'], metas, recurrentes,
    };
}
