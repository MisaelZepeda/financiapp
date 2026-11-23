// Topes de presupuesto por mes, con herencia.
//
// Cada categoría tiene su tope general (`presupuesto`). Además, `topes` guarda
// cambios con fecha de inicio: topes['2026-12'] = { comida: 3000, ocio: -1 }
// significa "a partir de diciembre, Comida 3000 y Ocio sin límite". Un mes usa
// el cambio más reciente que no sea posterior a él; si ninguno menciona la
// categoría, usa su tope general. −1 = sin límite (Firebase no guarda null).

export const SIN_TOPE = -1;

// Tope de una categoría en el mes `mes` ('AAAA-MM'): número ≥ 0, o null si no tiene.
export function topeEnMes(cat, topes, mes) {
    const meses = Object.keys(topes || {}).filter(k => k <= mes).sort().reverse();
    for (const k of meses) {
        const v = topes[k]?.[cat.id];
        if (v !== undefined && v !== null) return Number(v) < 0 ? null : Number(v);
    }
    const base = Number(cat.presupuesto);
    return base > 0 ? base : null;
}

// Categorías con `presupuesto` = su tope en ese mes (así el resto de la app no cambia).
export function categoriasDelMes(categorias, topes, mes) {
    if (!topes || !Object.keys(topes).length) return categorias;
    return categorias.map(c => {
        const t = topeEnMes(c, topes, mes);
        return t === (Number(c.presupuesto) > 0 ? Number(c.presupuesto) : null) ? c : { ...c, presupuesto: t };
    });
}
