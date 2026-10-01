import { useState } from 'react';
import { useAuth } from '../auth';
import { useData } from '../data';
import { Cargando } from '../ui';
import { money } from '../util';
import { ImagenProducto } from '../components/Pan';
import { Estrellas, resumenOpiniones } from '../components/Estrellas';
import ImagenModal from '../components/ImagenModal';
import OpinionesModal from '../components/OpinionesModal';

const ETIQUETA = { foto: 'Foto', ia: 'Imagen con IA' };

export default function Productos() {
  const { perfil } = useAuth();
  const { productos, opiniones, cargando } = useData();
  const [imagen, setImagen] = useState(null);
  const [opinar, setOpinar] = useState(null);
  const res = resumenOpiniones(opiniones);
  if (cargando) return <Cargando />;

  return (
    <>
      <div className="cat">
        {productos.map((p) => {
          const r = res[p.id];
          return (
            <article className="prod" key={p.id}>
              <div className="ph">
                <ImagenProducto producto={p} />
                <span className="ph-tag">{p.imagen ? ETIQUETA[p.imagen.tipo] : 'Dibujo'}</span>
                {p.activo === false && <span className="ph-tag rojo">Pausado</span>}
              </div>
              <div className="in">
                <b>{p.nombre}</b>
                <span className="small muted num">{money(p.precio)} mayorista · {money(p.precioMinorista || p.precio)} minorista</span>
                <button type="button" className="rating-btn" onClick={() => setOpinar(p)}>
                  <Estrellas valor={r?.promedio || 0} cantidad={r?.n || 0} />
                </button>
                <button className="btn sm primary" onClick={() => setImagen(p)}>Cambiar imagen</button>
              </div>
            </article>
          );
        })}
      </div>
      <p className="muted small">{perfil.rol === 'gerente' ? 'Los precios y las recetas se editan en Recetas. ' : ''}Tocá las estrellas para ver las opiniones de los clientes.</p>
      {imagen && <ImagenModal producto={productos.find((x) => x.id === imagen.id) || imagen} onClose={() => setImagen(null)} />}
      {opinar && <OpinionesModal producto={opinar} onClose={() => setOpinar(null)} />}
    </>
  );
}
