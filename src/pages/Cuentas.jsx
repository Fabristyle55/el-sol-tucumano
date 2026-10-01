import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { api } from '../api';
import { useData } from '../data';
import { Contador, Modal, Pill, Vacio, useAccion } from '../ui';
import { aFecha, cuando, dLarga, hoy, money } from '../util';
import { PAGOS_DESPACHO, estadoCuenta } from '../../shared/negocio.js';

const PILL = { 'al-dia': ['Al día', 'ok'], debe: ['Con saldo', 'warn'], vencida: ['Vencida', 'bad'] };

export default function Cuentas() {
  const { clientes, pedidos } = useData();
  const [pago, setPago] = useState(null);
  const [ver, setVer] = useState(null);
  const [params] = useSearchParams();
  const [filtro, setFiltro] = useState(params.get('f') || 'todos');
  const T = hoy();
  const filas = clientes.filter((c) => (c.tipo || 'mayorista') === 'mayorista').map((c) => ({ c, e: estadoCuenta(c, T) }))
    .sort((a, b) => b.e.saldo - a.e.saldo);
  const lista = filas.filter((x) => filtro === 'todos' || (filtro === 'saldo' ? x.e.saldo > 0 : x.e.estado === 'vencida'));
  const total = filas.reduce((s, x) => s + Math.max(0, x.e.saldo), 0);
  const vencidas = filas.filter((x) => x.e.estado === 'vencida');
  const totalVencido = vencidas.reduce((s, x) => s + x.e.saldo, 0);
  const aEntregar = pedidos.filter((p) => p.pago === 'Cuenta corriente' && !['entregado', 'cancelado'].includes(p.estado));

  return (
    <>
      <div className="kpis">
        <div className="kpi"><span className="t">Total a cobrar</span><span className="v"><Contador valor={total} formato={money} /></span><span className="s">{filas.filter((x) => x.e.saldo > 0).length} comercios con saldo</span></div>
        <div className={`kpi ${vencidas.length ? 'alert' : ''}`}><span className="t">Deuda vencida</span><span className="v"><Contador valor={totalVencido} formato={money} /></span><span className="s">{vencidas.length ? vencidas.map((x) => x.c.nombre).join(', ') : 'nadie atrasado'}</span></div>
        <div className="kpi"><span className="t">Pedidos a cuenta por entregar</span><span className="v"><Contador valor={aEntregar.length} /></span><span className="s">{money(aEntregar.reduce((s, p) => s + p.total, 0))} que se van a sumar</span></div>
      </div>
      <section className="card">
        <div className="card-h">
          <div className="tabs" role="group" aria-label="Filtrar">{[['todos', 'Todos'], ['saldo', 'Con saldo'], ['vencida', 'Vencidas']].map(([k, l]) => <button key={k} aria-pressed={filtro === k} onClick={() => setFiltro(k)}>{l}</button>)}</div>
          <span className="muted small">El pedido se suma al saldo cuando se entrega.</span>
        </div>
        {lista.length ? (
          <div className="tbl-wrap"><table>
            <thead><tr><th>Comercio</th><th className="r">Saldo</th><th>Debe desde</th><th className="r">Plazo</th><th>Estado</th><th /></tr></thead>
            <tbody>{lista.map(({ c, e }) => (
              <tr key={c.id}>
                <td><div style={{ fontWeight: 500 }}>{c.nombre}</div><div className="muted small">{c.localidad}{c.telefono ? ` · ${c.telefono}` : ''}</div></td>
                <td className="r num" style={{ fontWeight: 600 }}>{money(e.saldo)}</td>
                <td className="small">{e.saldo > 0 && c.deudaDesde ? <>{dLarga(c.deudaDesde)} <span className="muted">({e.dias} días)</span></> : <span className="muted">—</span>}</td>
                <td className="r"><PlazoInput cliente={c} plazo={e.plazo} /></td>
                <td><Pill e={PILL[e.estado]} /></td>
                <td><div className="row" style={{ justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
                  <button className="btn sm" onClick={() => setVer(c)}>Movimientos</button>
                  <button className="btn sm primary" disabled={e.saldo <= 0} onClick={() => setPago(c)}>Registrar pago</button>
                </div></td>
              </tr>
            ))}</tbody>
          </table></div>
        ) : <Vacio>No hay comercios en este filtro.</Vacio>}
      </section>
      {pago && <PagoModal cliente={pago} onClose={() => setPago(null)} />}
      {ver && <MovimientosModal cliente={ver} onClose={() => setVer(null)} />}
    </>
  );
}

function PlazoInput({ cliente, plazo }) {
  const [ocupado, correr] = useAccion();
  return (
    <span className="row" style={{ justifyContent: 'flex-end', flexWrap: 'nowrap', gap: 4 }}>
      <input key={`${cliente.id}-${plazo}`} className="qty-in num" style={{ width: 60 }} type="number" min="1" max="90" defaultValue={plazo} disabled={ocupado} aria-label={`Plazo de ${cliente.nombre} en días`}
        onBlur={(e) => { const v = Math.round(+e.target.value); if (v && v !== plazo) correr(() => api('cuenta', { accion: 'plazo', clienteId: cliente.id, plazoDias: v }), `Plazo de ${cliente.nombre}: ${v} días`); }} />
      <span className="muted small">días</span>
    </span>
  );
}

function PagoModal({ cliente, onClose }) {
  const [f, setF] = useState({ monto: Math.max(0, Math.round(cliente.saldo || 0)), medio: 'Efectivo', nota: '' });
  const [ocupado, correr] = useAccion();
  const queda = Math.round(cliente.saldo || 0) - (Number(f.monto) || 0);
  const guardar = async () => {
    const r = await correr(() => api('cuenta', { accion: 'pago', clienteId: cliente.id, monto: Number(f.monto), medio: f.medio, nota: f.nota }), `Pago de ${cliente.nombre} registrado`);
    if (r) onClose();
  };
  return (
    <Modal titulo={`Pago de ${cliente.nombre}`} onClose={onClose}>
      <div className="fields2">
        <div className="field"><label htmlFor="pg-m">Monto</label><input id="pg-m" type="number" min="0" value={f.monto} onChange={(e) => setF({ ...f, monto: e.target.value })} autoFocus /></div>
        <div className="field"><label htmlFor="pg-x">Medio de pago</label><select id="pg-x" value={f.medio} onChange={(e) => setF({ ...f, medio: e.target.value })}>{PAGOS_DESPACHO.map((x) => <option key={x}>{x}</option>)}</select></div>
      </div>
      <div className="field"><label htmlFor="pg-n">Nota (opcional)</label><input id="pg-n" type="text" value={f.nota} onChange={(e) => setF({ ...f, nota: e.target.value })} placeholder="Ej.: pagó el repartidor" /></div>
      <div className="lines">
        <div className="line"><span>Saldo actual</span><span className="num">{money(cliente.saldo)}</span></div>
        <div className="line"><span>Queda debiendo</span><span className="num" style={{ fontWeight: 600 }}>{money(Math.max(0, queda))}{queda < 0 ? ` (a favor ${money(-queda)})` : ''}</span></div>
      </div>
      <div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn" onClick={onClose}>Cerrar</button><button className="btn primary" disabled={ocupado || !(Number(f.monto) > 0)} onClick={guardar}>Registrar pago</button></div>
    </Modal>
  );
}

function MovimientosModal({ cliente, onClose }) {
  const [movs, setMovs] = useState(null);
  useEffect(() => {
    getDocs(query(collection(db, 'movCuenta'), where('clienteId', '==', cliente.id)))
      .then((s) => setMovs(s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (aFecha(b.fecha) || 0) - (aFecha(a.fecha) || 0))))
      .catch(() => setMovs([]));
  }, [cliente.id]);
  return (
    <Modal titulo={`Cuenta corriente de ${cliente.nombre}`} onClose={onClose} ancho={640}>
      {movs === null ? <div className="empty">Cargando…</div> : movs.length ? (
        <div className="tbl-wrap"><table>
          <thead><tr><th>Fecha</th><th>Detalle</th><th className="r">Cargo</th><th className="r">Pago</th><th className="r">Saldo</th></tr></thead>
          <tbody>{movs.map((m) => (
            <tr key={m.id}><td className="small">{cuando(m.fecha)}</td><td>{m.detalle}<div className="muted small">{m.usuario}</div></td>
              <td className="r num">{m.tipo === 'cargo' ? money(m.monto) : ''}</td><td className="r num" style={{ color: 'var(--ok)' }}>{m.tipo === 'pago' ? money(m.monto) : ''}</td><td className="r num" style={{ fontWeight: 600 }}>{money(m.saldo)}</td></tr>
          ))}</tbody>
        </table></div>
      ) : <Vacio>Este comercio todavía no tiene movimientos en cuenta corriente.</Vacio>}
      <div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn" onClick={onClose}>Cerrar</button></div>
    </Modal>
  );
}
