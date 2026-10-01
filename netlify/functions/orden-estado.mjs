// Producción: el panadero empieza o termina una orden. Al terminarla se
// descuentan los insumos del stock y, si era la última orden del día, los
// pedidos de ese día pasan a "listo para reparto".
import { db, endpoint, HttpError, FieldValue, registrar, notificar } from '../lib/servidor.mjs';
import { r3, idArticulo } from '../../shared/negocio.js';

export default endpoint(['gerente', 'panadero'], async (b, yo) => {
  const base = db();
  const res = await base.runTransaction(async (t) => {
    const ref = base.doc(`ordenes/${String(b.id)}`);
    const s = await t.get(ref);
    if (!s.exists) throw new HttpError(404, 'La orden no existe.');
    const o = s.data();

    if (b.accion === 'empezar') {
      if (o.estado !== 'pendiente') throw new HttpError(409, `La OP-${o.numero} ya está ${o.estado.replace('_', ' ')}.`);
      t.update(ref, { estado: 'en_curso', inicio: FieldValue.serverTimestamp(), responsable: yo.nombre || yo.email });
      registrar(t, yo, `Empezó OP-${o.numero}: ${o.cantidad} ${o.productoNombre}`);
      return { estado: 'en_curso', numero: o.numero };
    }

    if (b.accion !== 'terminar') throw new HttpError(400, 'Acción desconocida.');
    if (o.estado !== 'en_curso') throw new HttpError(409, 'Primero marcá la orden como empezada.');

    const insIds = Object.keys(o.insumos || {});
    const insSnaps = insIds.length ? await t.getAll(...insIds.map((id) => base.doc(`insumos/${id}`))) : [];
    const delDia = await t.get(base.collection('ordenes').where('fecha', '==', o.fecha));
    const enProd = await t.get(base.collection('pedidos').where('entrega', '==', o.fecha).where('estado', '==', 'produccion'));
    // Lo que se horneó de más para el local pasa al stock del despacho.
    const artRef = o.extra > 0 ? base.doc(`articulos/${idArticulo(o.productoId)}`) : null;
    const artSnap = artRef ? await t.get(artRef) : null;

    insSnaps.forEach((snap, k) => {
      if (!snap.exists) return;
      const iid = insIds[k];
      const q = o.insumos[iid];
      t.update(snap.ref, { stock: r3((snap.data().stock || 0) - q) });
      t.set(base.collection('movimientos').doc(), {
        insumoId: iid, insumoNombre: snap.data().nombre, cantidad: -q,
        motivo: `Producción OP-${o.numero}`, fecha: FieldValue.serverTimestamp(), usuario: yo.nombre || yo.email,
      });
    });
    t.update(ref, { estado: 'terminada', fin: FieldValue.serverTimestamp() });
    if (artRef) {
      const actual = artSnap.exists ? (artSnap.data().stock || 0) : 0;
      if (artSnap.exists) t.update(artRef, { stock: r3(actual + o.extra) });
      else t.set(artRef, { nombre: o.productoNombre, productoId: o.productoId, tipo: 'elaborado', categoria: 'Panificados', unidad: 'u', stock: o.extra, minimo: 0, activo: true });
      t.set(base.collection('movDespacho').doc(), {
        articuloId: artRef.id, articuloNombre: o.productoNombre, unidad: 'u', cantidad: o.extra,
        motivo: `Producción OP-${o.numero}`, fecha: FieldValue.serverTimestamp(), usuario: yo.nombre || yo.email,
      });
    }
    registrar(t, yo, `Terminó OP-${o.numero}: ${o.cantidad} ${o.productoNombre}`);

    const quedan = delDia.docs.filter((d) => d.id !== ref.id && d.data().estado !== 'terminada').length;
    let listos = 0;
    if (!quedan) {
      enProd.docs.forEach((d) => { t.update(d.ref, { estado: 'listo', listoEn: FieldValue.serverTimestamp() }); listos++; });
      if (listos) registrar(t, { nombre: 'Sistema' }, `${listos} pedidos del ${o.fecha} listos para reparto`);
    }
    return { estado: 'terminada', numero: o.numero, fecha: o.fecha, pedidosListos: listos, alDespacho: o.extra || 0 };
  });
  if (res.pedidosListos) await notificar('pedidos_listos', res);
  return res;
});
