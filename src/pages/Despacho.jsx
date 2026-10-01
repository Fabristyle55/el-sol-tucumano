import { useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { useData } from '../data';
import { Modal, Pill, Vacio, useAccion, Contador } from '../ui';
import { cant, cuando, dRel, dShort, estadoDe, hhmm, hoy, money, sumarDias } from '../util';
import { CATEGORIAS_DESPACHO, PAGOS_DESPACHO, precioArticulo, r3 } from '../../shared/negocio.js';
import { ImagenArticulo } from '../components/Pan';
import PedidoModal from '../components/PedidoModal';

const PESTANAS = [['vender', 'Vender'], ['reservas', 'Reservas'], ['stock', 'Stock'], ['ventas', 'Ventas del día']];
const estadoStock = (a) => ((a.stock || 0) <= 0 ? ['Sin stock', 'bad'] : (a.stock || 0) < (a.minimo || 0) ? ['Queda poco', 'warn'] : ['OK', 'ok']);

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
                  <span className="num precio">{money(precio(a))}{a.unidad === 'kg' ? '/kg' : ''}</span>
                  <span className={`stock-chip ${estadoStock(a)[1]}`}>{sin ? 'Sin stock' : cant(a.stock, a.unidad)}</span>
                </span>
                {enTicket && <span className="pos-cant" key={enTicket.k}>{cant(enTicket.cantidad, a.unidad)}</span>}
              </button>
            );
          })}
          {!lista.length && <Vacio>No hay artículos con ese filtro.</Vacio>}
        </div>
      </section>

      <section className="card pos-ticket" ref={ticketRef}>
        <div className="card-h"><h2>Venta</h2>{lineas.length > 0 && <button className="linkbtn small" onClick={() => setTicket([])}>Vaciar</button>}</div>
        {hecho && !lineas.length && (
          <div className="venta-ok"><span className="check">✓</span><b>Venta #{hecho.numero} registrada</b><span className="muted small">{money(hecho.total)} · el stock ya se descontó</span></div>
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
  const { articulos, productosPorId, movDespacho } = useData();
  const [modal, setModal] = useState(null); // {tipo, articulo}
  const bajos = articulos.filter((a) => a.activo !== false && (a.stock || 0) < (a.minimo || 0));
  return (
    <>
      {bajos.length > 0 && <div className="note warn">Queda poco de: {bajos.map((a) => a.nombre).join(', ')}.</div>}
      <section className="card">
        <div className="card-h"><h2>Artículos del despacho</h2><button className="btn primary" onClick={() => setModal({ tipo: 'articulo' })}>Nuevo artículo de reventa</button></div>
        <div className="tbl-wrap"><table>
          <thead><tr><th>Artículo</th><th>Categoría</th><th className="r">Precio</th><th className="r">Stock</th><th className="r">Mínimo</th><th>Estado</th><th /></tr></thead>
          <tbody>{articulos.map((a) => (
            <tr key={a.id} style={a.activo === false ? { opacity: 0.5 } : undefined}>
              <td><div className="row" style={{ gap: 10, flexWrap: 'nowrap' }}><span className="mini-actual"><ImagenArticulo articulo={a} productosPorId={productosPorId} /></span><div><div style={{ fontWeight: 600 }}>{a.nombre}</div><div className="muted small">{a.productoId ? 'Elaborado · repone producción' : 'Reventa'}</div></div></div></td>
              <td>{a.categoria}</td>
              <td className="r num">{money(precioArticulo(a, productosPorId))}{a.unidad === 'kg' ? '/kg' : ''}</td>
              <td className="r num" style={{ fontWeight: 700 }}>{cant(a.stock || 0, a.unidad)}</td>
              <td className="r num">{cant(a.minimo || 0, a.unidad)}</td>
              <td><Pill e={estadoStock(a)} /></td>
              <td><div className="row" style={{ justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
                <button className="btn sm" onClick={() => setModal({ tipo: 'ingreso', articulo: a })}>Ingreso</button>
                <button className="btn sm" onClick={() => setModal({ tipo: 'ajuste', articulo: a })}>Ajuste</button>
                <button className="btn sm" onClick={() => setModal({ tipo: 'articulo', articulo: a })}>Editar</button>
              </div></td>
            </tr>
          ))}</tbody>
        </table></div>
        <p className="muted small" style={{ margin: '10px 0 0' }}>Los elaborados se reponen solos cuando el panadero termina una orden con "extra para el local". La reventa se carga con "Ingreso".{perfil.rol === 'gerente' ? ' Los precios de los elaborados se editan en Recetas.' : ''}</p>
      </section>
      <section className="card">
        <div className="card-h"><h2>Últimos movimientos</h2></div>
        <div className="list">
          {movDespacho.map((m) => (
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
      {modal && <ModalStock {...modal} onClose={() => setModal(null)} />}
    </>
  );
}

function ModalStock({ tipo, articulo, onClose }) {
  const { productosPorId } = useData();
  const [ocupado, correr] = useAccion();
  const elaborado = !!articulo?.productoId;
  const [f, setF] = useState({
    cantidad: '', motivo: '',
    nombre: articulo?.nombre || '', categoria: articulo?.categoria || 'Lácteos', unidad: articulo?.unidad || 'u',
    precio: articulo ? precioArticulo(articulo, productosPorId) : '', minimo: articulo?.minimo ?? '', activo: articulo?.activo !== false,
  });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const kg = (articulo?.unidad || f.unidad) === 'kg';

  if (tipo === 'articulo') {
    const guardar = async () => {
      const r = await correr(() => api('despacho', { accion: 'articulo', id: articulo?.id, nombre: f.nombre, categoria: f.categoria, unidad: f.unidad, precio: Number(f.precio), minimo: Number(f.minimo), activo: f.activo }), articulo ? 'Artículo actualizado' : 'Artículo agregado');
      if (r) onClose();
    };
    return (
      <Modal titulo={articulo ? `Editar ${articulo.nombre}` : 'Nuevo artículo de reventa'} onClose={onClose}>
        {!elaborado && <div className="field"><label htmlFor="ar-n">Nombre</label><input id="ar-n" type="text" value={f.nombre} onChange={set('nombre')} placeholder="Ej.: Leche descremada 1 l" /></div>}
        <div className="fields2">
          {!elaborado && <div className="field"><label htmlFor="ar-c">Categoría</label><select id="ar-c" value={f.categoria} onChange={set('categoria')}>{CATEGORIAS_DESPACHO.filter((c) => c !== 'Panificados').map((c) => <option key={c}>{c}</option>)}</select></div>}
          {!elaborado && !articulo && <div className="field"><label htmlFor="ar-u">Se vende por</label><select id="ar-u" value={f.unidad} onChange={set('unidad')}><option value="u">Unidad</option><option value="kg">Kilo (fiambres, quesos)</option></select></div>}
          {!elaborado && <div className="field"><label htmlFor="ar-p">Precio {f.unidad === 'kg' ? 'por kg' : ''}</label><input id="ar-p" type="number" min="0" value={f.precio} onChange={set('precio')} /></div>}
          <div className="field"><label htmlFor="ar-m">Stock mínimo ({kg ? 'kg' : 'u'})</label><input id="ar-m" type="number" min="0" step={kg ? 0.1 : 1} value={f.minimo} onChange={set('minimo')} /></div>
        </div>
        {elaborado && <p className="muted small" style={{ margin: 0 }}>Es un producto elaborado: el nombre y el precio salen de Recetas.</p>}
        {articulo && <label className="row small"><input type="checkbox" checked={f.activo} onChange={set('activo')} /> Se vende en el despacho</label>}
        <div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn" onClick={onClose}>Cerrar</button><button className="btn primary" disabled={ocupado} onClick={guardar}>Guardar</button></div>
      </Modal>
    );
  }

  const ingreso = tipo === 'ingreso';
  const guardar = async () => {
    const r = await correr(() => api('despacho', { accion: tipo, articuloId: articulo.id, cantidad: Number(f.cantidad), motivo: f.motivo }), ingreso ? 'Ingreso registrado' : 'Stock ajustado');
    if (r) onClose();
  };
  return (
    <Modal titulo={`${ingreso ? 'Ingreso' : 'Ajuste'}: ${articulo.nombre}`} onClose={onClose}>
      <div className="fields2">
        <div className="field"><label htmlFor="mv-c">{ingreso ? 'Cantidad que entra' : 'Cantidad contada'} ({kg ? 'kg' : 'u'})</label><input id="mv-c" type="number" min="0" step={kg ? 0.05 : 1} value={f.cantidad} onChange={set('cantidad')} autoFocus /></div>
        <div className="field"><label htmlFor="mv-mo">Motivo</label><input id="mv-mo" type="text" value={f.motivo} onChange={set('motivo')} placeholder={ingreso ? 'Llegó el proveedor, sobrante de pedido…' : 'Conteo de cierre'} /></div>
      </div>
      <p className="muted small" style={{ margin: 0 }}>Hoy hay {cant(articulo.stock || 0, articulo.unidad)}.{!ingreso && ' Se reemplaza por lo que cargues.'}</p>
      <div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn" onClick={onClose}>Cerrar</button><button className="btn primary" disabled={ocupado || f.cantidad === ''} onClick={guardar}>Guardar</button></div>
    </Modal>
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
            <thead><tr><th>Venta</th><th>Hora</th><th>Artículos</th><th>Pago</th><th>Vendió</th><th className="r">Total</th>{perfil.rol === 'gerente' && <th />}</tr></thead>
            <tbody>{delDia.map((v) => (
              <tr key={v.id} style={v.anulada ? { opacity: 0.5, textDecoration: 'line-through' } : undefined}>
                <td className="num">#{v.numero}</td><td className="num">{hhmm(v.fecha)}</td>
                <td className="small">{v.items.map((i) => `${cant(i.cantidad, i.unidad)} ${i.nombre}`).join(' · ')}{v.cliente ? <span className="muted"> — {v.cliente}</span> : null}</td>
                <td>{v.pago}</td><td className="small muted">{v.vendedor}</td><td className="r num" style={{ fontWeight: 700 }}>{money(v.total)}</td>
                {perfil.rol === 'gerente' && <td className="r">{!v.anulada && <button className="btn sm ghost-bad" onClick={() => setAnular(v)}>Anular</button>}</td>}
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
