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
