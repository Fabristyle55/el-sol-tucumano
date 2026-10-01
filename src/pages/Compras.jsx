import { useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { useData } from '../data';
import { Pill, useAccion } from '../ui';
import { aFecha, cuando, fq } from '../util';
import { proyeccion } from '../../shared/negocio.js';

export default function Compras() {
  const { perfil } = useAuth();
  const d = useData();
  const [cant, setCant] = useState({});
  const [ocupado, correr] = useAccion();
  const g = perfil.rol === 'gerente';
  const alertas = proyeccion({ insumos: d.insumos, ordenes: d.ordenes, pedidos: d.pedidos, compras: d.compras, productosPorId: d.productosPorId }).filter((i) => i.alerta);
  const ocs = [...d.compras].sort((a, b) => (a.estado === 'autorizada' ? 0 : 1) - (b.estado === 'autorizada' ? 0 : 1) || (aFecha(b.fecha) || 0) - (aFecha(a.fecha) || 0)).slice(0, 30);

  return (
    <>
      <section className="card">
        <div className="card-h"><div><h2>Alertas de compra</h2><p className="muted small" style={{ margin: '4px 0 0' }}>Proyectado = stock − reservado − pedidos confirmados sin planificar + compras en camino.</p></div></div>
        {alertas.length ? (
          <div className="tbl-wrap"><table>
            <thead><tr><th>Insumo</th><th className="r">Proyectado</th><th className="r">Seguridad</th><th className="r">Comprar</th><th>Proveedor</th><th /></tr></thead>
            <tbody>{alertas.map((i) => (
              <tr key={i.id}>
                <td><div style={{ fontWeight: 500 }}>{i.nombre}</div><div className="muted small">{i.pendiente ? `incluye ${fq(i.pendiente, i.unidad)} ${i.unidad} para pedidos confirmados` : 'por consumo normal'}</div></td>
                <td className="r num" style={{ color: 'var(--bad)' }}>{fq(i.proyectado, i.unidad)} {i.unidad}</td>
                <td className="r num">{fq(i.seguridad, i.unidad)} {i.unidad}</td>
                <td className="r">{g
                  ? <input className="qty-in num" type="number" min={i.pack} step={i.pack} value={cant[i.id] ?? i.sugerido} onChange={(e) => setCant({ ...cant, [i.id]: e.target.value })} aria-label={`Cantidad a comprar de ${i.nombre}`} />
                  : <span className="num">{fq(i.sugerido, i.unidad)}</span>} <span className="muted small">{i.unidad}</span><div className="muted small">{i.packLabel}</div></td>
                <td>{i.proveedor}</td>
                <td className="r">{g
                  ? <button className="btn sm primary" disabled={ocupado} onClick={() => correr(() => api('compra', { accion: 'autorizar', insumoId: i.id, cantidad: +(cant[i.id] ?? i.sugerido) }), (r) => `${r.codigo} autorizada a ${r.proveedor}`)}>Autorizar compra</button>
                  : <span className="muted small">Espera autorización</span>}</td>
              </tr>
            ))}</tbody>
          </table></div>
        ) : <div className="note ok">Ningún insumo va a quedar por debajo del stock de seguridad.</div>}
      </section>
      <section className="card">
        <div className="card-h"><h2>Pedidos a proveedores</h2></div>
        {ocs.length ? (
          <div className="tbl-wrap"><table>
            <thead><tr><th>Orden</th><th>Insumo</th><th className="r">Cantidad</th><th>Proveedor</th><th>Fecha</th><th>Estado</th><th /></tr></thead>
            <tbody>{ocs.map((c) => (
              <tr key={c.id}><td className="num">{c.codigo}</td><td>{c.insumoNombre}</td><td className="r num">{fq(c.cantidad, c.unidad)} {c.unidad}</td><td>{c.proveedor}</td><td>{cuando(c.fecha)}</td>
                <td><Pill e={c.estado === 'autorizada' ? ['En camino', 'info'] : ['Recibida', 'ok']} /></td>
                <td className="r">{c.estado === 'autorizada' && <button className="btn sm" disabled={ocupado} onClick={() => correr(() => api('compra', { accion: 'recibir', id: c.id }), (r) => `Ingresaron ${r.cantidad} ${r.unidad} de ${r.insumo}`)}>Registrar recepción</button>}</td></tr>
            ))}</tbody>
          </table></div>
        ) : <div className="empty">Todavía no hay compras.</div>}
      </section>
    </>
  );
}
