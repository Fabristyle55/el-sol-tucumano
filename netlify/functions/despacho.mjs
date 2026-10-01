// Despacho: venta al público en el local (productos elaborados y de reventa).
// El mostrador registra cada venta en el momento, sin autorización del gerente.
// Acciones:
//   venta     → registra una venta y descuenta el stock del despacho
//   anular    → anula una venta (solo gerente) y devuelve el stock
//   ingreso   → suma mercadería (reventa que llega, sobrantes, etc.)
//   ajuste    → corrige el stock por conteo
//   articulo  → crea o edita un artículo de reventa (lácteos, bebidas, fiambres…), su oferta y vencimiento
//   merma     → registra lo que sobró, venció o se rompió (sale del stock y queda para el análisis)
//   cierre    → cierre de caja del día: compara el efectivo contado con lo que debería haber
import { db, endpoint, HttpError, FieldValue, registrar, siguienteNumero, texto } from '../lib/servidor.mjs';
import { r3, fechaAR, esFecha, precioArticulo, precioBaseArticulo, cantidadValida, resumenCaja, cobrosDelDia, CATEGORIAS_DESPACHO, PAGOS_DESPACHO, MOTIVOS_MERMA } from '../../shared/negocio.js';

const mov = (t, base, a, cantidad, motivo, yo) => t.set(base.collection('movDespacho').doc(), {
  articuloId: a.id, articuloNombre: a.nombre, unidad: a.unidad || 'u', cantidad, motivo,
  fecha: FieldValue.serverTimestamp(), usuario: yo.nombre || yo.email,
});
const fmt = (n, u) => (u === 'kg' ? `${r3(n)} kg` : `${n} u`);

export default endpoint(['gerente', 'mostrador'], async (b, yo) => {
  const base = db();

  if (b.accion === 'venta') {
    const pedidas = (Array.isArray(b.items) ? b.items : []).map((i) => ({ id: texto(i.articuloId, 60), cantidad: Number(i.cantidad) })).filter((i) => i.id && i.cantidad > 0);
    if (!pedidas.length) throw new HttpError(400, 'Agregá al menos un artículo a la venta.');
    const pago = PAGOS_DESPACHO.includes(b.pago) ? b.pago : 'Efectivo';
    return base.runTransaction(async (t) => {
      const snaps = await t.getAll(...pedidas.map((i) => base.doc(`articulos/${i.id}`)));
      const pids = [...new Set(snaps.filter((s) => s.exists && s.data().productoId).map((s) => s.data().productoId))];
      const prods = pids.length ? await t.getAll(...pids.map((id) => base.doc(`productos/${id}`))) : [];
      const num = await siguienteNumero(t, 'ventas', 0);
      const porId = Object.fromEntries(prods.filter((s) => s.exists).map((s) => [s.id, s.data()]));
      const lineas = pedidas.map((i, k) => {
        const s = snaps[k];
        if (!s.exists) throw new HttpError(400, 'Uno de los artículos ya no existe.');
        const a = { id: s.id, ...s.data() };
        const cantidad = cantidadValida(i.cantidad, a.unidad);
        if (!cantidad) throw new HttpError(400, `Cantidad inválida para ${a.nombre}.`);
        if ((a.stock || 0) < cantidad - 1e-9) throw new HttpError(409, `No alcanza el stock de ${a.nombre}: hay ${fmt(a.stock || 0, a.unidad)}. Si en realidad hay más, corregilo en Stock del despacho.`);
        return { a, cantidad, precio: precioArticulo(a, porId) };
      });
      const items = lineas.map(({ a, cantidad, precio }) => ({ articuloId: a.id, productoId: a.productoId || null, nombre: a.nombre, unidad: a.unidad || 'u', categoria: a.categoria || '', cantidad, precio, oferta: a.oferta || 0, subtotal: Math.round(cantidad * precio) }));
      const total = items.reduce((x, i) => x + i.subtotal, 0);
      const ref = base.collection('ventas').doc();
      t.set(ref, { numero: num.valor, fecha: FieldValue.serverTimestamp(), dia: fechaAR(0), items, total, pago, cliente: texto(b.cliente, 60), vendedor: yo.nombre || yo.email, anulada: false });
      lineas.forEach(({ a, cantidad }) => {
        t.update(base.doc(`articulos/${a.id}`), { stock: r3((a.stock || 0) - cantidad) });
        mov(t, base, a, -cantidad, `Venta #${num.valor}`, yo);
      });
      num.guardar();
      return { id: ref.id, numero: num.valor, total };
    });
  }

  if (b.accion === 'anular') {
    if (yo.rol !== 'gerente') throw new HttpError(403, 'Solo el gerente puede anular ventas.');
    return base.runTransaction(async (t) => {
      const ref = base.doc(`ventas/${texto(b.id, 60)}`);
      const s = await t.get(ref);
      if (!s.exists) throw new HttpError(404, 'La venta no existe.');
      const v = s.data();
      if (v.anulada) throw new HttpError(409, 'La venta ya estaba anulada.');
      const arts = await t.getAll(...v.items.map((i) => base.doc(`articulos/${i.articuloId}`)));
      v.items.forEach((i, k) => {
        if (!arts[k].exists) return;
        const a = { id: arts[k].id, ...arts[k].data() };
        t.update(arts[k].ref, { stock: r3((a.stock || 0) + i.cantidad) });
        mov(t, base, a, i.cantidad, `Anulación venta #${v.numero}`, yo);
      });
      t.update(ref, { anulada: true, anuladaPor: yo.nombre || yo.email, anuladaEn: FieldValue.serverTimestamp() });
      registrar(t, yo, `Anuló la venta #${v.numero} del despacho ($${v.total})`);
      return { numero: v.numero };
    });
  }

  if (b.accion === 'ingreso' || b.accion === 'ajuste') {
    return base.runTransaction(async (t) => {
      const ref = base.doc(`articulos/${texto(b.articuloId, 60)}`);
      const s = await t.get(ref);
      if (!s.exists) throw new HttpError(404, 'El artículo no existe.');
      const a = { id: s.id, ...s.data() };
      const n = Number(b.cantidad);
      if (b.accion === 'ingreso' && !cantidadValida(n, a.unidad)) throw new HttpError(400, 'Ingresá una cantidad mayor a cero.');
      if (b.accion === 'ajuste' && !(n >= 0)) throw new HttpError(400, 'Ingresá la cantidad contada.');
      const delta = b.accion === 'ingreso' ? cantidadValida(n, a.unidad) : r3(n - (a.stock || 0));
      const nuevo = r3((a.stock || 0) + delta);
      const cambios = { stock: nuevo };
      // Vencimiento: se guarda el más próximo de lo que hay en el despacho.
      if (b.accion === 'ingreso' && esFecha(b.vence)) cambios.vence = (a.stock > 0 && esFecha(a.vence) && a.vence < b.vence) ? a.vence : b.vence;
      else if (b.accion === 'ingreso' && !(a.stock > 0)) cambios.vence = FieldValue.delete();
      if (nuevo <= 0) cambios.vence = FieldValue.delete();
      t.update(ref, cambios);
      const motivo = texto(b.motivo, 120) || (b.accion === 'ingreso' ? 'Ingreso de mercadería' : 'Ajuste por conteo');
      mov(t, base, a, delta, motivo, yo);
      registrar(t, yo, `${b.accion === 'ingreso' ? 'Ingresó' : 'Ajustó'} ${a.nombre} en el despacho: ${delta > 0 ? '+' : ''}${fmt(delta, a.unidad)}`);
      return { stock: nuevo };
    });
  }

  if (b.accion === 'merma') {
    const motivo = MOTIVOS_MERMA.includes(b.motivo) ? b.motivo : 'Otro';
    return base.runTransaction(async (t) => {
      const ref = base.doc(`articulos/${texto(b.articuloId, 60)}`);
      const s = await t.get(ref);
      if (!s.exists) throw new HttpError(404, 'El artículo no existe.');
      const a = { id: s.id, ...s.data() };
      const pr = a.productoId ? await t.get(base.doc(`productos/${a.productoId}`)) : null;
      const cantidad = cantidadValida(b.cantidad, a.unidad);
      if (!cantidad) throw new HttpError(400, 'Ingresá una cantidad mayor a cero.');
      if (cantidad > (a.stock || 0) + 1e-9) throw new HttpError(409, `No podés dar de baja más de lo que hay (${fmt(a.stock || 0, a.unidad)}).`);
      const nuevo = r3((a.stock || 0) - cantidad);
      t.update(ref, nuevo <= 0 ? { stock: nuevo, vence: FieldValue.delete() } : { stock: nuevo });
      const nota = texto(b.nota, 120);
      mov(t, base, a, -cantidad, `Merma: ${motivo}${nota ? ` (${nota})` : ''}`, yo);
      const precio = precioBaseArticulo(a, pr?.exists ? { [a.productoId]: pr.data() } : {});
      t.set(base.collection('mermas').doc(), {
        articuloId: a.id, articuloNombre: a.nombre, productoId: a.productoId || null, unidad: a.unidad || 'u', cantidad, motivo, nota,
        valor: Math.round(cantidad * precio), dia: fechaAR(0), fecha: FieldValue.serverTimestamp(), usuario: yo.nombre || yo.email,
      });
      registrar(t, yo, `Dio de baja ${fmt(cantidad, a.unidad)} de ${a.nombre} del despacho (${motivo.toLowerCase()})`);
      return { stock: nuevo };
    });
  }

  if (b.accion === 'cierre') {
    const dia = fechaAR(0);
    const fondo = Math.max(0, Math.round(Number(b.fondo) || 0));
    const contado = Math.round(Number(b.contado));
    if (!(contado >= 0)) throw new HttpError(400, 'Ingresá el efectivo que contaste en la caja.');
    return base.runTransaction(async (t) => {
      const ref = base.doc(`cierres/${dia}`);
      const prev = await t.get(ref);
      if (prev.exists && yo.rol !== 'gerente') throw new HttpError(409, 'La caja de hoy ya se cerró. Si hay que corregirla, pedíselo al gerente.');
      const vs = await t.get(base.collection('ventas').where('dia', '==', dia));
      const rs = await t.get(base.collection('pedidos').where('entregadoDia', '==', dia));
      const ventas = vs.docs.map((d) => d.data());
      const reservas = cobrosDelDia(rs.docs.map((d) => d.data()));
      const r = resumenCaja(ventas, reservas);
      const esperado = fondo + r.efectivo;
      const diferencia = contado - esperado;
      t.set(ref, {
        dia, fondo, contado, esperado, diferencia, efectivo: r.efectivo, total: r.total, porPago: r.porPago,
        ventas: ventas.filter((v) => !v.anulada).length, reservas: reservas.length, notas: texto(b.notas, 300),
        cerradoPor: yo.nombre || yo.email, fecha: FieldValue.serverTimestamp(), ...(prev.exists ? { corregido: true } : {}),
      });
      registrar(t, yo, `${prev.exists ? 'Corrigió' : 'Hizo'} el cierre de caja del despacho: ${diferencia === 0 ? 'sin diferencias' : `${diferencia > 0 ? 'sobran' : 'faltan'} $${Math.abs(diferencia).toLocaleString('es-AR')}`}`);
      return { esperado, contado, diferencia };
    });
  }

  if (b.accion === 'articulo') {
    const nombre = texto(b.nombre, 80);
    if (!nombre) throw new HttpError(400, 'Escribí el nombre del artículo.');
    const datos = {
      nombre,
      categoria: CATEGORIAS_DESPACHO.includes(b.categoria) ? b.categoria : 'Almacén',
      unidad: b.unidad === 'kg' ? 'kg' : 'u',
      minimo: Math.max(0, Number(b.minimo) || 0),
      activo: b.activo !== false,
      oferta: Math.min(70, Math.max(0, Math.round(Number(b.oferta) || 0))),
      vence: esFecha(b.vence) ? b.vence : FieldValue.delete(),
    };
    const ref = b.id ? base.doc(`articulos/${texto(b.id, 60)}`) : base.collection('articulos').doc();
    const s = b.id ? await ref.get() : null;
    if (b.id && !s.exists) throw new HttpError(404, 'El artículo no existe.');
    const elaborado = !!s?.data()?.productoId;
    if (!elaborado) {
      const precio = Math.round(Number(b.precio));
      if (!(precio > 0)) throw new HttpError(400, 'Poné un precio mayor a cero.');
      datos.precio = precio;
    } else {
      delete datos.categoria; delete datos.nombre; // los elaborados toman nombre y precio del producto
    }
    if (b.id) await ref.update(datos);
    else { if (!esFecha(b.vence)) delete datos.vence; await ref.set({ ...datos, tipo: 'reventa', stock: 0, creado: FieldValue.serverTimestamp() }); }
    const nombreLog = elaborado ? s.data().nombre : nombre;
    await base.runTransaction(async (t) => registrar(t, yo, `${b.id ? 'Editó' : 'Agregó'} el artículo ${nombreLog} del despacho${datos.oferta ? ` (oferta ${datos.oferta} %)` : ''}`));
    return { id: ref.id };
  }

  throw new HttpError(400, 'Acción desconocida.');
});
