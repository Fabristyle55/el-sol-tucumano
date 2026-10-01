import { useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { useData } from '../data';
import { Modal, Stepper, useAccion } from '../ui';
import { ENTREGA_LABEL, TIPO_LABEL, manana, money } from '../util';
import { FORMAS_PAGO, MODOS_ENTREGA, precioPara } from '../../shared/negocio.js';

/**
 * Formulario de pedido.
 *  - modo "mostrador": el personal elige cliente y productos.
 *  - modo "web": el cliente confirma el carrito del catálogo.
 */
export default function PedidoModal({ modo, carrito, onClose, onCreado }) {
  const { perfil } = useAuth();
  const { productos, clientes } = useData();
  const [d, setD] = useState({
    clienteId: '_oc', ocasional: '', telefonoOcasional: '', direccionOcasional: '', tipoOcasional: 'minorista',
    entrega: manana(), pago: modo === 'web' ? 'Transferencia' : 'Efectivo',
    modoEntrega: modo === 'web' && perfil.tipoCliente === 'minorista' ? 'retiro' : 'envio',
    notas: '', confirmar: false, items: carrito || {},
  });
  const [error, setError] = useState('');
  const [ocupado, correr] = useAccion();
  const set = (k, v) => setD((x) => ({ ...x, [k]: v }));
  const activos = productos.filter((p) => p.activo !== false);
  const elegido = clientes.find((c) => c.id === d.clienteId);
  const tipo = modo === 'web' ? (perfil.tipoCliente || 'mayorista') : elegido ? (elegido.tipo || 'mayorista') : d.tipoOcasional;
  const precio = (pid) => precioPara(productos.find((p) => p.id === pid), tipo);
  const lineas = Object.entries(d.items).filter(([, q]) => q > 0);
  const total = lineas.reduce((a, [pid, q]) => a + q * precio(pid), 0);
  const mayoristas = clientes.filter((c) => (c.tipo || 'mayorista') === 'mayorista');
  const minoristas = clientes.filter((c) => c.tipo === 'minorista');

  async function guardar() {
    setError('');
    if (!lineas.length) { setError('Agregá al menos un producto.'); return; }
    if (modo === 'mostrador' && d.clienteId === '_oc' && !d.ocasional.trim()) { setError('Escribí a nombre de quién es el pedido.'); return; }
    if (modo === 'mostrador' && d.clienteId === '_oc' && d.modoEntrega === 'envio' && !d.direccionOcasional.trim()) { setError('Escribí la dirección de envío o elegí "Retira en el local".'); return; }
    if (!d.entrega || d.entrega < manana()) { setError('La entrega tiene que ser desde mañana.'); return; }
    const r = await correr(() => api('crear-pedido', {
      items: lineas.map(([productoId, cantidad]) => ({ productoId, cantidad })),
      entrega: d.entrega, pago: d.pago, notas: d.notas, modoEntrega: d.modoEntrega,
      ...(modo === 'mostrador' ? {
        clienteId: d.clienteId === '_oc' ? null : d.clienteId, ocasional: d.ocasional, confirmar: d.confirmar,
        tipoOcasional: d.tipoOcasional, telefonoOcasional: d.telefonoOcasional, direccionOcasional: d.direccionOcasional,
      } : {}),
    }), (x) => (modo === 'web' ? `Pedido #${x.numero} enviado. Te avisamos cuando se confirme.` : `Pedido #${x.numero} guardado como ${x.estado}.`));
    if (r) { onCreado?.(r); onClose(); }
  }

  return (
    <Modal titulo={modo === 'web' ? 'Confirmá tu pedido' : 'Cargar pedido'} onClose={onClose}>
      {modo === 'mostrador' && (
        <>
          <div className="fields2">
            <div className="field"><label htmlFor="d-cli">Cliente</label>
              <select id="d-cli" value={d.clienteId} onChange={(e) => set('clienteId', e.target.value)}>
                <option value="_oc">Cliente que no está registrado…</option>
                {mayoristas.length > 0 && <optgroup label="Mayoristas">{mayoristas.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}</optgroup>}
                {minoristas.length > 0 && <optgroup label="Minoristas">{minoristas.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}</optgroup>}
              </select></div>
            {d.clienteId === '_oc'
              ? <div className="field"><label htmlFor="d-tipo">Tipo de cliente</label><select id="d-tipo" value={d.tipoOcasional} onChange={(e) => set('tipoOcasional', e.target.value)}><option value="minorista">Minorista (particular)</option><option value="mayorista">Mayorista (comercio)</option></select></div>
              : <div className="field"><label>Cliente</label><div className="muted" style={{ padding: '8px 0' }}>{TIPO_LABEL[elegido?.tipo || 'mayorista']} · {elegido?.localidad || '—'}</div></div>}
          </div>
          {d.clienteId === '_oc' && (
            <div className="fields2">
              <div className="field"><label htmlFor="d-oc">Nombre</label><input id="d-oc" type="text" value={d.ocasional} onChange={(e) => set('ocasional', e.target.value)} placeholder="¿A nombre de quién?" /></div>
              <div className="field"><label htmlFor="d-tel">Teléfono</label><input id="d-tel" type="text" inputMode="tel" value={d.telefonoOcasional} onChange={(e) => set('telefonoOcasional', e.target.value)} placeholder="Para avisarle" /></div>
            </div>
          )}
          <div className="lines">
            {activos.map((p) => (
              <div className="line" key={p.id}>
                <span>{p.nombre} <span className="muted small num">{money(precio(p.id))}</span></span>
                <Stepper id={`dq-${p.id}`} value={d.items[p.id]} label={`Cantidad de ${p.nombre}`} onChange={(v) => set('items', { ...d.items, [p.id]: v })} />
              </div>
            ))}
          </div>
        </>
      )}
      {modo === 'web' && (
        <div className="lines">
          {lineas.map(([pid, q]) => {
            const p = productos.find((x) => x.id === pid);
            return <div className="line" key={pid}><span>{p?.nombre}</span><span className="num">{q} × {money(precio(pid))}</span></div>;
          })}
        </div>
      )}
      <div className="total"><span>Total <span className="muted small" style={{ fontFamily: 'var(--f-body)', fontWeight: 400 }}>precio {TIPO_LABEL[tipo].toLowerCase()}</span></span><span className="num">{money(total)}</span></div>
      <div className="field"><span style={{ fontSize: 13, fontWeight: 600 }}>Entrega</span>
        <div className="tabs" role="group" aria-label="Forma de entrega">{MODOS_ENTREGA.map((m) => <button type="button" key={m} aria-pressed={d.modoEntrega === m} onClick={() => set('modoEntrega', m)}>{ENTREGA_LABEL[m]}</button>)}</div>
      </div>
      {modo === 'mostrador' && d.clienteId === '_oc' && d.modoEntrega === 'envio' && (
        <div className="field"><label htmlFor="d-dir">Dirección de envío</label><input id="d-dir" type="text" value={d.direccionOcasional} onChange={(e) => set('direccionOcasional', e.target.value)} placeholder="Calle, número, referencia" /></div>
      )}
      <div className="fields2">
        <div className="field"><label htmlFor="d-ent">{d.modoEntrega === 'retiro' ? 'Fecha de retiro' : 'Fecha de entrega'}</label><input id="d-ent" type="date" min={manana()} value={d.entrega} onChange={(e) => set('entrega', e.target.value)} /></div>
        <div className="field"><label htmlFor="d-pago">Forma de pago</label><select id="d-pago" value={d.pago} onChange={(e) => set('pago', e.target.value)}>{FORMAS_PAGO.map((x) => <option key={x}>{x}</option>)}</select></div>
      </div>
      <div className="field"><label htmlFor="d-notas">Notas</label><textarea id="d-notas" rows={2} value={d.notas} onChange={(e) => set('notas', e.target.value)} placeholder="Horario de entrega, referencias…" /></div>
      {modo === 'mostrador' && perfil.rol === 'gerente' && (
        <label className="row small"><input type="checkbox" checked={d.confirmar} onChange={(e) => set('confirmar', e.target.checked)} /> Confirmarlo ahora</label>
      )}
      <p className="muted small" style={{ margin: 0 }}>
        {modo === 'web' ? <>Tu pedido queda <b>pendiente de confirmación</b>. El negocio lo revisa y te avisa.</> : 'Queda pendiente hasta que el gerente lo confirme.'}
      </p>
      {error && <div className="note bad">{error}</div>}
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn" type="button" onClick={onClose}>{modo === 'web' ? 'Seguir eligiendo' : 'Cerrar'}</button>
        <button className="btn primary" type="button" disabled={ocupado} onClick={guardar}>{ocupado ? 'Guardando…' : modo === 'web' ? 'Confirmar pedido' : 'Guardar pedido'}</button>
      </div>
    </Modal>
  );
}
