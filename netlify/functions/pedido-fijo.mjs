// Pedidos fijos (recurrentes) de los comercios mayoristas.
//   guardar  → el cliente (o el gerente) deja armado qué pide y qué días
//   pausar / activar / borrar
//   generar  → el gerente genera ahora los pedidos fijos de mañana (lo mismo que hace el proceso nocturno)
import { db, endpoint, HttpError, FieldValue, registrar, texto } from '../lib/servidor.mjs';
import { fechaAR, FORMAS_PAGO, DIAS_SEMANA } from '../../shared/negocio.js';
import { generarFijos } from '../lib/pedidos-fijos.mjs';

export default endpoint(['gerente', 'cliente'], async (b, yo) => {
  const base = db();
  if (b.accion === 'generar') {
    if (yo.rol !== 'gerente') throw new HttpError(403, 'Solo el gerente puede generar los pedidos fijos.');
    return generarFijos(fechaAR(1));
  }

  const clienteId = yo.rol === 'cliente' ? yo.clienteId : texto(b.clienteId, 60);
  if (!clienteId) throw new HttpError(400, 'Falta el cliente.');
  const cs = await base.doc(`clientes/${clienteId}`).get();
  if (!cs.exists) throw new HttpError(404, 'El cliente no existe.');
  const c = cs.data();
  if ((c.tipo || 'mayorista') !== 'mayorista') throw new HttpError(400, 'Los pedidos fijos son para comercios mayoristas.');
  const ref = base.doc(`pedidosFijos/${clienteId}`);

  if (b.accion === 'guardar') {
    const dias = [...new Set((Array.isArray(b.dias) ? b.dias : []).map(Number).filter((d) => d >= 0 && d <= 6))].sort();
    if (!dias.length) throw new HttpError(400, 'Elegí al menos un día de entrega.');
    const ps = await base.collection('productos').get();
    const validos = new Set(ps.docs.filter((d) => d.data().activo !== false).map((d) => d.id));
    const items = (Array.isArray(b.items) ? b.items : [])
      .map((i) => ({ productoId: texto(i.productoId, 60), cantidad: Math.floor(Number(i.cantidad)) }))
      .filter((i) => validos.has(i.productoId) && i.cantidad > 0 && i.cantidad <= 10000);
    if (!items.length) throw new HttpError(400, 'Agregá al menos un producto.');
    const pago = FORMAS_PAGO.includes(b.pago) ? b.pago : 'Efectivo';
    await ref.set({
      clienteId, clienteUid: c.uid || null, clienteNombre: c.nombre, dias, items, pago,
      modoEntrega: b.modoEntrega === 'retiro' ? 'retiro' : 'envio', activo: true, actualizado: FieldValue.serverTimestamp(), actualizadoPor: yo.nombre || yo.email,
    });
    await base.runTransaction(async (t) => registrar(t, yo, `Guardó el pedido fijo de ${c.nombre}: ${dias.map((d) => DIAS_SEMANA[d]).join(', ')}`));
    return { ok: true };
  }
  if (b.accion === 'pausar' || b.accion === 'activar') {
    if (!(await ref.get()).exists) throw new HttpError(404, 'No hay un pedido fijo armado.');
    await ref.update({ activo: b.accion === 'activar' });
    await base.runTransaction(async (t) => registrar(t, yo, `${b.accion === 'activar' ? 'Activó' : 'Pausó'} el pedido fijo de ${c.nombre}`));
    return { ok: true };
  }
  if (b.accion === 'borrar') {
    await ref.delete();
    await base.runTransaction(async (t) => registrar(t, yo, `Borró el pedido fijo de ${c.nombre}`));
    return { ok: true };
  }
  throw new HttpError(400, 'Acción desconocida.');
});
