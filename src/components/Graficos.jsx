import { useState } from 'react';

/**
 * Barras apiladas por día con tooltip al pasar el mouse (o tocar en el celular).
 * datos: [{ x: 'AAAA-MM-DD', etiqueta, valores: [n, n…] }] · series: [{ nombre, color }]
 */
export function BarrasApiladas({ datos, series, formato = (n) => n, alto = 220, titulo, marcarCada = 5 }) {
  const [hover, setHover] = useState(null);
  const W = 640; const H = alto; const L = 54; const B = 24; const T = 12;
  const max = Math.max(1, ...datos.map((d) => d.valores.reduce((a, b) => a + b, 0)));
  const paso = escala(max); const top = Math.ceil(max / paso) * paso;
  const y = (v) => H - B - (v / top) * (H - B - T);
  const bw = (W - L) / datos.length;
  const ancho = Math.max(2, bw - 3);
  const h = hover != null ? datos[hover] : null;
  return (
    <div className="graf" onMouseLeave={() => setHover(null)}>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={titulo}>
        {[0, 1, 2, 3, 4].map((k) => { const v = (top * k) / 4; return <g key={k}><line x1={L} x2={W} y1={y(v)} y2={y(v)} stroke="var(--line)" /><text x={L - 6} y={y(v) + 4} textAnchor="end">{corto(v)}</text></g>; })}
        {datos.map((d, i) => {
          let acc = 0;
          const x = L + i * bw + (bw - ancho) / 2;
          return (
            <g key={d.x} opacity={hover == null || hover === i ? 1 : 0.45}>
              {d.valores.map((v, s) => {
                if (!v) return null;
                const y0 = y(acc); acc += v; const y1 = y(acc);
                return <rect key={s} x={x} y={y1} width={ancho} height={Math.max(0, y0 - y1 - (acc > v ? 1 : 0))} fill={series[s].color} rx={ancho > 6 ? 2 : 1} />;
              })}
              {(i % marcarCada === datos.length % marcarCada || i === datos.length - 1) && <text x={x + ancho / 2} y={H - 6} textAnchor="middle">{d.etiqueta}</text>}
              <rect x={L + i * bw} y={T} width={bw} height={H - B - T} fill="transparent" onMouseEnter={() => setHover(i)} onClick={() => setHover(i)} />
            </g>
          );
        })}
      </svg>
      {h && (
        <div className="graf-tip" style={{ left: `${((L + (hover + 0.5) * bw) / W) * 100}%` }} role="status">
          <b>{h.titulo || h.etiqueta}</b>
          {series.map((s, k) => <div key={s.nombre}><i style={{ background: s.color }} />{s.nombre}<span className="num">{formato(h.valores[k])}</span></div>)}
          {series.length > 1 && <div className="graf-tot">Total<span className="num">{formato(h.valores.reduce((a, b) => a + b, 0))}</span></div>}
        </div>
      )}
    </div>
  );
}

/** Ranking en barras horizontales. filas: [{ nombre, valor, detalle, color? }] */
export function BarrasH({ filas, formato = (n) => n, max: maxFijo }) {
  const max = maxFijo || Math.max(1, ...filas.map((f) => Math.abs(f.valor)));
  return (
    <div className="barras-h">
      {filas.map((f) => (
        <div className="bh" key={f.nombre} title={f.detalle || undefined}>
          <div className="bh-t"><span>{f.nombre}</span><span className="num">{formato(f.valor)}</span></div>
          <div className="bh-bar"><i style={{ width: `${Math.max(1.5, (Math.abs(f.valor) / max) * 100)}%`, background: f.color || 'var(--verde)' }} /></div>
          {f.detalle && <div className="bh-d muted small">{f.detalle}</div>}
        </div>
      ))}
    </div>
  );
}

function escala(max) {
  const bruto = max / 4; const p = 10 ** Math.floor(Math.log10(bruto));
  return [1, 2, 2.5, 5, 10].map((m) => m * p).find((x) => x >= bruto);
}
const corto = (v) => (v >= 1e6 ? `${(v / 1e6).toLocaleString('es-AR', { maximumFractionDigits: 1 })}M` : v >= 1e3 ? `${Math.round(v / 1e3)}k` : `${v}`);
