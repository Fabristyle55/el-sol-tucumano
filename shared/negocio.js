// Lógica de negocio compartida entre el frontend (React) y el backend (Netlify Functions).
// Todo lo que calcula insumos, reservas y alertas de compra vive acá para que
// ambos lados den exactamente el mismo resultado.

export const ROLES_STAFF = ['gerente', 'mostrador', 'panadero', 'deposito'];
export const FORMAS_PAGO = ['Efectivo', 'Transferencia', 'Cuenta corriente'];
export const TIPOS_CLIENTE = ['mayorista', 'minorista'];
export const MODOS_ENTREGA = ['envio', 'retiro'];

/** Precio de un producto según el tipo de cliente. Si no hay precio minorista se usa el mayorista. */
export function precioPara(producto, tipo) {
  if (tipo === 'minorista' && Number(producto?.precioMinorista) > 0) return producto.precioMinorista;
  return producto?.precio || 0;
}
export const ZONA = 'America/Argentina/Buenos_Aires';

// ---------- Despacho (venta al público) ----------
export const CATEGORIAS_DESPACHO = ['Panificados', 'Lácteos', 'Bebidas', 'Fiambres', 'Almacén'];
export const PAGOS_DESPACHO = ['Efectivo', 'Transferencia', 'Débito', 'Crédito', 'Mercado Pago'];
/** Id del artículo del despacho que corresponde a un producto elaborado. */
export const idArticulo = (productoId) => `e-${productoId}`;
/** Precio de lista de un artículo del despacho: los elaborados usan el precio minorista del producto. */
export function precioBaseArticulo(articulo, productosPorId = {}) {
  if (articulo?.productoId) return precioPara(productosPorId[articulo.productoId] || {}, 'minorista') || articulo.precio || 0;
  return articulo?.precio || 0;
}
/** Precio de venta de un artículo del despacho, con el descuento de oferta si tiene. */
export function precioArticulo(articulo, productosPorId = {}) {
  const base = precioBaseArticulo(articulo, productosPorId);
  const oferta = Math.min(70, Math.max(0, Math.round(Number(articulo?.oferta) || 0)));
  return oferta ? Math.round((base * (100 - oferta)) / 100) : base;
}

// ---------- Vencimientos (reventa) ----------
export const DIAS_AVISO_VENCE = 3;
const utc = (iso) => { const [y, m, d] = iso.split('-').map(Number); return Date.UTC(y, m - 1, d); };
/** Días que van de la fecha a a la fecha b (negativo si b es anterior). */
export const diasEntre = (a, b) => Math.round((utc(b) - utc(a)) / 864e5);
/** Día de la semana de una fecha 'AAAA-MM-DD' (0 = domingo). */
export const diaSemana = (iso) => new Date(utc(iso)).getUTCDay();
export const DIAS_SEMANA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
/** Estado de vencimiento de un artículo con stock: null, 'ok', 'pronto' o 'vencido'. */
export function vencimiento(articulo, hoyISO) {
  if (!articulo?.vence || !esFecha(articulo.vence) || !((articulo.stock || 0) > 0)) return null;
  const dias = diasEntre(hoyISO, articulo.vence);
  return { dias, estado: dias < 0 ? 'vencido' : dias <= DIAS_AVISO_VENCE ? 'pronto' : 'ok' };
}

// ---------- Mermas ----------
export const MOTIVOS_MERMA = ['No se vendió', 'Vencido', 'Roto o dañado', 'Otro'];
/**
 * Sugerencia de "extra para el local" a partir de la última semana:
 * lo que se horneó de más menos lo que sobró, promediado por día de producción.
 */
export function extraSugerido(ordenes, mermas, productoId, hoyISO, dias = 7) {
  const desde = sumarDias(hoyISO, -dias);
  const ops = ordenes.filter((o) => o.productoId === productoId && o.fecha >= desde && o.fecha <= hoyISO && o.estado === 'terminada' && o.extra > 0);
  const producido = ops.reduce((a, o) => a + o.extra, 0);
  const sobro = r3(mermas.filter((m) => m.productoId === productoId && m.dia >= desde && m.dia <= hoyISO).reduce((a, m) => a + m.cantidad, 0));
  if (!producido && !sobro) return null;
  const nDias = Math.max(1, new Set(ops.map((o) => o.fecha)).size);
  return { producido, sobro, sugerido: Math.max(0, Math.round((producido - sobro) / nDias)) };
}

// ---------- Caja del despacho ----------
/** Totales por forma de pago de un día: ventas no anuladas + reservas retiradas. */
export function resumenCaja(ventas, reservas = []) {
  const porPago = {};
  for (const v of ventas) if (!v.anulada) porPago[v.pago] = (porPago[v.pago] || 0) + (v.total || 0);
  for (const p of reservas) porPago[p.pago] = (porPago[p.pago] || 0) + (p.total || 0);
  const total = Object.values(porPago).reduce((a, b) => a + b, 0);
  return { porPago, efectivo: porPago.Efectivo || 0, total };
}

// ---------- Cuenta corriente (mayoristas) ----------
export const PLAZO_CC = 15;
/** Estado de la cuenta de un cliente: 'al-dia', 'debe' o 'vencida' (deuda más vieja que el plazo). */
export function estadoCuenta(cliente, hoyISO) {
  const saldo = Math.round(cliente?.saldo || 0);
  const plazo = cliente?.plazoDias || PLAZO_CC;
  if (saldo <= 0) return { saldo, dias: 0, plazo, estado: 'al-dia' };
  const dias = cliente.deudaDesde && esFecha(cliente.deudaDesde) ? diasEntre(cliente.deudaDesde, hoyISO) : 0;
  return { saldo, dias, plazo, estado: dias > plazo ? 'vencida' : 'debe' };
}

// ---------- Costos ----------
/** Costo de una unidad de producto según su receta y el costo de cada insumo. */
export function costoProducto(producto, insumosPorId) {
  let total = 0; let completo = true;
  for (const [iid, q] of Object.entries(producto?.receta || {})) {
    const c = Number(insumosPorId[iid]?.costo);
    if (c > 0) total += q * c; else completo = false;
  }
  return { costo: Math.round(total), completo };
}
export const margen = (precio, costo) => ({ monto: Math.round((precio || 0) - costo), pct: precio > 0 ? Math.round(((precio - costo) / precio) * 100) : 0 });
/** Cantidad válida según la unidad: enteros para "u", hasta 3 decimales para "kg". */
export function cantidadValida(n, unidad) {
  const x = Number(n);
  if (!(x > 0) || x > 10000) return 0;
  return unidad === 'kg' ? Math.round(x * 1000) / 1000 : Math.floor(x);
}
/** Los pedidos minoristas se arman con lo del despacho; no entran en la planificación. */
export const vaAProduccion = (pedido) => pedido.tipoCliente !== 'minorista';

export const r3 = (n) => Math.round(n * 1000) / 1000;

/** Fecha de hoy (más un desplazamiento en días) en Argentina, como 'AAAA-MM-DD'. */
export function fechaAR(offsetDias = 0) {
  const base = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
  return offsetDias ? sumarDias(base, offsetDias) : base;
}

export function sumarDias(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export const esFecha = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

/** Suma las cantidades pedidas por producto: { productoId: cantidad } */
export function totalesPorProducto(pedidos) {
  const t = {};
  for (const p of pedidos) for (const it of p.items || []) {
    t[it.productoId] = (t[it.productoId] || 0) + it.cantidad;
  }
  return t;
}

/**
 * "Explosión" de la lista de materiales: multiplica cada cantidad de producto
 * por su receta y devuelve { insumoId: cantidadNecesaria }.
 */
export function explotar(cantidades, productosPorId) {
  const nec = {};
  for (const [pid, q] of Object.entries(cantidades)) {
    if (!q) continue;
    const receta = productosPorId[pid]?.receta || {};
    for (const [iid, x] of Object.entries(receta)) nec[iid] = r3((nec[iid] || 0) + q * x);
  }
  return nec;
}

/** Insumos comprometidos por órdenes de producción que todavía no se terminaron. */
export function reservado(ordenes) {
  const r = {};
  for (const o of ordenes) {
    if (o.estado === 'terminada') continue;
    for (const [iid, q] of Object.entries(o.insumos || {})) r[iid] = r3((r[iid] || 0) + q);
  }
  return r;
}

/** Cantidad de cada insumo en compras autorizadas que todavía no llegaron. */
export function enCamino(compras) {
  const r = {};
  for (const c of compras) if (c.estado === 'autorizada') r[c.insumoId] = r3((r[c.insumoId] || 0) + c.cantidad);
  return r;
}

/**
 * Proyección de stock y alertas de compra.
 * proyectado = stock − reservado − (pedidos confirmados sin planificar) + compras en camino
 * Hay alerta cuando el proyectado queda por debajo del stock de seguridad.
 */
export function proyeccion({ insumos, ordenes, pedidos, compras, productosPorId }) {
  const res = reservado(ordenes);
  const pend = explotar(totalesPorProducto(pedidos.filter((p) => p.estado === 'confirmado' && vaAProduccion(p))), productosPorId);
  const cam = enCamino(compras);
  return insumos.map((i) => {
    const proyectado = r3(i.stock - (res[i.id] || 0) - (pend[i.id] || 0) + (cam[i.id] || 0));
    const pack = i.pack || 1;
    const sugerido = Math.max(pack, Math.ceil((i.seguridad * 1.5 - proyectado) / pack) * pack);
    return {
      ...i,
      reservado: res[i.id] || 0,
      disponible: r3(i.stock - (res[i.id] || 0)),
      pendiente: pend[i.id] || 0,
      enCamino: cam[i.id] || 0,
      proyectado,
      alerta: proyectado < i.seguridad,
      sugerido,
    };
  });
}

/** Compara lo necesario contra lo disponible y devuelve los faltantes. */
export function faltantes(necesario, insumosPorId, reservas) {
  const out = [];
  for (const [iid, q] of Object.entries(necesario)) {
    const i = insumosPorId[iid];
    const disp = r3((i?.stock || 0) - (reservas[iid] || 0));
    if (q > disp + 1e-9) out.push({ insumoId: iid, nombre: i?.nombre || iid, unidad: i?.unidad || '', falta: r3(q - disp) });
  }
  return out;
}
