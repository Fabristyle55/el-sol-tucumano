import { useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { useData } from '../data';
import { Modal, Pill, Cargando, useAccion } from '../ui';
import { cuando, fq } from '../util';
import { reservado, r3 } from '../../shared/negocio.js';

export default function Stock() {
  const { perfil } = useAuth();
  const { insumos, insumosPorId, ordenes, movimientos, cargando } = useData();
  const [modal, setModal] = useState(null);
  const puede = ['deposito', 'gerente'].includes(perfil.rol);
  const res = reservado(ordenes);

  return (
    <>
      <section className="card">
        <div className="card-h"><h2>Materias primas</h2>
          {puede && <div className="row"><button className="btn" onClick={() => setModal('ajuste')}>Ajuste de inventario</button><button className="btn primary" onClick={() => setModal('ingreso')}>Registrar ingreso</button></div>}
        </div>
        {cargando ? <Cargando /> : (
          <div className="tbl-wrap"><table>
            <thead><tr><th>Insumo</th><th className="r">En depósito</th><th className="r">Reservado</th><th className="r">Disponible</th><th className="r">Seguridad</th><th>Unidad</th><th>Nivel</th><th>Estado</th></tr></thead>
            <tbody>{insumos.map((i) => {
              const rv = res[i.id] || 0; const disp = r3(i.stock - rv);
              const st = disp < i.seguridad * 0.5 ? ['Crítico', 'bad'] : disp < i.seguridad ? ['Bajo seguridad', 'warn'] : ['OK', 'ok'];
              const pct = Math.max(0, Math.min(100, (disp / (i.seguridad * 2 || 1)) * 100));
              return (
                <tr key={i.id}><td><div style={{ fontWeight: 500 }}>{i.nombre}</div><div className="muted small">{i.proveedor}</div></td>
                  <td className="r num">{fq(i.stock, i.unidad)}</td><td className="r num">{rv ? fq(rv, i.unidad) : '—'}</td>
                  <td className="r num" style={{ fontWeight: 600 }}>{fq(disp, i.unidad)}</td><td className="r num">{fq(i.seguridad, i.unidad)}</td><td className="muted">{i.unidad}</td>
                  <td><div className="meter"><i style={{ width: `${pct}%`, background: `var(--${st[1]})` }} /></div></td><td><Pill e={st} /></td></tr>
              );
            })}</tbody>
          </table></div>
        )}
        <p className="muted small" style={{ margin: '10px 0 0' }}>Reservado = insumos de órdenes de producción que todavía no se terminaron.</p>
      </section>
      <section className="card">
        <div className="card-h"><h2>Últimos movimientos</h2></div>
        <div className="list">
          {movimientos.map((m) => {
            const u = insumosPorId[m.insumoId]?.unidad || '';
            return (
              <div className="li" key={m.id}><span className="when">{cuando(m.fecha)}</span>
                <div className="body" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <span>{m.insumoNombre} <span className="muted">· {m.motivo} · {m.usuario}</span></span>
                  <span className="num" style={{ color: `var(--${m.cantidad < 0 ? 'bad' : 'ok'})` }}>{m.cantidad > 0 ? '+' : ''}{fq(m.cantidad, u)} {u}</span>
                </div>
              </div>
            );
          })}
          {!movimientos.length && <div className="empty">Todavía no hay movimientos.</div>}
        </div>
      </section>
      {modal && <MovModal tipo={modal} insumos={insumos} onClose={() => setModal(null)} />}
    </>
  );
}

function MovModal({ tipo, insumos, onClose }) {
  const [iid, setIid] = useState(insumos[0]?.id || '');
  const [q, setQ] = useState('');
  const [motivo, setMotivo] = useState('');
  const [ocupado, correr] = useAccion();
  const ing = tipo === 'ingreso';
  const i = insumos.find((x) => x.id === iid);
  const guardar = async () => {
    const r = await correr(() => api('movimiento-stock', { insumoId: iid, tipo, cantidad: parseFloat(q), motivo }), 'Movimiento registrado');
    if (r) onClose();
  };
  return (
    <Modal titulo={ing ? 'Registrar ingreso' : 'Ajuste de inventario'} onClose={onClose}>
      <div className="field"><label htmlFor="mv-i">Insumo</label><select id="mv-i" value={iid} onChange={(e) => setIid(e.target.value)}>{insumos.map((x) => <option key={x.id} value={x.id}>{x.nombre} ({x.unidad})</option>)}</select></div>
      <div className="fields2">
        <div className="field"><label htmlFor="mv-q">{ing ? 'Cantidad recibida' : 'Cantidad contada en depósito'}</label><input id="mv-q" type="number" min="0" step="0.01" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="field"><label htmlFor="mv-m">Motivo</label><input id="mv-m" type="text" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder={ing ? 'Remito del proveedor' : 'Conteo semanal'} /></div>
      </div>
      {!ing && i && <p className="muted small" style={{ margin: 0 }}>El sistema tiene {fq(i.stock, i.unidad)} {i.unidad}. Se ajusta a lo que cargues.</p>}
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn" onClick={onClose}>Cerrar</button>
        <button className="btn primary" disabled={ocupado || q === ''} onClick={guardar}>Guardar</button>
      </div>
    </Modal>
  );
}
