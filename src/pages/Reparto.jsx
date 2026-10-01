import { Link, useSearchParams } from 'react-router-dom';
import { useData } from '../data';
import { Pill, Vacio } from '../ui';
import { aCobrarEnEntrega } from '../../shared/negocio.js';
import { cant, dLarga, dRel, estadoDe, hoy, manana, money, sumarDias } from '../util';

/** Hoja de reparto imprimible: pedidos con envío de un día, agrupados por localidad. */
export default function Reparto() {
  const { pedidos } = useData();
  const [params, setParams] = useSearchParams();
  const D = params.get('d') || hoy();
  const lista = pedidos.filter((p) => p.entrega === D && p.modoEntrega !== 'retiro' && p.estado !== 'cancelado')
    .sort((a, b) => (a.localidad || '').localeCompare(b.localidad || '') || (a.direccion || '').localeCompare(b.direccion || '') || a.numero - b.numero);
  const zonas = {};
  lista.forEach((p) => { (zonas[p.localidad || 'Sin localidad'] ||= []).push(p); });
  const aCobrar = aCobrarEnEntrega;
  const totalCobrar = lista.reduce((s, p) => s + aCobrar(p), 0);
  const bultos = {};
  lista.forEach((p) => p.items.forEach((i) => { bultos[i.nombre] = (bultos[i.nombre] || 0) + i.cantidad; }));
  const sinListo = lista.filter((p) => !['listo', 'en_camino', 'entregado'].includes(p.estado)).length;

  return (
    <>
      <div className="row no-print" style={{ justifyContent: 'space-between' }}>
        <div className="row">
          <span className="lbl">Día</span>
          <div className="tabs">{[sumarDias(hoy(), -1), hoy(), manana()].map((d) => <button key={d} aria-pressed={d === D} onClick={() => setParams({ d })}>{dRel(d)}</button>)}</div>
          <input type="date" aria-label="Otro día" value={D} onChange={(e) => e.target.value && setParams({ d: e.target.value })} />
        </div>
        <div className="row"><Link className="btn" to="/pedidos">Volver a pedidos</Link><Link className="btn" to="/entregas">Modo repartidor</Link><button className="btn primary" disabled={!lista.length} onClick={() => window.print()}>Imprimir o guardar PDF</button></div>
      </div>
      {sinListo > 0 && <div className="note warn no-print">{sinListo === 1 ? 'Hay 1 pedido que todavía no está listo' : `Hay ${sinListo} pedidos que todavía no están listos`} (en producción o sin confirmar). Igual aparecen en la hoja.</div>}

      <section className="card hoja">
        <div className="hoja-cab">
          <div><img src="/marca/logo.jpg" alt="" /><div><b>Hoja de reparto</b><span>Panificación El Sol Siciliano</span></div></div>
          <div className="r"><b>{dLarga(D)}</b><span>{lista.length} entregas · a cobrar {money(totalCobrar)}</span></div>
        </div>
        {lista.length ? Object.entries(zonas).map(([zona, ps]) => (
          <div key={zona} className="hoja-zona">
            <h3>{zona} <span className="muted small">· {ps.length} {ps.length === 1 ? 'entrega' : 'entregas'}</span></h3>
            <div className="tbl-wrap"><table>
              <thead><tr><th style={{ width: 28 }}>✓</th><th>Pedido</th><th>Cliente y dirección</th><th>Productos</th><th className="r">A cobrar</th><th className="firma">Recibió (firma)</th></tr></thead>
              <tbody>{ps.map((p) => (
                <tr key={p.id}>
                  <td><span className="casilla" /></td>
                  <td className="num">#{p.numero}<div className="no-print"><Pill e={estadoDe(p)} /></div></td>
                  <td><b>{p.clienteNombre}</b><div className="small">{p.direccion || 'Sin dirección'}{p.telefono ? ` · Tel. ${p.telefono}` : ''}</div>{p.notas ? <div className="small muted">Nota: {p.notas}</div> : null}</td>
                  <td className="small">{p.items.map((i) => `${cant(i.cantidad, i.unidad)} ${i.nombre}`).join(' · ')}</td>
                  <td className="r num">{aCobrar(p) ? <b>{money(aCobrar(p))}</b> : <span className="small muted">{p.pago === 'Cuenta corriente' ? 'Cta. cte.' : p.pago}</span>}</td>
                  <td className="firma" />
                </tr>
              ))}</tbody>
            </table></div>
          </div>
        )) : <Vacio>No hay pedidos con envío para el {dLarga(D)}.</Vacio>}
        {lista.length > 0 && (
          <div className="hoja-pie">
            <div><span className="lbl">Carga total del vehículo</span><div className="small">{Object.entries(bultos).map(([n, q]) => `${q} ${n}`).join(' · ')}</div></div>
            <div className="r"><span className="lbl">Total a cobrar en efectivo</span><b className="num">{money(totalCobrar)}</b></div>
          </div>
        )}
      </section>
    </>
  );
}
