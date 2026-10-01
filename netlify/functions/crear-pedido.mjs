// Crea un pedido. Si lo hace un cliente es un pedido web; si lo hace el
// mostrador o el gerente es un pedido de mostrador. Los precios se toman
// siempre de la base de datos, nunca de lo que manda el navegador.
import { db, endpoint, HttpError, FieldValue, registrar, siguienteNumero, notificar, texto } from '../lib/servidor.mjs';
import { fechaAR, esFecha, FORMAS_PAGO, MODOS_ENTREGA, precioPara } from '../../shared/negocio.js';

export default endpoint(['gerente', 'mostrador', 'cliente'], async (b, yo) => {
  const items = (Array.isArray(b.items) ? b.items : [])
    .map((i) => ({ productoId: texto(i.productoId, 60), cantidad: Math.floor(Number(i.cantidad)) }))
    .filter((i) => i.productoId && i.cantidad > 0 && i.cantidad <= 10000);
  if (!items.length) throw new HttpError(400, 'Agregá al menos un producto.');
  if (!esFecha(b.entrega) || b.entrega < fechaAR(1)) throw new HttpError(400, 'La entrega tiene que ser desde mañana.');
  const pago = FORMAS_PAGO.includes(b.pago) ? b.pago : 'Efectivo';
  const modoEntrega = MODOS_ENTREGA.includes(b.modoEntrega) ? b.modoEntrega : 'envio';

  const base = db();
  let cliente;
  let canal;
  let estado = 'pendiente';
  if (yo.rol === 'cliente') {
    canal = 'web';
    const s = await base.doc(`clientes/${yo.clienteId}`).get();
    if (!s.exists) throw new HttpError(400, 'Tu cuenta no tiene un comercio asociado.');
    cliente = { id: s.id, ...s.data() };
  } else {
    canal = 'mostrador';
    if (b.clienteId) {
      const s = await base.doc(`clientes/${texto(b.clienteId, 60)}`).get();
      if (!s.exists) throw new HttpError(400, 'El cliente elegido no existe.');
      cliente = { id: s.id, ...s.data() };
    } else if (texto(b.ocasional)) {
      cliente = { id: null, nombre: texto(b.ocasional, 80), localidad: '', direccion: texto(b.direccionOcasional, 120), telefono: texto(b.telefonoOcasional, 40), uid: null, tipo: b.tipoOcasional === 'mayorista' ? 'mayorista' : 'minorista' };
    } else {
      throw new HttpError(400, 'Elegí un cliente o escribí a nombre de quién es el pedido.');
    }
    if (b.confirmar && yo.rol === 'gerente') estado = 'confirmado';
  }

  const tipoCliente = cliente.tipo === 'minorista' ? 'minorista' : 'mayorista';
  if (modoEntrega === 'envio' && !cliente.direccion && tipoCliente === 'minorista') {
    throw new HttpError(400, 'Para enviar el pedido hace falta una dirección. Si no, elegí "Retira en el local".');
  }

  const res = await base.runTransaction(async (t) => {
    const refs = items.map((i) => base.doc(`productos/${i.productoId}`));
    const snaps = await t.getAll(...refs);
    const num = await siguienteNumero(t, 'pedidos', 1000);
    const lineas = items.map((i, k) => {
      const s = snaps[k];
      if (!s.exists || s.data().activo === false) throw new HttpError(400, 'Uno de los productos ya no está disponible.');
      return { productoId: i.productoId, nombre: s.data().nombre, cantidad: i.cantidad, precio: precioPara(s.data(), tipoCliente) };
    });
    const total = lineas.reduce((a, l) => a + l.cantidad * l.precio, 0);
    const ref = base.collection('pedidos').doc();
    t.set(ref, {
      numero: num.valor,
      clienteId: cliente.id,
      clienteUid: cliente.uid || null,
      clienteNombre: cliente.nombre,
      localidad: cliente.localidad || '',
      direccion: cliente.direccion || '',
      telefono: cliente.telefono || '',
      tipoCliente, modoEntrega,
      canal, entrega: b.entrega, items: lineas, total, pago,
      notas: texto(b.notas, 500),
      estado,
      creado: FieldValue.serverTimestamp(),
      creadoPor: yo.nombre || yo.email,
    });
    num.guardar();
    registrar(t, yo, `${canal === 'web' ? 'Nuevo pedido web' : 'Cargó el pedido'} #${num.valor} de ${cliente.nombre}`);
    return { id: ref.id, numero: num.valor, estado, total, cliente: cliente.nombre, tipoCliente, modoEntrega };
  });

  await notificar('pedido_creado', { ...res, canal, entrega: b.entrega });
  return res;
});
