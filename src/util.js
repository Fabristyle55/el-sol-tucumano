import { fechaAR, sumarDias } from '../shared/negocio.js';

export const ROLES = {
  gerente: { label: 'Gerente', vistas: ['panel', 'pedidos', 'planificacion', 'produccion', 'stock', 'productos', 'recetas', 'compras', 'usuarios'] },
  mostrador: { label: 'Mostrador', vistas: ['pedidos', 'productos'] },
  panadero: { label: 'Panadero', vistas: ['produccion', 'recetas'] },
  deposito: { label: 'Depósito', vistas: ['stock', 'compras'] },
  cliente: { label: 'Cliente', vistas: ['catalogo', 'mis-pedidos'] },
};

export const VISTAS = {
  panel: ['Panel', 'Lo que pasa hoy en la panadería y lo que necesita tu decisión.'],
  pedidos: ['Pedidos', 'Pedidos de la web y del mostrador en un solo lugar, con su estado.'],
  planificacion: ['Planificación', 'Cruza los pedidos confirmados con las recetas y calcula los insumos para cada día de entrega.'],
  produccion: ['Producción', 'Qué y cuánto amasar y hornear. Al terminar una orden se descuentan los insumos del stock.'],
  stock: ['Stock', 'Materias primas disponibles, reservadas para producción y por debajo del stock de seguridad.'],
  productos: ['Productos', 'Fotos de cada producto para el catálogo y lo que opinan los clientes.'],
  recetas: ['Recetas', 'Insumos necesarios por unidad de cada producto. Son la base del cálculo de producción.'],
  compras: ['Compras', 'Insumos que van a quedar por debajo del stock de seguridad y pedidos a proveedores.'],
  usuarios: ['Usuarios y clientes', 'Cuentas del personal con su rol, comercios mayoristas y clientes minoristas.'],
  catalogo: ['Catálogo', 'Elegí productos, día de entrega y si lo retirás o te lo enviamos. Tocá las estrellas para ver opiniones o dejar la tuya.'],
  'mis-pedidos': ['Mis pedidos', 'Seguí el estado de cada pedido hasta la entrega.'],
};

export const EST = {
  pendiente: ['Pendiente', 'warn'], confirmado: ['Confirmado', 'info'], produccion: ['En producción', 'brand'],
  listo: ['Listo para reparto', 'gold'], entregado: ['Entregado', 'ok'], cancelado: ['Cancelado', 'bad'],
};
export const OPEST = { pendiente: ['Por hacer', 'warn'], en_curso: ['En curso', 'brand'], terminada: ['Terminada', 'ok'] };

export const hoy = () => fechaAR(0);
export const manana = () => fechaAR(1);
export { sumarDias };

const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const dShort = (s) => new Intl.DateTimeFormat('es-AR', { weekday: 'short', day: 'numeric', month: 'short' }).format(parse(s));
export const dRel = (s) => (s === hoy() ? 'Hoy' : s === manana() ? 'Mañana' : dShort(s));
export const aFecha = (ts) => (ts?.toDate ? ts.toDate() : ts ? new Date(ts) : null);
export const hhmm = (ts) => { const d = aFecha(ts); return d ? new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit' }).format(d) : '—'; };
export const cuando = (ts) => {
  const d = aFecha(ts); if (!d) return '…';
  const inicio = new Date(); inicio.setHours(0, 0, 0, 0);
  return d >= inicio ? hhmm(d) : new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short' }).format(d);
};
export const money = (n) => '$' + Math.round(n || 0).toLocaleString('es-AR');
export const fq = (n, u) => (u === 'u' ? Math.ceil((n || 0) - 1e-9).toLocaleString('es-AR') : (n || 0).toLocaleString('es-AR', { maximumFractionDigits: 2 }));
export const porId = (arr) => Object.fromEntries(arr.map((x) => [x.id, x]));
export const abrev = (nombre) => nombre.split(/\s+/).filter((w) => /^[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(w)).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
export const TIPO_LABEL = { mayorista: 'Mayorista', minorista: 'Minorista' };
export const ENTREGA_LABEL = { envio: 'Envío', retiro: 'Retira en el local' };
export const LOCALIDADES = ['San Miguel de Tucumán', 'Yerba Buena', 'Tafí Viejo', 'Banda del Río Salí', 'Las Talitas', 'Lules', 'Alderetes', 'Famaillá', 'Otra'];
