import { Link } from 'react-router-dom';
import { api } from '../api';
import { useData } from '../data';
import { Pill, Vacio, Cargando, useAccion } from '../ui';
import { EST, aFecha, dRel, money } from '../util';

const PASOS = ['pendiente', 'confirmado', 'produccion', 'listo', 'entregado'];
const NOMBRES = ['Recibido', 'Confirmado', 'En el horno', 'Listo', 'Entregado'];

export default function MisPedidos() {
  const { pedidos, cargando } = useData();
  const [ocupado, correr] = useAccion();
  const lista = [...pedidos].sort((a, b) => (aFecha(b.creado) || 0) - (aFecha(a.creado) || 0)).slice(0, 20);
  if (cargando) return <Cargando />;
  if (!lista.length) return <section className="card"><Vacio>Todavía no hiciste pedidos. <Link className="linkbtn" to="/catalogo">Ir al catálogo</Link></Vacio></section>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {lista.map((o) => {
        const k = PASOS.indexOf(o.estado);
        return (
          <section className="card" key={o.id}>
            <div className="card-h" style={{ marginBottom: 4 }}>
              <div><h2 style={{ fontSize: 17 }}>Pedido #{o.numero} · {o.modoEntrega === 'retiro' ? 'retirás' : 'entrega'} {dRel(o.entrega).toLowerCase()}</h2>
                <div className="muted small">{o.items.map((it) => `${it.cantidad} × ${it.nombre}`).join(' · ')}</div></div>
              <div className="row"><span className="num" style={{ fontWeight: 600 }}>{money(o.total)}</span><Pill e={EST[o.estado]} />
                {o.estado === 'pendiente' && <button className="btn sm ghost-bad" disabled={ocupado} onClick={() => correr(() => api('pedido-estado', { id: o.id, accion: 'cancelar' }), 'Pedido cancelado')}>Cancelar</button>}</div>
            </div>
            {o.estado === 'cancelado'
              ? <div className="note bad" style={{ marginTop: 8 }}>Este pedido se canceló.</div>
              : <div className="track">{NOMBRES.map((n, j) => <div key={n} className={j <= k ? 'on' : ''}><i />{n}</div>)}</div>}
          </section>
        );
      })}
    </div>
  );
}
