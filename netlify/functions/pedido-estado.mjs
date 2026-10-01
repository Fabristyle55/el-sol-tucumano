// Cambia el estado de un pedido.
// Mayoristas: confirmar (gerente) → producción → listo → entregar.
// Minoristas (reservas del despacho, sin gerente): preparar (descuenta el stock del
// despacho) → entregar (retirado). Cancelar devuelve el stock si ya se había preparado.
import { db, endpoint, HttpError, FieldValue, registrar, notificar } from '../lib/servidor.mjs';
import { r3, idArticulo } from '../../shared/negocio.js';

const ACCIONES = {
  confirmar: { roles: ['gerente'], desde: ['pendiente'], a: 'confirmado', verbo: 'Confirmó' },
  preparar: { roles: ['gerente', 'mostrador'], desde: ['reservado'], a: 'listo', verbo: 'Preparó' },
  cancelar: { roles: ['gerente', 'mostrador', 'cliente'], desde: ['pendiente', 'confirmado', 'reservado', 'listo'], a: 'cancelado', verbo: 'Canceló' },
  entregar: { roles: ['gerente', 'mostrador'], desde: ['listo'], a: 'entregado', verbo: 'Entregó' },
};

export default endpoint(['gerente', 'mostrador', 'cliente'], async (b, yo) => {
  const acc = ACCIONES[b.accion];
  if (!acc) throw new HttpError(400, 'Acción desconocida.');
  if (!acc.roles.includes(yo.rol)) throw new HttpError(403, 'Tu usuario no puede hacer esta acción.');
  const base = db();
  const res = await base.runTransaction(async (t) => {
    const ref = base.doc(`pedidos/${String(b.id)}`);
    const s = await t.get(ref);
    if (!s.exists) throw new HttpError(404, 'El pedido no existe.');
    const p = s.data();
    const minorista = p.tipoCliente === 'minorista';

    if (yo.rol === 'cliente') {
      if (p.clienteUid !== yo.uid) throw new HttpError(403, 'Ese pedido no es tuyo.');
      if (!['pendiente', 'reservado'].includes(p.estado)) throw new HttpError(409, 'Ese pedido ya se está preparando y no se puede cancelar desde la web. Llamá al local.');
    }
    if (!acc.desde.includes(p.estado)) throw new HttpError(409, `El pedido #${p.numero} está ${p.estado} y no se puede ${b.accion}.`);
    if (b.accion === 'confirmar' && minorista) throw new HttpError(409, 'Las reservas minoristas no necesitan confirmación.');
    if (b.accion === 'cancelar' && p.estado === 'listo' && !minorista) throw new HttpError(409, 'El pedido ya está producido; no se puede cancelar.');

    // Movimientos de stock del despacho (solo reservas minoristas)
    const tocaStock = minorista && (b.accion === 'preparar' || (b.accion === 'cancelar' && p.estado === 'listo'));
    if (tocaStock) {
      const ids = p.items.map((i) => i.articuloId || idArticulo(i.productoId));
      const snaps = await t.getAll(...ids.map((id) => base.doc(`articulos/${id}`)));
      const signo = b.accion === 'preparar' ? -1 : 1;
      p.items.forEach((i, k) => {
        const a = snaps[k];
        if (!a.exists) throw new HttpError(409, `El artículo ${i.nombre} ya no existe en el despacho.`);
        const stock = a.data().stock || 0;
        if (signo < 0 && stock < i.cantidad - 1e-9) throw new HttpError(409, `No alcanza ${i.nombre} en el despacho: hay ${stock}. Reponé o ajustá el stock primero.`);
        t.update(a.ref, { stock: r3(stock + signo * i.cantidad) });
        t.set(base.collection('movDespacho').doc(), {
          articuloId: a.id, articuloNombre: a.data().nombre, unidad: a.data().unidad || 'u', cantidad: signo * i.cantidad,
          motivo: `${signo < 0 ? 'Reserva' : 'Cancelación de reserva'} #${p.numero}`, fecha: FieldValue.serverTimestamp(), usuario: yo.nombre || yo.email,
        });
      });
    }

    t.update(ref, { estado: acc.a, [`${acc.a}En`]: FieldValue.serverTimestamp() });
    registrar(t, yo, `${acc.verbo} ${minorista ? 'la reserva' : 'el pedido'} #${p.numero} de ${p.clienteNombre}`);
    return { numero: p.numero, estado: acc.a, cliente: p.clienteNombre, clienteUid: p.clienteUid, minorista };
  });
  if (!res.minorista) await notificar(`pedido_${res.estado}`, res);
  return res;
});
