import { useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { useData } from '../data';
import { Modal, Stepper, useAccion } from '../ui';
import { ENTREGA_LABEL, TIPO_LABEL, cant, hoy, manana, money } from '../util';
import { FORMAS_PAGO, MODOS_ENTREGA, PAGOS_DESPACHO, estadoCuenta, idArticulo, precioPara, precioArticulo, r3 } from '../../shared/negocio.js';

/**
 * Formulario de pedido.
 *  - modo "mostrador": el personal elige cliente y productos.
 *  - modo "web": el cliente confirma el carrito del catálogo.
 * Mayoristas: productos elaborados por pedido; el gerente confirma.
 * Minoristas: artículos del despacho; queda "reservado" sin autorización.
 */
/** Ítems de un pedido anterior para repetirlo: { productoId | articuloId: cantidad }. */
const itemsDe = (p) => Object.fromEntries((p?.items || []).map((i) => [p.tipoCliente === 'minorista' ? (i.articuloId || idArticulo(i.productoId)) : i.productoId, i.cantidad]));

export default function PedidoModal({ modo, carrito, onClose, onCreado, tipoInicial = 'mayorista', inicial = null }) {
  const { perfil } = useAuth();
  const { productos, productosPorId, clientes, articulos, miCliente } = useData();
  const registrado = inicial?.clienteId && clientes.some((c) => c.id === inicial.clienteId);
  const [d, setD] = useState({
    clienteId: registrado ? inicial.clienteId : '_oc', ocasional: registrado ? '' : (inicial?.clienteNombre || ''), telefonoOcasional: inicial?.telefono || '', direccionOcasional: inicial?.direccion || '', tipoOcasional: tipoInicial === 'minorista' ? 'minorista' : 'mayorista',
    entrega: modo === 'web' && perfil.tipoCliente === 'minorista' ? hoy() : (tipoInicial === 'minorista' ? hoy() : manana()),
    pago: inicial?.pago || (modo === 'web' ? 'Transferencia' : 'Efectivo'),
    modoEntrega: (modo === 'web' && perfil.tipoCliente === 'minorista') || tipoInicial === 'minorista' ? 'retiro' : 'envio',
    notas: '', confirmar: false, items: carrito || (inicial ? itemsDe(inicial) : {}),
  });
  const [error, setError] = useState('');
  const [ocupado, correr] = useAccion();
  const set = (k, v) => setD((x) => ({ ...x, [k]: v }));
  const elegido = clientes.find((c) => c.id === d.clienteId);
  const tipo = modo === 'web' ? (perfil.tipoCliente || 'mayorista') : elegido ? (elegido.tipo || 'mayorista') : d.tipoOcasional;
  const minorista = tipo === 'minorista';
  const porArt = Object.fromEntries(articulos.map((a) => [a.id, a]));
  const precio = (id) => (minorista ? precioArticulo(porArt[id], productosPorId) : precioPara(productos.find((p) => p.id === id), tipo));
  const nombre = (id) => (minorista ? porArt[id]?.nombre : productos.find((p) => p.id === id)?.nombre);
  const lineas = Object.entries(d.items).filter(([id, q]) => q > 0 && (minorista ? porArt[id] : true));
  const total = Math.round(lineas.reduce((a, [id, q]) => a + q * precio(id), 0));
  const mayoristas = clientes.filter((c) => (c.tipo || 'mayorista') === 'mayorista');
  const minoristas = clientes.filter((c) => c.tipo === 'minorista');
  const minFecha = minorista ? hoy() : manana();
  // Cuenta corriente: solo comercios mayoristas registrados.
  const fichaCliente = modo === 'web' ? miCliente : elegido;
  const conCuenta = !minorista && !!fichaCliente;
  const pagos = minorista ? PAGOS_DESPACHO : FORMAS_PAGO.filter((x) => x !== 'Cuenta corriente' || conCuenta);
  const cuenta = conCuenta ? estadoCuenta(fichaCliente, hoy()) : null;
  const pagoSel = pagos.includes(d.pago) ? d.pago : pagos[0];

  // Al cambiar de tipo de cliente se vacía la lista (mayoristas eligen productos; minoristas, artículos del despacho)
  const cambiarCliente = (patch) => setD((x) => {
    const n = { ...x, ...patch };
    const el = clientes.find((c) => c.id === n.clienteId);
    const t = el ? (el.tipo || 'mayorista') : n.tipoOcasional;
    if (t !== tipo) { n.items = {}; n.modoEntrega = t === 'minorista' ? 'retiro' : 'envio'; n.entrega = t === 'minorista' ? hoy() : manana(); }
    return n;
  });

  async function guardar() {
    setError('');
    if (!lineas.length) { setError('Agregá al menos un producto.'); return; }
    if (modo === 'mostrador' && d.clienteId === '_oc' && !d.ocasional.trim()) { setError('Escribí a nombre de quién es el pedido.'); return; }
    if (modo === 'mostrador' && d.clienteId === '_oc' && d.modoEntrega === 'envio' && !d.direccionOcasional.trim()) { setError('Escribí la dirección de envío o elegí "Retira en el local".'); return; }
    if (!d.entrega || d.entrega < minFecha) { setError(minorista ? 'La fecha de retiro no puede ser anterior a hoy.' : 'La entrega tiene que ser desde mañana.'); return; }
    const r = await correr(() => api('crear-pedido', {
      items: lineas.map(([id, cantidad]) => (minorista ? { articuloId: id, cantidad } : { productoId: id, cantidad })),
      entrega: d.entrega, pago: pagoSel, notas: d.notas, modoEntrega: d.modoEntrega,
      ...(modo === 'mostrador' ? {
        clienteId: d.clienteId === '_oc' ? null : d.clienteId, ocasional: d.ocasional, confirmar: d.confirmar,
        tipoOcasional: d.tipoOcasional, telefonoOcasional: d.telefonoOcasional, direccionOcasional: d.direccionOcasional,
      } : {}),
    }), (x) => (x.estado === 'reservado'
      ? (modo === 'web' ? `Reserva #${x.numero} lista. Te esperamos en el despacho.` : `Reserva #${x.numero} cargada.`)
      : (modo === 'web' ? `Pedido #${x.numero} enviado. Te avisamos cuando se confirme.` : `Pedido #${x.numero} guardado como ${x.estado}.`)));
    if (r) { onCreado?.(r); onClose(); }
  }

  const disponibles = articulos.filter((a) => a.activo !== false);
  return (
    <Modal titulo={modo === 'web' ? (minorista ? 'Confirmá tu reserva' : 'Confirmá tu pedido') : (minorista ? 'Cargar reserva minorista' : 'Cargar pedido')} onClose={onClose}>
      {modo === 'mostrador' && (
        <>
          <div className="fields2">
            <div className="field"><label htmlFor="d-cli">Cliente</label>
              <select id="d-cli" value={d.clienteId} onChange={(e) => cambiarCliente({ clienteId: e.target.value })}>
                <option value="_oc">Cliente que no está registrado…</option>
                {mayoristas.length > 0 && <optgroup label="Mayoristas">{mayoristas.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}</optgroup>}
                {minoristas.length > 0 && <optgroup label="Minoristas">{minoristas.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}</optgroup>}
              </select></div>
            {d.clienteId === '_oc'
              ? <div className="field"><label htmlFor="d-tipo">Tipo de cliente</label><select id="d-tipo" value={d.tipoOcasional} onChange={(e) => cambiarCliente({ tipoOcasional: e.target.value })}><option value="minorista">Minorista (particular)</option><option value="mayorista">Mayorista (comercio)</option></select></div>
              : <div className="field"><label>Cliente</label><div className="muted" style={{ padding: '8px 0' }}>{TIPO_LABEL[elegido?.tipo || 'mayorista']} · {elegido?.localidad || '—'}</div></div>}
          </div>
          {d.clienteId === '_oc' && (
            <div className="fields2">
              <div className="field"><label htmlFor="d-oc">Nombre</label><input id="d-oc" type="text" value={d.ocasional} onChange={(e) => set('ocasional', e.target.value)} placeholder="¿A nombre de quién?" /></div>
              <div className="field"><label htmlFor="d-tel">Teléfono</label><input id="d-tel" type="text" inputMode="tel" value={d.telefonoOcasional} onChange={(e) => set('telefonoOcasional', e.target.value)} placeholder="Para avisarle" /></div>
            </div>
          )}
          {minorista && <div className="note">Las reservas minoristas salen de lo que hay en el despacho y no necesitan que el gerente las confirme.</div>}
          <div className="lines">
            {minorista
              ? disponibles.map((a) => {
                const kg = a.unidad === 'kg';
                return (
                  <div className="line" key={a.id}>
                    <span>{a.nombre} <span className="muted small num">{money(precioArticulo(a, productosPorId))}{kg ? '/kg' : ''} · hay {cant(a.stock || 0, a.unidad)}</span></span>
                    <Stepper id={`dq-${a.id}`} value={d.items[a.id]} paso={kg ? 0.25 : 1} max={a.stock || 0} label={`Cantidad de ${a.nombre}`}
                      onChange={(v) => set('items', { ...d.items, [a.id]: kg ? r3(v) : v })} />
                  </div>
                );
              })
              : productos.filter((p) => p.activo !== false).map((p) => (
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
          {lineas.map(([id, q]) => <div className="line" key={id}><span>{nombre(id)}</span><span className="num">{cant(q, porArt[id]?.unidad)} × {money(precio(id))}</span></div>)}
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
        <div className="field"><label htmlFor="d-ent">{d.modoEntrega === 'retiro' ? 'Fecha de retiro' : 'Fecha de entrega'}</label><input id="d-ent" type="date" min={minFecha} value={d.entrega} onChange={(e) => set('entrega', e.target.value)} /></div>
        <div className="field"><label htmlFor="d-pago">Forma de pago</label><select id="d-pago" value={pagoSel} onChange={(e) => set('pago', e.target.value)}>{pagos.map((x) => <option key={x}>{x}</option>)}</select></div>
      </div>
      <div className="field"><label htmlFor="d-notas">Notas</label><textarea id="d-notas" rows={2} value={d.notas} onChange={(e) => set('notas', e.target.value)} placeholder={minorista ? 'Horario en que pasa a retirar…' : 'Horario de entrega, referencias…'} /></div>
      {modo === 'mostrador' && perfil.rol === 'gerente' && !minorista && (
        <label className="row small"><input type="checkbox" checked={d.confirmar} onChange={(e) => set('confirmar', e.target.checked)} /> Confirmarlo ahora</label>
      )}
      <p className="muted small" style={{ margin: 0 }}>
        {minorista
          ? (modo === 'web' ? <>Tu reserva queda lista; la preparamos con lo que hay en el despacho. <b>No hace falta esperar confirmación.</b></> : 'Queda reservada para retirar; la preparás desde Despacho → Reservas.')
          : (modo === 'web' ? <>Tu pedido queda <b>pendiente de confirmación</b>. El negocio lo revisa y te avisa.</> : 'Queda pendiente hasta que el gerente lo confirme.')}
      </p>
      {pagoSel === 'Cuenta corriente' && cuenta && cuenta.saldo > 0 && (
        <div className={`note ${cuenta.estado === 'vencida' ? 'bad' : 'warn'}`}>
          {modo === 'web' ? 'Tu cuenta corriente' : 'La cuenta corriente de este cliente'} tiene un saldo de <b className="num">{money(cuenta.saldo)}</b>{cuenta.estado === 'vencida' ? ` vencido hace ${cuenta.dias - cuenta.plazo} días${modo === 'web' ? '. Elegí otra forma de pago o comunicate con el local.' : '.'}` : '.'}
        </div>
      )}
      {error && <div className="note bad">{error}</div>}
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn" type="button" onClick={onClose}>{modo === 'web' ? 'Seguir eligiendo' : 'Cerrar'}</button>
        <button className="btn primary" type="button" disabled={ocupado} onClick={guardar}>{ocupado ? 'Guardando…' : modo === 'web' ? (minorista ? 'Reservar' : 'Confirmar pedido') : (minorista ? 'Guardar reserva' : 'Guardar pedido')}</button>
      </div>
    </Modal>
  );
}
