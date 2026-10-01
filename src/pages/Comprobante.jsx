import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useData } from '../data';
import { Vacio } from '../ui';
import { ENTREGA_LABEL, aFecha, cant, dLarga, estadoDe, money } from '../util';

const fechaHora = (ts) => { const d = aFecha(ts); return d ? new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d) : ''; };

/** Comprobante imprimible (se guarda como PDF desde el diálogo de impresión). */
export default function Comprobante() {
  const [params] = useSearchParams();
  const tipo = params.get('tipo') === 'venta' ? 'venta' : 'pedido';
  const id = params.get('id') || '';
  const { pedidos, ventas } = useData();
  const enMemoria = (tipo === 'venta' ? ventas : pedidos).find((x) => x.id === id);
  const [doc_, setDoc] = useState(enMemoria || null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (enMemoria) { setDoc(enMemoria); return; }
    if (!id) { setError(true); return; }
    getDoc(doc(db, tipo === 'venta' ? 'ventas' : 'pedidos', id))
      .then((s) => (s.exists() ? setDoc({ id: s.id, ...s.data() }) : setError(true)))
      .catch(() => setError(true));
  }, [id, tipo, enMemoria]);

  if (error) return <section className="card"><Vacio>No se encontró el comprobante, o no tenés permiso para verlo.</Vacio></section>;
  if (!doc_) return <section className="card"><Vacio>Cargando…</Vacio></section>;

  const x = doc_;
  const venta = tipo === 'venta';
  const minorista = !venta && x.tipoCliente === 'minorista';
  const titulo = venta ? 'Ticket de venta' : minorista ? 'Comprobante de reserva' : 'Remito de pedido';
  const items = x.items || [];
  const subtotal = (i) => i.subtotal ?? Math.round(i.cantidad * i.precio);

  return (
    <>
      <div className="row no-print" style={{ justifyContent: 'flex-end' }}>
        <button className="btn" onClick={() => window.close()}>Cerrar</button>
        <button className="btn primary" onClick={() => window.print()}>Descargar PDF o imprimir</button>
      </div>
      <p className="muted small no-print" style={{ margin: 0, textAlign: 'right' }}>En la ventana de impresión elegí "Guardar como PDF".</p>
      <article className={`comprobante ${venta ? 'ticket' : ''}`}>
        <header>
          <img src="/marca/logo.jpg" alt="Panificación El Sol Siciliano" />
          <div className="emisor"><b>Panificación El Sol Siciliano</b><span>Panadería · Tucumán, Argentina</span></div>
          <div className="nro"><span>{titulo}</span><b className="num">{venta ? `N.º ${String(x.numero || 0).padStart(6, '0')}` : `#${x.numero}`}</b><span className="num">{fechaHora(venta ? x.fecha : x.creado) || dLarga(x.entrega)}</span></div>
        </header>
        <div className="franja" />
        <section className="datos">
          {venta ? (
            <>
              <div><span className="lbl">Cliente</span><b>{x.cliente || 'Consumidor final'}</b></div>
              <div><span className="lbl">Atendió</span><b>{x.vendedor}</b></div>
              <div><span className="lbl">Forma de pago</span><b>{x.pago}</b></div>
            </>
          ) : (
            <>
              <div><span className="lbl">Cliente</span><b>{x.clienteNombre}</b>{x.direccion ? <span>{x.direccion}{x.localidad ? `, ${x.localidad}` : ''}</span> : null}{x.telefono ? <span>Tel. {x.telefono}</span> : null}</div>
              <div><span className="lbl">{x.modoEntrega === 'retiro' ? 'Retira' : 'Entrega'}</span><b>{dLarga(x.entrega)}</b><span>{ENTREGA_LABEL[x.modoEntrega || 'envio']}</span></div>
              <div><span className="lbl">Forma de pago</span><b>{x.pago}</b><span>Estado: {estadoDe(x)[0]}</span></div>
            </>
          )}
        </section>
        <table className="items">
          <thead><tr><th>Cant.</th><th>Producto</th><th className="r">Precio</th><th className="r">Subtotal</th></tr></thead>
          <tbody>{items.map((i, k) => (
            <tr key={k}><td className="num">{cant(i.cantidad, i.unidad)}</td><td>{i.nombre}{i.oferta ? <span className="small muted"> (oferta -{i.oferta} %)</span> : null}</td><td className="r num">{money(i.precio)}{i.unidad === 'kg' ? '/kg' : ''}</td><td className="r num">{money(subtotal(i))}</td></tr>
          ))}</tbody>
        </table>
        <div className="tot"><span>Total</span><b className="num">{money(x.total)}</b></div>
        {x.notas && !venta ? <p className="small">Nota: {x.notas}</p> : null}
        {x.anulada && <p className="anulada">VENTA ANULADA</p>}
        {!venta && !minorista && (
          <div className="firmas"><div><span />Recibí conforme (firma y aclaración)</div><div><span />Entregó</div></div>
        )}
        <footer>Documento no válido como factura · Gracias por elegirnos</footer>
      </article>
    </>
  );
}
