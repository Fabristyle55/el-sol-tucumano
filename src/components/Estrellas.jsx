import { useState } from 'react';

const RUTA = 'M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.4l-5.8 3.1 1.1-6.5L2.6 9.4l6.5-.9z';

/** Estrellas de solo lectura (admite medias, por ejemplo 4,3). */
export function Estrellas({ valor = 0, tam = 16, cantidad }) {
  const pct = Math.max(0, Math.min(100, (valor / 5) * 100));
  return (
    <span className="estrellas" aria-label={`${valor.toLocaleString('es-AR', { maximumFractionDigits: 1 })} de 5 estrellas`} style={{ '--tam': `${tam}px` }}>
      <span className="estrellas-fondo">{[0, 1, 2, 3, 4].map((k) => <svg key={k} viewBox="0 0 24 24"><path d={RUTA} /></svg>)}</span>
      <span className="estrellas-llenas" style={{ width: `${pct}%` }}>{[0, 1, 2, 3, 4].map((k) => <svg key={k} viewBox="0 0 24 24"><path d={RUTA} /></svg>)}</span>
      {cantidad !== undefined && <span className="estrellas-n">({cantidad})</span>}
    </span>
  );
}

/** Selector de estrellas para opinar. */
export function ElegirEstrellas({ valor, onChange }) {
  const [hover, setHover] = useState(0);
  const mostrar = hover || valor;
  const textos = ['', 'Malo', 'Regular', 'Bueno', 'Muy bueno', 'Excelente'];
  return (
    <div className="elegir-estrellas" onMouseLeave={() => setHover(0)}>
      <div role="radiogroup" aria-label="Calificación">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={valor === n} aria-label={`${n} ${n === 1 ? 'estrella' : 'estrellas'}`}
            className={n <= mostrar ? 'on' : ''} style={{ '--i': n }} onMouseEnter={() => setHover(n)} onClick={() => onChange(n)}>
            <svg viewBox="0 0 24 24"><path d={RUTA} /></svg>
          </button>
        ))}
      </div>
      <span className="small muted">{textos[mostrar] || 'Tocá una estrella'}</span>
    </div>
  );
}

/** Promedio y cantidad de opiniones por producto. */
export function resumenOpiniones(opiniones) {
  const r = {};
  for (const o of opiniones) {
    const x = (r[o.productoId] ||= { suma: 0, n: 0 });
    x.suma += o.estrellas; x.n += 1;
  }
  for (const k of Object.keys(r)) r[k].promedio = r[k].suma / r[k].n;
  return r;
}
