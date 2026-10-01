import { useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { useData } from '../data';
import { Modal, Pill, Vacio, useAccion, Contador } from '../ui';
import { cant, cuando, dLarga, dRel, dShort, estadoDe, hhmm, hoy, money, sumarDias } from '../util';
import { CATEGORIAS_DESPACHO, MOTIVOS_MERMA, PAGOS_DESPACHO, precioArticulo, precioBaseArticulo, r3, resumenCaja, vencimiento } from '../../shared/negocio.js';
import { ImagenArticulo } from '../components/Pan';
import PedidoModal from '../components/PedidoModal';

const PESTANAS = [['vender', 'Vender'], ['reservas', 'Reservas'], ['stock', 'Stock'], ['caja', 'Caja'], ['ventas', 'Ventas del día']];
const estadoStock = (a) => ((a.stock || 0) <= 0 ? ['Sin stock', 'bad'] : (a.stock || 0) < (a.minimo || 0) ? ['Queda poco', 'warn'] : ['OK', 'ok']);
const pillVence = (v) => (!v ? null : v.estado === 'vencido' ? ['Vencido', 'bad'] : v.estado === 'pronto' ? [v.dias === 0 ? 'Vence hoy' : v.dias === 1 ? 'Vence mañana' : `Vence en ${v.dias} días`, 'warn'] : null);

export default function Despacho() {
  const { perfil } = useAuth();
  const { pedidos } = useData();
  const [params, setParams] = useSearchParams();
  const tab = params.get('t') || (perfil.rol === 'gerente' ? 'ventas' : 'vender');
  const nReservas = pedidos.filter((p) => p.tipoCliente === 'minorista' && ['reservado', 'listo'].includes(p.estado)).length;
  return (
    <>
      <div className="tabs grandes" role="tablist" aria-label="Secciones del despacho">
        {PESTANAS.map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} aria-pressed={tab === k} onClick={() => setParams({ t: k })}>
            {l}{k === 'reservas' && nReservas > 0 && <span className="badge n" style={{ marginLeft: 4 }}>{nReservas}</span>}
          </button>
        ))}
      </div>
      {tab === 'vender' && <Vender />}
      {tab === 'reservas' && <Reservas />}
      {tab === 'stock' && <StockDespacho />}
      {tab === 'caja' && <Caja />}
      {tab === 'ventas' && <VentasDia />}
    </>
  );
}

/* ---------------------------- Vender ---------------------------- */
function Vender() {
  const { articulos, productosPorId } = useData();
  const [cat, setCat] = useState('Todos');
  const [buscar, setBuscar] = useState('');
  const [ticket, setTicket] = useState([]); // [{id, cantidad}]
  const [pago, setPago] = useState('Efectivo');
  const [cliente, setCliente] = useState('');
  const [hecho, setHecho] = useState(null);
  const [ocupado, correr] = useAccion();
  const ticketRef = useRef();
  const porId = useMemo(() => Object.fromEntries(articulos.map((a) => [a.id, a])), [articulos]);

  const lista = articulos.filter((a) => a.activo !== false
    && (cat === 'Todos' || a.categoria === cat)
    && (!buscar || a.nombre.toLowerCase().includes(buscar.toLowerCase())));
  const lineas = ticket.map((l) => ({ ...l, a: porId[l.id] })).filter((l) => l.a);
  const precio = (a) => precioArticulo(a, productosPorId);
  const total = lineas.reduce((s, l) => s + Math.round(l.cantidad * precio(l.a)), 0);

  const agregar = (a, ev) => {
    const paso = a.unidad === 'kg' ? 0.25 : 1;
    setHecho(null);
    setTicket((t) => {
      const ya = t.find((x) => x.id === a.id);
      return ya ? t.map((x) => (x.id === a.id ? { ...x, cantidad: r3(x.cantidad + paso), k: Date.now() } : x)) : [...t, { id: a.id, cantidad: paso, k: Date.now() }];
    });
    // pequeño "+1" que sube desde la tarjeta
    const r = ev.currentTarget.getBoundingClientRect();
    const f = document.createElement('span');
    f.className = 'mas-uno'; f.textContent = a.unidad === 'kg' ? '+250 g' : '+1';
    Object.assign(f.style, { left: `${r.left + r.width / 2}px`, top: `${r.top + 20}px` });
    document.body.appendChild(f); setTimeout(() => f.remove(), 800);
  };
  const cambiar = (id, cantidad) => setTicket((t) => (cantidad > 0 ? t.map((x) => (x.id === id ? { ...x, cantidad } : x)) : t.filter((x) => x.id !== id)));
  const cobrar = async () => {
    const r = await correr(() => api('despacho', { accion: 'venta', items: lineas.map((l) => ({ articuloId: l.id, cantidad: l.cantidad })), pago, cliente }));
    if (r) { setHecho(r); setTicket([]); setCliente(''); setPago('Efectivo'); }
  };

  return (
    <div className="pos">
      <section className="card pos-art">
        <div className="row" style={{ marginBottom: 12 }}>
          <input type="text" className="buscar" placeholder="Buscar artículo…" value={buscar} onChange={(e) => setBuscar(e.target.value)} aria-label="Buscar artículo" />
          <div className="tabs">{['Todos', ...CATEGORIAS_DESPACHO].map((c) => <button key={c} aria-pressed={cat === c} onClick={() => setCat(c)}>{c}</button>)}</div>
        </div>
        <div className="pos-grid">
          {lista.map((a) => {
            const sin = (a.stock || 0) <= 0;
            const enTicket = ticket.find((x) => x.id === a.id);
            return (
              <button key={a.id} type="button" className={`pos-item ${sin ? 'sin' : ''} ${enTicket ? 'en' : ''}`} disabled={sin} onClick={(e) => agregar(a, e)}>
                <span className="pos-img"><ImagenArticulo articulo={a} productosPorId={productosPorId} /></span>
                <b>{a.nombre}</b>
                <span className="row" style={{ justifyContent: 'space-between', width: '100%' }}>
                  <span className="num precio">{a.oferta > 0 && <s className="muted" style={{ fontWeight: 400, marginRight: 4 }}>{money(precioBaseArticulo(a, productosPorId))}</s>}{money(precio(a))}{a.unidad === 'kg' ? '/kg' : ''}</span>
                  <span className={`stock-chip ${estadoStock(a)[1]}`}>{sin ? 'Sin stock' : cant(a.stock, a.unidad)}</span>
                </span>
                {enTicket && <span className="pos-cant" key={enTicket.k}>{cant(enTicket.cantidad, a.unidad)}</span>}
                {a.oferta > 0 && <span className="pos-oferta">-{a.oferta}%</span>}
              </button>
            );
          })}
          {!lista.length && <Vacio>No hay artículos con ese filtro.</Vacio>}
        </div>
      </section>

      <section className="card pos-ticket" ref={ticketRef}>
        <div className="card-h"><h2>Venta</h2>{lineas.length > 0 && <button className="linkbtn small" onClick={() => setTicket([])}>Vaciar</button>}</div>
        {hecho && !lineas.length && (
          <div className="venta-ok"><span className="check">✓</span><b>Venta #{hecho.numero} registrada</b><span className="muted small">{money(hecho.total)} · el stock ya se descontó</span>{hecho.id && <Link className="btn sm" to={`/comprobante?tipo=venta&id=${hecho.id}`} target="_blank">Imprimir ticket</Link>}</div>
        )}
        {!lineas.length && !hecho && <div className="empty">Tocá los artículos para agregarlos a la venta.</div>}
        <div className="ticket-lineas">
          {lineas.map((l) => {
            const paso = l.a.unidad === 'kg' ? 0.05 : 1;
            return (
              <div className="ticket-linea" key={l.id}>
                <div style={{ minWidth: 0 }}><b>{l.a.nombre}</b><div className="muted small num">{money(precio(l.a))}{l.a.unidad === 'kg' ? ' el kg' : ' c/u'}</div></div>
                <span className="step">
                  <button type="button" onClick={() => cambiar(l.id, r3(l.cantidad - paso))} aria-label="Quitar">−</button>
                  <input className="num" type="number" min="0" step={paso} value={l.cantidad} aria-label={`Cantidad de ${l.a.nombre}`} onChange={(e) => cambiar(l.id, Math.max(0, r3(+e.target.value || 0)))} />
                  <button type="button" onClick={() => cambiar(l.id, r3(l.cantidad + paso))} aria-label="Agregar">+</button>
                </span>
                <span className="num sub">{money(Math.round(l.cantidad * precio(l.a)))}</span>
              </div>
            );
          })}
        </div>
        {lineas.length > 0 && (
          <>
            <div className="total"><span>Total</span><span className="num" key={total}>{money(total)}</span></div>
            <div className="field"><span style={{ fontSize: 13, fontWeight: 700 }}>Forma de pago</span>
              <div className="tabs">{PAGOS_DESPACHO.map((p) => <button key={p} aria-pressed={pago === p} onClick={() => setPago(p)}>{p}</button>)}</div>
            </div>
            <input type="text" placeholder="Nombre del cliente (opcional)" value={cliente} onChange={(e) => setCliente(e.target.value)} aria-label="Nombre del cliente" />
            <button className="btn primary cobrar" disabled={ocupado} onClick={cobrar}>{ocupado ? 'Registrando…' : `Cobrar ${money(total)}`}</button>
          </>
        )}
      </section>
    </div>
  );
}

/* ---------------------------- Reservas ---------------------------- */
function Reservas() {
  const { pedidos } = useData();
  const [nueva, setNueva] = useState(false);
  const [ocupado, correr] = useAccion();
  const lista = pedidos.filter((p) => p.tipoCliente === 'minorista' && ['reservado', 'listo'].includes(p.estado))
    .sort((a, b) => a.entrega.localeCompare(b.entrega) || a.numero - b.numero);
  const accion = (p, a, msg) => correr(() => api('pedido-estado', { id: p.id, accion: a }), msg);
  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <p className="muted" style={{ margin: 0 }}>Reservas de clientes minoristas para retirar en el despacho. No necesitan autorización del gerente.</p>
        <button className="btn primary" onClick={() => setNueva(true)}>Cargar reserva</button>
      </div>
      {lista.length ? (
        <div className="reservas">
          {lista.map((p) => (
            <article className="reserva" key={p.id}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <div><b className="num">#{p.numero}</b> <b>{p.clienteNombre}</b><div className="muted small">{p.canal === 'web' ? 'Desde la web' : 'Cargada en el mostrador'} · retira {dRel(p.entrega).toLowerCase()}{p.telefono ? ` · ${p.telefono}` : ''}</div></div>
                <Pill e={estadoDe(p)} />
              </div>
              <ul>{p.items.map((i) => <li key={i.articuloId || i.productoId}><span>{i.nombre}</span><span className="num">{cant(i.cantidad, i.unidad)}</span></li>)}</ul>
              {p.notas && <p className="small muted" style={{ margin: 0 }}>Nota: {p.notas}</p>}
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span className="num" style={{ fontWeight: 800 }}>{money(p.total)} <span className="muted small" style={{ fontWeight: 500 }}>· {p.pago}</span></span>
                <div className="row">
                  <button className="btn sm ghost-bad" disabled={ocupado} onClick={() => accion(p, 'cancelar', `Reserva #${p.numero} cancelada`)}>Cancelar</button>
                  {p.estado === 'reservado'
                    ? <button className="btn sm primary" disabled={ocupado} onClick={() => accion(p, 'preparar', `Reserva #${p.numero} preparada; se descontó del despacho`)}>Preparar</button>
                    : <button className="btn sm primary" disabled={ocupado} onClick={() => accion(p, 'entregar', `Reserva #${p.numero} retirada`)}>Marcar retirada</button>}
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : <section className="card"><Vacio>No hay reservas pendientes.</Vacio></section>}
      {nueva && <PedidoModal modo="mostrador" tipoInicial="minorista" onClose={() => setNueva(false)} />}
    </>
  );
}

/* ---------------------------- Stock ---------------------------- */
function StockDespacho() {
  const { perfil } = useAuth();
  const { articulos, productosPorId, movDespacho, mermas } = useData();
  const [modal, setModal] = useState(null); // {tipo, articulo}
  const [ocupado, correr] = useAccion();
  const T = hoy();
  const bajos = articulos.filter((a) => a.activo !== false && (a.stock || 0) < (a.minimo || 0));
  const porVencer = articulos.map((a) => ({ a, v: vencimiento(a, T) })).filter((x) => x.v && x.v.estado !== 'ok').sort((x, y) => x.v.dias - y.v.dias);
  const semana = mermas.filter((m) => m.dia >= sumarDias(T, -6));
  const valorMermas = semana.reduce((s, m) => s + (m.valor || 0), 0);
  const porMotivo = {};
  semana.forEach((m) => { porMotivo[m.motivo] = (porMotivo[m.motivo] || 0) + (m.valor || 0); });
  const ofertar = (a, pct) => correr(() => api('despacho', { accion: 'articulo', id: a.id, nombre: a.nombre, categoria: a.categoria, unidad: a.unidad, precio: a.precio, minimo: a.minimo, activo: a.activo !== false, vence: a.vence, oferta: pct }), pct ? `${a.nombre} en oferta con ${pct} % de descuento` : `Se quitó la oferta de ${a.nombre}`);
  return (
    <>
      {porVencer.length > 0 && (
        <section className="card aviso-vence">
          <div className="card-h"><div><h2>Vencimientos</h2><p className="muted small" style={{ margin: '4px 0 0' }}>Productos que vencen en los próximos días. Conviene ponerlos en oferta para venderlos antes.</p></div></div>
          <div className="attn-list">{porVencer.map(({ a, v }) => (
            <div className="attn" key={a.id}><span className="stripe" style={{ background: `var(--${v.estado === 'vencido' ? 'bad' : 'warn'})` }} />
              <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 500 }}>{a.nombre} <Pill e={pillVence(v)} /></div>
                <div className="muted small">Hay {cant(a.stock, a.unidad)} · vence el {dLarga(a.vence)}{a.oferta ? ` · en oferta -${a.oferta} %` : ''}</div></div>
              {v.estado === 'vencido'
                ? <button className="btn sm ghost-bad" onClick={() => setModal({ tipo: 'merma', articulo: a, motivo: 'Vencido' })}>Dar de baja</button>
                : a.oferta ? <button className="btn sm" disabled={ocupado} onClick={() => ofertar(a, 0)}>Quitar oferta</button>
                  : <button className="btn sm primary" disabled={ocupado} onClick={() => ofertar(a, 20)}>Poner en oferta -20 %</button>}
            </div>
          ))}</div>
        </section>
      )}
      {bajos.length > 0 && <div className="note warn">Queda poco de: {bajos.map((a) => a.nombre).join(', ')}.</div>}
      <section className="card">
        <div className="card-h"><h2>Artículos del despacho</h2><button className="btn primary" onClick={() => setModal({ tipo: 'articulo' })}>Nuevo artículo de reventa</button></div>
        <div className="tbl-wrap"><table>
          <thead><tr><th>Artículo</th><th>Categoría</th><th className="r">Precio</th><th className="r">Stock</th><th className="r">Mínimo</th><th>Vence</th><th>Estado</th><th /></tr></thead>
          <tbody>{articulos.map((a) => {
            const v = vencimiento(a, T);
            return (
              <tr key={a.id} style={a.activo === false ? { opacity: 0.5 } : undefined}>
                <td><div className="row" style={{ gap: 10, flexWrap: 'nowrap' }}><span className="mini-actual"><ImagenArticulo articulo={a} productosPorId={productosPorId} /></span><div><div style={{ fontWeight: 600 }}>{a.nombre}</div><div className="muted small">{a.productoId ? 'Elaborado' : 'Reventa'}</div></div></div></td>
                <td>{a.categoria}</td>
                <td className="r num">{a.oferta > 0 && <><span className="pill gold" style={{ marginRight: 6 }}>-{a.oferta}%</span></>}{money(precioArticulo(a, productosPorId))}{a.unidad === 'kg' ? '/kg' : ''}</td>
                <td className="r num" style={{ fontWeight: 700 }}>{cant(a.stock || 0, a.unidad)}</td>
                <td className="r num">{cant(a.minimo || 0, a.unidad)}</td>
                <td className="small">{v ? (pillVence(v) ? <Pill e={pillVence(v)} /> : <span className="num">{dLarga(a.vence)}</span>) : <span className="muted">—</span>}</td>
                <td><Pill e={estadoStock(a)} /></td>
                <td><div className="row" style={{ justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
                  <button className="btn sm" onClick={() => setModal({ tipo: 'ingreso', articulo: a })}>Ingreso</button>
                  <button className="btn sm" disabled={!(a.stock > 0)} onClick={() => setModal({ tipo: 'merma', articulo: a })}>Merma</button>
                  <button className="btn sm" onClick={() => setModal({ tipo: 'ajuste', articulo: a })}>Ajuste</button>
                  <button className="btn sm" onClick={() => setModal({ tipo: 'articulo', articulo: a })}>Editar</button>
                </div></td>
              </tr>
            );
          })}</tbody>
        </table></div>
        <p className="muted small" style={{ margin: '10px 0 0' }}>Los elaborados se reponen solos cuando el panadero termina una orden con "extra para el local". La reventa se carga con "Ingreso", con su fecha de vencimiento. "Merma" da de baja lo que sobró, venció o se rompió.{perfil.rol === 'gerente' ? ' Los precios de los elaborados se editan en Recetas.' : ''}</p>
      </section>
      <div className="grid2">
        <section className="card">
          <div className="card-h"><h2>Mermas de la semana</h2><span className="num" style={{ fontWeight: 600 }}>{money(valorMermas)}</span></div>
          {semana.length ? (
            <>
              <div className="row" style={{ marginBottom: 10 }}>{Object.entries(porMotivo).map(([m, v]) => <span className="chip" key={m}>{m}: {money(v)}</span>)}</div>
              <div className="list">{[...semana].sort((x, y) => y.dia.localeCompare(x.dia)).slice(0, 8).map((m) => (
                <div className="li" key={m.id}><span className="when">{dShort(m.dia).split(',')[0]}</span>
                  <div className="body" style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><span>{cant(m.cantidad, m.unidad)} {m.articuloNombre} <span className="muted">· {m.motivo}</span></span><span className="num muted">{money(m.valor)}</span></div></div>
              ))}</div>
              <p className="muted small" style={{ margin: '10px 0 0' }}>Lo que sobra de pan se usa en Planificación para sugerir cuánto hornear de más para el local.</p>
            </>
          ) : <Vacio>No se registraron mermas en los últimos 7 días.</Vacio>}
        </section>
        <section className="card">
          <div className="card-h"><h2>Últimos movimientos</h2></div>
          <div className="list">
            {movDespacho.slice(0, 12).map((m) => (
              <div className="li" key={m.id}><span className="when">{cuando(m.fecha)}</span>
                <div className="body" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <span>{m.articuloNombre} <span className="muted">· {m.motivo} · {m.usuario}</span></span>
                  <span className="num" style={{ color: `var(--${m.cantidad < 0 ? 'bad' : 'ok'})` }}>{m.cantidad > 0 ? '+' : ''}{cant(m.cantidad, m.unidad)}</span>
                </div>
              </div>
            ))}
            {!movDespacho.length && <div className="empty">Todavía no hay movimientos.</div>}
          </div>
        </section>
      </div>
      {modal && <ModalStock {...modal} onClose={() => setModal(null)} />}
    </>
  );
}

function ModalStock({ tipo, articulo, motivo: motivoInicial, onClose }) {
  const { productosPorId } = useData();
  const [ocupado, correr] = useAccion();
  const elaborado = !!articulo?.productoId;
  const [f, setF] = useState({
    cantidad: '', motivo: tipo === 'merma' ? (motivoInicial || (elaborado ? 'No se vendió' : 'Vencido')) : '', vence: '',
    nombre: articulo?.nombre || '', categoria: articulo?.categoria || 'Lácteos', unidad: articulo?.unidad || 'u',
    precio: articulo ? precioBaseArticulo(articulo, productosPorId) : '', minimo: articulo?.minimo ?? '', activo: articulo?.activo !== false,
    oferta: articulo?.oferta || 0, venceArt: articulo?.vence || '',
  });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const kg = (articulo?.unidad || f.unidad) === 'kg';

  if (tipo === 'articulo') {
    const guardar = async () => {
      const r = await correr(() => api('despacho', { accion: 'articulo', id: articulo?.id, nombre: f.nombre, categoria: f.categoria, unidad: f.unidad, precio: Number(f.precio), minimo: Number(f.minimo), activo: f.activo, oferta: Number(f.oferta) || 0, vence: f.venceArt || null }), articulo ? 'Artículo actualizado' : 'Artículo agregado');
      if (r) onClose();
    };
    return (
      <Modal titulo={articulo ? `Editar ${articulo.nombre}` : 'Nuevo artículo de reventa'} onClose={onClose}>
        {!elaborado && <div className="field"><label htmlFor="ar-n">Nombre</label><input id="ar-n" type="text" value={f.nombre} onChange={set('nombre')} placeholder="Ej.: Leche descremada 1 l" /></div>}
        <div className="fields2">
          {!elaborado && <div className="field"><label htmlFor="ar-c">Categoría</label><select id="ar-c" value={f.categoria} onChange={set('categoria')}>{CATEGORIAS_DESPACHO.filter((c) => c !== 'Panificados').map((c) => <option key={c}>{c}</option>)}</select></div>}
          {!elaborado && !articulo && <div className="field"><label htmlFor="ar-u">Se vende por</label><select id="ar-u" value={f.unidad} onChange={set('unidad')}><option value="u">Unidad</option><option value="kg">Kilo (fiambres, quesos)</option></select></div>}
          {!elaborado && <div className="field"><label htmlFor="ar-p">Precio de lista {f.unidad === 'kg' ? 'por kg' : ''}</label><input id="ar-p" type="number" min="0" value={f.precio} onChange={set('precio')} /></div>}
          <div className="field"><label htmlFor="ar-m">Stock mínimo ({kg ? 'kg' : 'u'})</label><input id="ar-m" type="number" min="0" step={kg ? 0.1 : 1} value={f.minimo} onChange={set('minimo')} /></div>
          <div className="field"><label htmlFor="ar-o">Oferta (% de descuento)</label><input id="ar-o" type="number" min="0" max="70" value={f.oferta} onChange={set('oferta')} /></div>
          {articulo && !elaborado && <div className="field"><label htmlFor="ar-v">Próximo vencimiento</label><input id="ar-v" type="date" value={f.venceArt} onChange={set('venceArt')} /></div>}
        </div>
        {Number(f.oferta) > 0 && <p className="small" style={{ margin: 0 }}>Precio con oferta: <b className="num">{money(Math.round((Number(f.precio) || 0) * (100 - Math.min(70, Number(f.oferta))) / 100))}</b>{f.unidad === 'kg' ? ' por kg' : ''}</p>}
        {elaborado && <p className="muted small" style={{ margin: 0 }}>Es un producto elaborado: el nombre y el precio salen de Recetas. La oferta se aplica solo en el despacho.</p>}
        {articulo && <label className="row small"><input type="checkbox" checked={f.activo} onChange={set('activo')} /> Se vende en el despacho</label>}
        <div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn" onClick={onClose}>Cerrar</button><button className="btn primary" disabled={ocupado} onClick={guardar}>Guardar</button></div>
      </Modal>
    );
  }

  if (tipo === 'merma') {
    const guardar = async () => {
      const r = await correr(() => api('despacho', { accion: 'merma', articuloId: articulo.id, cantidad: Number(f.cantidad), motivo: f.motivo, nota: f.nota }), 'Merma registrada');
      if (r) onClose();
    };
    return (
      <Modal titulo={`Merma: ${articulo.nombre}`} onClose={onClose}>
        <div className="fields2">
          <div className="field"><label htmlFor="me-c">Cantidad ({kg ? 'kg' : 'u'})</label><input id="me-c" type="number" min="0" max={articulo.stock} step={kg ? 0.05 : 1} value={f.cantidad} onChange={set('cantidad')} autoFocus /></div>
          <div className="field"><label htmlFor="me-m">Motivo</label><select id="me-m" value={f.motivo} onChange={set('motivo')}>{MOTIVOS_MERMA.map((m) => <option key={m}>{m}</option>)}</select></div>
        </div>
        <div className="field"><label htmlFor="me-n">Nota (opcional)</label><input id="me-n" type="text" value={f.nota || ''} onChange={set('nota')} placeholder="Ej.: se donó al comedor" /></div>
        <p className="muted small" style={{ margin: 0 }}>Hay {cant(articulo.stock || 0, articulo.unidad)}. Lo que des de baja sale del stock y queda registrado como pérdida.</p>
        <div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn" onClick={onClose}>Cerrar</button><button className="btn primary" disabled={ocupado || !(Number(f.cantidad) > 0)} onClick={guardar}>Dar de baja</button></div>
      </Modal>
    );
  }

  const ingreso = tipo === 'ingreso';
  const guardar = async () => {
    const r = await correr(() => api('despacho', { accion: tipo, articuloId: articulo.id, cantidad: Number(f.cantidad), motivo: f.motivo, vence: f.vence || null }), ingreso ? 'Ingreso registrado' : 'Stock ajustado');
    if (r) onClose();
  };
  return (
    <Modal titulo={`${ingreso ? 'Ingreso' : 'Ajuste'}: ${articulo.nombre}`} onClose={onClose}>
      <div className="fields2">
        <div className="field"><label htmlFor="mv-c">{ingreso ? 'Cantidad que entra' : 'Cantidad contada'} ({kg ? 'kg' : 'u'})</label><input id="mv-c" type="number" min="0" step={kg ? 0.05 : 1} value={f.cantidad} onChange={set('cantidad')} autoFocus /></div>
        <div className="field"><label htmlFor="mv-mo">Motivo</label><input id="mv-mo" type="text" value={f.motivo} onChange={set('motivo')} placeholder={ingreso ? 'Llegó el proveedor, sobrante de pedido…' : 'Conteo de cierre'} /></div>
        {ingreso && !elaborado && <div className="field"><label htmlFor="mv-v">Vence el (opcional)</label><input id="mv-v" type="date" min={hoy()} value={f.vence} onChange={set('vence')} /></div>}
      </div>
      <p className="muted small" style={{ margin: 0 }}>Hoy hay {cant(articulo.stock || 0, articulo.unidad)}.{!ingreso && ' Se reemplaza por lo que cargues.'}{ingreso && articulo.vence && articulo.stock > 0 ? ` Lo que hay ahora vence el ${dLarga(articulo.vence)}; se avisa por la fecha más próxima.` : ''}</p>
      <div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn" onClick={onClose}>Cerrar</button><button className="btn primary" disabled={ocupado || f.cantidad === ''} onClick={guardar}>Guardar</button></div>
    </Modal>
  );
}

/* ---------------------------- Caja ---------------------------- */
function Caja() {
  const { perfil } = useAuth();
  const { ventas, pedidos, cierres } = useData();
  const T = hoy();
  const [f, setF] = useState({ fondo: '', contado: '', notas: '' });
  const [ocupado, correr] = useAccion();
  const ventasHoy = ventas.filter((v) => v.dia === T);
  const reservasHoy = pedidos.filter((p) => p.tipoCliente === 'minorista' && p.estado === 'entregado' && p.entregadoDia === T);
  const r = resumenCaja(ventasHoy, reservasHoy);
  const fondo = Math.max(0, Math.round(Number(f.fondo) || 0));
  const esperado = fondo + r.efectivo;
  const contado = f.contado === '' ? null : Math.round(Number(f.contado) || 0);
  const dif = contado === null ? null : contado - esperado;
  const cierreHoy = cierres.find((c) => c.dia === T);
  const puedeCerrar = !cierreHoy || perfil.rol === 'gerente';
  const historial = [...cierres].sort((a, b) => b.dia.localeCompare(a.dia));
  const cerrar = async () => {
    const x = await correr(() => api('despacho', { accion: 'cierre', fondo, contado, notas: f.notas }), (y) => (y.diferencia === 0 ? 'Caja cerrada sin diferencias' : `Caja cerrada: ${y.diferencia > 0 ? 'sobran' : 'faltan'} ${money(Math.abs(y.diferencia))}`));
    if (x) setF({ fondo: '', contado: '', notas: '' });
  };
  const difPill = (d) => (d === 0 ? ['Sin diferencias', 'ok'] : d > 0 ? [`Sobran ${money(d)}`, 'warn'] : [`Faltan ${money(-d)}`, 'bad']);
  return (
    <>
      <div className="grid2">
        <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="card-h" style={{ marginBottom: 0 }}><h2>Cierre de caja de hoy</h2>{cierreHoy && <Pill e={['Caja cerrada', 'ok']} />}</div>
          <div className="lines">
            <div className="line"><span>Ventas en efectivo</span><span className="num">{money(r.efectivo - reservasHoy.filter((p) => p.pago === 'Efectivo').reduce((s, p) => s + p.total, 0))}</span></div>
            <div className="line"><span>Reservas retiradas en efectivo</span><span className="num">{money(reservasHoy.filter((p) => p.pago === 'Efectivo').reduce((s, p) => s + p.total, 0))}</span></div>
            {Object.entries(r.porPago).filter(([p]) => p !== 'Efectivo').map(([p, t]) => <div className="line muted" key={p}><span>{p} (no entra en la caja)</span><span className="num">{money(t)}</span></div>)}
          </div>
          {cierreHoy && !puedeCerrar ? (
            <div className="note ok" style={{ marginTop: 14 }}>La caja de hoy la cerró {cierreHoy.cerradoPor}: se contaron {money(cierreHoy.contado)} y {cierreHoy.diferencia === 0 ? 'no hubo diferencias' : `${cierreHoy.diferencia > 0 ? 'sobraron' : 'faltaron'} ${money(Math.abs(cierreHoy.diferencia))}`}.</div>
          ) : (
            <>
              <div className="fields2">
                <div className="field"><label htmlFor="cj-f">Fondo de caja al abrir</label><input id="cj-f" type="number" min="0" value={f.fondo} onChange={(e) => setF({ ...f, fondo: e.target.value })} placeholder="0" /></div>
                <div className="field"><label htmlFor="cj-c">Efectivo contado ahora</label><input id="cj-c" type="number" min="0" value={f.contado} onChange={(e) => setF({ ...f, contado: e.target.value })} placeholder="Contá los billetes" /></div>
              </div>
              <div className="total"><span>Debería haber</span><span className="num">{money(esperado)}</span></div>
              {dif !== null && <div className={`note ${dif === 0 ? 'ok' : dif > 0 ? 'warn' : 'bad'}`}>{dif === 0 ? 'Coincide con lo vendido en efectivo.' : `${dif > 0 ? 'Sobran' : 'Faltan'} ${money(Math.abs(dif))}. Revisá si quedó una venta sin cargar o un vuelto mal dado.`}</div>}
              <div className="field"><label htmlFor="cj-n">Notas (opcional)</label><input id="cj-n" type="text" value={f.notas} onChange={(e) => setF({ ...f, notas: e.target.value })} placeholder="Ej.: se pagó al repartidor del sodero" /></div>
              <button className="btn primary" style={{ alignSelf: 'flex-start' }} disabled={ocupado || contado === null} onClick={cerrar}>{cierreHoy ? 'Corregir el cierre' : 'Cerrar la caja'}</button>
            </>
          )}
        </section>
        <section className="card">
          <div className="card-h"><h2>Cierres anteriores</h2><span className="muted small">últimas 2 semanas</span></div>
          {historial.length ? (
            <div className="tbl-wrap"><table>
              <thead><tr><th>Día</th><th className="r">Debería</th><th className="r">Contado</th><th>Resultado</th><th>Cerró</th></tr></thead>
              <tbody>{historial.map((c) => (
                <tr key={c.id}><td>{c.dia === T ? 'Hoy' : dShort(c.dia)}</td><td className="r num">{money(c.esperado)}</td><td className="r num">{money(c.contado)}</td>
                  <td><Pill e={difPill(c.diferencia)} />{c.notas ? <div className="muted small">{c.notas}</div> : null}</td><td className="small muted">{c.cerradoPor}</td></tr>
              ))}</tbody>
            </table></div>
          ) : <Vacio>Todavía no hay cierres de caja.</Vacio>}
        </section>
      </div>
    </>
  );
}

/* ---------------------------- Ventas del día ---------------------------- */
function VentasDia() {
  const { perfil } = useAuth();
  const { ventas, pedidos, articulos } = useData();
  const [dia, setDia] = useState(hoy());
  const [anular, setAnular] = useState(null);
  const [ocupado, correr] = useAccion();
  const delDia = ventas.filter((v) => v.dia === dia).sort((a, b) => b.numero - a.numero);
  const validas = delDia.filter((v) => !v.anulada);
  const total = validas.reduce((s, v) => s + v.total, 0);
  const retiradas = pedidos.filter((p) => p.tipoCliente === 'minorista' && p.estado === 'entregado' && p.entrega === dia);
  const totalRes = retiradas.reduce((s, p) => s + p.total, 0);
  const porPago = {}; const porArt = {};
  validas.forEach((v) => {
    porPago[v.pago] = (porPago[v.pago] || 0) + v.total;
    v.items.forEach((i) => { const x = (porArt[i.nombre] ||= { cantidad: 0, total: 0, unidad: i.unidad }); x.cantidad = r3(x.cantidad + i.cantidad); x.total += i.subtotal; });
  });
  const pagos = Object.entries(porPago).sort((a, b) => b[1] - a[1]);
  const maxPago = pagos[0]?.[1] || 1;
  const top = Object.entries(porArt).sort((a, b) => b[1].total - a[1].total);
  const bajos = articulos.filter((a) => a.activo !== false && (a.stock || 0) < (a.minimo || 0));
  const dias = [0, -1, -2, -3, -4, -5, -6].map((k) => sumarDias(hoy(), k));

  return (
    <>
      <div className="row"><span className="lbl">Día</span><div className="tabs">{dias.map((d) => <button key={d} aria-pressed={d === dia} onClick={() => setDia(d)}>{d === hoy() ? 'Hoy' : dShort(d)}</button>)}</div></div>
      <div className="kpis">
        <div className="kpi"><span className="t">Vendido en el despacho</span><span className="v"><Contador valor={total} formato={money} /></span><span className="s">{validas.length} ventas</span></div>
        <div className="kpi"><span className="t">Ticket promedio</span><span className="v"><Contador valor={validas.length ? Math.round(total / validas.length) : 0} formato={money} /></span><span className="s">por venta</span></div>
        <div className="kpi"><span className="t">Reservas retiradas</span><span className="v"><Contador valor={retiradas.length} /></span><span className="s">{money(totalRes)}</span></div>
        <div className={`kpi ${bajos.length ? 'alert' : ''}`}><span className="t">Artículos con poco stock</span><span className="v"><Contador valor={bajos.length} /></span><span className="s">{bajos.slice(0, 2).map((a) => a.nombre).join(', ') || 'todo en orden'}</span></div>
      </div>
      <div className="grid2">
        <section className="card"><div className="card-h"><h2>Por forma de pago</h2></div>
          {pagos.length ? <div className="op-barras pagos">{pagos.map(([p, t]) => <div key={p}><span className="small">{p}</span><i><b style={{ width: `${(t / maxPago) * 100}%` }} /></i><span className="small num">{money(t)}</span></div>)}</div> : <Vacio>Sin ventas este día.</Vacio>}
        </section>
        <section className="card"><div className="card-h"><h2>Lo más vendido</h2></div>
          {top.length ? <div className="lines">{top.slice(0, 8).map(([n, x]) => <div className="line" key={n}><span>{n}</span><span className="num">{cant(x.cantidad, x.unidad)} · {money(x.total)}</span></div>)}</div> : <Vacio>Sin ventas este día.</Vacio>}
        </section>
      </div>
      <section className="card">
        <div className="card-h"><h2>Ventas {dia === hoy() ? 'de hoy' : `del ${dShort(dia)}`}</h2><span className="muted small">las anota el mostrador</span></div>
        {delDia.length ? (
          <div className="tbl-wrap"><table>
            <thead><tr><th>Venta</th><th>Hora</th><th>Artículos</th><th>Pago</th><th>Vendió</th><th className="r">Total</th><th /></tr></thead>
            <tbody>{delDia.map((v) => (
              <tr key={v.id} style={v.anulada ? { opacity: 0.5, textDecoration: 'line-through' } : undefined}>
                <td className="num">#{v.numero}</td><td className="num">{hhmm(v.fecha)}</td>
                <td className="small">{v.items.map((i) => `${cant(i.cantidad, i.unidad)} ${i.nombre}`).join(' · ')}{v.cliente ? <span className="muted"> — {v.cliente}</span> : null}</td>
                <td>{v.pago}</td><td className="small muted">{v.vendedor}</td><td className="r num" style={{ fontWeight: 700 }}>{money(v.total)}</td>
                <td className="r"><div className="row" style={{ justifyContent: 'flex-end', flexWrap: 'nowrap' }}><Link className="btn sm" to={`/comprobante?tipo=venta&id=${v.id}`} target="_blank">Ticket</Link>{perfil.rol === 'gerente' && !v.anulada && <button className="btn sm ghost-bad" onClick={() => setAnular(v)}>Anular</button>}</div></td>
              </tr>
            ))}</tbody>
          </table></div>
        ) : <Vacio>No hay ventas registradas este día.</Vacio>}
      </section>
      {anular && (
        <Modal titulo={`¿Anular la venta #${anular.numero}?`} onClose={() => setAnular(null)}>
          <p style={{ margin: 0 }}>Se devuelve el stock al despacho y la venta deja de sumar en el total del día.</p>
          <div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn" onClick={() => setAnular(null)}>Volver</button>
            <button className="btn primary" disabled={ocupado} onClick={async () => { await correr(() => api('despacho', { accion: 'anular', id: anular.id }), `Venta #${anular.numero} anulada`); setAnular(null); }}>Anular venta</button></div>
        </Modal>
      )}
    </>
  );
}
