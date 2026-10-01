import { Fragment, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { useData } from '../data';
import { Modal, Pill, Vacio, Cargando, useAccion } from '../ui';
import { ENTREGA_LABEL, TIPO_LABEL, cant, dRel, dShort, estadoDe, hhmm, aFecha, money } from '../util';
import PedidoModal from '../components/PedidoModal';

const FILTROS = [['activos', 'Activos'], ['pendiente', 'Por confirmar'], ['reservado', 'Reservas'], ['confirmado', 'Confirmados'], ['produccion', 'En producción'], ['listo', 'Listos'], ['entregado', 'Entregados'], ['cancelado', 'Cancelados']];
const activo = (p) => !['entregado', 'cancelado'].includes(p.estado);

export default function Pedidos() {
  const { perfil } = useAuth();
  const { pedidos, cargando } = useData();
  const [params, setParams] = useSearchParams();
  const f = params.get('f') || 'activos';
  const tipo = params.get('t') || 'todos';
  const conTipo = (p) => tipo === 'todos' || (p.tipoCliente || 'mayorista') === tipo;
  const filtro = (k, t) => { const n = {}; if (k !== 'activos') n.f = k; if (t !== 'todos') n.t = t; setParams(n); setAbierto(null); };
  const [abierto, setAbierto] = useState(null);
  const [nuevo, setNuevo] = useState(false);
  const [cancelar, setCancelar] = useState(null);
  const [ocupado, correr] = useAccion();
  const nav = useNavigate();
  const g = perfil.rol === 'gerente';

  let lista = pedidos.filter((p) => conTipo(p) && (f === 'activos' ? activo(p) : p.estado === f));
  lista.sort((a, b) => (f === 'entregado' ? b.entrega.localeCompare(a.entrega) || b.numero - a.numero : a.entrega.localeCompare(b.entrega) || a.numero - b.numero));
  if (f === 'entregado') lista = lista.slice(0, 30);
  const contar = (k) => pedidos.filter((p) => conTipo(p) && (k === 'activos' ? activo(p) : p.estado === k)).length;
  const accion = (p, a, msg) => correr(() => api('pedido-estado', { id: p.id, accion: a }), msg);

  const botones = (p) => {
    if (p.tipoCliente === 'minorista') {
      if (p.estado === 'reservado') return (<>
        <button className="btn sm primary" disabled={ocupado} onClick={() => accion(p, 'preparar', `Reserva #${p.numero} preparada`)}>Preparar</button>
        <button className="btn sm ghost-bad" disabled={ocupado} onClick={() => setCancelar(p)}>Cancelar</button></>);
      if (p.estado === 'listo') return <button className="btn sm primary" disabled={ocupado} onClick={() => accion(p, 'entregar', `Reserva #${p.numero} retirada`)}>Marcar retirada</button>;
      return null;
    }
    if (p.estado === 'pendiente' && g) return (<>
      <button className="btn sm primary" disabled={ocupado} onClick={() => accion(p, 'confirmar', `Pedido #${p.numero} confirmado`)}>Confirmar</button>
      <button className="btn sm ghost-bad" disabled={ocupado} onClick={() => setCancelar(p)}>Cancelar</button></>);
    if (p.estado === 'pendiente') return <span className="muted small">Espera al gerente</span>;
    if (p.estado === 'listo') return <button className="btn sm" disabled={ocupado} onClick={() => accion(p, 'entregar', `Pedido #${p.numero} entregado`)}>Marcar entregado</button>;
    if (p.estado === 'confirmado' && g) return <button className="btn sm" onClick={() => nav(`/planificacion?d=${p.entrega}`)}>Planificar</button>;
    return null;
  };

  return (
    <section className="card">
      <div className="card-h">
        <div className="tabs" role="group" aria-label="Filtrar por estado">
          {FILTROS.map(([k, l]) => <button key={k} aria-pressed={f === k} onClick={() => filtro(k, tipo)}>{l} <span className="num">{contar(k)}</span></button>)}
        </div>
        <div className="row">
          <select aria-label="Tipo de cliente" value={tipo} onChange={(e) => filtro(f, e.target.value)}><option value="todos">Todos los clientes</option><option value="mayorista">Mayoristas</option><option value="minorista">Minoristas</option></select>
          <button className="btn primary" onClick={() => setNuevo(true)}>Cargar pedido</button>
        </div>
      </div>
      {cargando ? <Cargando /> : lista.length ? (
        <div className="tbl-wrap"><table>
          <thead><tr><th>Pedido</th><th>Cliente</th><th>Canal</th><th>Entrega</th><th className="r">Total</th><th>Estado</th><th /></tr></thead>
          <tbody>
            {lista.map((p) => (
              <Fragment key={p.id}>
                <tr>
                  <td><button className="linkbtn num" aria-expanded={abierto === p.id} onClick={() => setAbierto(abierto === p.id ? null : p.id)}>#{p.numero}</button></td>
                  <td><div style={{ fontWeight: 500 }}>{p.clienteNombre}</div><div className="muted small">{TIPO_LABEL[p.tipoCliente || 'mayorista']}{p.localidad ? ` · ${p.localidad}` : ''}</div></td>
                  <td><span className="chip">{p.canal === 'web' ? 'Web' : 'Mostrador'}</span></td>
                  <td>{dRel(p.entrega)}{p.modoEntrega === 'retiro' && <div className="muted small">Retira en el local</div>}</td>
                  <td className="r num">{money(p.total)}</td>
                  <td><Pill e={estadoDe(p)} /></td>
                  <td><div className="row" style={{ justifyContent: 'flex-end', flexWrap: 'nowrap' }}>{botones(p)}</div></td>
                </tr>
                {abierto === p.id && (
                  <tr className="detail"><td /><td colSpan={6}>
                    <div className="row" style={{ gap: '6px 16px' }}>{p.items.map((it) => <span key={it.articuloId || it.productoId}><span className="num">{cant(it.cantidad, it.unidad)}</span> × {it.nombre}</span>)}</div>
                    <div className="muted" style={{ marginTop: 6 }}>
                      {ENTREGA_LABEL[p.modoEntrega || 'envio']} · Pago: {p.pago}{p.telefono ? ` · Tel. ${p.telefono}` : ''} · Cargado {aFecha(p.creado) ? `${dShort(aFecha(p.creado).toISOString().slice(0, 10))} ${hhmm(p.creado)}` : ''} por {p.creadoPor}
                      {p.direccion ? ` · ${p.direccion}` : ''}{p.notas ? ` · Nota: ${p.notas}` : ''}
                    </div>
                  </td></tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table></div>
      ) : <Vacio>No hay pedidos en este estado.</Vacio>}
      {f === 'entregado' && <p className="muted small" style={{ margin: '10px 0 0' }}>Se muestran los 30 más recientes de las últimas dos semanas.</p>}

      {nuevo && <PedidoModal modo="mostrador" onClose={() => setNuevo(false)} />}
      {cancelar && (
        <Modal titulo={`¿Cancelar el pedido #${cancelar.numero}?`} onClose={() => setCancelar(null)}>
          <p style={{ margin: 0 }}>El pedido de {cancelar.clienteNombre} queda cancelado. Esta acción no se puede deshacer.</p>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn" onClick={() => setCancelar(null)}>Volver</button>
            <button className="btn primary" disabled={ocupado} onClick={async () => { await accion(cancelar, 'cancelar', `Pedido #${cancelar.numero} cancelado`); setCancelar(null); }}>Cancelar pedido</button>
          </div>
        </Modal>
      )}
    </section>
  );
}
