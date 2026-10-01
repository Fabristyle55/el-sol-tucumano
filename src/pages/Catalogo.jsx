import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../data';
import { useAuth } from '../auth';
import { precioPara, precioArticulo } from '../../shared/negocio.js';
import { Stepper, Cargando } from '../ui';
import { cant, money } from '../util';
import PedidoModal from '../components/PedidoModal';
import OpinionesModal from '../components/OpinionesModal';
import { ImagenProducto, ImagenArticulo } from '../components/Pan';
import { Estrellas, resumenOpiniones } from '../components/Estrellas';

/** Anima una copia de la imagen del producto "volando" hasta el carrito. */
function volarAlCarrito(origen, destino) {
  if (!origen || !destino || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return Promise.resolve();
  const a = origen.getBoundingClientRect();
  const b = destino.getBoundingClientRect();
  const clon = origen.cloneNode(true);
  clon.className = 'vuelo';
  Object.assign(clon.style, { left: `${a.left}px`, top: `${a.top}px`, width: `${a.width}px`, height: `${a.height}px` });
  document.body.appendChild(clon);
  const dx = b.left + 28 - (a.left + a.width / 2);
  const dy = b.top + b.height / 2 - (a.top + a.height / 2);
  const anim = clon.animate([
    { transform: 'translate(0,0) scale(1)', opacity: 1, borderRadius: '16px' },
    { transform: `translate(${dx * 0.45}px, ${dy * 0.45 - 90}px) scale(.55) rotate(-8deg)`, opacity: 1, offset: 0.5 },
    { transform: `translate(${dx}px, ${dy}px) scale(.12) rotate(10deg)`, opacity: 0.4, borderRadius: '50%' },
  ], { duration: 750, easing: 'cubic-bezier(.5,0,.3,1)' });
  return anim.finished.then(() => clon.remove(), () => clon.remove());
}

export default function Catalogo() {
  const { productos, productosPorId, articulos, opiniones, cargando } = useData();
  const { perfil } = useAuth();
  const tipo = perfil.tipoCliente || 'mayorista';
  const [carrito, setCarrito] = useState({});
  const [checkout, setCheckout] = useState(false);
  const [opinar, setOpinar] = useState(null);
  const [agregado, setAgregado] = useState(null);
  const [salto, setSalto] = useState(0);
  const barra = useRef();
  const fotos = useRef({});
  const nav = useNavigate();
  // Mayoristas ven los productos que se elaboran por pedido; minoristas, lo que hay en el despacho.
  const minorista = tipo === 'minorista';
  const activos = minorista ? articulos.filter((a) => a.activo !== false) : productos.filter((p) => p.activo !== false);
  const res = resumenOpiniones(opiniones);
  const precio = (x) => (minorista ? precioArticulo(x, productosPorId) : precioPara(x, tipo));
  const porId = Object.fromEntries(activos.map((x) => [x.id, x]));
  const n = Object.entries(carrito).filter(([id, q]) => porId[id] && q > 0).length;
  const total = Math.round(Object.entries(carrito).reduce((a, [id, q]) => a + (porId[id] ? q * precio(porId[id]) : 0), 0));

  const cambiar = (p, v) => {
    const antes = carrito[p.id] || 0;
    setCarrito({ ...carrito, [p.id]: v });
    if (v > antes) {
      setAgregado(p.id);
      setTimeout(() => setAgregado((x) => (x === p.id ? null : x)), 1100);
      volarAlCarrito(fotos.current[p.id], barra.current).then(() => setSalto((s) => s + 1));
    }
  };

  if (cargando) return <Cargando />;
  return (
    <>
      <div className="cat">
        {activos.map((p) => {
          const prodRef = minorista ? (p.productoId ? productosPorId[p.productoId] : null) : p;
          const r = prodRef ? res[prodRef.id] : null;
          const q = carrito[p.id] || 0;
          const kg = p.unidad === 'kg';
          const sinStock = minorista && (p.stock || 0) <= 0;
          return (
            <article className={`prod ${agregado === p.id ? 'agregado' : ''} ${sinStock ? 'agotado' : ''}`} key={p.id}>
              <div className="ph" ref={(el) => { fotos.current[p.id] = el; }}>
                {minorista ? <ImagenArticulo articulo={p} productosPorId={productosPorId} /> : <ImagenProducto producto={p} />}
                {q > 0 && <span className="ph-cant" key={q}>{cant(q, p.unidad)}</span>}
                {minorista && <span className={`ph-tag ${sinStock ? 'rojo' : ''}`}>{sinStock ? 'Sin stock' : `Hay ${cant(p.stock, p.unidad)}`}</span>}
              </div>
              <div className="in">
                <b>{p.nombre}</b>
                {prodRef
                  ? <button type="button" className="rating-btn" onClick={() => setOpinar(prodRef)} title="Ver opiniones"><Estrellas valor={r?.promedio || 0} cantidad={r?.n || 0} /></button>
                  : <span className="small muted">{p.categoria}</span>}
                <div className="prod-pie">
                  <span className="num precio">{money(precio(p))}{kg ? '/kg' : ''}</span>
                  {q === 0
                    ? <button className="btn sm primary agregar" disabled={sinStock} onClick={() => cambiar(p, kg ? 0.25 : 1)}>{sinStock ? 'Agotado' : 'Agregar'}</button>
                    : <Stepper id={`cq-${p.id}`} value={q} paso={kg ? 0.25 : 1} max={minorista ? p.stock : undefined} label={`Cantidad de ${p.nombre}`} onChange={(v) => cambiar(p, v)} />}
                </div>
                {agregado === p.id && <span className="ok-agregado">✓ Agregado {minorista ? 'a la reserva' : 'al pedido'}</span>}
              </div>
            </article>
          );
        })}
      </div>
      <div className="cartbar" ref={barra}>
        <div className="row" style={{ gap: 12 }}>
          <span className="carrito-ic" key={salto} aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6" /><circle cx="10" cy="20" r="1.4" /><circle cx="17" cy="20" r="1.4" /></svg>
            {n > 0 && <i>{n}</i>}
          </span>
          <div><div className="muted small">{n} {n === 1 ? 'artículo' : 'artículos'}{minorista ? ' · retirás en el despacho' : ''}</div><div className="num" style={{ fontWeight: 700, fontSize: 18 }}>{money(total)}</div></div>
        </div>
        <button className="btn primary" disabled={!n} onClick={() => setCheckout(true)}>{minorista ? 'Ver reserva' : 'Ver pedido'}</button>
      </div>
      {checkout && <PedidoModal modo="web" carrito={carrito} onClose={() => setCheckout(false)} onCreado={() => { setCarrito({}); nav('/mis-pedidos'); }} />}
      {opinar && <OpinionesModal producto={opinar} onClose={() => setOpinar(null)} />}
    </>
  );
}
