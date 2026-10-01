// Pruebas de la lógica de negocio compartida:  npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { explotar, reservado, proyeccion, faltantes, totalesPorProducto, sumarDias } from '../shared/negocio.js';

const productos = {
  pf: { id: 'pf', receta: { h000: 0.65, lev: 0.015 } },
  pp: { id: 'pp', receta: { h000: 0.9, tom: 0.3 } },
};

test('explotar multiplica cantidades por receta', () => {
  assert.deepEqual(explotar({ pf: 10, pp: 5 }, productos), { h000: 11, lev: 0.15, tom: 1.5 });
});

test('totales por producto suma los pedidos', () => {
  const t = totalesPorProducto([{ items: [{ productoId: 'pf', cantidad: 3 }] }, { items: [{ productoId: 'pf', cantidad: 2 }, { productoId: 'pp', cantidad: 1 }] }]);
  assert.deepEqual(t, { pf: 5, pp: 1 });
});

test('reservado ignora órdenes terminadas', () => {
  assert.deepEqual(reservado([{ estado: 'pendiente', insumos: { h000: 5 } }, { estado: 'terminada', insumos: { h000: 9 } }, { estado: 'en_curso', insumos: { h000: 1.5 } }]), { h000: 6.5 });
});

test('faltantes detecta lo que no alcanza', () => {
  const ins = { h000: { nombre: 'Harina', unidad: 'kg', stock: 10 } };
  assert.deepEqual(faltantes({ h000: 12 }, ins, { h000: 1 }), [{ insumoId: 'h000', nombre: 'Harina', unidad: 'kg', falta: 3 }]);
  assert.deepEqual(faltantes({ h000: 9 }, ins, {}), []);
});

test('proyección alerta y sugiere múltiplos del envase', () => {
  const [h] = proyeccion({
    insumos: [{ id: 'h000', stock: 100, seguridad: 80, pack: 25 }],
    ordenes: [{ estado: 'pendiente', insumos: { h000: 20 } }],
    pedidos: [{ estado: 'confirmado', items: [{ productoId: 'pf', cantidad: 20 }] }],
    compras: [{ estado: 'autorizada', insumoId: 'h000', cantidad: 5 }],
    productosPorId: productos,
  });
  assert.equal(h.proyectado, 72); // 100 - 20 - 13 + 5
  assert.equal(h.alerta, true);
  assert.equal(h.sugerido, 50); // 120 - 72 = 48 → 2 bolsas de 25
});

test('sumarDias cruza fin de mes', () => {
  assert.equal(sumarDias('2026-09-30', 1), '2026-10-01');
});

import { precioPara } from '../shared/negocio.js';
test('precio según tipo de cliente', () => {
  assert.equal(precioPara({ precio: 100, precioMinorista: 130 }, 'minorista'), 130);
  assert.equal(precioPara({ precio: 100, precioMinorista: 130 }, 'mayorista'), 100);
  assert.equal(precioPara({ precio: 100 }, 'minorista'), 100); // sin precio minorista usa el mayorista
});

import { precioArticulo, cantidadValida, vaAProduccion } from '../shared/negocio.js';
test('precio de artículos del despacho', () => {
  const prods = { pf: { precio: 2400, precioMinorista: 3000 } };
  assert.equal(precioArticulo({ productoId: 'pf' }, prods), 3000); // elaborado: precio minorista del producto
  assert.equal(precioArticulo({ precio: 1500 }, prods), 1500); // reventa: su propio precio
});
test('cantidades por unidad y por kilo', () => {
  assert.equal(cantidadValida(2.7, 'u'), 2);
  assert.equal(cantidadValida(0.2504, 'kg'), 0.25);
  assert.equal(cantidadValida(0, 'u'), 0);
  assert.equal(cantidadValida(-1, 'kg'), 0);
});
test('las reservas minoristas no entran en la producción', () => {
  assert.equal(vaAProduccion({ tipoCliente: 'minorista' }), false);
  assert.equal(vaAProduccion({ tipoCliente: 'mayorista' }), true);
  assert.equal(vaAProduccion({}), true);
  const [h] = proyeccion({
    insumos: [{ id: 'h000', stock: 100, seguridad: 10, pack: 25 }], ordenes: [], compras: [],
    pedidos: [{ estado: 'confirmado', tipoCliente: 'minorista', items: [{ productoId: 'pf', cantidad: 50 }] }],
    productosPorId: { pf: { receta: { h000: 1 } } },
  });
  assert.equal(h.proyectado, 100);
});

// ---------- Mejoras: ofertas, vencimientos, caja, cuenta corriente, costos, mermas ----------
import { vencimiento, resumenCaja, estadoCuenta, costoProducto, margen, extraSugerido, diaSemana, diasEntre } from '../shared/negocio.js';

test('la oferta descuenta el porcentaje y se limita a 70 %', () => {
  assert.equal(precioArticulo({ precio: 1000, oferta: 20 }), 800);
  assert.equal(precioArticulo({ precio: 1000, oferta: 95 }), 300);
  assert.equal(precioArticulo({ precio: 1000 }), 1000);
});

test('vencimiento avisa 3 días antes y solo si hay stock', () => {
  assert.equal(vencimiento({ stock: 2, vence: '2026-10-04' }, '2026-10-01').estado, 'pronto');
  assert.equal(vencimiento({ stock: 2, vence: '2026-10-09' }, '2026-10-01').estado, 'ok');
  assert.equal(vencimiento({ stock: 2, vence: '2026-09-30' }, '2026-10-01').estado, 'vencido');
  assert.equal(vencimiento({ stock: 0, vence: '2026-09-30' }, '2026-10-01'), null);
});

test('resumen de caja suma por forma de pago sin las anuladas', () => {
  const r = resumenCaja([{ pago: 'Efectivo', total: 1000 }, { pago: 'Efectivo', total: 500, anulada: true }, { pago: 'Débito', total: 300 }], [{ pago: 'Efectivo', total: 200 }]);
  assert.equal(r.efectivo, 1200); assert.equal(r.total, 1500);
});

test('la cuenta corriente vence después del plazo', () => {
  assert.equal(estadoCuenta({ saldo: 0 }, '2026-10-01').estado, 'al-dia');
  assert.equal(estadoCuenta({ saldo: 5000, deudaDesde: '2026-09-25' }, '2026-10-01').estado, 'debe');
  assert.equal(estadoCuenta({ saldo: 5000, deudaDesde: '2026-09-01' }, '2026-10-01').estado, 'vencida');
  assert.equal(estadoCuenta({ saldo: 5000, deudaDesde: '2026-09-25', plazoDias: 3 }, '2026-10-01').estado, 'vencida');
});

test('costo y margen por producto con la receta', () => {
  const ins = { h: { costo: 1000 }, l: { costo: 4000 } };
  assert.deepEqual(costoProducto({ receta: { h: 0.5, l: 0.05 } }, ins), { costo: 700, completo: true });
  assert.equal(costoProducto({ receta: { h: 0.5, x: 1 } }, ins).completo, false);
  assert.deepEqual(margen(1000, 700), { monto: 300, pct: 30 });
});

test('extra sugerido descuenta lo que sobró', () => {
  const ops = [{ productoId: 'pf', fecha: '2026-09-29', estado: 'terminada', extra: 10 }, { productoId: 'pf', fecha: '2026-09-30', estado: 'terminada', extra: 10 }];
  const mermas = [{ productoId: 'pf', dia: '2026-09-29', cantidad: 4 }, { productoId: 'pf', dia: '2026-09-30', cantidad: 2 }];
  assert.deepEqual(extraSugerido(ops, mermas, 'pf', '2026-10-01'), { producido: 20, sobro: 6, sugerido: 7 });
  assert.equal(extraSugerido([], [], 'pf', '2026-10-01'), null);
});

test('fechas: día de la semana y diferencia en días', () => {
  assert.equal(diaSemana('2026-10-01'), 4); // jueves
  assert.equal(diasEntre('2026-09-28', '2026-10-01'), 3);
});

// ---------- Reparto, WhatsApp y promociones ----------
import { aCobrarEnEntrega, cobrosDelDia, telefonoWa, linkWhatsApp, aplicarPromos, promoVigente, promosDe, codigoCupon, rangoDias } from '../shared/negocio.js';

test('reparto: qué se cobra en la entrega', () => {
  assert.equal(aCobrarEnEntrega({ pago: 'Efectivo', total: 1500.4 }), 1500);
  assert.equal(aCobrarEnEntrega({ pago: 'Cuenta corriente', total: 1500 }), 0);
  assert.equal(aCobrarEnEntrega({ pago: 'Transferencia', total: 1500 }), 0);
});

test('caja: suma reservas retiradas y lo cobrado por el repartidor', () => {
  const pedidos = [
    { estado: 'entregado', tipoCliente: 'minorista', pago: 'Efectivo', total: 1000 },
    { estado: 'entregado', tipoCliente: 'mayorista', pago: 'Efectivo', total: 5000, cobrado: 4800, pagoCobrado: 'Efectivo' },
    { estado: 'entregado', tipoCliente: 'mayorista', pago: 'Cuenta corriente', total: 9000, cobrado: 0 },
    { estado: 'entregado', tipoCliente: 'mayorista', pago: 'Efectivo', total: 7000 },
    { estado: 'listo', tipoCliente: 'minorista', pago: 'Efectivo', total: 300 },
  ];
  const c = cobrosDelDia(pedidos);
  assert.deepEqual(c, [{ pago: 'Efectivo', total: 1000 }, { pago: 'Efectivo', total: 4800 }]);
  assert.equal(resumenCaja([], c).efectivo, 5800);
});

test('WhatsApp: normaliza teléfonos de Tucumán', () => {
  assert.equal(telefonoWa('381 15 4123456'), '5493814123456');
  assert.equal(telefonoWa('0381-4123456'), '5493814123456');
  assert.equal(telefonoWa('+54 9 381 412-3456'), '5493814123456');
  assert.equal(telefonoWa('4123456'), '5493814123456');
  assert.equal(telefonoWa('15 4123456'), '5493814123456');
  assert.equal(telefonoWa('011 15 5555 1234'), '5491155551234');
  assert.equal(telefonoWa(''), '');
  assert.equal(telefonoWa('123'), '');
  assert.ok(linkWhatsApp('3814123456', 'Hola, ¿todo bien?').startsWith('https://wa.me/5493814123456?text=Hola%2C%20'));
  assert.equal(linkWhatsApp('', 'x'), '');
});

const PROMOS = [
  { tipo: 'cantidad', productoId: 'pf', minimo: 50, pct: 10, para: 'mayorista' },
  { tipo: 'cantidad', productoId: 'pf', minimo: 100, pct: 15, para: 'mayorista' },
  { tipo: 'cantidad', productoId: null, minimo: 30, pct: 5, para: 'todos' },
  { tipo: 'cantidad', productoId: 'pp', minimo: 10, pct: 20, para: 'mayorista', activo: false },
];

test('promos: se aplica la mejor promo por cantidad de cada línea', () => {
  const r = aplicarPromos([{ productoId: 'pf', cantidad: 120, precio: 100 }, { productoId: 'pp', cantidad: 40, precio: 50 }, { productoId: 'pp', cantidad: 5, precio: 50 }], PROMOS, 'mayorista', null, '2026-10-01');
  assert.equal(r.subtotal, 12000 + 2000 + 250);
  assert.equal(r.lineas[0].descuento, 1800); // 15 % (la de 100+)
  assert.equal(r.lineas[1].descuento, 100); // 5 % general (la de 20 % está pausada)
  assert.equal(r.lineas[2].descuento, undefined);
  assert.equal(r.total, 14250 - 1900);
});

test('promos: respetan el tipo de cliente y el vencimiento', () => {
  const r = aplicarPromos([{ productoId: 'pf', cantidad: 60, precio: 100 }], PROMOS, 'minorista', null, '2026-10-01');
  assert.equal(r.descuento, 300); // solo la general del 5 %
  assert.equal(promoVigente({ vence: '2026-09-30' }, 'mayorista', '2026-10-01'), false);
  assert.equal(promoVigente({ usosMax: 3, usos: 3 }, 'mayorista', '2026-10-01'), false);
  assert.deepEqual(promosDe('pf', PROMOS, 'mayorista', '2026-10-01').map((p) => p.minimo), [30, 50, 100]);
});

test('cupón: se aplica después de las promos y respeta la compra mínima', () => {
  const cupon = { codigo: 'SOL10', pct: 10, minimo: 5000 };
  const ok = aplicarPromos([{ productoId: 'pf', cantidad: 60, precio: 100 }], PROMOS, 'mayorista', cupon, '2026-10-01');
  assert.equal(ok.descLineas, 600);
  assert.equal(ok.descCupon, 540); // 10 % de 5400
  assert.equal(ok.total, 4860);
  assert.equal(ok.cuponOk, true);
  const no = aplicarPromos([{ productoId: 'x', cantidad: 2, precio: 100 }], [], 'mayorista', cupon, '2026-10-01');
  assert.equal(no.cuponOk, false);
  assert.match(no.motivoCupon, /desde/);
  assert.equal(no.total, 200);
  assert.equal(codigoCupon(' sol-10 '), 'SOL10');
});

test('rango de días incluye los extremos', () => {
  assert.deepEqual(rangoDias('2026-09-29', '2026-10-02'), ['2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02']);
});
