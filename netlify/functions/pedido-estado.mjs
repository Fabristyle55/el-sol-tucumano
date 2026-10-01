// Cambia el estado de un pedido.
// Mayoristas: confirmar (gerente) → producción → listo → entregar.
//   Si se paga en cuenta corriente, al entregarlo se suma al saldo del cliente.
// Minoristas (reservas del despacho, sin gerente): preparar (descuenta el stock del
// despacho) → entregar (retirado). Cancelar devuelve el stock si ya se había preparado.
// Envíos: el repartidor los saca a reparto (en camino) y al entregarlos registra lo que
// cobró, que entra en la caja del día. Si no pudo entregar, el pedido vuelve a "listo".
import { db, endpoint, HttpError, FieldValue, registrar, notificar, avisarCliente, texto } from '../lib/servidor.mjs';
import { r3, idArticulo, fechaAR, aCobrarEnEntrega, PAGOS_DESPACHO } from '../../shared/negocio.js';

const ACCIONES = {
  confirmar: { roles: ['gerente'], desde: ['pendiente'], a: 'confirmado', verbo: 'Confirmó' },
  preparar: { roles: ['gerente', 'mostrador'], desde: ['reservado'], a: 'listo', verbo: 'Preparó' },
  cancelar: { roles: ['gerente', 'mostrador', 'cliente'], desde: ['pendiente', 'confirmado', 'reservado', 'listo'], a: 'cancelado', verbo: 'Canceló' },
  salir: { roles: ['gerente', 'mostrador', 'repartidor'], desde: ['listo'], a: 'en_camino', verbo: 'Sacó a reparto' },
  entregar: { roles: ['gerente', 'mostrador', 'repartidor'], desde: ['listo', 'en_camino'], a: 'entregado', verbo: 'Entregó' },
  'no-entregado': { roles: ['gerente', 'mostrador', 'repartidor'], desde: ['en_camino'], a: 'listo', verbo: 'No pudo entregar' },
};

export default endpoint(['gerente', 'mostrador', 'cliente', 'repartidor'], async (b, yo) => {
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
    const envio = p.modoEntrega !== 'retiro';
    if (b.accion === 'salir' && !envio) throw new HttpError(409, 'Ese pedido se retira en el local; no sale a reparto.');
    if (yo.rol === 'repartidor' && !envio) throw new HttpError(403, 'El repartidor solo entrega pedidos con envío.');
    // Lo cobrado en la entrega (lo informa el repartidor o quien la marca); entra en la caja del día.
    let cobro = null;
    if (b.accion === 'entregar' && envio && p.pago !== 'Cuenta corriente' && (b.cobrado != null || yo.rol === 'repartidor')) {
      const monto = b.cobrado == null ? aCobrarEnEntrega(p) : Math.round(Number(b.cobrado));
      if (!(monto >= 0) || monto > (p.total || 0) * 2 + 1) throw new HttpError(400, 'El monto cobrado no es válido.');
      cobro = { cobrado: monto, pagoCobrado: PAGOS_DESPACHO.includes(b.medio) ? b.medio : (p.pago === 'Transferencia' ? 'Transferencia' : 'Efectivo') };
    }
    const motivo = texto(b.motivo, 160);
    if (b.accion === 'no-entregado' && !motivo) throw new HttpError(400, 'Contá por qué no se pudo entregar.');

    // Cuenta corriente: al entregar un pedido mayorista se carga al saldo del cliente.
    const aCuenta = b.accion === 'entregar' && !minorista && p.pago === 'Cuenta corriente' && p.clienteId;
    const cliRef = aCuenta ? base.doc(`clientes/${p.clienteId}`) : null;
    const cliSnap = cliRef ? await t.get(cliRef) : null;
    if (aCuenta && !cliSnap.exists) throw new HttpError(409, 'El cliente de este pedido ya no existe, así que no se puede cargar a su cuenta corriente. Cambiá la forma de pago antes de entregarlo.');

    // Movimientos de stock del despacho (solo reservas minoristas)
    const tocaStock = minorista && (b.accion === 'preparar' || (b.accion === 'cancelar' && p.estado === 'listo'));
    let snaps = [];
    if (tocaStock) {
      const ids = p.items.map((i) => i.articuloId || idArticulo(i.productoId));
      snaps = await t.getAll(...ids.map((id) => base.doc(`articulos/${id}`)));
    }

    // --- Escrituras ---
    if (tocaStock) {
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
    if (cliSnap?.exists) {
      const c = cliSnap.data();
      const antes = Math.round(c.saldo || 0);
      const saldo = antes + Math.round(p.total || 0);
      t.update(cliRef, { saldo, ...(antes <= 0 ? { deudaDesde: fechaAR(0) } : {}) });
      t.set(base.collection('movCuenta').doc(), {
        clienteId: p.clienteId, clienteUid: c.uid || null, clienteNombre: p.clienteNombre, tipo: 'cargo', monto: Math.round(p.total || 0),
        detalle: `Pedido #${p.numero}`, saldo, dia: fechaAR(0), fecha: FieldValue.serverTimestamp(), usuario: yo.nombre || yo.email,
      });
    }

    const cambios = { estado: acc.a, [`${acc.a}En`]: FieldValue.serverTimestamp() };
    if (b.accion === 'entregar') { cambios.entregadoDia = fechaAR(0); cambios.entregadoPor = yo.nombre || yo.email; if (cobro) Object.assign(cambios, cobro); }
    if (b.accion === 'salir') cambios.repartidor = yo.nombre || yo.email;
    if (b.accion === 'no-entregado') cambios.intentos = FieldValue.arrayUnion({ motivo, dia: fechaAR(0), por: yo.nombre || yo.email });
    t.update(ref, cambios);
    registrar(t, yo, `${acc.verbo} ${minorista ? 'la reserva' : 'el pedido'} #${p.numero} de ${p.clienteNombre}${cliSnap?.exists ? ' (a cuenta corriente)' : ''}${cobro ? ` · cobró ${cobro.cobrado.toLocaleString('es-AR')} (${cobro.pagoCobrado})` : ''}${motivo && b.accion === 'no-entregado' ? `: ${motivo}` : ''}`);
    return { numero: p.numero, estado: acc.a, cliente: p.clienteNombre, clienteUid: p.clienteUid, minorista, pedido: p };
  });
  if (!res.minorista) await notificar(`pedido_${res.estado}`, { numero: res.numero, estado: res.estado, cliente: res.cliente, clienteUid: res.clienteUid });
  if (b.accion === 'confirmar') await avisarCliente('confirmado', res.pedido);
  if (b.accion === 'preparar' && res.pedido.modoEntrega === 'retiro') await avisarCliente('reserva-lista', res.pedido);
  if (b.accion === 'salir') await avisarCliente('en-camino', res.pedido);
  const { pedido, ...salida } = res;
  return salida;
});
