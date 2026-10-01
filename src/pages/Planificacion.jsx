import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useData } from '../data';
import { Pill, useAccion } from '../ui';
import { OPEST, dRel, fq, hoy, manana } from '../util';
import { explotar, extraSugerido, reservado, r3, totalesPorProducto, vaAProduccion } from '../../shared/negocio.js';

export default function Planificacion() {
  const { pedidos, productos, productosPorId, insumosPorId, ordenes, mermas } = useData();
  const [params, setParams] = useSearchParams();
  const [extra, setExtra] = useState({});
  const [ocupado, correr] = useAccion();
  const D = params.get('d') || manana();

  const fechas = [...new Set(pedidos.filter((p) => vaAProduccion(p) && ['confirmado', 'pendiente', 'produccion'].includes(p.estado) && p.entrega >= hoy()).map((p) => p.entrega).concat([manana(), D]))].sort();
  // Solo los pedidos mayoristas se producen por pedido (los minoristas salen del despacho).
  const conf = pedidos.filter((p) => p.entrega === D && p.estado === 'confirmado' && vaAProduccion(p)).sort((a, b) => a.numero - b.numero);
  const pend = pedidos.filter((p) => p.entrega === D && p.estado === 'pendiente' && vaAProduccion(p));
  const opsD = ordenes.filter((o) => o.fecha === D).sort((a, b) => a.numero - b.numero);
  const ex = extra[D] || {};
  const tot = totalesPorProducto(conf);
  const prod = {};
  productos.forEach((p) => { const q = (tot[p.id] || 0) + (ex[p.id] || 0); if (q) prod[p.id] = q; });
  const nec = explotar(prod, productosPorId);
  const res = reservado(ordenes);
  const filas = Object.keys(nec).map((iid) => {
    const i = insumosPorId[iid] || { nombre: iid, unidad: '', stock: 0, seguridad: 0 };
    const disp = r3(i.stock - (res[iid] || 0));
    return { iid, i, n: nec[iid], disp, queda: r3(disp - nec[iid]) };
  }).sort((a, b) => (a.queda - a.i.seguridad) / (a.i.seguridad || 1) - (b.queda - b.i.seguridad) / (b.i.seguridad || 1));
  const falta = filas.filter((r) => r.queda < 0);
  const totalU = Object.values(prod).reduce((a, b) => a + b, 0);

  const sug = Object.fromEntries(productos.map((p) => [p.id, extraSugerido(ordenes, mermas, p.id, hoy())]));
  const haySug = Object.values(sug).some(Boolean);
  const setEx = (pid, v) => setExtra({ ...extra, [D]: { ...ex, [pid]: Math.max(0, Math.floor(+v || 0)) } });
  const generar = async () => {
    const r = await correr(() => api('generar-ordenes', { fecha: D, extra: ex }), (x) => `Se generaron ${x.ordenes} órdenes de producción para ${dRel(D).toLowerCase()}.`);
    if (r) setExtra({ ...extra, [D]: {} });
  };

  return (
    <>
      <div className="row"><span className="lbl">Día de entrega</span>
        <div className="tabs">{fechas.map((d) => <button key={d} aria-pressed={d === D} onClick={() => setParams({ d })}>{dRel(d)}</button>)}</div>
        <input type="date" aria-label="Otra fecha" min={hoy()} value={D} onChange={(e) => e.target.value && setParams({ d: e.target.value })} />
      </div>
      {pend.length > 0 && (
        <div className="note warn">{pend.length === 1 ? '1 pedido pendiente' : `${pend.length} pedidos pendientes`} de confirmar para este día no {pend.length === 1 ? 'entra' : 'entran'} en el cálculo. <Link className="linkbtn" to="/pedidos?f=pendiente">Revisarlos</Link></div>
      )}
      <div className="grid2 plan">
        <section className="card">
          <div className="card-h"><h2>1 · Productos a elaborar</h2><span className="muted small">{conf.length} pedidos confirmados</span></div>
          {conf.length > 0 && <div className="row" style={{ marginBottom: 10 }}>{conf.map((o) => <span className="chip" key={o.id}>#{o.numero} {o.clienteNombre}</span>)}</div>}
          <div className="tbl-wrap"><table>
            <thead><tr><th>Producto</th><th className="r">Pedidos</th><th className="r">Extra local</th><th className="r">A producir</th></tr></thead>
            <tbody>{productos.filter((p) => p.activo !== false || tot[p.id]).map((p) => (
              <tr key={p.id}><td>{p.nombre}</td><td className="r num">{tot[p.id] || '—'}</td>
                <td className="r"><input className="qty-in num" type="number" min="0" placeholder="0" value={ex[p.id] || ''} onChange={(e) => setEx(p.id, e.target.value)} aria-label={`Extra para venta en el local de ${p.nombre}`} />
                  {sug[p.id] && <div><button className="linkbtn small" title={`Última semana: se hornearon ${sug[p.id].producido} de más y sobraron ${sug[p.id].sobro}`} onClick={() => setEx(p.id, sug[p.id].sugerido)}>sugerido: {sug[p.id].sugerido}</button></div>}</td>
                <td className="r num" style={{ fontWeight: 600 }}>{prod[p.id] || '—'}</td></tr>
            ))}</tbody>
          </table></div>
          <p className="muted small" style={{ margin: '10px 0 0' }}>"Extra local" es lo que se hornea de más para vender en el despacho. Cuando el panadero termina la orden, pasa solo al stock del despacho.{haySug ? ' "Sugerido" descuenta lo que sobró en la última semana (mermas del despacho); tocalo para usarlo.' : ''}</p>
        </section>
        <section className="card">
          <div className="card-h"><h2>2 · Insumos requeridos</h2><span className="muted small">según recetas</span></div>
          {filas.length ? (
            <div className="tbl-wrap"><table>
              <thead><tr><th>Insumo</th><th className="r">Necesario</th><th className="r">Disponible</th><th>Resultado</th></tr></thead>
              <tbody>{filas.map((r) => (
                <tr key={r.iid}><td>{r.i.nombre}</td><td className="r num">{fq(r.n, r.i.unidad)} {r.i.unidad}</td><td className="r num">{fq(r.disp, r.i.unidad)} {r.i.unidad}</td>
                  <td>{r.queda < 0 ? <Pill e={[`Faltan ${fq(-r.queda, r.i.unidad)} ${r.i.unidad}`, 'bad']} /> : r.queda < r.i.seguridad ? <Pill e={['Queda bajo seguridad', 'warn']} /> : <Pill e={['Alcanza', 'ok']} />}</td></tr>
              ))}</tbody>
            </table></div>
          ) : <div className="empty">No hay nada para producir este día.</div>}
        </section>
      </div>
      <section className="card">
        <div className="card-h">
          <div><h2>3 · Órdenes de producción</h2>
            <p className="muted small" style={{ margin: '4px 0 0' }}>{opsD.length ? `Ya hay ${opsD.length} órdenes para ${dRel(D).toLowerCase()} (${opsD.filter((o) => o.estado === 'terminada').length} terminadas).` : 'Todavía no se generaron órdenes para este día.'}</p></div>
          <button className="btn primary" disabled={!totalU || falta.length > 0 || ocupado} onClick={generar}>{ocupado ? 'Generando…' : `Generar ${Object.keys(prod).length || ''} órdenes`}</button>
        </div>
        {falta.length > 0
          ? <div className="note bad">No alcanzan {falta.map((r) => r.i.nombre.toLowerCase()).join(', ')}. Autorizá la compra o ajustá las cantidades antes de generar las órdenes. <Link className="linkbtn" to="/compras">Ir a Compras</Link></div>
          : totalU > 0 && <div className="note">Al generar: los pedidos pasan a <b>En producción</b>, se reservan {Object.keys(nec).length} insumos en el stock y los panaderos ven el programa del día.</div>}
        {opsD.length > 0 && <div className="row" style={{ marginTop: 12 }}>{opsD.map((o) => <span className="chip" key={o.id}>OP-{o.numero} · {o.cantidad} {o.productoNombre} · {OPEST[o.estado][0]}</span>)}</div>}
      </section>
    </>
  );
}
