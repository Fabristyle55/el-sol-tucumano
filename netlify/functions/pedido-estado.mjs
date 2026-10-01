// Cambia el estado de un pedido: confirmar, cancelar o marcar como entregado.
import { db, endpoint, HttpError, FieldValue, registrar, notificar } from '../lib/servidor.mjs';

const ACCIONES = {
  confirmar: { roles: ['gerente'], desde: ['pendiente'], a: 'confirmado', verbo: 'Confirmó' },
  cancelar: { roles: ['gerente', 'cliente'], desde: ['pendiente', 'confirmado'], a: 'cancelado', verbo: 'Canceló' },
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
    if (yo.rol === 'cliente') {
      if (p.clienteUid !== yo.uid) throw new HttpError(403, 'Ese pedido no es tuyo.');
      if (p.estado !== 'pendiente') throw new HttpError(409, 'Solo podés cancelar pedidos que todavía no se confirmaron.');
    }
    if (!acc.desde.includes(p.estado)) throw new HttpError(409, `El pedido #${p.numero} está ${p.estado} y no se puede ${b.accion}.`);
    t.update(ref, { estado: acc.a, [`${acc.a}En`]: FieldValue.serverTimestamp() });
    registrar(t, yo, `${acc.verbo} el pedido #${p.numero} de ${p.clienteNombre}`);
    return { numero: p.numero, estado: acc.a, cliente: p.clienteNombre, clienteUid: p.clienteUid };
  });
  await notificar(`pedido_${res.estado}`, res);
  return res;
});
