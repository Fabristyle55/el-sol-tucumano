// Crea un pedido. Si lo hace un cliente es un pedido web; si lo hace el
// mostrador o el gerente es un pedido de mostrador. Los precios se toman
// siempre de la base de datos, nunca de lo que manda el navegador.
//
// Mayoristas: se arman con productos elaborados por pedido; quedan "pendientes"
//   hasta que el gerente los confirma y después entran en la planificación.
// Minoristas: se arman con lo que hay en el despacho (elaborados y reventa);
//   entran directamente como "reservados", sin autorización del gerente.
import { db, endpoint, HttpError, FieldValue, registrar, siguienteNumero, notificar, texto, avisarCliente } from '../lib/servidor.mjs';
import { fechaAR, esFecha, FORMAS_PAGO, MODOS_ENTREGA, precioPara, precioArticulo, cantidadValida, estadoCuenta, aplicarPromos, codigoCupon, promoVigente } from '../../shared/negocio.js';

export default endpoint(['gerente', 'mostrador', 'cliente'], async (b, yo) => {
  const pago = FORMAS_PAGO.includes(b.pago) || ['Débito', 'Crédito', 'Mercado Pago'].includes(b.pago) ? b.pago : 'Efectivo';
  const base = db();

  // 1) Cliente y canal
  let cliente;
  let canal;
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
  }
  const tipoCliente = cliente.tipo === 'minorista' ? 'minorista' : 'mayorista';
  const minorista = tipoCliente === 'minorista';
  const modoEntrega = MODOS_ENTREGA.includes(b.modoEntrega) ? b.modoEntrega : (minorista ? 'retiro' : 'envio');
  if (modoEntrega === 'envio' && !cliente.direccion && minorista) {
    throw new HttpError(400, 'Para enviar el pedido hace falta una dirección. Si no, elegí "Retira en el local".');
  }

  // Cuenta corriente: solo para comercios mayoristas registrados y sin deuda vencida.
  if (pago === 'Cuenta corriente') {
    if (minorista || !cliente.id) throw new HttpError(400, 'La cuenta corriente es solo para comercios mayoristas registrados. Elegí otra forma de pago.');
    const ec = estadoCuenta(cliente, fechaAR(0));
    if (ec.estado === 'vencida' && yo.rol === 'cliente') throw new HttpError(409, `Tenés un saldo vencido de $${ec.saldo.toLocaleString('es-AR')} en tu cuenta corriente. Elegí otra forma de pago o comunicate con el local.`);
  }

  // 2) Fecha: los mayoristas desde mañana (hay que producir); los minoristas pueden retirar hoy.
  const minFecha = fechaAR(minorista ? 0 : 1);
  if (!esFecha(b.entrega) || b.entrega < minFecha) throw new HttpError(400, minorista ? 'La fecha de retiro no puede ser anterior a hoy.' : 'La entrega tiene que ser desde mañana.');

  // 3) Estado inicial
  let estado = 'pendiente';
  if (minorista) estado = 'reservado';
  else if (b.confirmar && yo.rol === 'gerente') estado = 'confirmado';

  // Promociones por cantidad vigentes y cupón (si mandaron uno).
  const promos = (await base.collection('promos').where('tipo', '==', 'cantidad').get()).docs.map((d) => ({ id: d.id, ...d.data() }));
  const codigo = codigoCupon(b.cupon);

  const crudos = Array.isArray(b.items) ? b.items : [];
  const res = await base.runTransaction(async (t) => {
    let lineas;
    if (minorista) {
      const pedidas = crudos.map((i) => ({ id: texto(i.articuloId, 60), cantidad: Number(i.cantidad) })).filter((i) => i.id && i.cantidad > 0);
      if (!pedidas.length) throw new HttpError(400, 'Agregá al menos un artículo.');
      const snaps = await t.getAll(...pedidas.map((i) => base.doc(`articulos/${i.id}`)));
      const pids = [...new Set(snaps.filter((s) => s.exists && s.data().productoId).map((s) => s.data().productoId))];
      const prods = pids.length ? await t.getAll(...pids.map((id) => base.doc(`productos/${id}`))) : [];
      const porId = Object.fromEntries(prods.filter((s) => s.exists).map((s) => [s.id, s.data()]));
      lineas = pedidas.map((i, k) => {
        const s = snaps[k];
        if (!s.exists || s.data().activo === false) throw new HttpError(400, 'Uno de los artículos ya no está disponible.');
        const a = { id: s.id, ...s.data() };
        const cantidad = cantidadValida(i.cantidad, a.unidad);
        if (!cantidad) throw new HttpError(400, `Cantidad inválida para ${a.nombre}.`);
        if ((a.stock || 0) < cantidad - 1e-9) throw new HttpError(409, `De ${a.nombre} quedan ${a.stock || 0} ${a.unidad === 'kg' ? 'kg' : 'u'} en el despacho.`);
        return { articuloId: a.id, productoId: a.productoId || null, nombre: a.nombre, unidad: a.unidad || 'u', cantidad, precio: precioArticulo(a, porId) };
      });
    } else {
      const items = crudos.map((i) => ({ productoId: texto(i.productoId, 60), cantidad: Math.floor(Number(i.cantidad)) })).filter((i) => i.productoId && i.cantidad > 0 && i.cantidad <= 10000);
      if (!items.length) throw new HttpError(400, 'Agregá al menos un producto.');
      const snaps = await t.getAll(...items.map((i) => base.doc(`productos/${i.productoId}`)));
      lineas = items.map((i, k) => {
        const s = snaps[k];
        if (!s.exists || s.data().activo === false) throw new HttpError(400, 'Uno de los productos ya no está disponible.');
        return { productoId: i.productoId, nombre: s.data().nombre, cantidad: i.cantidad, precio: precioPara(s.data(), tipoCliente) };
      });
    }
    let cupon = null; let cuponRef = null;
    if (codigo) {
      cuponRef = base.doc(`promos/cupon-${codigo}`);
      const cs = await t.get(cuponRef);
      if (!cs.exists) throw new HttpError(400, 'El cupón no existe. Sacalo o revisá el código.');
      cupon = cs.data();
      if (!promoVigente(cupon, tipoCliente, fechaAR(0))) throw new HttpError(409, 'El cupón ya no está vigente. Sacalo para continuar.');
    }
    const calc = aplicarPromos(lineas, promos, tipoCliente, cupon, fechaAR(0));
    if (cupon && !calc.cuponOk) throw new HttpError(409, calc.motivoCupon);
    lineas = calc.lineas;
    const num = await siguienteNumero(t, 'pedidos', 1000);
    const total = calc.total;
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
      canal, entrega: b.entrega, items: lineas, subtotal: calc.subtotal, descuento: calc.descuento, ...(cupon ? { cupon: codigo, descCupon: calc.descCupon } : {}), total, pago,
      notas: texto(b.notas, 500),
      estado,
      creado: FieldValue.serverTimestamp(),
      creadoPor: yo.nombre || yo.email,
    });
    num.guardar();
    if (cuponRef) t.update(cuponRef, { usos: FieldValue.increment(1) });
    const que = minorista ? 'Reserva' : (canal === 'web' ? 'Nuevo pedido web' : 'Pedido de mostrador');
    registrar(t, yo, `${que} #${num.valor} de ${cliente.nombre}${calc.descuento ? ` (descuento $${calc.descuento.toLocaleString('es-AR')}${cupon ? `, cupón ${codigo}` : ''})` : ''}`);
    return {
      id: ref.id, numero: num.valor, estado, total, cliente: cliente.nombre, tipoCliente, modoEntrega,
      pedido: { numero: num.valor, clienteId: cliente.id, clienteUid: cliente.uid || null, clienteNombre: cliente.nombre, entrega: b.entrega, items: lineas, total },
    };
  });

  // Solo los pedidos mayoristas avisan al gerente (los minoristas los atiende el mostrador).
  if (!minorista) await notificar('pedido_creado', { ...res, canal, entrega: b.entrega });
  if (canal === 'web') await avisarCliente(minorista ? 'reserva' : 'recibido', res.pedido);
  const { pedido, ...salida } = res;
  return salida;
});
