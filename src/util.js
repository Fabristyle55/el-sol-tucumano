import { fechaAR, sumarDias, linkWhatsApp } from '../shared/negocio.js';

export const ROLES = {
  gerente: { label: 'Gerente', vistas: ['panel', 'despacho', 'pedidos', 'planificacion', 'produccion', 'stock', 'compras', 'recetas', 'productos', 'cuentas', 'promociones', 'reportes', 'historial', 'usuarios', 'recorrido'], rutas: ['reparto', 'entregas', 'comprobante'] },
  mostrador: { label: 'Mostrador', vistas: ['despacho', 'pedidos', 'productos'], rutas: ['reparto', 'entregas', 'comprobante'] },
  panadero: { label: 'Panadero', vistas: ['produccion', 'recetas'], rutas: [] },
  deposito: { label: 'Depósito', vistas: ['stock', 'compras'], rutas: [] },
  repartidor: { label: 'Repartidor', vistas: ['entregas'], rutas: [] },
  cliente: { label: 'Cliente', vistas: ['catalogo', 'mis-pedidos'], rutas: ['comprobante'] },
};

export const VISTAS = {
  panel: ['Panel', 'Lo que pasa hoy en la panadería y lo que necesita tu decisión.'],
  despacho: ['Despacho', 'Venta al público en el local: cobrar, reservas para retirar, stock, caja y lo vendido en el día.'],
  pedidos: ['Pedidos', 'Pedidos mayoristas y reservas minoristas, de la web y del mostrador, con su estado.'],
  planificacion: ['Planificación', 'Cruza los pedidos confirmados con las recetas y calcula los insumos para cada día de entrega.'],
  produccion: ['Producción', 'Qué y cuánto amasar y hornear. Al terminar una orden se descuentan los insumos del stock.'],
  stock: ['Stock', 'Materias primas disponibles, reservadas para producción y por debajo del stock de seguridad.'],
  productos: ['Productos', 'Fotos de cada producto para el catálogo y lo que opinan los clientes.'],
  recetas: ['Recetas', 'Insumos por unidad de cada producto, su costo y el margen que deja. Son la base del cálculo de producción.'],
  compras: ['Compras', 'Insumos que van a quedar por debajo del stock de seguridad y pedidos a proveedores.'],
  cuentas: ['Cuentas corrientes', 'Saldo de cada comercio mayorista, pagos y deudas vencidas.'],
  reportes: ['Reportes', 'Ventas por mes, productos más vendidos, consumo de insumos y mayoristas contra minoristas.'],
  historial: ['Historial y respaldos', 'Quién hizo cada cosa en el sistema y cuándo, y las copias de seguridad de los datos.'],
  usuarios: ['Usuarios y clientes', 'Cuentas del personal con su rol, comercios mayoristas y clientes minoristas.'],
  recorrido: ['Recorrido de demostración', 'Un pedido de punta a punta, paso a paso y con datos reales del sistema, para mostrar cómo funciona.'],
  entregas: ['Entregas del día', 'Tu recorrido: cómo llegar, avisar al cliente, cobrar y marcar cada entrega.'],
  promociones: ['Promociones y cupones', 'Descuentos por cantidad para los comercios y cupones con código.'],
  reparto: ['Hoja de reparto', 'Pedidos con envío del día, ordenados por zona, para imprimir y llevar en el reparto.'],
  comprobante: ['Comprobante', 'Descargalo en PDF o imprimilo.'],
  catalogo: ['Catálogo', 'Elegí productos y el día de entrega o de retiro. Tocá las estrellas para ver opiniones o dejar la tuya.'],
  'mis-pedidos': ['Mis pedidos', 'Seguí el estado de cada pedido, repetí uno anterior o dejá armado tu pedido fijo.'],
};

export const EST = {
  pendiente: ['Pendiente', 'warn'], reservado: ['Reservado', 'info'], confirmado: ['Confirmado', 'info'], produccion: ['En producción', 'brand'],
  listo: ['Listo para reparto', 'gold'], en_camino: ['En camino', 'brand'], entregado: ['Entregado', 'ok'], cancelado: ['Cancelado', 'bad'],
};
export const OPEST = { pendiente: ['Por hacer', 'warn'], en_curso: ['En curso', 'brand'], terminada: ['Terminada', 'ok'] };

export const hoy = () => fechaAR(0);
export const manana = () => fechaAR(1);
export { sumarDias };

const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const dShort = (s) => new Intl.DateTimeFormat('es-AR', { weekday: 'short', day: 'numeric', month: 'short' }).format(parse(s));
export const dRel = (s) => (s === hoy() ? 'Hoy' : s === manana() ? 'Mañana' : dShort(s));
export const aFecha = (ts) => (ts?.toDate ? ts.toDate() : ts ? new Date(ts) : null);
export const hhmm = (ts) => { const d = aFecha(ts); return d ? new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d) : '—'; };
export const cuando = (ts) => {
  const d = aFecha(ts); if (!d) return '…';
  const inicio = new Date(); inicio.setHours(0, 0, 0, 0);
  return d >= inicio ? hhmm(d) : new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short' }).format(d);
};
export const money = (n) => '$' + Math.round(n || 0).toLocaleString('es-AR');
export const fq = (n, u) => (u === 'u' ? Math.ceil((n || 0) - 1e-9).toLocaleString('es-AR') : (n || 0).toLocaleString('es-AR', { maximumFractionDigits: 2 }));
export const porId = (arr) => Object.fromEntries(arr.map((x) => [x.id, x]));
export const abrev = (nombre) => nombre.split(/\s+/).filter((w) => /^[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(w)).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
/** Estado para mostrar: las reservas minoristas se retiran en el despacho. */
export const estadoDe = (p) => (p.tipoCliente === 'minorista'
  ? ({ listo: ['Listo para retirar', 'gold'], entregado: ['Retirado', 'ok'] }[p.estado] || EST[p.estado])
  : EST[p.estado]) || [p.estado, 'info'];
/** Cantidad con unidad: "2" o "0,25 kg". */
export const cant = (n, u) => (u === 'kg' ? `${(n || 0).toLocaleString('es-AR', { maximumFractionDigits: 3 })} kg` : `${n}`);
export const TIPO_LABEL = { mayorista: 'Mayorista', minorista: 'Minorista' };
export const ENTREGA_LABEL = { envio: 'Envío', retiro: 'Retira en el local' };
export const CANAL_LABEL = { web: 'Web', mostrador: 'Mostrador', fijo: 'Pedido fijo' };
/** Fecha 'AAAA-MM-DD' como 01/10/2026. */
export const dLarga = (s) => (s ? s.split('-').reverse().join('/') : '');
export const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export const mesCorto = (ym) => `${MESES[+ym.slice(5, 7) - 1]} ${ym.slice(2, 4)}`;
export const LOCALIDADES = ['San Miguel de Tucumán', 'Yerba Buena', 'Tafí Viejo', 'Banda del Río Salí', 'Las Talitas', 'Lules', 'Alderetes', 'Famaillá', 'Otra'];

/** Mensaje de WhatsApp para avisarle al cliente cómo va su pedido. */
export function mensajeEstado(p) {
  const n = `#${p.numero}`;
  const hola = `Hola ${(p.clienteNombre || '').split(' ')[0]}, te escribimos de Panificación El Sol Siciliano.`;
  const retiro = p.modoEntrega === 'retiro';
  const t = {
    pendiente: `Recibimos tu pedido ${n} para el ${dLarga(p.entrega)}. En breve lo confirmamos.`,
    reservado: `Recibimos tu reserva ${n} para retirar el ${dLarga(p.entrega)}.`,
    confirmado: `Tu pedido ${n} para el ${dLarga(p.entrega)} está confirmado.`,
    produccion: `Tu pedido ${n} ya está en el horno.`,
    listo: retiro ? `Tu pedido ${n} está listo. Podés pasar a retirarlo por el local.` : `Tu pedido ${n} está listo y sale en el próximo reparto.`,
    en_camino: `Tu pedido ${n} está en camino. En un rato llega el repartidor.`,
    entregado: `Gracias por tu compra. Tu pedido ${n} figura como entregado.`,
    cancelado: `Tu pedido ${n} fue cancelado. Cualquier consulta, respondé este mensaje.`,
  }[p.estado] || `Te escribimos por tu pedido ${n}.`;
  return `${hola} ${t} Total: ${money(p.total)}.`;
}
/** Link de WhatsApp al teléfono del cliente del pedido, o '' si no tiene teléfono válido. */
export const waPedido = (p, texto) => linkWhatsApp(p.telefono, texto || mensajeEstado(p));
/** Link a Google Maps con la dirección del pedido. */
export const mapaPedido = (p) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([p.direccion, p.localidad || 'San Miguel de Tucumán', 'Tucumán, Argentina'].filter(Boolean).join(', '))}`;
