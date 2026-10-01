// Compras de insumos: el gerente autoriza una compra y el depósito registra la recepción.
import { db, endpoint, HttpError, FieldValue, registrar, siguienteNumero, notificar } from '../lib/servidor.mjs';
import { r3 } from '../../shared/negocio.js';

export default endpoint(['gerente', 'deposito'], async (b, yo) => {
  const base = db();

  if (b.accion === 'autorizar') {
    if (yo.rol !== 'gerente') throw new HttpError(403, 'Solo el gerente autoriza compras.');
    const cantidad = Number(b.cantidad);
    if (!(cantidad > 0)) throw new HttpError(400, 'Ingresá una cantidad mayor a cero.');
    const res = await base.runTransaction(async (t) => {
      const is = await t.get(base.doc(`insumos/${String(b.insumoId)}`));
      if (!is.exists) throw new HttpError(404, 'El insumo no existe.');
      const num = await siguienteNumero(t, 'compras', 0);
      const i = is.data();
      const codigo = `OC-${String(num.valor).padStart(3, '0')}`;
      t.set(base.collection('compras').doc(), {
        numero: num.valor, codigo, insumoId: is.id, insumoNombre: i.nombre, unidad: i.unidad,
        cantidad: r3(cantidad), proveedor: i.proveedor || '', estado: 'autorizada',
        fecha: FieldValue.serverTimestamp(), autorizadaPor: yo.nombre || yo.email,
      });
      num.guardar();
      registrar(t, yo, `Autorizó ${codigo}: ${i.nombre}, ${r3(cantidad)} ${i.unidad} a ${i.proveedor || 'proveedor'}`);
      return { codigo, insumo: i.nombre, cantidad: r3(cantidad), unidad: i.unidad, proveedor: i.proveedor || '' };
    });
    await notificar('compra_autorizada', res);
    return res;
  }

  if (b.accion === 'recibir') {
    return base.runTransaction(async (t) => {
      const ref = base.doc(`compras/${String(b.id)}`);
      const s = await t.get(ref);
      if (!s.exists) throw new HttpError(404, 'La compra no existe.');
      const c = s.data();
      if (c.estado !== 'autorizada') throw new HttpError(409, `${c.codigo} ya fue recibida.`);
      const iref = base.doc(`insumos/${c.insumoId}`);
      const is = await t.get(iref);
      if (!is.exists) throw new HttpError(404, 'El insumo de esta compra ya no existe.');
      t.update(iref, { stock: r3((is.data().stock || 0) + c.cantidad) });
      t.update(ref, { estado: 'recibida', recibida: FieldValue.serverTimestamp(), recibidaPor: yo.nombre || yo.email });
      t.set(base.collection('movimientos').doc(), {
        insumoId: c.insumoId, insumoNombre: c.insumoNombre, cantidad: c.cantidad,
        motivo: `Compra recibida ${c.codigo}`, fecha: FieldValue.serverTimestamp(), usuario: yo.nombre || yo.email,
      });
      registrar(t, yo, `Recibió ${c.codigo}: ${c.insumoNombre}, ${c.cantidad} ${c.unidad}`);
      return { codigo: c.codigo, insumo: c.insumoNombre, cantidad: c.cantidad, unidad: c.unidad };
    });
  }

  throw new HttpError(400, 'Acción desconocida.');
});
