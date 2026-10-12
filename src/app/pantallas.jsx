// Pantallas de El Sol App: una por tarea, con lo justo para hacerla rápido.
// Las acciones llaman a las mismas funciones del servidor que la página completa.
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { api } from '../api';
import { useAuth } from '../auth';
import { useData } from '../data';
import { BotonWhatsApp, Modal, Pill, Stepper, TemaToggle, Vacio, Cargando, useAccion } from '../ui';
import { OPEST, ROLES, cant, cuando, dRel, estadoDe, fq, hhmm, hoy, manana, money, waPedido } from '../util';
import {
  PAGOS_DESPACHO, aplicarPromos, cobrosDelDia, estadoCuenta, precioArticulo, precioPara, promosDe, proyeccion, r3, resumenCaja, vaAProduccion,
} from '../../shared/negocio.js';
import { ImagenArticulo, ImagenProducto } from '../components/Pan';
import PedidoModal from '../components/PedidoModal';
import { Ico } from './Ico';

/* ------------------------------ piezas comunes ------------------------------ */
const Seg = ({ opciones, valor, onChange }) => (
  <div className="am-seg" role="group">
    {opciones.map(([k, l, n]) => (
      <button key={k} type="button" aria-pressed={valor === k} onClick={() => onChange(k)}>{l}{n > 0 && <b>{n}</b>}</button>
    ))}
  </div>
);
const Fila = ({ titulo, sub, der, onClick, children }) => {
  const C = onClick ? 'button' : 'div';
  return (
    <C className={`am-fila${onClick ? ' toca' : ''}`} onClick={onClick} type={onClick ? 'button' : undefined}>
      <div className="am-fila-t"><b>{titulo}</b>{sub && <span>{sub}</span>}{children}</div>
      {der && <div className="am-fila-d">{der}</div>}
    </C>
  );
};
const resumenItems = (items = []) => items.map((i) => `${cant(i.cantidad, i.unidad)} ${i.nombre}`).join(' · ');

/** Botón de la acción que sigue para un pedido, según su estado y el rol. */
function AccionPedido({ p }) {
  const { perfil } = useAuth();
  const [ocupado, correr] = useAccion();
  const g = perfil.rol === 'gerente';
  const ir = (a, msg) => correr(() => api('pedido-estado', { id: p.id, accion: a }), msg);
  if (p.tipoCliente === 'minorista') {
    if (p.estado === 'reservado') return <button className="btn primary" disabled={ocupado} onClick={() => ir('preparar', `Reserva #${p.numero} preparada`)}>Preparar</button>;
    if (p.estado === 'listo') return <button className="btn primary" disabled={ocupado} onClick={() => ir('entregar', `Reserva #${p.numero} retirada`)}>Retirada</button>;
    return null;
  }
  if (p.estado === 'pendiente' && g) return <button className="btn primary" disabled={ocupado} onClick={() => ir('confirmar', `Pedido #${p.numero} confirmado`)}>Confirmar</button>;
  if (['listo', 'en_camino'].includes(p.estado)) return <button className="btn" disabled={ocupado} onClick={() => ir('entregar', `Pedido #${p.numero} entregado`)}>Entregado</button>;
  return null;
}

function TarjetaPedido({ p }) {
  return (
    <article className="am-card am-pedido">
      <div className="am-pedido-h">
        <div><b className="num">#{p.numero}</b> <b>{p.clienteNombre}</b></div>
        <Pill e={estadoDe(p)} />
      </div>
      <p>{resumenItems(p.items)}</p>
      <div className="am-pedido-f">
        <span><b className="num">{money(p.total)}</b> <span className="muted small">· {p.modoEntrega === 'retiro' ? 'retira' : 'envío'} {dRel(p.entrega).toLowerCase()}</span></span>
        <AccionPedido p={p} />
      </div>
    </article>
  );
}

/* --------------------------------- Gerente --------------------------------- */
export function Inicio() {
  const { perfil } = useAuth();
  const d = useData();
  const nav = useNavigate();
  const [ocupado, correr] = useAccion();
  const T = hoy();
  if (d.cargando) return <Cargando />;
  const porConfirmar = d.pedidos.filter((p) => p.estado === 'pendiente').sort((a, b) => a.entrega.localeCompare(b.entrega) || a.numero - b.numero);
  const paraManana = d.pedidos.filter((p) => p.entrega === manana() && vaAProduccion(p) && p.estado !== 'cancelado');
  const alertas = proyeccion({ insumos: d.insumos, ordenes: d.ordenes, pedidos: d.pedidos, compras: d.compras, productosPorId: d.productosPorId }).filter((i) => i.alerta);
  const caja = resumenCaja(d.ventas.filter((v) => v.dia === T), cobrosDelDia(d.pedidos.filter((p) => p.entregadoDia === T)));
  const vencidas = d.clientes.filter((c) => estadoCuenta(c, T).estado === 'vencida');
  const hora = new Date().getHours();
  return (
    <>
      <p className="am-saludo">{hora < 13 ? 'Buen día' : hora < 20 ? 'Buenas tardes' : 'Buenas noches'}, {perfil.nombre?.split(' ')[0]}.</p>
      <div className="am-kpis">
        <button type="button" className="am-kpi" onClick={() => nav('/pedidos?f=pendientes')}><span>Por confirmar</span><b className={porConfirmar.length ? 'warn' : ''}>{porConfirmar.length}</b></button>
        <button type="button" className="am-kpi" onClick={() => nav('/pedidos?f=manana')}><span>Pedidos para mañana</span><b>{paraManana.length}</b></button>
        <button type="button" className="am-kpi" onClick={() => nav('/stock?f=alerta')}><span>Insumos en alerta</span><b className={alertas.length ? 'bad' : ''}>{alertas.length}</b></button>
        <button type="button" className="am-kpi" onClick={() => nav('/ventas')}><span>Vendido hoy</span><b>{money(caja.total)}</b></button>
      </div>
      <h2 className="am-h2">Para resolver</h2>
      <div className="am-lista">
        {porConfirmar.slice(0, 4).map((p) => (
          <Fila key={p.id} titulo={`#${p.numero} ${p.clienteNombre}`} sub={`Entrega ${dRel(p.entrega).toLowerCase()} · ${money(p.total)}`}
            der={<button className="btn primary sm" disabled={ocupado} onClick={() => correr(() => api('pedido-estado', { id: p.id, accion: 'confirmar' }), `Pedido #${p.numero} confirmado`)}>Confirmar</button>} />
        ))}
        {alertas.slice(0, 3).map((i) => (
          <Fila key={i.id} titulo={i.nombre} sub={`Quedan ${fq(i.proyectado, i.unidad)} ${i.unidad} · mínimo ${fq(i.seguridad, i.unidad)}`}
            der={<button className="btn sm" disabled={ocupado} onClick={() => correr(() => api('compra', { accion: 'autorizar', insumoId: i.id, cantidad: i.sugerido }), `Compra autorizada: ${fq(i.sugerido, i.unidad)} ${i.unidad} de ${i.nombre}`)}>Comprar {fq(i.sugerido, i.unidad)} {i.unidad}</button>} />
        ))}
        {vencidas.length > 0 && <Fila titulo={`${vencidas.length === 1 ? '1 cuenta corriente vencida' : `${vencidas.length} cuentas corrientes vencidas`}`} sub={vencidas.map((c) => c.nombre).join(', ')} />}
        {!porConfirmar.length && !alertas.length && !vencidas.length && <div className="am-ok"><Ico n="ok" /> Todo al día. No hay nada pendiente.</div>}
      </div>
    </>
  );
}

export function PedidosApp() {
  const { perfil } = useAuth();
  const { pedidos, cargando } = useData();
  const loc = useLocation();
  const g = perfil.rol === 'gerente';
  const [f, setF] = useState(new URLSearchParams(loc.search).get('f') || (g ? 'pendientes' : 'hoy'));
  if (cargando) return <Cargando />;
  const activos = pedidos.filter((p) => p.estado !== 'cancelado');
  const grupos = {
    pendientes: activos.filter((p) => p.estado === 'pendiente'),
    hoy: activos.filter((p) => p.entrega === hoy()),
    manana: activos.filter((p) => p.entrega === manana()),
  };
  const ops = [...(g ? [['pendientes', 'A confirmar', grupos.pendientes.length]] : []), ['hoy', 'Hoy'], ['manana', 'Mañana']];
  const ORD = { pendiente: 0, reservado: 0, listo: 1, en_camino: 2, confirmado: 3, produccion: 4, entregado: 9 };
  const lista = [...(grupos[f] || [])].sort((a, b) => (ORD[a.estado] ?? 5) - (ORD[b.estado] ?? 5) || a.numero - b.numero);
  return (
    <>
      <Seg opciones={ops} valor={f} onChange={setF} />
      {lista.length ? <div className="am-lista">{lista.map((p) => <TarjetaPedido key={p.id} p={p} />)}</div>
        : <Vacio>{f === 'pendientes' ? 'No hay pedidos esperando confirmación.' : 'No hay pedidos para este día.'}</Vacio>}
    </>
  );
}

export function StockApp() {
  const { perfil } = useAuth();
  const d = useData();
  const loc = useLocation();
  const [f, setF] = useState(new URLSearchParams(loc.search).get('f') || 'todos');
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(null);
  if (d.cargando) return <Cargando />;
  const proy = proyeccion({ insumos: d.insumos, ordenes: d.ordenes, pedidos: d.pedidos, compras: d.compras, productosPorId: d.productosPorId });
  const nAlerta = proy.filter((i) => i.alerta).length;
  const lista = proy.filter((i) => (f === 'todos' || i.alerta) && (!q || i.nombre.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => (b.alerta - a.alerta) || a.nombre.localeCompare(b.nombre));
  const estado = (i) => (i.disponible < i.seguridad * 0.5 ? ['Crítico', 'bad'] : i.alerta ? ['Comprar', 'warn'] : ['OK', 'ok']);
  return (
    <>
      <div className="am-buscar"><Ico n="buscar" size={18} /><input type="search" placeholder="Buscar insumo" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar insumo" /></div>
      <Seg opciones={[['todos', 'Todos'], ['alerta', 'En alerta', nAlerta]]} valor={f} onChange={setF} />
      <div className="am-lista">
        {lista.map((i) => {
          const st = estado(i);
          const pct = Math.max(4, Math.min(100, (i.disponible / ((i.seguridad || 1) * 2)) * 100));
          return (
            <Fila key={i.id} onClick={() => setSel(i)} titulo={i.nombre} sub={`Disponible ${fq(i.disponible, i.unidad)} ${i.unidad} · mínimo ${fq(i.seguridad, i.unidad)}`}
              der={<><Pill e={st} /><Ico n="flecha" size={18} /></>}>
              <span className="am-meter"><i style={{ width: `${pct}%`, background: `var(--${st[1]})` }} /></span>
            </Fila>
          );
        })}
        {!lista.length && <Vacio>No hay insumos que coincidan.</Vacio>}
      </div>
      {sel && <HojaInsumo i={sel} gerente={perfil.rol === 'gerente'} onClose={() => setSel(null)} />}
    </>
  );
}

function HojaInsumo({ i, gerente, onClose }) {
  const [tipo, setTipo] = useState('ingreso');
  const [q, setQ] = useState('');
  const [motivo, setMotivo] = useState('');
  const [ocupado, correr] = useAccion();
  const guardar = async () => {
    const r = await correr(() => api('movimiento-stock', { insumoId: i.id, tipo, cantidad: parseFloat(q), motivo }), tipo === 'ingreso' ? 'Ingreso registrado' : 'Stock ajustado');
    if (r) onClose();
  };
  const comprar = async () => {
    const r = await correr(() => api('compra', { accion: 'autorizar', insumoId: i.id, cantidad: i.sugerido }), `Compra autorizada: ${fq(i.sugerido, i.unidad)} ${i.unidad}`);
    if (r) onClose();
  };
  return (
    <Modal titulo={i.nombre} onClose={onClose}>
      <div className="am-datos">
        <div><span>En depósito</span><b className="num">{fq(i.stock, i.unidad)} {i.unidad}</b></div>
        <div><span>Reservado</span><b className="num">{fq(i.reservado, i.unidad)} {i.unidad}</b></div>
        <div><span>Mínimo</span><b className="num">{fq(i.seguridad, i.unidad)} {i.unidad}</b></div>
      </div>
      {gerente && i.alerta && <button className="btn primary am-xl" disabled={ocupado} onClick={comprar}>Autorizar compra de {fq(i.sugerido, i.unidad)} {i.unidad}{i.proveedor && <span className="muted-inv">a {i.proveedor}</span>}</button>}
      <Seg opciones={[['ingreso', 'Ingresó mercadería'], ['ajuste', 'Conté el stock']]} valor={tipo} onChange={setTipo} />
      <div className="field"><label htmlFor="hi-q">{tipo === 'ingreso' ? `Cantidad que ingresó (${i.unidad})` : `Cantidad que hay en el depósito (${i.unidad})`}</label>
        <input id="hi-q" type="number" inputMode="decimal" min="0" step="0.01" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <div className="field"><label htmlFor="hi-m">Motivo (opcional)</label><input id="hi-m" type="text" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder={tipo === 'ingreso' ? 'Remito del proveedor' : 'Conteo semanal'} /></div>
      <button className="btn primary am-xl" disabled={ocupado || q === ''} onClick={guardar}>Guardar</button>
    </Modal>
  );
}

export function VentasApp() {
  const d = useData();
  if (d.cargando) return <Cargando />;
  const T = hoy();
  const ventas = d.ventas.filter((v) => v.dia === T).sort((a, b) => (b.numero || 0) - (a.numero || 0));
  const caja = resumenCaja(ventas, cobrosDelDia(d.pedidos.filter((p) => p.entregadoDia === T)));
  const validas = ventas.filter((v) => !v.anulada);
  return (
    <>
      <div className="am-total"><span>Total del día</span><b className="num">{money(caja.total)}</b><small>{validas.length} ventas en el despacho más cobros de entregas y reservas</small></div>
      <div className="am-card am-pagos">
        {Object.entries(caja.porPago).sort((a, b) => b[1] - a[1]).map(([k, v]) => <div key={k}><span>{k}</span><b className="num">{money(v)}</b></div>)}
        {!Object.keys(caja.porPago).length && <span className="muted">Todavía no hubo cobros hoy.</span>}
      </div>
      <h2 className="am-h2">Últimas ventas</h2>
      <div className="am-lista">
        {ventas.slice(0, 20).map((v) => (
          <Fila key={v.id} titulo={<span className={v.anulada ? 'tachado' : ''}>#{v.numero} · {money(v.total)}</span>}
            sub={`${hhmm(v.fecha)} · ${v.pago}${v.anulada ? ' · anulada' : ''}`} der={<span className="muted small">{(v.items || []).length} art.</span>} />
        ))}
        {!ventas.length && <Vacio>Todavía no hay ventas hoy.</Vacio>}
      </div>
    </>
  );
}

/* -------------------------------- Mostrador -------------------------------- */
export function Vender() {
  const { articulos, productosPorId, cargando } = useData();
  const [cat, setCat] = useState('Todos');
  const [q, setQ] = useState('');
  const [ticket, setTicket] = useState({});
  const [cobrar, setCobrar] = useState(false);
  if (cargando) return <Cargando />;
  const activos = articulos.filter((a) => a.activo !== false);
  const cats = ['Todos', ...new Set(activos.map((a) => a.categoria).filter(Boolean))];
  const lista = activos.filter((a) => (cat === 'Todos' || a.categoria === cat) && (!q || a.nombre.toLowerCase().includes(q.toLowerCase())));
  const precio = (a) => precioArticulo(a, productosPorId);
  const porId = Object.fromEntries(activos.map((a) => [a.id, a]));
  const lineas = Object.entries(ticket).filter(([id, n]) => n > 0 && porId[id]).map(([id, n]) => ({ a: porId[id], n }));
  const total = lineas.reduce((s, l) => s + Math.round(l.n * precio(l.a)), 0);
  const sumar = (a) => {
    const paso = a.unidad === 'kg' ? 0.25 : 1;
    setTicket((t) => ({ ...t, [a.id]: Math.min(a.stock || 0, r3((t[a.id] || 0) + paso)) }));
  };
  return (
    <>
      <div className="am-buscar"><Ico n="buscar" size={18} /><input type="search" placeholder="Buscar artículo" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar artículo" /></div>
      <div className="am-chips">{cats.map((c) => <button key={c} type="button" aria-pressed={cat === c} onClick={() => setCat(c)}>{c}</button>)}</div>
      <div className="am-grid">
        {lista.map((a) => {
          const sin = (a.stock || 0) <= 0;
          return (
            <button key={a.id} type="button" className={`am-art${ticket[a.id] ? ' on' : ''}`} disabled={sin || (ticket[a.id] || 0) >= (a.stock || 0)} onClick={() => sumar(a)}>
              {ticket[a.id] > 0 && <b className="am-art-n">{cant(ticket[a.id], a.unidad)}</b>}
              <ImagenArticulo articulo={a} productosPorId={productosPorId} className="am-art-img" />
              <span className="am-art-nom">{a.nombre}</span>
              <span className="am-art-p"><b className="num">{money(precio(a))}</b><small>{sin ? 'Sin stock' : `quedan ${cant(a.stock, a.unidad)}`}</small></span>
            </button>
          );
        })}
      </div>
      {lineas.length > 0 && (
        <div className="am-barra">
          <span><b className="num">{money(total)}</b><small>{lineas.length} {lineas.length === 1 ? 'artículo' : 'artículos'}</small></span>
          <button className="btn sm" type="button" onClick={() => setTicket({})}>Vaciar</button>
          <button className="btn primary" type="button" onClick={() => setCobrar(true)}>Cobrar</button>
        </div>
      )}
      {cobrar && <HojaCobro lineas={lineas} precio={precio} total={total} cambiar={(id, n) => setTicket((t) => ({ ...t, [id]: n }))} onClose={() => setCobrar(false)} onHecho={() => { setTicket({}); setCobrar(false); }} />}
    </>
  );
}

function HojaCobro({ lineas, precio, total, cambiar, onClose, onHecho }) {
  const [pago, setPago] = useState('Efectivo');
  const [ocupado, correr] = useAccion();
  const cobrar = async () => {
    const r = await correr(() => api('despacho', { accion: 'venta', items: lineas.map((l) => ({ articuloId: l.a.id, cantidad: l.n })), pago, cliente: '' }), (x) => `Venta #${x.numero} cobrada: ${money(x.total)}`);
    if (r) onHecho();
  };
  return (
    <Modal titulo="Cobrar" onClose={onClose}>
      <div className="am-ticket">
        {lineas.map(({ a, n }) => (
          <div key={a.id}><span>{a.nombre}<small>{money(precio(a))}{a.unidad === 'kg' ? ' el kg' : ''}</small></span>
            <Stepper value={n} paso={a.unidad === 'kg' ? 0.25 : 1} max={a.stock} onChange={(v) => cambiar(a.id, v)} label={`Cantidad de ${a.nombre}`} /></div>
        ))}
      </div>
      <div className="am-chips am-chips-full">{PAGOS_DESPACHO.map((p) => <button key={p} type="button" aria-pressed={pago === p} onClick={() => setPago(p)}>{p}</button>)}</div>
      <button className="btn primary am-xl" disabled={ocupado || !lineas.length || total <= 0} onClick={cobrar}>Cobrar {money(total)}</button>
    </Modal>
  );
}

export function ReservasApp() {
  const { pedidos, cargando } = useData();
  if (cargando) return <Cargando />;
  const lista = pedidos.filter((p) => p.tipoCliente === 'minorista' && ['reservado', 'listo'].includes(p.estado))
    .sort((a, b) => a.entrega.localeCompare(b.entrega) || a.numero - b.numero);
  return lista.length ? (
    <div className="am-lista">
      {lista.map((p) => (
        <article className="am-card am-pedido" key={p.id}>
          <div className="am-pedido-h"><div><b className="num">#{p.numero}</b> <b>{p.clienteNombre}</b></div><Pill e={estadoDe(p)} /></div>
          <p>{resumenItems(p.items)}</p>
          <div className="am-pedido-f">
            <span><b className="num">{money(p.total)}</b> <span className="muted small">· retira {dRel(p.entrega).toLowerCase()}</span></span>
            <span className="row"><BotonWhatsApp href={waPedido(p)}>Avisar</BotonWhatsApp><AccionPedido p={p} /></span>
          </div>
        </article>
      ))}
    </div>
  ) : <Vacio>No hay reservas para preparar.</Vacio>;
}

/* --------------------------------- Panadero --------------------------------- */
export function ProduccionApp() {
  const { ordenes, insumosPorId, cargando } = useData();
  const [abierta, setAbierta] = useState(null);
  const [ocupado, correr] = useAccion();
  if (cargando) return <Cargando />;
  const abiertas = ordenes.filter((o) => o.estado !== 'terminada');
  const fecha = [...new Set(abiertas.map((o) => o.fecha))].sort()[0];
  if (!fecha) {
    const hechas = ordenes.filter((o) => o.fecha >= hoy());
    return <div className="am-ok am-ok-grande"><Ico n="ok" size={28} /><b>No hay nada para hornear ahora.</b><span>{hechas.length ? `Ya se terminaron las ${hechas.length} órdenes.` : 'El gerente genera las órdenes desde la planificación.'}</span></div>;
  }
  const g = ordenes.filter((o) => o.fecha === fecha).sort((a, b) => ({ en_curso: 0, pendiente: 1, terminada: 2 }[a.estado] - { en_curso: 0, pendiente: 1, terminada: 2 }[b.estado]) || a.numero - b.numero);
  const hechas = g.filter((o) => o.estado === 'terminada').length;
  const accion = (o, a) => correr(() => api('orden-estado', { id: o.id, accion: a }),
    (r) => (a === 'empezar' ? `OP-${o.numero} en curso` : r?.pedidosListos ? `¡Listo! ${r.pedidosListos} pedidos quedaron para reparto` : `OP-${o.numero} terminada`));
  return (
    <>
      <div className="am-progreso"><span>Para {dRel(fecha).toLowerCase()}</span><span className="am-meter grande"><i style={{ width: `${(hechas / g.length) * 100}%` }} /></span><b className="num">{hechas}/{g.length}</b></div>
      <div className="am-lista">
        {g.map((o) => (
          <article key={o.id} className={`am-card am-op ${o.estado}`}>
            <div className="am-op-h">
              <b className="am-op-n num">{o.cantidad + (o.extra || 0)}</b>
              <div><b>{o.productoNombre}</b><span className="muted small">OP-{o.numero}{o.extra ? ` · incluye ${o.extra} para el local` : ''}</span></div>
              <Pill e={OPEST[o.estado]} />
            </div>
            {abierta === o.id && (
              <ul className="am-insumos">{Object.entries(o.insumos || {}).map(([iid, q]) => <li key={iid}><span>{insumosPorId[iid]?.nombre || iid}</span><b className="num">{fq(q, insumosPorId[iid]?.unidad)} {insumosPorId[iid]?.unidad}</b></li>)}</ul>
            )}
            <div className="am-op-f">
              <button type="button" className="linkbtn small" onClick={() => setAbierta(abierta === o.id ? null : o.id)}>{abierta === o.id ? 'Ocultar insumos' : 'Ver insumos'}</button>
              {o.estado === 'pendiente' && <button className="btn primary" disabled={ocupado} onClick={() => accion(o, 'empezar')}>Empezar</button>}
              {o.estado === 'en_curso' && <button className="btn primary" disabled={ocupado} onClick={() => accion(o, 'terminar')}>Terminar</button>}
              {o.estado === 'terminada' && <span className="muted small">Terminada {hhmm(o.fin)}</span>}
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

export function RecetasApp() {
  const { productos, insumosPorId, cargando } = useData();
  const [sel, setSel] = useState(null);
  const [n, setN] = useState(10);
  if (cargando) return <Cargando />;
  const p = productos.find((x) => x.id === sel);
  if (p) {
    return (
      <>
        <button type="button" className="linkbtn" onClick={() => setSel(null)}>← Todas las recetas</button>
        <div className="am-card">
          <div className="am-receta-h"><ImagenProducto producto={p} className="am-receta-img" /><div><b>{p.nombre}</b><span className="muted small">Calculá los insumos para la cantidad que vas a hacer.</span></div></div>
          <div className="am-receta-n"><span>Unidades</span><Stepper value={n} onChange={setN} label="Unidades a hacer" /></div>
          <ul className="am-insumos">
            {Object.entries(p.receta || {}).map(([iid, q]) => {
              const u = insumosPorId[iid]?.unidad || '';
              return <li key={iid}><span>{insumosPorId[iid]?.nombre || iid}<small>{fq(q, u)} {u} por unidad</small></span><b className="num">{fq(r3(q * n), u)} {u}</b></li>;
            })}
          </ul>
        </div>
      </>
    );
  }
  return (
    <div className="am-lista">
      {productos.filter((x) => x.activo !== false).map((x) => (
        <Fila key={x.id} onClick={() => setSel(x.id)} titulo={x.nombre} sub={`${Object.keys(x.receta || {}).length} insumos`} der={<Ico n="flecha" size={18} />} />
      ))}
    </div>
  );
}

/* --------------------------------- Depósito --------------------------------- */
export function ComprasApp() {
  const { compras, cargando } = useData();
  const [ocupado, correr] = useAccion();
  if (cargando) return <Cargando />;
  const porRecibir = compras.filter((c) => c.estado === 'autorizada');
  const recibidas = compras.filter((c) => c.estado === 'recibida').sort((a, b) => (b.fecha?.toDate?.() || 0) - (a.fecha?.toDate?.() || 0)).slice(0, 6);
  return (
    <>
      <h2 className="am-h2">Por recibir</h2>
      <div className="am-lista">
        {porRecibir.map((c) => (
          <Fila key={c.id} titulo={`${fq(c.cantidad, c.unidad)} ${c.unidad} de ${c.insumoNombre}`} sub={`${c.codigo || ''} · ${c.proveedor || ''}`}
            der={<button className="btn primary" disabled={ocupado} onClick={() => correr(() => api('compra', { accion: 'recibir', id: c.id }), `Ingresó ${c.insumoNombre} al depósito`)}>Recibir</button>} />
        ))}
        {!porRecibir.length && <Vacio>No hay compras esperando llegar.</Vacio>}
      </div>
      {recibidas.length > 0 && <>
        <h2 className="am-h2">Recibidas</h2>
        <div className="am-lista">{recibidas.map((c) => <Fila key={c.id} titulo={`${fq(c.cantidad, c.unidad)} ${c.unidad} de ${c.insumoNombre}`} sub={`${c.codigo || ''} · ${cuando(c.fecha)}`} der={<Pill e={['Recibida', 'ok']} />} />)}</div>
      </>}
    </>
  );
}

/* --------------------------------- Clientes --------------------------------- */
export function Pedir() {
  const { productos, productosPorId, articulos, promos, cargando } = useData();
  const { perfil } = useAuth();
  const loc = useLocation();
  const nav = useNavigate();
  const tipo = perfil.tipoCliente || 'mayorista';
  const minorista = tipo === 'minorista';
  const [carrito, setCarrito] = useState(() => loc.state?.carrito || {});
  const [checkout, setCheckout] = useState(false);
  const activos = useMemo(() => (minorista ? articulos.filter((a) => a.activo !== false) : productos.filter((p) => p.activo !== false)), [minorista, articulos, productos]);
  if (cargando) return <Cargando />;
  const precio = (x) => (minorista ? precioArticulo(x, productosPorId) : precioPara(x, tipo));
  const porId = Object.fromEntries(activos.map((x) => [x.id, x]));
  const pid = (x) => (minorista ? x.productoId || null : x.id);
  const elegidos = Object.entries(carrito).filter(([id, q]) => porId[id] && q > 0);
  const calc = aplicarPromos(elegidos.map(([id, q]) => ({ productoId: pid(porId[id]), cantidad: q, precio: precio(porId[id]) })), promos, tipo, null, hoy());
  return (
    <>
      <p className="muted small am-nota">{minorista ? 'Reservá lo que hay hoy en el despacho y pasalo a buscar.' : 'Elegí cantidades; el pedido se elabora para el día que elijas.'}</p>
      <div className="am-lista">
        {activos.map((x) => {
          const pr = promosDe(pid(x), promos, tipo, hoy())[0];
          const max = minorista ? x.stock || 0 : undefined;
          return (
            <div key={x.id} className="am-fila am-prod">
              {minorista ? <ImagenArticulo articulo={x} productosPorId={productosPorId} className="am-prod-img" /> : <ImagenProducto producto={x} className="am-prod-img" />}
              <div className="am-fila-t"><b>{x.nombre}</b><span><b className="num">{money(precio(x))}</b>{minorista && !max ? ' · sin stock' : ''}</span>{pr && <em className="am-promo">−{pr.pct}% llevando {pr.minimo} o más</em>}</div>
              <Stepper value={carrito[x.id] || 0} max={max} paso={x.unidad === 'kg' ? 0.25 : 1} onChange={(v) => setCarrito({ ...carrito, [x.id]: v })} label={`Cantidad de ${x.nombre}`} />
            </div>
          );
        })}
      </div>
      {elegidos.length > 0 && (
        <div className="am-barra">
          <span><b className="num">{money(calc.total)}</b><small>{elegidos.length} {elegidos.length === 1 ? 'producto' : 'productos'}{calc.descuento ? ` · ahorrás ${money(calc.descuento)}` : ''}</small></span>
          <button className="btn primary" type="button" onClick={() => setCheckout(true)}>Continuar</button>
        </div>
      )}
      {checkout && <PedidoModal modo="web" carrito={carrito} onClose={() => setCheckout(false)} onCreado={() => { setCarrito({}); nav('/mis-pedidos'); }} />}
    </>
  );
}

function pasosDe(o) {
  const envio = o.modoEntrega !== 'retiro';
  if (o.tipoCliente === 'minorista') return [['reservado', 'Reservado'], ['listo', 'Preparado'], ...(envio ? [['en_camino', 'En camino']] : []), ['entregado', envio ? 'Entregado' : 'Retirado']];
  return [['pendiente', 'Recibido'], ['confirmado', 'Confirmado'], ['produccion', 'En el horno'], ['listo', 'Listo'], ...(envio ? [['en_camino', 'En camino']] : []), ['entregado', envio ? 'Entregado' : 'Retirado']];
}

export function MisPedidosApp() {
  const { pedidos, miCliente, cargando } = useData();
  const { perfil } = useAuth();
  const nav = useNavigate();
  const [ocupado, correr] = useAccion();
  if (cargando) return <Cargando />;
  const ord = [...pedidos].sort((a, b) => b.entrega.localeCompare(a.entrega) || b.numero - a.numero);
  const activos = ord.filter((p) => !['entregado', 'cancelado'].includes(p.estado));
  const pasados = ord.filter((p) => ['entregado', 'cancelado'].includes(p.estado)).slice(0, 6);
  const cc = perfil.tipoCliente !== 'minorista' && miCliente ? estadoCuenta(miCliente, hoy()) : null;
  const repetir = (p) => nav('/pedir', { state: { carrito: Object.fromEntries((p.items || []).map((i) => [i.articuloId || i.productoId, i.cantidad])) } });
  return (
    <>
      {cc && cc.saldo > 0 && (
        <div className={`am-card am-cc ${cc.estado}`}><span>Cuenta corriente</span><b className="num">{money(cc.saldo)}</b>
          <small>{cc.estado === 'vencida' ? `Vencida hace ${cc.dias - cc.plazo} días. Acercate a pagar.` : `Plazo de ${cc.plazo} días desde la primera entrega sin pagar.`}</small></div>
      )}
      {activos.map((p) => {
        const pasos = pasosDe(p);
        const k = pasos.findIndex(([e]) => e === p.estado);
        return (
          <article className="am-card am-pedido" key={p.id}>
            <div className="am-pedido-h"><div><b className="num">#{p.numero}</b> <b>{dRel(p.entrega)}</b></div><b className="num">{money(p.total)}</b></div>
            <p>{resumenItems(p.items)}</p>
            <div className="am-estado"><span>Estado</span><b>{pasos[k]?.[1] || estadoDe(p)[0]}</b><span className="muted small">paso {k + 1} de {pasos.length}</span></div>
            <ol className="am-pasos" aria-hidden="true">
              {pasos.map(([e], j) => <li key={e} className={j < k ? 'hecho' : j === k ? 'actual' : ''}><i /></li>)}
            </ol>
            {['pendiente', 'reservado'].includes(p.estado) && (
              <div className="am-pedido-f"><span className="muted small">Todavía podés cancelarlo.</span>
                <button className="btn sm ghost-bad" disabled={ocupado} onClick={() => correr(() => api('pedido-estado', { id: p.id, accion: 'cancelar' }), `Pedido #${p.numero} cancelado`)}>Cancelar</button></div>
            )}
          </article>
        );
      })}
      {!activos.length && <div className="am-ok am-ok-grande"><Ico n="pedidos" size={28} /><b>No tenés pedidos en curso.</b><button className="btn primary" onClick={() => nav('/pedir')}>Hacer un pedido</button></div>}
      {pasados.length > 0 && <>
        <h2 className="am-h2">Anteriores</h2>
        <div className="am-lista">{pasados.map((p) => (
          <Fila key={p.id} titulo={`#${p.numero} · ${money(p.total)}`} sub={`${dRel(p.entrega)} · ${estadoDe(p)[0]}`}
            der={p.estado === 'entregado' ? <button className="btn sm" onClick={() => repetir(p)}>Repetir</button> : null} />
        ))}</div>
      </>}
    </>
  );
}

/* ----------------------------------- Más ----------------------------------- */
export function Mas() {
  const { perfil } = useAuth();
  const [instalar, setInstalar] = useState(() => window.__elSolInstalar || null);
  useEffect(() => {
    const f = () => setInstalar(window.__elSolInstalar || null);
    window.addEventListener('el-sol-instalable', f);
    return () => window.removeEventListener('el-sol-instalable', f);
  }, []);
  const instalada = window.matchMedia?.('(display-mode: standalone)').matches;
  const rol = ROLES[perfil.rol];
  const completa = `/${rol.vistas[0]}`;
  const etiquetaRol = perfil.rol === 'cliente' ? `Cliente ${perfil.tipoCliente === 'minorista' ? 'minorista' : 'mayorista'}` : rol.label;
  return (
    <>
      <div className="am-card am-yo"><span className="am-avatar">{(perfil.nombre || '?').slice(0, 1)}</span><div><b>{perfil.nombre}</b><span className="muted small">{etiquetaRol} · {perfil.email}</span></div></div>
      <div className="am-lista">
        {!instalada && (instalar
          ? <Fila onClick={async () => { instalar.prompt(); await instalar.userChoice.catch(() => {}); window.__elSolInstalar = null; setInstalar(null); }} titulo="Instalar la app" sub="Queda con su ícono, como cualquier otra app." der={<Ico n="bajar" size={20} />} />
          : <Fila titulo="Instalar la app" sub="Celular: menú del navegador → «Instalar app» o «Agregar a pantalla de inicio». Computadora: ícono de instalar en la barra de direcciones." />)}
        <Fila titulo="Tema claro u oscuro" sub="Se recuerda en este dispositivo." der={<TemaToggle />} />
        <a className="am-fila toca" href={completa}><div className="am-fila-t"><b>Abrir la página completa</b><span>Reportes, planificación, recetas, usuarios y todo lo demás.</span></div><div className="am-fila-d"><Ico n="externo" size={20} /></div></a>
        <Fila onClick={() => signOut(auth)} titulo={<span style={{ color: 'var(--rojo)' }}>Cerrar sesión</span>} der={<Ico n="salir" size={20} />} />
      </div>
      <p className="muted small am-pie">El Sol App · Panificación El Sol Siciliano · Seminario Integrador UTN FRT</p>
    </>
  );
}
