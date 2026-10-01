import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../data';
import { useAuth } from '../auth';
import { precioPara } from '../../shared/negocio.js';
import { Stepper, Cargando } from '../ui';
import { abrev, money } from '../util';
import PedidoModal from '../components/PedidoModal';

export default function Catalogo() {
  const { productos, cargando } = useData();
  const { perfil } = useAuth();
  const tipo = perfil.tipoCliente || 'mayorista';
  const [carrito, setCarrito] = useState({});
  const [checkout, setCheckout] = useState(false);
  const nav = useNavigate();
  const activos = productos.filter((p) => p.activo !== false);
  const n = Object.values(carrito).reduce((a, b) => a + b, 0);
  const total = Object.entries(carrito).reduce((a, [pid, q]) => a + q * precioPara(productos.find((p) => p.id === pid), tipo), 0);

  if (cargando) return <Cargando />;
  return (
    <>
      <div className="cat">
        {activos.map((p) => (
          <article className="prod" key={p.id}>
            <div className="ph" aria-hidden="true"><span>{p.abrev || abrev(p.nombre)}</span></div>
            <div className="in">
              <b>{p.nombre}</b><span className="num" style={{ color: 'var(--brand)' }}>{money(precioPara(p, tipo))}</span>
              <Stepper id={`cq-${p.id}`} value={carrito[p.id]} label={`Cantidad de ${p.nombre}`} onChange={(v) => setCarrito({ ...carrito, [p.id]: v })} />
            </div>
          </article>
        ))}
      </div>
      <div className="cartbar">
        <div><div className="muted small">{n} {n === 1 ? 'producto' : 'productos'}</div><div className="num" style={{ fontWeight: 600, fontSize: 18 }}>{money(total)}</div></div>
        <button className="btn primary" disabled={!n} onClick={() => setCheckout(true)}>Ver pedido</button>
      </div>
      {checkout && <PedidoModal modo="web" carrito={carrito} onClose={() => setCheckout(false)} onCreado={() => { setCarrito({}); nav('/mis-pedidos'); }} />}
    </>
  );
}
