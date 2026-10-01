import { useState } from 'react';
import { useAuth } from '../auth';
import { useData } from '../data';
import { api } from '../api';
import { BotonWhatsApp, Modal, Pill, Vacio, Cargando, useAccion } from '../ui';
import { cant, dLarga, dRel, estadoDe, hoy, manana, mapaPedido, money, sumarDias, waPedido } from '../util';
import { PAGOS_DESPACHO, aCobrarEnEntrega } from '../../shared/negocio.js';

const ORDEN = { en_camino: 0, listo: 1, produccion: 2, confirmado: 3, pendiente: 4, reservado: 4, entregado: 5 };

/**
 * Pantalla del repartidor (pensada para el celular): los envíos de un día, cómo llegar,
 * avisar al cliente por WhatsApp, cobrar y marcar la entrega. Lo cobrado entra en la caja.
 */
export default function Entregas() {
  const { perfil } = useAuth();
  const { pedidos, cargando } = useData();
  const [dia, setDia] = useState(hoy());
  const [entregar, setEntregar] = useState(null);
  const [fallo, setFallo] = useState(null);
  const [ocupado, correr] = useAccion();
  const lista = pedidos.filter((p) => p.entrega === dia && p.modoEntrega !== 'retiro' && p.estado !== 'cancelado')
    .sort((a, b) => (ORDEN[a.estado] ?? 9) - (ORDEN[b.estado] ?? 9) || (a.localidad || '').localeCompare(b.localidad || '') || (a.direccion || '').localeCompare(b.direccion || ''));
  const listos = lista.filter((p) => p.estado === 'listo');
  const hechos = lista.filter((p) => p.estado === 'entregado');
  const efectivo = hechos.filter((p) => (p.pagoCobrado || p.pago) === 'Efectivo').reduce((s, p) => s + (p.cobrado ?? 0), 0);
  const otros = hechos.filter((p) => p.cobrado > 0 && (p.pagoCobrado || p.pago) !== 'Efectivo').reduce((s, p) => s + p.cobrado, 0);
  const pendienteCobrar = lista.filter((p) => ['listo', 'en_camino'].includes(p.estado)).reduce((s, p) => s + aCobrarEnEntrega(p), 0);

  const salirTodos = () => correr(async () => {
    for (const p of listos) await api('pedido-estado', { id: p.id, accion: 'salir' });
    return listos.length;
  }, (n) => `${n === 1 ? 'Salió 1 pedido' : `Salieron ${n} pedidos`} a reparto. ¡Buen viaje!`);

  if (cargando) return <Cargando />;
  return (
    <div className="entregas">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="tabs" role="group" aria-label="Día de reparto">
          {[sumarDias(hoy(), -1), hoy(), manana()].map((d) => <button key={d} type="button" aria-pressed={d === dia} onClick={() => setDia(d)}>{dRel(d)}</button>)}
        </div>
        {listos.length > 0 && <button className="btn primary" disabled={ocupado} onClick={salirTodos}>Salgo a repartir ({listos.length})</button>}
      </div>

      <div className="kpis kpis-3">
        <div className="kpi"><span className="t">Entregados</span><span className="v num">{hechos.length}/{lista.length}</span><span className="s">{lista.length - hechos.length} por entregar</span></div>
        <div className="kpi"><span className="t">Efectivo cobrado</span><span className="v num">{money(efectivo)}</span><span className="s">{otros ? `+ ${money(otros)} por otros medios` : 'Se rinde en la caja del local'}</span></div>
        <div className="kpi"><span className="t">Falta cobrar</span><span className="v num">{money(pendienteCobrar)}</span><span className="s">en las entregas que quedan</span></div>
      </div>

      {!lista.length && <section className="card"><Vacio>No hay envíos para el {dLarga(dia)}.</Vacio></section>}
      <ol className="entregas-lista" aria-label={`Envíos del ${dLarga(dia)}`}>
        {lista.map((p, k) => {
          const cobrar = aCobrarEnEntrega(p);
          const activo = ['listo', 'en_camino'].includes(p.estado);
          const ultimo = p.intentos?.[p.intentos.length - 1];
          return (
            <li key={p.id} className={`card entrega ${p.estado === 'entregado' ? 'hecha' : ''}`}>
              <div className="entrega-cab">
                <span className="entrega-n" aria-hidden="true">{k + 1}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h2>{p.clienteNombre} <span className="muted small num">#{p.numero}</span></h2>
                  <div className="small">{p.direccion || 'Sin dirección'}{p.localidad ? ` · ${p.localidad}` : ''}</div>
                </div>
                <Pill e={estadoDe(p)} />
              </div>
              <div className="small muted">{p.items.map((i) => `${cant(i.cantidad, i.unidad)} ${i.nombre}`).join(' · ')}</div>
              {p.notas && <div className="small"><b>Nota:</b> {p.notas}</div>}
              {ultimo && p.estado !== 'entregado' && <div className="note warn small">No se pudo entregar ({ultimo.dia === hoy() ? 'hoy' : dLarga(ultimo.dia)}): {ultimo.motivo}</div>}
              <div className="entrega-cobro">
                {p.estado === 'entregado'
                  ? <span className="small">Entregado{p.entregadoPor ? ` por ${p.entregadoPor}` : ''}{p.cobrado != null ? ` · cobró ${money(p.cobrado)} (${p.pagoCobrado || p.pago})` : ''}</span>
                  : cobrar ? <span>Cobrar <b className="num">{money(cobrar)}</b> <span className="muted small">{p.pago}</span></span>
                    : <span className="small muted">No se cobra: {p.pago === 'Cuenta corriente' ? 'va a la cuenta corriente' : 'ya pagó por transferencia'}</span>}
              </div>
              <div className="row entrega-acciones">
                {p.direccion && <a className="btn sm" href={mapaPedido(p)} target="_blank" rel="noopener noreferrer">Cómo llegar</a>}
                {p.telefono && <a className="btn sm" href={`tel:${p.telefono.replace(/[^\d+]/g, '')}`}>Llamar</a>}
                <BotonWhatsApp href={activo ? waPedido(p, `Hola, soy ${perfil.nombre.split(' ')[0]}, el repartidor de El Sol Siciliano. Estoy llegando con tu pedido #${p.numero}.${cobrar ? ` Son ${money(cobrar)}.` : ''}`) : null}>Estoy llegando</BotonWhatsApp>
                {p.estado === 'listo' && <button className="btn sm" disabled={ocupado} onClick={() => correr(() => api('pedido-estado', { id: p.id, accion: 'salir' }), `Pedido #${p.numero} en camino`)}>Sale ahora</button>}
                {p.estado === 'en_camino' && <button className="btn sm ghost-bad" disabled={ocupado} onClick={() => setFallo(p)}>No pude entregar</button>}
                {activo && <button className="btn sm primary" disabled={ocupado} onClick={() => setEntregar(p)}>Entregado</button>}
              </div>
            </li>
          );
        })}
      </ol>
      {entregar && <EntregarModal p={entregar} onClose={() => setEntregar(null)} />}
      {fallo && <FalloModal p={fallo} onClose={() => setFallo(null)} />}
    </div>
  );
}

function EntregarModal({ p, onClose }) {
  const cc = p.pago === 'Cuenta corriente';
  const [monto, setMonto] = useState(String(aCobrarEnEntrega(p)));
  const [medio, setMedio] = useState(p.pago === 'Transferencia' ? 'Transferencia' : 'Efectivo');
  const [ocupado, correr] = useAccion();
  const ok = async () => {
    const r = await correr(() => api('pedido-estado', { id: p.id, accion: 'entregar', ...(cc ? {} : { cobrado: Math.round(Number(monto) || 0), medio }) }), `Pedido #${p.numero} entregado`);
    if (r) onClose();
  };
  return (
    <Modal titulo={`Entregar el pedido #${p.numero}`} onClose={onClose}>
      <p style={{ margin: 0 }}>{p.clienteNombre} · total del pedido <b className="num">{money(p.total)}</b></p>
      {cc ? <div className="note">Este pedido va a la cuenta corriente del comercio: no se cobra en la entrega.</div> : (
        <div className="fields2">
          <div className="field"><label htmlFor="en-m">¿Cuánto cobraste?</label><input id="en-m" type="number" min="0" inputMode="numeric" value={monto} onChange={(e) => setMonto(e.target.value)} /></div>
          <div className="field"><label htmlFor="en-p">Medio de pago</label><select id="en-p" value={medio} onChange={(e) => setMedio(e.target.value)}>{PAGOS_DESPACHO.map((x) => <option key={x}>{x}</option>)}</select></div>
        </div>
      )}
      {!cc && Number(monto) !== aCobrarEnEntrega(p) && <div className="note warn">Lo cobrado no coincide con lo que había que cobrar ({money(aCobrarEnEntrega(p))}). Queda registrado así.</div>}
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn" onClick={onClose}>Volver</button>
        <button className="btn primary" disabled={ocupado} onClick={ok}>Confirmar entrega</button>
      </div>
    </Modal>
  );
}

const MOTIVOS = ['No había nadie', 'El local estaba cerrado', 'Dirección equivocada', 'No quiso recibirlo'];
function FalloModal({ p, onClose }) {
  const [motivo, setMotivo] = useState(MOTIVOS[0]);
  const [otro, setOtro] = useState('');
  const [ocupado, correr] = useAccion();
  const ok = async () => {
    const r = await correr(() => api('pedido-estado', { id: p.id, accion: 'no-entregado', motivo: motivo === '_otro' ? otro : motivo }), 'Quedó registrado. El pedido vuelve a "listo".');
    if (r) onClose();
  };
  return (
    <Modal titulo={`No se pudo entregar el #${p.numero}`} onClose={onClose}>
      <fieldset className="radios"><legend className="small">¿Qué pasó?</legend>
        {[...MOTIVOS, '_otro'].map((m) => <label key={m}><input type="radio" name="motivo" checked={motivo === m} onChange={() => setMotivo(m)} /> {m === '_otro' ? 'Otro motivo' : m}</label>)}
      </fieldset>
      {motivo === '_otro' && <div className="field"><label htmlFor="nf-o">Contá qué pasó</label><input id="nf-o" type="text" value={otro} onChange={(e) => setOtro(e.target.value)} /></div>}
      <p className="muted small" style={{ margin: 0 }}>El pedido vuelve a "listo" para salir en otro viaje. Avisale al cliente por WhatsApp para coordinar.</p>
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <BotonWhatsApp href={waPedido(p, `Hola, somos de El Sol Siciliano. Pasamos con tu pedido #${p.numero} pero no pudimos entregarlo. ¿Cuándo te queda bien que volvamos?`)}>Avisar</BotonWhatsApp>
        <button className="btn" onClick={onClose}>Volver</button>
        <button className="btn primary" disabled={ocupado || (motivo === '_otro' && !otro.trim())} onClick={ok}>Registrar</button>
      </div>
    </Modal>
  );
}
