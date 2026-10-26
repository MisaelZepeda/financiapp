// Consejos de Tlaco: se muestran mientras carga la app y en "Tu salud financiera".
// Generales y prácticos, pensados para finanzas personales en México.

export const CONSEJOS = [
    'Antes de comprar a meses sin intereses, suma todas tus mensualidades: lo ideal es que no pasen del 20 % de tu ingreso.',
    'Paga el total de tu tarjeta antes de la fecha límite y no pagarás intereses.',
    'El pago mínimo de la tarjeta es una trampa: alarga la deuda y multiplica los intereses.',
    'Un fondo de emergencia de 3 meses de gastos te salva de usar la tarjeta en un imprevisto.',
    'Págate primero: aparta tu ahorro el día que cobras, no lo que sobre a fin de mes.',
    'Revisa tus suscripciones cada mes; las que no usas son fugas silenciosas.',
    'Los gastos hormiga (café, antojos, envíos) suman más de lo que crees. Regístralos una semana.',
    'Usar menos del 30 % del límite de tus tarjetas ayuda a tu historial crediticio.',
    'Compara el CAT, no solo la tasa: incluye comisiones y te dice el costo real del crédito.',
    'Si tienes varias deudas, paga primero la de interés más alto mientras cubres el mínimo de las demás.',
    'Una meta con fecha y monto se cumple más que un "algún día ahorraré".',
    'Antes de una compra grande, espera 48 horas. Si aún la quieres, adelante.',
    'Tu cashback cuenta: regístralo para ver cuánto te regresa tu tarjeta al año.',
    'Divide tu ingreso: necesidades, gustos y ahorro. Ajusta los porcentajes a tu realidad.',
    'Los meses sin intereses no son dinero extra: el pago llega cada mes aunque ya no recuerdes la compra.',
    'Revisa tu estado de cuenta: un cargo que no reconoces se reporta mejor pronto.',
    'Automatiza el ahorro con un traspaso fijo el día de pago.',
    'Un presupuesto no es para prohibirte nada, es para decidir a dónde va tu dinero.',
    'Si tu tarjeta da cashback, úsala para gastos que igual harías y págala completa.',
    'Ten tu fondo de emergencia en una cuenta que dé rendimiento pero puedas retirar rápido.',
    'Celebra cada meta cumplida: el ahorro también debe sentirse bien.',
    'Cuando te suban el sueldo, sube tu ahorro antes que tu gasto.',
    'Evita disponer efectivo con la tarjeta de crédito: cobra comisión e intereses desde el primer día.',
    'Planea los gastos de diciembre y enero desde octubre; la cuesta de enero se sube mejor preparado.',
    'Guarda tus tickets de gastos deducibles: te pueden regresar dinero en la declaración anual.',
    'Revisa tus gastos fijos una vez al año: plan de celular, internet y seguros suelen bajar al renegociar.',
    'Si prestas dinero, que sea uno que puedas no volver a ver.',
    'Antes de invertir, ten tu fondo de emergencia y tus deudas caras bajo control.',
    'El interés compuesto trabaja para ti en el ahorro y en tu contra en las deudas.',
    'Comprar en oferta solo es ahorro si de verdad lo ibas a comprar.',
    'Ten pocas tarjetas y conócelas bien: fecha de corte, fecha de pago y beneficios.',
    'Haz tus compras grandes justo después del corte de tu tarjeta: tendrás más días para pagar.',
    'Revisar tus finanzas 10 minutos a la semana vale más que una gran revisión al año.',
    'Si un mes gastaste de más, no pasa nada: ajusta el siguiente y sigue.',
    'Separa una cuenta para gastos y otra para ahorro; lo que no ves, no lo gastas.',
    'Las metas pequeñas y frecuentes mantienen la motivación más que una sola meta enorme.',
    'Registra tus ingresos extra: saber cuánto entra de verdad te ayuda a planear mejor.',
    'Un seguro de gastos médicos puede proteger años de ahorro en un solo día.',
    'Evita los préstamos de apps con intereses muy altos; compara antes de firmar.',
    'Tu dinero, hasta la última moneda: cada peso registrado te da más claridad.',
];

export function consejoAlAzar(excepto = null) {
    if (CONSEJOS.length < 2) return CONSEJOS[0];
    let c;
    do { c = CONSEJOS[Math.floor(Math.random() * CONSEJOS.length)]; } while (c === excepto);
    return c;
}
