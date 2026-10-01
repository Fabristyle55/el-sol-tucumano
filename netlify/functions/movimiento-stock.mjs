// Stock: ingreso manual de mercadería o ajuste por conteo físico.
import { db, endpoint, HttpError, FieldValue, registrar, texto } from '../lib/servidor.mjs';
import { r3 } from '../../shared/negocio.js';

export default endpoint(['gerente', 'deposito'], async (b, yo) => {
  const cantidad = Number(b.cantidad);
  if (!['ingreso', 'ajuste'].includes(b.tipo)) throw new HttpError(400, 'Tipo de movimiento inválido.');
  if (!(cantidad >= 0) || (b.tipo === 'ingreso' && !(cantidad > 0))) throw new HttpError(400, 'Ingresá una cantidad válida.');
  const base = db();
  return base.runTransaction(async (t) => {
    const ref = base.doc(`insumos/${String(b.insumoId)}`);
    const s = await t.get(ref);
    if (!s.exists) throw new HttpError(404, 'El insumo no existe.');
    const i = s.data();
    const delta = b.tipo === 'ingreso' ? r3(cantidad) : r3(cantidad - (i.stock || 0));
    t.update(ref, { stock: r3((i.stock || 0) + delta) });
    const motivo = texto(b.motivo, 120) || (b.tipo === 'ingreso' ? 'Ingreso manual' : 'Ajuste por conteo');
    t.set(base.collection('movimientos').doc(), {
      insumoId: s.id, insumoNombre: i.nombre, cantidad: delta, motivo,
      fecha: FieldValue.serverTimestamp(), usuario: yo.nombre || yo.email,
    });
    registrar(t, yo, `${b.tipo === 'ingreso' ? 'Registró ingreso' : 'Ajustó inventario'}: ${i.nombre} ${delta > 0 ? '+' : ''}${delta} ${i.unidad}`);
    return { insumo: i.nombre, delta, stock: r3((i.stock || 0) + delta) };
  });
});
