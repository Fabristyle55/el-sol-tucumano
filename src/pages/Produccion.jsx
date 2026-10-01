import { api } from '../api';
import { useAuth } from '../auth';
import { useData } from '../data';
import { Pill, Vacio, useAccion } from '../ui';
import { OPEST, dRel, dShort, fq, hhmm, hoy } from '../util';

const ORDEN = { en_curso: 0, pendiente: 1, terminada: 2 };

export default function Produccion() {
  const { perfil } = useAuth();
  const { ordenes, insumosPorId } = useData();
  const [ocupado, correr] = useAccion();
  const puede = ['panadero', 'gerente'].includes(perfil.rol);
  const ops = ordenes.filter((o) => o.estado !== 'terminada' || o.fecha >= hoy());
  const completo = (f) => ops.filter((o) => o.fecha === f).every((o) => o.estado === 'terminada');
  const fechas = [...new Set(ops.map((o) => o.fecha))].sort((a, b) => completo(a) - completo(b) || a.localeCompare(b));
  const accion = (o, a) => correr(() => api('orden-estado', { id: o.id, accion: a }),
    (r) => (a === 'empezar' ? `OP-${o.numero} en curso` : r.pedidosListos ? `Producción completa: ${r.pedidosListos} pedidos listos para reparto` : `OP-${o.numero} terminada. Se descontaron los insumos.`));

  if (!fechas.length) return <section className="card"><Vacio>No hay órdenes de producción. El gerente las genera desde Planificación.</Vacio></section>;

  return fechas.map((f) => {
    const g = ops.filter((o) => o.fecha === f).sort((a, b) => ORDEN[a.estado] - ORDEN[b.estado] || a.numero - b.numero);
    const hechas = g.filter((o) => o.estado === 'terminada').length;
    if (hechas === g.length) {
      return (
        <section className="card" key={f}>
          <div className="card-h" style={{ margin: 0 }}><h2 style={{ fontSize: 19 }}>Producción para {dRel(f).toLowerCase()} terminada</h2><Pill e={['Completa', 'ok']} /></div>
          <div className="row" style={{ marginTop: 10 }}>{g.map((o) => <span className="chip" key={o.id}>{o.cantidad} {o.productoNombre}</span>)}</div>
        </section>
      );
    }
    return (
      <section key={f} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="card-h" style={{ margin: 0 }}>
          <h2 style={{ fontSize: 21 }}>Producción para {dRel(f).toLowerCase()} <span className="muted" style={{ fontFamily: 'var(--f-body)', fontSize: 14, fontWeight: 400 }}>· {dShort(f)}</span></h2>
          <div className="row"><div className="meter" style={{ width: 140 }}><i style={{ width: `${(hechas / g.length) * 100}%`, background: 'var(--ok)' }} /></div><span className="num small">{hechas}/{g.length} terminadas</span></div>
        </div>
        <div className="ops">
          {g.map((o) => (
            <article className={`op ${o.estado === 'terminada' ? 'done' : ''}`} key={o.id}>
              <div className="row" style={{ justifyContent: 'space-between' }}><span className="muted small num">OP-{o.numero}</span><Pill e={OPEST[o.estado]} /></div>
              <div><div className="q num">{o.cantidad}</div><div style={{ fontWeight: 600 }}>{o.productoNombre}</div>{o.extra > 0 && <div className="muted small">incluye {o.extra} para el local</div>}</div>
              <ul>{Object.entries(o.insumos || {}).map(([iid, q]) => {
                const i = insumosPorId[iid];
                return <li key={iid}><span>{i?.nombre || iid}</span><span className="num">{fq(q, i?.unidad)} {i?.unidad}</span></li>;
              })}</ul>
              {puede && o.estado === 'pendiente' && <button className="btn" disabled={ocupado} onClick={() => accion(o, 'empezar')}>Empezar</button>}
              {puede && o.estado === 'en_curso' && <button className="btn primary" disabled={ocupado} onClick={() => accion(o, 'terminar')}>Terminar y descontar insumos</button>}
              {o.estado === 'en_curso' && o.responsable && <span className="muted small">A cargo de {o.responsable}</span>}
              {o.estado === 'terminada' && <span className="muted small">Terminada {hhmm(o.fin)}</span>}
            </article>
          ))}
        </div>
      </section>
    );
  });
}
