import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { useData } from '../data';
import { Modal, Pill, Stepper, Vacio, Cargando, useAccion } from '../ui';
import { aFecha, cant, cuando, dRel, estadoDe, hoy, money } from '../util';
import { DIAS_SEMANA, FORMAS_PAGO, estadoCuenta, idArticulo } from '../../shared/negocio.js';

const PASOS = ['pendiente', 'confirmado', 'produccion', 'listo', 'entregado'];
const NOMBRES = ['Recibido', 'Confirmado', 'En el horno', 'Listo', 'Entregado'];
const PASOS_MIN = ['reservado', 'listo', 'entregado'];
const NOMBRES_MIN = ['Reservado', 'Preparado', 'Retirado'];

export default function MisPedidos() {
  const { perfil } = useAuth();
  const { pedidos, cargando, miCliente, movCuenta, pedidosFijos, productosPorId } = useData();
  const [ocupado, correr] = useAccion();
  const [armarFijo, setArmarFijo] = useState(false);
  const nav = useNavigate();
  const mayorista = (perfil.tipoCliente || 'mayorista') === 'mayorista';
  const lista = [...pedidos].sort((a, b) => (aFecha(b.creado) || 0) - (aFecha(a.creado) || 0)).slice(0, 20);
  const fijo = pedidosFijos[0] || null;
  const cuenta = miCliente ? estadoCuenta(miCliente, hoy()) : null;
  const movs = [...movCuenta].sort((a, b) => (aFecha(b.fecha) || 0) - (aFecha(a.fecha) || 0)).slice(0, 5);

  // Repetir: vuelve al catálogo con el carrito cargado como en ese pedido.
  const repetir = (o) => {
    const carrito = Object.fromEntries(o.items.map((i) => [o.tipoCliente === 'minorista' ? (i.articuloId || idArticulo(i.productoId)) : i.productoId, i.cantidad]));
    nav('/catalogo', { state: { carrito } });
  };

  if (cargando) return <Cargando />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {mayorista && (
        <div className="grid2">
          <section className="card">
            <div className="card-h"><h2>Cuenta corriente</h2>{cuenta && cuenta.saldo > 0 && <Pill e={cuenta.estado === 'vencida' ? ['Vencida', 'bad'] : ['Con saldo', 'warn']} />}</div>
            {cuenta && (cuenta.saldo > 0 || movs.length) ? (
              <>
                <div className="kpi-mini"><span className="muted small">Saldo a pagar</span><b className="num">{money(Math.max(0, cuenta.saldo))}</b>
                  {cuenta.saldo > 0 && <span className="small muted">{cuenta.estado === 'vencida' ? `Venció hace ${cuenta.dias - cuenta.plazo} días (plazo de ${cuenta.plazo} días).` : `Plazo de pago: ${cuenta.plazo} días desde la primera entrega sin pagar.`}</span>}</div>
                {movs.length > 0 && <div className="list" style={{ marginTop: 8 }}>{movs.map((m) => (
                  <div className="li" key={m.id}><span className="when">{cuando(m.fecha)}</span>
                    <div className="body" style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><span>{m.detalle}</span><span className="num" style={{ color: `var(--${m.tipo === 'pago' ? 'ok' : 'ink'})` }}>{m.tipo === 'pago' ? '−' : '+'}{money(m.monto)}</span></div></div>
                ))}</div>}
              </>
            ) : <p className="muted small" style={{ margin: 0 }}>Podés pagar tus pedidos a cuenta corriente: elegí "Cuenta corriente" como forma de pago y se suma a tu saldo cuando te los entregamos.</p>}
          </section>
          <section className="card">
            <div className="card-h"><h2>Pedido fijo</h2>{fijo && <Pill e={fijo.activo ? ['Activo', 'ok'] : ['Pausado', 'warn']} />}</div>
            {fijo ? (
              <>
                <p style={{ margin: '0 0 6px' }}><b>{fijo.dias.map((d) => DIAS_SEMANA[d]).join(', ')}</b> <span className="muted">· {fijo.pago}</span></p>
                <p className="muted small" style={{ margin: 0 }}>{fijo.items.map((i) => `${i.cantidad} ${productosPorId[i.productoId]?.nombre || i.productoId}`).join(' · ')}</p>
                <p className="muted small" style={{ margin: '8px 0 0' }}>Se carga solo la noche anterior a cada entrega y te avisamos cuando lo confirmamos.</p>
                <div className="row" style={{ marginTop: 10 }}>
                  <button className="btn sm" onClick={() => setArmarFijo(true)}>Modificar</button>
                  <button className="btn sm" disabled={ocupado} onClick={() => correr(() => api('pedido-fijo', { accion: fijo.activo ? 'pausar' : 'activar' }), fijo.activo ? 'Pedido fijo pausado' : 'Pedido fijo activado')}>{fijo.activo ? 'Pausar' : 'Activar'}</button>
                  <button className="btn sm ghost-bad" disabled={ocupado} onClick={() => correr(() => api('pedido-fijo', { accion: 'borrar' }), 'Pedido fijo borrado')}>Borrar</button>
                </div>
              </>
            ) : (
              <>
                <p className="muted small" style={{ margin: 0 }}>¿Pedís lo mismo todas las semanas? Dejalo armado con los días de entrega y se carga solo, sin que tengas que entrar cada vez.</p>
                <div className="row" style={{ marginTop: 10 }}><button className="btn primary" onClick={() => setArmarFijo(true)}>Armar pedido fijo</button></div>
              </>
            )}
          </section>
        </div>
      )}

      {!lista.length && <section className="card"><Vacio>Todavía no hiciste pedidos. <Link className="linkbtn" to="/catalogo">Ir al catálogo</Link></Vacio></section>}
      {lista.map((o) => {
        const min = o.tipoCliente === 'minorista';
        const k = (min ? PASOS_MIN : PASOS).indexOf(o.estado);
        const nombres = min ? NOMBRES_MIN : NOMBRES;
        return (
          <section className="card" key={o.id}>
            <div className="card-h" style={{ marginBottom: 4 }}>
              <div><h2 style={{ fontSize: 16 }}>Pedido #{o.numero} · {o.modoEntrega === 'retiro' ? 'retirás' : 'entrega'} {dRel(o.entrega).toLowerCase()}{o.canal === 'fijo' ? ' · pedido fijo' : ''}</h2>
                <div className="muted small">{o.items.map((it) => `${cant(it.cantidad, it.unidad)} × ${it.nombre}`).join(' · ')}</div></div>
              <div className="row"><span className="num" style={{ fontWeight: 600 }}>{money(o.total)}</span><Pill e={estadoDe(o)} /></div>
            </div>
            {o.estado === 'cancelado'
              ? <div className="note bad" style={{ marginTop: 8 }}>Este pedido se canceló.</div>
              : <div className="track">{nombres.map((n, j) => <div key={n} className={j <= k ? 'on' : ''}><i />{n}</div>)}</div>}
            <div className="row" style={{ marginTop: 12 }}>
              <button className="btn sm" onClick={() => repetir(o)}>Repetir pedido</button>
              <Link className="btn sm" to={`/comprobante?tipo=pedido&id=${o.id}`} target="_blank">Comprobante PDF</Link>
              {['pendiente', 'reservado'].includes(o.estado) && <button className="btn sm ghost-bad" disabled={ocupado} onClick={() => correr(() => api('pedido-estado', { id: o.id, accion: 'cancelar' }), 'Pedido cancelado')}>Cancelar</button>}
            </div>
          </section>
        );
      })}
      {armarFijo && <ArmarFijo fijo={fijo} onClose={() => setArmarFijo(false)} />}
    </div>
  );

}

function ArmarFijo({ fijo, onClose }) {
  const { productos } = useData();
  const [dias, setDias] = useState(fijo?.dias || [1, 3, 5]);
  const [items, setItems] = useState(Object.fromEntries((fijo?.items || []).map((i) => [i.productoId, i.cantidad])));
  const [pago, setPago] = useState(fijo?.pago || 'Efectivo');
  const [ocupado, correr] = useAccion();
  const total = productos.reduce((a, p) => a + (items[p.id] || 0) * (p.precio || 0), 0);
  const guardar = async () => {
    const r = await correr(() => api('pedido-fijo', { accion: 'guardar', dias, pago, items: Object.entries(items).filter(([, q]) => q > 0).map(([productoId, cantidad]) => ({ productoId, cantidad })) }), 'Pedido fijo guardado');
    if (r) onClose();
  };
  return (
    <Modal titulo={fijo ? 'Modificar pedido fijo' : 'Armar pedido fijo'} onClose={onClose}>
      <div className="field"><span style={{ fontSize: 13, fontWeight: 500 }}>Días de entrega</span>
        <div className="tabs" role="group" aria-label="Días de entrega">{[1, 2, 3, 4, 5, 6].map((d) => (
          <button key={d} type="button" aria-pressed={dias.includes(d)} onClick={() => setDias(dias.includes(d) ? dias.filter((x) => x !== d) : [...dias, d].sort())}>{DIAS_SEMANA[d]}</button>
        ))}</div>
      </div>
      <div className="lines">{productos.filter((p) => p.activo !== false).map((p) => (
        <div className="line" key={p.id}><span>{p.nombre} <span className="muted small num">{money(p.precio)}</span></span>
          <Stepper id={`fj-${p.id}`} value={items[p.id]} label={`Cantidad de ${p.nombre}`} onChange={(v) => setItems({ ...items, [p.id]: v })} /></div>
      ))}</div>
      <div className="total"><span>Total por entrega</span><span className="num">{money(total)}</span></div>
      <div className="field"><label htmlFor="fj-pago">Forma de pago</label><select id="fj-pago" value={pago} onChange={(e) => setPago(e.target.value)}>{FORMAS_PAGO.map((x) => <option key={x}>{x}</option>)}</select></div>
      <p className="muted small" style={{ margin: 0 }}>La noche anterior a cada día elegido se carga el pedido como <b>pendiente</b> y el local lo confirma. Podés pausarlo cuando quieras (por ejemplo, en vacaciones).</p>
      <div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn" onClick={onClose}>Cerrar</button><button className="btn primary" disabled={ocupado || !dias.length || !Object.values(items).some((q) => q > 0)} onClick={guardar}>Guardar</button></div>
    </Modal>
  );
}
